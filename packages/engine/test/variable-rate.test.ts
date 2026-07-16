import { describe, expect, it } from "vitest";
import {
  buildAmortizationSchedule,
  fixedRate,
  frenchMonthlyPayment,
  runSensitivity,
  scenarioInputSchema,
  simulate,
  steppedRate,
  steppedRateFromYears,
  type ScenarioInput,
} from "../src";

/**
 * Phase 10 (G9): variable-rate paths and partial early repayments
 * (estinzione anticipata parziale), from the amortization schedule up to
 * simulate() and sensitivity.
 */

const MONEY_EPSILON = 1e-6;

function variableScenario(overrides: Record<string, unknown> = {}): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "var",
    title: "Variable-rate reference",
    property: { price: 200_000 },
    financing: {
      kind: "mortgage",
      downPayment: 40_000,
      annualRate: 0.03,
      durationYears: 25,
      rateSteps: [{ fromYear: 4, annualRate: 0.055 }],
    },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
    ...overrides,
  });
}

describe("steppedRate constructor", () => {
  it("degrades to a fixed rate with no steps", () => {
    const rate = steppedRate(0.03, []);
    expect(rate.annualRateAt(1)).toBe(0.03);
    expect(rate.annualRateAt(600)).toBe(0.03);
  });

  it("applies each step from its month onward", () => {
    const rate = steppedRate(0.03, [
      { fromMonth: 13, annualRate: 0.05 },
      { fromMonth: 25, annualRate: 0.04 },
    ]);
    expect(rate.annualRateAt(12)).toBe(0.03);
    expect(rate.annualRateAt(13)).toBe(0.05);
    expect(rate.annualRateAt(24)).toBe(0.05);
    expect(rate.annualRateAt(25)).toBe(0.04);
  });

  it("rejects unordered, too-early, or invalid steps", () => {
    expect(() => steppedRate(0.03, [{ fromMonth: 1, annualRate: 0.05 }])).toThrow(RangeError);
    expect(() =>
      steppedRate(0.03, [
        { fromMonth: 25, annualRate: 0.05 },
        { fromMonth: 13, annualRate: 0.04 },
      ]),
    ).toThrow(RangeError);
    expect(() => steppedRate(0.03, [{ fromMonth: 13, annualRate: -0.01 }])).toThrow(RangeError);
    expect(() => steppedRate(Number.NaN, [])).toThrow(RangeError);
  });
});

describe("variable-rate amortization (re-amortization branch)", () => {
  const principal = 160_000;
  const durationYears = 20;
  const schedule = buildAmortizationSchedule({
    principal,
    durationYears,
    rate: steppedRateFromYears(0.03, [{ fromYear: 6, annualRate: 0.05 }]),
  });

  it("keeps the initial French payment until the step", () => {
    const expected = frenchMonthlyPayment(principal, 0.03 / 12, durationYears * 12);
    for (const row of schedule.months.slice(0, 60)) {
      expect(row.payment).toBeCloseTo(expected, 6);
    }
  });

  it("re-amortizes the remaining balance over the remaining contractual months", () => {
    const balanceAtStep = schedule.months[59]!.closingBalance;
    const expected = frenchMonthlyPayment(balanceAtStep, 0.05 / 12, durationYears * 12 - 60);
    for (const row of schedule.months.slice(60)) {
      expect(row.payment).toBeCloseTo(expected, 6);
    }
    expect(expected).toBeGreaterThan(schedule.monthlyPayment);
  });

  it("still closes at exactly zero with all principal repaid", () => {
    expect(schedule.months).toHaveLength(durationYears * 12);
    expect(schedule.months.at(-1)!.closingBalance).toBe(0);
    const principalSum = schedule.months.reduce((sum, row) => sum + row.principal, 0);
    expect(Math.abs(principalSum - principal)).toBeLessThan(principal * 1e-9);
  });

  it("costs more interest than the fixed-rate baseline when rates rise", () => {
    const fixed = buildAmortizationSchedule({ principal, durationYears, rate: fixedRate(0.03) });
    expect(schedule.totalInterest).toBeGreaterThan(fixed.totalInterest);
  });
});

