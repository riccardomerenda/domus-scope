import { describe, it } from "vitest";
import fc from "fast-check";
import {
  defaultEngineConfig,
  scenarioAtPrice,
  scenarioInputSchema,
  simulate,
  solveReservationPrice,
  type ScenarioInput,
} from "../../src";

/**
 * PT-04 (Phase 8, docs/07-negotiation-lens.md): with the market value
 * anchored, the wealth advantage is strictly decreasing in the transaction
 * price — the invariant the reservation-price bisection relies on — and the
 * solver is a true inverse of simulate().
 */

interface NegotiationParams {
  marketValue: number;
  downFraction: number;
  annualRate: number;
  durationYears: number;
  horizonYears: number;
  rentToPrice: number;
  cash: boolean;
}

const negotiationParams = fc.record<NegotiationParams>({
  marketValue: fc.double({ min: 100_000, max: 800_000, noNaN: true }),
  downFraction: fc.double({ min: 0.1, max: 0.5, noNaN: true }),
  annualRate: fc.double({ min: 0, max: 0.08, noNaN: true }),
  durationYears: fc.integer({ min: 10, max: 30 }),
  horizonYears: fc.integer({ min: 5, max: 30 }),
  rentToPrice: fc.double({ min: 0.02, max: 0.08, noNaN: true }),
  cash: fc.boolean(),
});

function buildScenario(params: NegotiationParams): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "nego-property-test",
    title: "Negotiation property test",
    property: { price: params.marketValue, marketValue: params.marketValue },
    financing: params.cash
      ? { kind: "cash" }
      : {
          kind: "mortgage",
          downPayment: params.marketValue * params.downFraction,
          annualRate: params.annualRate,
          durationYears: params.durationYears,
        },
    rentAlternative: {
      equivalentMonthlyRent: (params.marketValue * params.rentToPrice) / 12,
      comparability: "high",
    },
    horizonYears: params.horizonYears,
  });
}

/** Price domain kept above the down payment so the principal stays ≥ 0. */
function priceAt(params: NegotiationParams, fraction: number): number {
  const floor = params.cash ? 1 : params.marketValue * params.downFraction;
  const max = params.marketValue * 2;
  return floor + (max - floor) * fraction;
}

const EPSILON = 1e-6;

describe("PT-04: advantage is strictly decreasing in the transaction price", () => {
  it("paying more for the same house never helps, mortgage or cash", () => {
    fc.assert(
      fc.property(
        negotiationParams,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.05, max: 0.5, noNaN: true }),
        (params, start, gap) => {
          const input = buildScenario(params);
          const lower = priceAt(params, Math.min(start, 1 - gap));
          const higher = priceAt(params, Math.min(start, 1 - gap) + gap);

          const cheap = simulate(scenarioAtPrice(input, lower), defaultEngineConfig);
          const dear = simulate(scenarioAtPrice(input, higher), defaultEngineConfig);

          if (dear.summary.advantageAtHorizon >= cheap.summary.advantageAtHorizon - EPSILON) {
            throw new Error(
              `advantage did not decrease when the price rose ${lower} → ${higher}: ` +
                `${cheap.summary.advantageAtHorizon} → ${dear.summary.advantageAtHorizon}`,
            );
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe("PT-05: the solver inverts simulate()", () => {
  it("simulating at a solved P* lands within a cent of indifference", () => {
    fc.assert(
      fc.property(negotiationParams, (params) => {
        const input = buildScenario(params);
        const reservation = solveReservationPrice(input, defaultEngineConfig);

        if (reservation.status !== "solved") {
          // Null cases must still report a coherent one-sided range.
          if (reservation.status === "rentAlwaysWins" && reservation.advantageAtMin >= 0) {
            throw new Error("rentAlwaysWins with a non-negative advantage at the minimum");
          }
          if (reservation.status === "buyAlwaysWins" && reservation.advantageAtMax <= 0) {
            throw new Error("buyAlwaysWins with a non-positive advantage at the maximum");
          }
          return;
        }

        const price = reservation.price!;
        if (price < reservation.bounds.min - EPSILON || price > reservation.bounds.max + EPSILON) {
          throw new Error(`P* ${price} escaped the bounds`);
        }
        const at = simulate(scenarioAtPrice(input, price), defaultEngineConfig);
        if (Math.abs(at.summary.advantageAtHorizon) > 0.01) {
          throw new Error(`advantage at P* is ${at.summary.advantageAtHorizon}, expected ≈ 0`);
        }
      }),
      { numRuns: 25 },
    );
  });
});
