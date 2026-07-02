import { describe, expect, it } from "vitest";
import {
  aggregateByYear,
  buildAmortizationSchedule,
  defaultEngineConfig,
  fixedRate,
  quickAssess,
  quickInputSchema,
} from "../src";

/**
 * TV-07 (NFR-002): identical inputs produce deeply equal outputs. The engine
 * has no clock, randomness, or I/O; this test guards that property as modules
 * are added.
 */
describe("TV-07: determinism", () => {
  it("produces deeply equal schedules for identical inputs", () => {
    const input = { principal: 160_000, durationYears: 25, rate: fixedRate(0.0345) };

    const first = buildAmortizationSchedule(input);
    const second = buildAmortizationSchedule(input);

    expect(second).toStrictEqual(first);
    expect(aggregateByYear(second, 30)).toStrictEqual(aggregateByYear(first, 30));
  });

  it("produces deeply equal quick assessments for identical inputs", () => {
    const input = quickInputSchema.parse({
      propertyPrice: 200_000,
      equivalentMonthlyRent: 1_250,
      horizonYears: 10,
      financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
      comparability: "medium",
      liquidity: { available: 80_000, emergencyFund: 20_000 },
    });

    expect(quickAssess(input, defaultEngineConfig)).toStrictEqual(
      quickAssess(input, defaultEngineConfig),
    );
  });
});
