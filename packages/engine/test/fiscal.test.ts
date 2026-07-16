import { describe, expect, it } from "vitest";
import {
  defaultEngineConfig,
  italianPurchaseCostItems,
  resolveCostItems,
  scenarioInputSchema,
  simulate,
  type EngineConfig,
  type ScenarioInput,
} from "../src";

/**
 * Phase 11 (G13/G14/G15): Italian fiscal modeling that can move the verdict —
 * plusvalenza on early non-primary sales, the renovation tax credit, and IMU
 * on the cadastral base.
 */

function scenario(overrides: Record<string, unknown> = {}): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "fiscal",
    title: "Fiscal reference",
    property: { price: 200_000 },
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
    ...overrides,
  });
}

describe("plusvalenza on early non-primary sales (G15)", () => {
  const primary = simulate(scenario());

  it("defaults primaryResidence to true — pre-Phase-11 inputs are exempt", () => {
    expect(scenario().property.primaryResidence).toBe(true);
    // Composition never contains the gains-tax line for a primary residence.
    const ids = primary.wealthLens.buyCompositionAtHorizon.items.map((item) => item.id);
    expect(ids).not.toContain("wealth.buy.propertyGainsTax");
  });

  it("taxes the liquidation wealth only in years 1–4", () => {
    // primary vs second home: identical except for years hit by the tax.
    // (Interest deduction also differs — compare with deduction disabled.)
    // 5% appreciation so the net-of-selling-costs gain is positive from year 1
    // (at the default 1.5%, selling costs eat the gain until year 3).
    const noDeduction: EngineConfig = {
      ...defaultEngineConfig,
      toggles: { ...defaultEngineConfig.toggles, mortgageInterestDeduction: false },
    };
    const fast = { homeAppreciation: 0.05 };
    const primaryClean = simulate(scenario({ assumptions: fast }), noDeduction);
    const secondClean = simulate(
      scenario({ property: { price: 200_000, primaryResidence: false }, assumptions: fast }),
      noDeduction,
    );
    for (const year of secondClean.wealthLens.years) {
      const primaryYear = primaryClean.wealthLens.years[year.year - 1]!;
      if (year.year < 5) {
        expect(year.wealthBuyLiquidation).toBeLessThan(primaryYear.wealthBuyLiquidation);
      } else {
        expect(year.wealthBuyLiquidation).toBeCloseTo(primaryYear.wealthBuyLiquidation, 6);
      }
      // Hold basis never carries the hypothetical-sale tax.
      expect(year.wealthBuyHold).toBeCloseTo(primaryYear.wealthBuyHold, 6);
    }
  });

  it("mirrors the tax in the cost lens's liquidation cumulative", () => {
    const fast = { homeAppreciation: 0.05 };
    const primaryFast = simulate(scenario({ assumptions: fast }));
    const secondFast = simulate(
      scenario({ property: { price: 200_000, primaryResidence: false }, assumptions: fast }),
    );
    for (const year of secondFast.costLens.years) {
      const primaryYear = primaryFast.costLens.years[year.year - 1]!;
      const taxDelta =
        year.cumulativeBuyLiquidation -
        year.cumulativeBuyHold -
        (primaryYear.cumulativeBuyLiquidation - primaryYear.cumulativeBuyHold);
      if (year.year < 5) expect(taxDelta).toBeGreaterThan(0);
      else expect(taxDelta).toBeCloseTo(0, 6);
    }
  });

  it("floors the gain at zero when the property loses value", () => {
    // Deduction off so primary vs non-primary differ only by the gains tax.
    const noDeduction: EngineConfig = {
      ...defaultEngineConfig,
      toggles: { ...defaultEngineConfig.toggles, mortgageInterestDeduction: false },
    };
    const losing = simulate(
      scenario({
        property: { price: 200_000, primaryResidence: false },
        assumptions: { homeAppreciation: -0.05 },
      }),
      noDeduction,
    );
    const reference = simulate(scenario({ assumptions: { homeAppreciation: -0.05 } }), noDeduction);
    // Depreciating home: no gain, so no tax — the two runs are identical.
    for (const year of losing.wealthLens.years) {
      expect(year.wealthBuyLiquidation).toBeCloseTo(
        reference.wealthLens.years[year.year - 1]!.wealthBuyLiquidation,
        6,
      );
    }
  });

  it("shows the tax as a traced composition line at a short horizon", () => {
    const shortHorizon = simulate(
      scenario({ property: { price: 200_000, primaryResidence: false }, horizonYears: 3 }),
    );
    const line = shortHorizon.wealthLens.buyCompositionAtHorizon.items.find(
      (item) => item.id === "wealth.buy.propertyGainsTax",
    );
    expect(line).toBeDefined();
    expect(line!.amount).toBeLessThan(0);
    // The breakdown still sums exactly to the liquidation wealth.
    const sum = shortHorizon.wealthLens.buyCompositionAtHorizon.items.reduce(
      (total, item) => total + item.amount,
      0,
    );
    expect(sum).toBeCloseTo(shortHorizon.wealthLens.years.at(-1)!.wealthBuyLiquidation, 6);
  });
});

