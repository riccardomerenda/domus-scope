import { describe, it } from "vitest";
import fc from "fast-check";
import { defaultEngineConfig, scenarioInputSchema, simulate, type ScenarioInput } from "../../src";

/**
 * PT-02 and PT-03 (domain spec §12): structural invariants of the wealth-lens
 * simulation over the realistic input space.
 */

interface ScenarioParams {
  price: number;
  downFraction: number;
  annualRate: number;
  durationYears: number;
  horizonYears: number;
  rentToPrice: number;
  rentGrowth: number;
  homeAppreciation: number;
  alternativeReturn: number;
}

const scenarioParams = fc.record<ScenarioParams>({
  price: fc.double({ min: 100_000, max: 800_000, noNaN: true }),
  downFraction: fc.double({ min: 0.1, max: 0.5, noNaN: true }),
  annualRate: fc.double({ min: 0, max: 0.08, noNaN: true }),
  durationYears: fc.integer({ min: 10, max: 30 }),
  horizonYears: fc.integer({ min: 5, max: 30 }),
  rentToPrice: fc.double({ min: 0.02, max: 0.08, noNaN: true }),
  rentGrowth: fc.double({ min: -0.03, max: 0.08, noNaN: true }),
  homeAppreciation: fc.double({ min: -0.03, max: 0.06, noNaN: true }),
  alternativeReturn: fc.double({ min: 0, max: 0.08, noNaN: true }),
});

function buildScenario(params: ScenarioParams, rentGrowth: number): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "property-test",
    title: "Property test scenario",
    property: { price: params.price },
    financing: {
      kind: "mortgage",
      downPayment: params.price * params.downFraction,
      annualRate: params.annualRate,
      durationYears: params.durationYears,
    },
    rentAlternative: {
      equivalentMonthlyRent: (params.price * params.rentToPrice) / 12,
      comparability: "high",
    },
    horizonYears: params.horizonYears,
    assumptions: {
      rentGrowth,
      homeAppreciation: params.homeAppreciation,
      alternativeReturn: params.alternativeReturn,
    },
  });
}

const EPSILON = 1e-6;

describe("PT-02: wealth-lens accounting invariants", () => {
  it("keeps the monthly budget symmetric and the deposits consistent", () => {
    fc.assert(
      fc.property(scenarioParams, (params) => {
        const result = simulate(buildScenario(params, params.rentGrowth), defaultEngineConfig);

        for (const row of result.wealthLens.months) {
          if (Math.abs(row.budget - Math.max(row.outflowBuy, row.outflowRent)) > EPSILON) {
            throw new Error(`month ${row.month}: budget is not the max of the two outflows`);
          }
          if (row.buyerDeposit < -EPSILON || row.renterDeposit < -EPSILON) {
            throw new Error(`month ${row.month}: negative deposit`);
          }
          if (Math.min(row.buyerDeposit, row.renterDeposit) > EPSILON) {
            throw new Error(`month ${row.month}: the cheaper side must invest its whole surplus`);
          }
          if (!Number.isFinite(row.buyerPortfolio) || !Number.isFinite(row.renterPortfolio)) {
            throw new Error(`month ${row.month}: non-finite portfolio`);
          }
        }
        for (const year of result.wealthLens.years) {
          if (
            !Number.isFinite(year.wealthBuyLiquidation) ||
            !Number.isFinite(year.wealthRentLiquidation)
          ) {
            throw new Error(`year ${year.year}: non-finite wealth`);
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe("PT-03: monotonicity in rent growth", () => {
  it("higher rent growth never favors renting more", () => {
    fc.assert(
      fc.property(
        scenarioParams,
        fc.double({ min: 0.005, max: 0.05, noNaN: true }),
        (params, delta) => {
          const base = simulate(buildScenario(params, params.rentGrowth), defaultEngineConfig);
          const higher = simulate(
            buildScenario(params, params.rentGrowth + delta),
            defaultEngineConfig,
          );

          const baseLast = base.wealthLens.years.at(-1);
          const higherLast = higher.wealthLens.years.at(-1);
          if (!baseLast || !higherLast) throw new Error("missing final year");

          if (higherLast.advantageLiquidation + EPSILON < baseLast.advantageLiquidation) {
            throw new Error(
              `advantage decreased when rent growth rose: ` +
                `${baseLast.advantageLiquidation} → ${higherLast.advantageLiquidation}`,
            );
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
