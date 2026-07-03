import { describe, expect, it } from "vitest";
import {
  defaultEngineConfig,
  italianPurchaseCostItems,
  italianRentCostItems,
  scenarioInputSchema,
  simulate,
  type EngineConfig,
  type ScenarioInput,
} from "../../src";

/**
 * Analytical-mode golden vectors (domain spec §12): TV-06, TV-09, TV-10, plus
 * consistency with the transcript quick-mode vectors and the full-simulation
 * snapshot that guards against silent numeric drift.
 *
 * Transcript assumptions; the interest deduction is toggled off here because
 * the source-document model does not include it (it gets its own test below).
 */
const transcriptConfig: EngineConfig = {
  ...defaultEngineConfig,
  toggles: { ...defaultEngineConfig.toggles, mortgageInterestDeduction: false },
  assumptions: {
    alternativeReturn: 0.05,
    homeAppreciation: 0,
    rentGrowth: 0,
    inflation: 0.02,
    capitalGainsTax: 0.26,
    maintenanceRate: 0.01,
    recurringTaxRate: 0,
  },
};

function referenceScenario(overrides: Record<string, unknown> = {}): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "ref",
    title: "Transcript reference",
    property: { price: 200_000 },
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
    ...overrides,
  });
}

describe("analytical mode vs the transcript reference", () => {
  const result = simulate(referenceScenario(), transcriptConfig);

  it("keeps year-1 figures consistent with the quick preview (TV-01/TV-08)", () => {
    expect(result.summary.yearOneUnrecoverableRent).toBe(15_000);
    // Exact-schedule interest is slightly below the simplified 4,800 €, so the
    // analytical year-1 total lands just under the quick-mode 8,800 €.
    expect(result.summary.yearOneUnrecoverableBuy).toBeGreaterThan(8_600);
    expect(result.summary.yearOneUnrecoverableBuy).toBeLessThan(8_800);
  });

  it("reaches a buy-favorable verdict with both break-evens within the horizon", () => {
    expect(result.verdict.kind).toBe("BUY_MORTGAGE");
    expect(result.verdict.strength).toBe("standard");
    expect(result.summary.advantageAtHorizon).toBeGreaterThan(0);
    expect(result.breakEvens.wealthLiquidation).not.toBeNull();
    expect(result.breakEvens.costLiquidation).not.toBeNull();
  });

  it("provides the real-terms view of the advantage (critique W5)", () => {
    expect(result.summary.advantageAtHorizonReal).toBeCloseTo(
      result.summary.advantageAtHorizon / Math.pow(1.02, 10),
      6,
    );
  });

  it("records assumption provenance (NFR-005)", () => {
    expect(result.assumptions.provenance.alternativeReturn).toBe("global");
    const withOverride = simulate(
      referenceScenario({ assumptions: { rentGrowth: 0.04 } }),
      transcriptConfig,
    );
    expect(withOverride.assumptions.provenance.rentGrowth).toBe("scenario");
    expect(withOverride.assumptions.values.rentGrowth).toBe(0.04);
    const withDefaults = simulate(referenceScenario(), defaultEngineConfig);
    expect(withDefaults.assumptions.provenance.maintenanceRate).toBe("engine-default");
  });
});

describe("TV-06: negative appreciation", () => {
  const result = simulate(
    referenceScenario({
      financing: { kind: "mortgage", downPayment: 20_000, annualRate: 0.03, durationYears: 25 },
      assumptions: { homeAppreciation: -0.05 },
    }),
    transcriptConfig,
  );

  it("lets the property value decline and flags negative-equity years (W-007)", () => {
    const first = result.costLens.years.at(0);
    const last = result.costLens.years.at(-1);
    expect(last?.propertyValue ?? 0).toBeLessThan(first?.propertyValue ?? 0);
    expect(result.warnings.map((w) => w.id)).toContain("W-007");
  });

  it("shows the appreciation credit as a positive cost (a loss) in the cost lens", () => {
    const credit = result.costLens.years
      .at(0)
      ?.buy.items.find((item) => item.id === "buy.appreciationCredit");
    // With g < 0 the "credit" flips sign: losing value is an unrecoverable cost.
    expect(credit?.amount ?? 0).toBeGreaterThan(0);
  });
});