describe("partial early repayments (estinzione anticipata parziale)", () => {
  const principal = 160_000;
  const durationYears = 20;
  const baseline = buildAmortizationSchedule({ principal, durationYears, rate: fixedRate(0.03) });

  it("reducePayment: lowers the payment from the next month on", () => {
    const schedule = buildAmortizationSchedule({
      principal,
      durationYears,
      rate: fixedRate(0.03),
      prepayments: [{ month: 60, amount: 20_000, mode: "reducePayment" }],
    });
    const row = schedule.months[59]!;
    // The event month carries the true cash out and the extra principal.
    expect(row.payment).toBeCloseTo(baseline.months[59]!.payment + 20_000, 6);
    expect(row.closingBalance).toBeCloseTo(baseline.months[59]!.closingBalance - 20_000, 6);
    // Lower payment afterwards, same contractual end.
    expect(schedule.months[60]!.payment).toBeLessThan(schedule.monthlyPayment);
    expect(schedule.months).toHaveLength(durationYears * 12);
    expect(schedule.months.at(-1)!.closingBalance).toBe(0);
    const principalSum = schedule.months.reduce((sum, r) => sum + r.principal, 0);
    expect(Math.abs(principalSum - principal)).toBeLessThan(principal * 1e-9);
    expect(schedule.totalInterest).toBeLessThan(baseline.totalInterest);
  });

  it("reduceDuration: keeps the payment and closes the loan early", () => {
    const schedule = buildAmortizationSchedule({
      principal,
      durationYears,
      rate: fixedRate(0.03),
      prepayments: [{ month: 60, amount: 20_000, mode: "reduceDuration" }],
    });
    expect(schedule.months.length).toBeLessThan(durationYears * 12);
    // Payment unchanged after the event (final residue month aside).
    for (const row of schedule.months.slice(60, -1)) {
      expect(row.payment).toBeCloseTo(schedule.monthlyPayment, 6);
    }
    expect(schedule.months.at(-1)!.closingBalance).toBe(0);
    const principalSum = schedule.months.reduce((sum, r) => sum + r.principal, 0);
    expect(Math.abs(principalSum - principal)).toBeLessThan(principal * 1e-9);
  });

  it("clamps a prepayment larger than the open balance and closes the loan", () => {
    const schedule = buildAmortizationSchedule({
      principal,
      durationYears,
      rate: fixedRate(0.03),
      prepayments: [{ month: 24, amount: 1_000_000, mode: "reducePayment" }],
    });
    expect(schedule.months).toHaveLength(24);
    expect(schedule.months.at(-1)!.closingBalance).toBe(0);
    const principalSum = schedule.months.reduce((sum, r) => sum + r.principal, 0);
    expect(Math.abs(principalSum - principal)).toBeLessThan(principal * 1e-9);
  });

  it("ignores prepayments scheduled after payoff", () => {
    const schedule = buildAmortizationSchedule({
      principal,
      durationYears,
      rate: fixedRate(0.03),
      prepayments: [
        { month: 24, amount: 1_000_000, mode: "reducePayment" },
        { month: 120, amount: 10_000, mode: "reducePayment" },
      ],
    });
    expect(schedule.months).toHaveLength(24);
  });
});

describe("schema validation (BR-level boundary)", () => {
  it("rejects unordered rate steps", () => {
    expect(() =>
      variableScenario({
        financing: {
          kind: "mortgage",
          downPayment: 40_000,
          annualRate: 0.03,
          durationYears: 25,
          rateSteps: [
            { fromYear: 10, annualRate: 0.05 },
            { fromYear: 4, annualRate: 0.04 },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects rate steps beyond the mortgage duration", () => {
    expect(() =>
      variableScenario({
        financing: {
          kind: "mortgage",
          downPayment: 40_000,
          annualRate: 0.03,
          durationYears: 10,
          rateSteps: [{ fromYear: 12, annualRate: 0.05 }],
        },
      }),
    ).toThrow();
  });

  it("keeps pre-Phase-10 financing valid (defaults to fixed rate)", () => {
    const input = variableScenario({
      financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    });
    expect(input.financing.kind === "mortgage" && input.financing.rateSteps).toEqual([]);
    expect(input.financing.kind === "mortgage" && input.financing.prepayments).toEqual([]);
  });
});

describe("simulate() with a variable-rate path", () => {
  const fixed = simulate(
    variableScenario({
      financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    }),
  );
  const variable = simulate(variableScenario());

  it("pays more interest and loses advantage when rates rise", () => {
    expect(variable.summary.totalInterest).toBeGreaterThan(fixed.summary.totalInterest);
    expect(variable.summary.advantageAtHorizon).toBeLessThan(fixed.summary.advantageAtHorizon);
  });

  it("fires the payment-shock warning W-011", () => {
    expect(variable.warnings.some((w) => w.id === "W-011")).toBe(true);
    expect(fixed.warnings.some((w) => w.id === "W-011")).toBe(false);
  });

  it("keeps W-011 quiet when the step change is small", () => {
    const mild = simulate(
      variableScenario({
        financing: {
          kind: "mortgage",
          downPayment: 40_000,
          annualRate: 0.03,
          durationYears: 25,
          rateSteps: [{ fromYear: 4, annualRate: 0.032 }],
        },
      }),
    );
    expect(mild.warnings.some((w) => w.id === "W-011")).toBe(false);
  });

  it("routes the prepayment through the wealth lens as a real cash flow", () => {
    const withPrepay = simulate(
      variableScenario({
        financing: {
          kind: "mortgage",
          downPayment: 40_000,
          annualRate: 0.03,
          durationYears: 25,
          rateSteps: [],
          prepayments: [{ year: 5, amount: 15_000, mode: "reducePayment" }],
        },
      }),
    );
    const eventMonth = withPrepay.wealthLens.months[5 * 12 - 1]!;
    const baselineMonth = fixed.wealthLens.months[5 * 12 - 1]!;
    expect(eventMonth.outflowBuy).toBeCloseTo(baselineMonth.outflowBuy + 15_000, 6);
    // Debt at the horizon is lower; total interest within the horizon shrinks.
    expect(withPrepay.wealthLens.years.at(-1)!.debtBalance).toBeLessThan(
      fixed.wealthLens.years.at(-1)!.debtBalance,
    );
    expect(withPrepay.summary.totalInterest).toBeLessThan(fixed.summary.totalInterest);
  });
});

describe("sensitivity on a variable-rate mortgage", () => {
  it("shifts the whole rate path, not just the initial level", () => {
    const result = runSensitivity(variableScenario(), undefined, { heatmap: null });
    const up = result.entries.find((entry) => entry.id === "mortgageRate:+");
    const down = result.entries.find((entry) => entry.id === "mortgageRate:-");
    expect(up).toBeDefined();
    expect(down).toBeDefined();
    // Higher rates along the whole path always hurt the buy side.
    expect(up!.advantageDelta).toBeLessThan(-MONEY_EPSILON);
    expect(down!.advantageDelta).toBeGreaterThan(MONEY_EPSILON);
  });
});
