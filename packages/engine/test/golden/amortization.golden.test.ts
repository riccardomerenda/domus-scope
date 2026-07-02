import { describe, expect, it } from "vitest";
import { aggregateByYear, buildAmortizationSchedule, fixedRate } from "../../src";

describe("French amortization — golden cases", () => {
  it("matches the textbook case: 100,000 @ 6% over 30 years", () => {
    const schedule = buildAmortizationSchedule({
      principal: 100_000,
      durationYears: 30,
      rate: fixedRate(0.06),
    });

    expect(schedule.monthlyPayment).toBeCloseTo(599.55, 2);
    expect(schedule.months).toHaveLength(360);
    expect(schedule.totalInterest).toBeCloseTo(115_838.19, 1);
    expect(schedule.totalPrincipal).toBe(100_000);
  });

  it("TV-04: zero-rate mortgage repays linearly with no division by zero", () => {
    const schedule = buildAmortizationSchedule({
      principal: 120_000,
      durationYears: 10,
      rate: fixedRate(0),
    });

    expect(schedule.monthlyPayment).toBe(1_000);
    expect(schedule.totalInterest).toBe(0);
    for (const row of schedule.months) {
      expect(row.interest).toBe(0);
      expect(row.payment).toBe(1_000);
    }
    expect(schedule.months.at(-1)?.closingBalance).toBe(0);
  });

  it("TV-05: horizon beyond payoff yields zero rows, not errors (G7)", () => {
    const schedule = buildAmortizationSchedule({
      principal: 160_000,
      durationYears: 20,
      rate: fixedRate(0.03),
    });
    const years = aggregateByYear(schedule, 30);

    expect(years).toHaveLength(30);

    const year20 = years[19];
    expect(year20?.closingBalance).toBe(0);

    for (const year of years.slice(20)) {
      expect(year.interest).toBe(0);
      expect(year.principal).toBe(0);
      expect(year.totalPaid).toBe(0);
      expect(year.closingBalance).toBe(0);
    }

    const totalPrincipalAcrossYears = years.reduce((sum, y) => sum + y.principal, 0);
    expect(totalPrincipalAcrossYears).toBeCloseTo(160_000, 6);
    const totalInterestAcrossYears = years.reduce((sum, y) => sum + y.interest, 0);
    expect(totalInterestAcrossYears).toBeCloseTo(schedule.totalInterest, 6);
  });

  it("rejects invalid inputs with clear errors (NFR-008)", () => {
    expect(() =>
      buildAmortizationSchedule({ principal: 0, durationYears: 10, rate: fixedRate(0.03) }),
    ).toThrow(RangeError);
    expect(() =>
      buildAmortizationSchedule({ principal: 100_000, durationYears: 0, rate: fixedRate(0.03) }),
    ).toThrow(RangeError);
    expect(() => fixedRate(-0.01)).toThrow(RangeError);
  });
});