describe("TV-09: cash purchase draining liquidity", () => {
  const result = simulate(
    referenceScenario({
      financing: { kind: "cash" },
      profile: { liquidity: 210_000, emergencyFund: 20_000 },
    }),
    transcriptConfig,
  );

  it("fires both W-002 and W-004 and reports the residual liquidity", () => {
    const ids = result.warnings.map((w) => w.id);
    expect(ids).toContain("W-002");
    expect(ids).toContain("W-004");
    expect(result.summary.liquidityAfterPurchase).toBe(10_000);
  });
});

describe("TV-10: low rent comparability", () => {
  const result = simulate(
    referenceScenario({
      rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "low" },
    }),
    transcriptConfig,
  );

  it("caps the verdict at indicative and fires W-001 (BR-022)", () => {
    expect(result.verdict.strength).toBe("indicative");
    expect(result.warnings.map((w) => w.id)).toContain("W-001");
  });
});

describe("G4: mortgage interest deduction", () => {
  it("credits 19% of the capped interest in year 1", () => {
    const config: EngineConfig = {
      ...transcriptConfig,
      toggles: { ...transcriptConfig.toggles, mortgageInterestDeduction: true },
    };
    const result = simulate(referenceScenario(), config);
    const deduction = result.costLens.years
      .at(0)
      ?.buy.items.find((item) => item.id === "buy.deduction");
    // Year-1 interest ≈ 4,734 € > 4,000 € cap → credit = 19% × 4,000 = 760 €.
    expect(deduction?.amount).toBe(-760);
    expect(deduction?.sign).toBe("credit");
  });
});

describe("W-008: horizon beyond mortgage payoff", () => {
  it("informs when the mortgage ends inside the horizon (G7)", () => {
    const result = simulate(
      referenceScenario({
        financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 15 },
        horizonYears: 20,
      }),
      transcriptConfig,
    );
    expect(result.warnings.map((w) => w.id)).toContain("W-008");
    // Post-payoff years still carry ownership costs but no interest.
    const year20 = result.costLens.years.at(19);
    expect(year20?.buy.items.find((item) => item.id === "buy.interest")?.amount).toBe(0);
    expect(year20?.debtBalance).toBe(0);
  });
});

describe("full-simulation snapshot (numeric-drift guard)", () => {
  it("matches the frozen projection for the Italian reference scenario", () => {
    const input = referenceScenario({
      costItems: [
        ...italianPurchaseCostItems({
          propertyPrice: 200_000,
          cadastralValue: 110_000,
          mortgagePrincipal: 160_000,
          regime: "primaryExisting",
          condoFeesAnnual: 1_200,
          homeInsuranceAnnual: 400,
        }),
        ...italianRentCostItems({ monthlyRent: 1_250 }),
      ],
      profile: { liquidity: 80_000, emergencyFund: 20_000 },
    });
    const result = simulate(input, transcriptConfig);

    const round2 = (value: number) => Math.round(value * 100) / 100;
    const digest = result.costLens.years.map((costYear, index) => {
      const wealthYear = result.wealthLens.years[index];
      return {
        year: costYear.year,
        cumulativeRent: round2(costYear.cumulativeRent),
        cumulativeBuyHold: round2(costYear.cumulativeBuyHold),
        cumulativeBuyLiquidation: round2(costYear.cumulativeBuyLiquidation),
        wealthRent: round2(wealthYear?.wealthRentLiquidation ?? 0),
        wealthBuy: round2(wealthYear?.wealthBuyLiquidation ?? 0),
        advantage: round2(wealthYear?.advantageLiquidation ?? 0),
      };
    });

    expect({
      verdict: result.verdict.kind,
      breakEvens: result.breakEvens,
      initialCapital: round2(result.wealthLens.initialCapital),
      totalInterest: round2(result.summary.totalInterest),
      digest,
    }).toMatchSnapshot();
  });
});
