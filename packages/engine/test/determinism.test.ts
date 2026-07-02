import { describe, expect, it } from "vitest";
import { aggregateByYear, buildAmortizationSchedule, fixedRate } from "../src";

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
});