describe("mortgage-interest deduction gating (G4 + G13)", () => {
  it("grants the deduction only to primary residences", () => {
    const primary = simulate(scenario());
    const second = simulate(
      scenario({ property: { price: 200_000, primaryResidence: false } }),
    );
    const primaryLine = primary.costLens.years[0]!.buy.items.find(
      (item) => item.id === "buy.deduction",
    );
    const secondLine = second.costLens.years[0]!.buy.items.find(
      (item) => item.id === "buy.deduction",
    );
    expect(primaryLine).toBeDefined();
    expect(secondLine).toBeUndefined();
  });
});

describe("renovation tax credit (G14)", () => {
  const renovationItem = {
    id: "it-renovation",
    label: "Renovation",
    scenario: "buy",
    timing: { kind: "oneTime", month: 0, amount: 60_000 },
    recoverability: { kind: "partial", share: 0.5 },
    sign: "cost",
    renovationCredit: true,
    enabled: true,
    notes: "",
  };

  it("spreads 50% of the spend over 10 years as negative cost lines", () => {
    const result = simulate(scenario({ costItems: [renovationItem], horizonYears: 12 }));
    for (const year of result.costLens.years) {
      const line = year.buy.items.find((item) => item.id === "buy.renovationCredit");
      if (year.year <= 10) {
        expect(line).toBeDefined();
        expect(line!.amount).toBeCloseTo(-(0.5 * 60_000) / 10, 6); // −3,000/year
      } else {
        expect(line).toBeUndefined();
      }
    }
  });

  it("caps the eligible spend at 96,000 €", () => {
    const bigWorks = { ...renovationItem, timing: { ...renovationItem.timing, amount: 150_000 } };
    const result = simulate(scenario({ costItems: [bigWorks] }));
    const line = result.costLens.years[0]!.buy.items.find(
      (item) => item.id === "buy.renovationCredit",
    );
    expect(line!.amount).toBeCloseTo(-(0.5 * 96_000) / 10, 6); // −4,800/year
  });

  it("is a toggle: disabling it removes every credit line", () => {
    const config: EngineConfig = {
      ...defaultEngineConfig,
      toggles: { ...defaultEngineConfig.toggles, renovationDeduction: false },
    };
    const result = simulate(scenario({ costItems: [renovationItem] }), config);
    const line = result.costLens.years[0]!.buy.items.find(
      (item) => item.id === "buy.renovationCredit",
    );
    expect(line).toBeUndefined();
  });

  it("improves the buy side vs the same works without the credit", () => {
    const withCredit = simulate(scenario({ costItems: [renovationItem] }));
    const withoutCredit = simulate(
      scenario({ costItems: [{ ...renovationItem, renovationCredit: false }] }),
    );
    expect(withCredit.summary.advantageAtHorizon).toBeGreaterThan(
      withoutCredit.summary.advantageAtHorizon,
    );
  });
});

describe("IMU on the cadastral base (G13)", () => {
  it("resolves percentOfCadastral against the cadastral value, 0 when unset", () => {
    const imuItem = {
      id: "it-imu",
      label: "IMU (second home)",
      scenario: "buy" as const,
      timing: {
        kind: "recurring" as const,
        base: { kind: "percentOfCadastral" as const, rate: 0.0115 },
        growth: { kind: "rate" as const, rate: 0 },
      },
      recoverability: { kind: "none" as const },
      sign: "cost" as const,
      enabled: true,
      notes: "",
    };
    const ctx = {
      horizonYears: 3,
      propertyValueStartOfYear: () => 200_000,
      annualRentAt: () => 15_000,
      cadastralValue: 80_000,
    };
    const resolved = resolveCostItems([imuItem], "buy", ctx);
    expect(resolved.recurring[0]!.annual).toEqual([920, 920, 920]); // 80k × 1.15%, flat
    const unset = resolveCostItems([imuItem], "buy", { ...ctx, cadastralValue: null });
    expect(unset.recurring[0]!.annual).toEqual([0, 0, 0]);
  });

  it("adds the IMU preset only for the second-home regime", () => {
    const secondHome = italianPurchaseCostItems({
      propertyPrice: 200_000,
      cadastralValue: 80_000,
      regime: "otherExisting",
    });
    const primary = italianPurchaseCostItems({
      propertyPrice: 200_000,
      cadastralValue: 80_000,
      regime: "primaryExisting",
    });
    expect(secondHome.some((item) => item.id === "it-imu")).toBe(true);
    expect(primary.some((item) => item.id === "it-imu")).toBe(false);
  });

  it("keeps the renovation preset flagged for the tax credit", () => {
    const items = italianPurchaseCostItems({
      propertyPrice: 200_000,
      renovation: { amount: 40_000, valueRetention: 0.5 },
    });
    const renovation = items.find((item) => item.id === "it-renovation");
    expect(renovation?.renovationCredit).toBe(true);
  });
});
