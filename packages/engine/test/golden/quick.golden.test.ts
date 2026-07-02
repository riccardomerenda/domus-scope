import { describe, expect, it } from "vitest";
import {
  aggregateByYear,
  buildAmortizationSchedule,
  defaultEngineConfig,
  fixedRate,
  quickAssess,
  quickInputSchema,
  type EngineConfig,
} from "../../src";

/**
 * Golden vectors TV-01, TV-02, TV-03, TV-08 (domain spec §12), taken from the
 * source document §16. Quick mode must reproduce them byte-exactly.
 *
 * Transcript assumptions: r_alt = 5%, maintenance = 1%, recurring tax = 0,
 * home appreciation = 0.
 */
const transcriptConfig: EngineConfig = {
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

const mortgageCase = quickInputSchema.parse({
  propertyPrice: 200_000,
  equivalentMonthlyRent: 1_250,
  horizonYears: 10,
  financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
});

describe("TV-01: transcript mortgage example (source doc §16.1)", () => {
  const result = quickAssess(mortgageCase, transcriptConfig);

  it("reproduces the year-1 unrecoverable costs byte-exactly", () => {
    expect(result.yearOne.rent.total).toBe(15_000);
    expect(result.yearOne.mortgage?.total).toBe(8_800);

    const amounts = Object.fromEntries(
      (result.yearOne.mortgage?.items ?? []).map((entry) => [entry.id, entry.amount]),
    );
    expect(amounts["buy.interest"]).toBe(4_800);
    expect(amounts["buy.opportunityCost"]).toBe(2_000);
    expect(amounts["buy.maintenance"]).toBe(2_000);
    expect(amounts["buy.appreciationCredit"]).toBe(0); // g = 0, shown but null (BR-019)
  });

  it("derives R* = 4.4% from the transcript's own parameters (critique W3)", () => {
    expect(result.rule.threshold).toBeCloseTo(0.044, 12);
    expect(result.rule.rentToPrice).toBeCloseTo(0.075, 12);
    expect(result.rule.ltv).toBe(0.8);
    expect(result.rule.band).toBe("above");
  });

  it("issues a favorable-to-buy provisional verdict, as the transcript expects", () => {
    expect(result.verdict.kind).toBe("BUY_MORTGAGE");
    expect(result.verdict.strength).toBe("standard");
  });

  it("labels the method as simplified and raises no spurious warnings", () => {
    expect(result.yearOne.method).toBe("simplified");
    expect(result.warnings).toEqual([]);
  });
});

describe("TV-02: transcript cash example (source doc §16.2)", () => {
  const cashCase = quickInputSchema.parse({
    propertyPrice: 200_000,
    equivalentMonthlyRent: 1_250,
    horizonYears: 10,
    financing: { kind: "cash" },
  });
  const result = quickAssess(cashCase, transcriptConfig);

  it("reproduces the 12,000 € year-1 cost byte-exactly", () => {
    expect(result.yearOne.cash.total).toBe(12_000);
    const amounts = Object.fromEntries(
      result.yearOne.cash.items.map((entry) => [entry.id, entry.amount]),
    );
    expect(amounts["buy.opportunityCost"]).toBe(10_000); // BR-014: cash is not free
    expect(amounts["buy.maintenance"]).toBe(2_000);
  });

  it("derives the transcript's ≈6% cash threshold instead of hardcoding it", () => {
    expect(result.rule.threshold).toBeCloseTo(0.06, 12);
    expect(result.rule.ltv).toBe(0);
    expect(result.verdict.kind).toBe("BUY_CASH");
  });
});

describe("TV-03: quick-rule table (source doc §16.3) against the derived threshold", () => {
  // With the transcript parameters the derived R* is 4.4% (not the naive 5%),
  // so the ≈5.0% row lands *above* the grey band [3.9%, 4.9%] rather than
  // inside it — the derivation shifts the reading (critique W3).
  const rows = [
    { price: 200_000, rent: 1_250, ratio: 0.075, band: "above" },
    { price: 200_000, rent: 833, ratio: 0.04998, band: "above" },
    { price: 250_000, rent: 470, ratio: 0.02256, band: "below" },
    { price: 300_000, rent: 1_000, ratio: 0.04, band: "within" },
  ] as const;

  it.each(rows)("price %s, rent %s → ratio and band", ({ price, rent, ratio, band }) => {
    const input = quickInputSchema.parse({
      propertyPrice: price,
      equivalentMonthlyRent: rent,
      horizonYears: 10,
      financing: {
        kind: "mortgage",
        downPayment: price * 0.2,
        annualRate: 0.03,
        durationYears: 25,
      },
    });
    const result = quickAssess(input, transcriptConfig);
    expect(result.rule.rentToPrice).toBeCloseTo(ratio, 10);
    expect(result.rule.band).toBe(band);
  });
});

describe("TV-08: simplified vs exact year-1 interest (critique W9)", () => {
  it("the simplified preview slightly overstates the exact schedule and says so", () => {
    const schedule = buildAmortizationSchedule({
      principal: 160_000,
      durationYears: 25,
      rate: fixedRate(0.03),
    });
    const exactYearOne = aggregateByYear(schedule, 1)[0]?.interest ?? 0;

    expect(exactYearOne).toBeLessThan(4_800);
    expect(exactYearOne).toBeGreaterThan(4_600);

    const quick = quickAssess(mortgageCase, transcriptConfig);
    const interest = quick.yearOne.mortgage?.items.find((entry) => entry.id === "buy.interest");
    expect(interest?.formulaId).toBe("quick.interest.simplified");
    expect(interest?.amount).toBe(4_800);
  });
});
