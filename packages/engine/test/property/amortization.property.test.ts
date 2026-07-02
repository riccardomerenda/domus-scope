import { describe, it } from "vitest";
import fc from "fast-check";
import { buildAmortizationSchedule, fixedRate } from "../../src";

/**
 * PT-01 (domain spec §12): structural invariants of the amortization schedule,
 * checked over the whole realistic input space.
 */

const amortizationInputs = fc.record({
  principal: fc.double({ min: 1_000, max: 2_000_000, noNaN: true }),
  annualRate: fc.double({ min: 0, max: 0.15, noNaN: true }),
  durationYears: fc.integer({ min: 1, max: 40 }),
});

// Absolute tolerance for money comparisons: one millionth of a euro.
const MONEY_EPSILON = 1e-6;

describe("PT-01: amortization invariants", () => {
  it("holds every invariant for arbitrary principal, rate, and duration", () => {
    fc.assert(
      fc.property(amortizationInputs, ({ principal, annualRate, durationYears }) => {
        const schedule = buildAmortizationSchedule({
          principal,
          durationYears,
          rate: fixedRate(annualRate),
        });
        const months = schedule.months;

        if (months.length !== durationYears * 12) {
          throw new Error(`expected ${durationYears * 12} months, got ${months.length}`);
        }

        let principalSum = 0;
        for (const row of months) {
          // payment = interest + principal, every month
          if (Math.abs(row.payment - (row.interest + row.principal)) > MONEY_EPSILON) {
            throw new Error(`month ${row.month}: payment does not split into interest+principal`);
          }
          // interest is never negative
          if (row.interest < 0) {
            throw new Error(`month ${row.month}: negative interest`);
          }
          // balance strictly decreases
          if (!(row.closingBalance < row.openingBalance)) {
            throw new Error(`month ${row.month}: balance did not decrease`);
          }
          // the payment stays the constant French payment (final residue aside)
          if (Math.abs(row.payment - schedule.monthlyPayment) > MONEY_EPSILON) {
            throw new Error(`month ${row.month}: payment deviates from the constant payment`);
          }
          principalSum += row.principal;
        }

        // principal parts sum back to the loan (relative tolerance, §10)
        if (Math.abs(principalSum - principal) > principal * 1e-9) {
          throw new Error(`principal parts sum to ${principalSum}, expected ${principal}`);
        }

        // the loan closes at exactly zero
        if (months.at(-1)?.closingBalance !== 0) {
          throw new Error("final closing balance is not exactly zero");
        }
      }),
      { numRuns: 300 },
    );
  });
});
