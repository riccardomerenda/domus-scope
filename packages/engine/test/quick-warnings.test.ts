import { describe, expect, it } from "vitest";
import {
  defaultEngineConfig,
  quickAssess,
  quickInputSchema,
  type EngineConfig,
  type QuickInput,
  type WarningId,
} from "../src";

const baseConfig: EngineConfig = {
  ...defaultEngineConfig,
  assumptions: {
    ...defaultEngineConfig.assumptions,
    alternativeReturn: 0.05,
    homeAppreciation: 0,
    rentGrowth: 0,
    maintenanceRate: 0.01,
    recurringTaxRate: 0,
  },
};

function parseInput(overrides: Record<string, unknown> = {}): QuickInput {
  return quickInputSchema.parse({
    propertyPrice: 200_000,
    equivalentMonthlyRent: 1_250,
    horizonYears: 10,
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    ...overrides,
  });
}

function warningIds(input: QuickInput, config: EngineConfig = baseConfig): WarningId[] {
  return quickAssess(input, config).warnings.map((warning) => warning.id);
}

describe("quick-level warnings (W-001…W-006, W-009)", () => {
  it("W-001 + indicative verdict when rent comparability is low (BR-022)", () => {
    const result = quickAssess(parseInput({ comparability: "low" }), baseConfig);
    expect(result.warnings.map((w) => w.id)).toContain("W-001");
    expect(result.verdict.strength).toBe("indicative");
  });

  it("W-002 when the down payment pushes liquidity below the emergency fund (BR-006)", () => {
    const ids = warningIds(parseInput({ liquidity: { available: 50_000, emergencyFund: 20_000 } }));
    expect(ids).toContain("W-002");
    expect(ids).not.toContain("W-004");
  });

  it("W-003 on horizons shorter than the configured threshold (BR-005)", () => {
    expect(warningIds(parseInput({ horizonYears: 2 }))).toContain("W-003");
    expect(warningIds(parseInput({ horizonYears: 3 }))).not.toContain("W-003");
  });

  it("W-004 when a cash purchase drains liquidity below the fund", () => {
    const ids = warningIds(
      parseInput({
        financing: { kind: "cash" },
        liquidity: { available: 210_000, emergencyFund: 20_000 },
      }),
    );
    expect(ids).toContain("W-004");
    expect(ids).not.toContain("W-002");
  });

  it("W-005 when LTV exceeds the configured threshold", () => {
    const ids = warningIds(
      parseInput({
        financing: { kind: "mortgage", downPayment: 20_000, annualRate: 0.03, durationYears: 25 },
      }),
    );
    expect(ids).toContain("W-005");
    // LTV exactly at the threshold does not warn.
    expect(warningIds(parseInput())).not.toContain("W-005");
  });

  it("W-006 when the opportunity cost is disabled, and costs shrink accordingly (BR-011)", () => {
    const config: EngineConfig = {
      ...baseConfig,
      toggles: { ...baseConfig.toggles, opportunityCost: false },
    };
    const result = quickAssess(parseInput(), config);
    expect(result.warnings.map((w) => w.id)).toContain("W-006");
    // Without opportunity cost (and its paired credit, BR-019): 4,800 + 2,000.
    expect(result.yearOne.mortgage?.total).toBe(6_800);
    // The derived threshold also drops its equity-opportunity term.
    expect(result.rule.threshold).toBeCloseTo(0.034, 12);
  });

  it("W-009 when an assumption exceeds the sanity bounds (BR-020), without blocking", () => {
    const result = quickAssess(parseInput({ assumptions: { alternativeReturn: 0.2 } }), baseConfig);
    const w009 = result.warnings.find((w) => w.id === "W-009");
    expect(w009?.context["field"]).toBe("alternativeReturn");
    // The computation still runs: opportunity = 40,000 × 20% = 8,000.
    const opportunity = result.yearOne.mortgage?.items.find(
      (entry) => entry.id === "buy.opportunityCost",
    );
    expect(opportunity?.amount).toBe(8_000);
  });

  it("stays silent on the reference happy path", () => {
    expect(warningIds(parseInput())).toEqual([]);
  });
});
