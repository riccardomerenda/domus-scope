import { describe, it } from "vitest";
import fc from "fast-check";
import { buildAmortizationSchedule, steppedRate, type PrepaymentEvent } from "../../src";

/**
 * PT-05 (Phase 10): the PT-01 structural invariants must survive arbitrary
 * deterministic rate paths and partial early repayments.
 */

const MONEY_EPSILON = 1e-6;

const inputs = fc
  .record({
    principal: fc.double({ min: 10_000, max: 2_000_000, noNaN: true }),
    initialRate: fc.double({ min: 0, max: 0.12, noNaN: true }),
    durationYears: fc.integer({ min: 2, max: 40 }),
    stepRates: fc.array(fc.double({ min: 0, max: 0.15, noNaN: true }), {
      minLength: 0,
      maxLength: 3,
    }),
    stepMonthSeeds: fc.array(fc.integer({ min: 2, max: 480 }), { minLength: 3, maxLength: 3 }),
    prepaymentSeeds: fc.array(
      fc.record({
        month: fc.integer({ min: 1, max: 480 }),
        // As a fraction of the principal, so amounts stay meaningful.
        amountFraction: fc.double({ min: 0.01, max: 0.6, noNaN: true }),
        mode: fc.constantFrom<"reducePayment" | "reduceDuration">(
          "reducePayment",
          "reduceDuration",
        ),
      }),
      { minLength: 0, maxLength: 3 },
    ),
  })
  .map(({ principal, initialRate, durationYears, stepRates, stepMonthSeeds, prepaymentSeeds }) => {
    const totalMonths = durationYears * 12;
    // Distinct, sorted, in-range step months derived from the seeds.
    const stepMonths = [...new Set(stepMonthSeeds.map((seed) => 2 + (seed % (totalMonths - 1))))]
      .sort((a, b) => a - b)
      .slice(0, stepRates.length);
    const steps = stepMonths.map((fromMonth, index) => ({
      fromMonth,
      annualRate: stepRates[index]!,
    }));
    const prepayments: PrepaymentEvent[] = prepaymentSeeds.map((seed) => ({
      month: 1 + (seed.month % totalMonths),
      amount: principal * seed.amountFraction,
      mode: seed.mode,
    }));
    return { principal, initialRate, durationYears, steps, prepayments };
  });

describe("PT-05: amortization invariants under rate paths and prepayments", () => {
  it("holds every invariant for arbitrary paths and repayment events", () => {
    fc.assert(
      fc.property(inputs, ({ principal, initialRate, durationYears, steps, prepayments }) => {
        const schedule = buildAmortizationSchedule({
          principal,
          durationYears,
          rate: steppedRate(initialRate, steps),
          prepayments,
        });
        const months = schedule.months;

        if (months.length < 1 || months.length > durationYears * 12) {
          throw new Error(`schedule has ${months.length} months for ${durationYears} years`);
        }

        let principalSum = 0;
        for (const row of months) {
          if (Math.abs(row.payment - (row.interest + row.principal)) > MONEY_EPSILON) {
            throw new Error(`month ${row.month}: payment does not split into interest+principal`);
          }
          if (row.interest < 0) throw new Error(`month ${row.month}: negative interest`);
          if (row.principal < -MONEY_EPSILON) {
            throw new Error(`month ${row.month}: negative principal`);
          }
          if (!(row.closingBalance <= row.openingBalance)) {
            throw new Error(`month ${row.month}: balance increased`);
          }
          if (row.closingBalance < 0) throw new Error(`month ${row.month}: negative balance`);
          principalSum += row.principal;
        }

        if (Math.abs(principalSum - principal) > principal * 1e-9) {
          throw new Error(`principal parts sum to ${principalSum}, expected ${principal}`);
        }
        if (months.at(-1)?.closingBalance !== 0) {
          throw new Error("final closing balance is not exactly zero");
        }
      }),
      { numRuns: 300 },
    );
  });
});
