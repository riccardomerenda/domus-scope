import { describe, expect, it } from "vitest";
import {
  defaultEngineConfig,
  italianPurchaseCostItems,
  resolveCostItems,
  scenarioInputSchema,
  simulate,
  type CostItem,
  type EngineConfig,
} from "../src";

/**
 * Focused coverage for the cost-resolution engine, the Italian preset
 * regimes, and the hold-basis simulate path (Phase 12 test-gap closure —
 * previously only exercised indirectly through one snapshot).
 */

const ctx = {
  horizonYears: 3,
  // Value grows 10%/year from 100k; rent grows from 12k by 5%/year.
  propertyValueStartOfYear: (t: number) => 100_000 * Math.pow(1.1, t - 1),
  annualRentAt: (t: number) => 12_000 * Math.pow(1.05, t - 1),
  cadastralValue: null,
};

function recurring(base: CostItem["timing"], overrides: Partial<CostItem> = {}): CostItem {
  return {
    id: "x",
    label: "X",
    scenario: "buy",
    timing: base,
    recoverability: { kind: "none" },
    sign: "cost",
    enabled: true,
    notes: "",
    ...overrides,
  };
}

describe("cost-item resolution semantics (§4)", () => {
  it("percentOfValue follows the start-of-year value", () => {
    const item = recurring({
      kind: "recurring",
      base: { kind: "percentOfValue", rate: 0.01 },
      growth: { kind: "rate", rate: 0.99 }, // ignored for percent bases
    });
    const { recurring: series } = resolveCostItems([item], "buy", ctx);
    expect(series[0]!.annual[0]).toBeCloseTo(1_000, 9);
    expect(series[0]!.annual[1]).toBeCloseTo(1_100, 9);
    expect(series[0]!.annual[2]).toBeCloseTo(1_210, 9);
  });

  it("fixedAnnual with tracksValue growth scales with the value curve", () => {
    const item = recurring({
      kind: "recurring",
      base: { kind: "fixedAnnual", amount: 500 },
      growth: { kind: "tracksValue" },
    });
    const { recurring: series } = resolveCostItems([item], "buy", ctx);
    expect(series[0]!.annual[0]).toBeCloseTo(500, 9);
    expect(series[0]!.annual[1]).toBeCloseTo(550, 9);
    expect(series[0]!.annual[2]).toBeCloseTo(605, 9);
  });

  it("fixedAnnual with tracksRent growth scales with the rent curve", () => {
    const item = recurring({
      kind: "recurring",
      base: { kind: "fixedAnnual", amount: 200 },
      growth: { kind: "tracksRent" },
    });
    const { recurring: series } = resolveCostItems([item], "buy", ctx);
    expect(series[0]!.annual[1]).toBeCloseTo(210, 9);
  });

  it("drops one-time events beyond the horizon", () => {
    const inside = recurring({ kind: "oneTime", month: 36, amount: 1_000 }, { id: "in" });
    const beyond = recurring({ kind: "oneTime", month: 37, amount: 1_000 }, { id: "out" });
    const { oneTime } = resolveCostItems([inside, beyond], "buy", ctx);
    expect(oneTime.map((event) => event.itemId)).toEqual(["in"]);
  });

  it("splits partial recoverability into unrecoverable + recoverable exactly", () => {
    const item = recurring(
      { kind: "oneTime", month: 0, amount: 30_000 },
      { recoverability: { kind: "partial", share: 0.4 } },
    );
    const { oneTime } = resolveCostItems([item], "buy", ctx);
    expect(oneTime[0]!.recoverable).toBeCloseTo(12_000, 9);
    expect(oneTime[0]!.unrecoverable).toBeCloseTo(18_000, 9);
    expect(oneTime[0]!.recoverable + oneTime[0]!.unrecoverable).toBeCloseTo(
      oneTime[0]!.amount,
      9,
    );
  });

  it("credits produce negative amounts; disabled and other-side items are skipped", () => {
    const credit = recurring(
      { kind: "oneTime", month: 0, amount: 1_000 },
      { id: "credit", sign: "credit" },
    );
    const disabled = recurring({ kind: "oneTime", month: 0, amount: 1 }, {
      id: "off",
      enabled: false,
    });
    const rentSide = recurring({ kind: "oneTime", month: 0, amount: 1 }, {
      id: "rent",
      scenario: "rent",
    });
    const { oneTime } = resolveCostItems([credit, disabled, rentSide], "buy", ctx);
    expect(oneTime).toHaveLength(1);
    expect(oneTime[0]!.amount).toBe(-1_000);
  });
});

describe("Italian preset regimes (G1/G2)", () => {
  it("newBuildPrimary: 4% VAT + fixed taxes, no registration tax", () => {
    const items = italianPurchaseCostItems({
      propertyPrice: 300_000,
      cadastralValue: 90_000,
      regime: "newBuildPrimary",
    });
    const vat = items.find((item) => item.id === "it-vat-new-build");
    expect(vat).toBeDefined();
    expect(vat!.timing.kind === "oneTime" && vat!.timing.amount).toBe(300_000 * 0.04 + 600);
    expect(items.some((item) => item.id === "it-registration-tax")).toBe(false);
    expect(items.some((item) => item.id === "it-imu")).toBe(false);
  });

  it("applies the 1,000 € registration-tax minimum floor", () => {
    const items = italianPurchaseCostItems({
      propertyPrice: 40_000,
      cadastralValue: 20_000, // 2% → 400 €, below the floor
      regime: "primaryExisting",
    });
    const registration = items.find((item) => item.id === "it-registration-tax");
    expect(registration!.timing.kind === "oneTime" && registration!.timing.amount).toBe(1_000);
  });

  it("switches the imposta sostitutiva between primary (0.25%) and other (2%)", () => {
    const primary = italianPurchaseCostItems({
      propertyPrice: 200_000,
      mortgagePrincipal: 160_000,
      regime: "primaryExisting",
    }).find((item) => item.id === "it-mortgage-tax");
    const other = italianPurchaseCostItems({
      propertyPrice: 200_000,
      mortgagePrincipal: 160_000,
      regime: "otherExisting",
    }).find((item) => item.id === "it-mortgage-tax");
    expect(primary!.timing.kind === "oneTime" && primary!.timing.amount).toBe(160_000 * 0.0025);
    expect(other!.timing.kind === "oneTime" && other!.timing.amount).toBe(160_000 * 0.02);
  });
});

describe("hold-basis simulate path (BR-013 toggle)", () => {
  const holdConfig: EngineConfig = {
    ...defaultEngineConfig,
    toggles: { ...defaultEngineConfig.toggles, liquidationBasis: false },
  };
  const input = scenarioInputSchema.parse({
    id: "hold",
    title: "Hold basis",
    property: { price: 200_000 },
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
  });
  const hold = simulate(input, holdConfig);
  const liquidation = simulate(input);

  it("reports the hold advantage in the summary", () => {
    expect(hold.summary.basis).toBe("hold");
    expect(hold.summary.advantageAtHorizon).toBe(
      hold.wealthLens.years.at(-1)!.advantageHold,
    );
    // Hold ignores selling costs → more favorable to buying than liquidation.
    expect(hold.summary.advantageAtHorizon).toBeGreaterThan(
      liquidation.summary.advantageAtHorizon,
    );
  });

  it("still exposes all four break-evens regardless of basis", () => {
    expect(hold.breakEvens.costHold).toBe(liquidation.breakEvens.costHold);
    expect(hold.breakEvens.wealthLiquidation).toBe(liquidation.breakEvens.wealthLiquidation);
  });
});
