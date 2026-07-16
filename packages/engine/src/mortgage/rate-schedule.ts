/**
 * Annual interest rate as a function of the 1-based month index.
 *
 * `fixedRate` covers fixed mortgages; `steppedRate` models variable-rate
 * scenarios (G9) as an explicit, deterministic path of step changes — the
 * amortization algorithm re-amortizes the remaining balance whenever the rate
 * changes. Paths are data the user can see and edit, never a stochastic model.
 */
export interface RateSchedule {
  annualRateAt(month: number): number;
}

function assertValidRate(annualRate: number, label: string): void {
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new RangeError(`${label} must be a finite number ≥ 0, got ${annualRate}`);
  }
}

export function fixedRate(annualRate: number): RateSchedule {
  assertValidRate(annualRate, "Mortgage annual rate");
  return { annualRateAt: () => annualRate };
}

/** A rate change effective from `fromMonth` (1-based) onward. */
export interface MonthlyRateStep {
  fromMonth: number;
  annualRate: number;
}

/**
 * Step-wise rate: `initialAnnualRate` from month 1, each step overriding from
 * its month onward. Steps must be strictly increasing in `fromMonth` ≥ 2.
 */
export function steppedRate(initialAnnualRate: number, steps: MonthlyRateStep[]): RateSchedule {
  assertValidRate(initialAnnualRate, "Initial mortgage annual rate");
  steps.forEach((step, index) => {
    assertValidRate(step.annualRate, `Rate step ${index + 1} annual rate`);
    if (!Number.isInteger(step.fromMonth) || step.fromMonth < 2) {
      throw new RangeError(
        `Rate step ${index + 1} must start at a whole month ≥ 2, got ${step.fromMonth}`,
      );
    }
    if (index > 0 && step.fromMonth <= steps[index - 1]!.fromMonth) {
      throw new RangeError("Rate steps must have strictly increasing months");
    }
  });
  if (steps.length === 0) return fixedRate(initialAnnualRate);
  return {
    annualRateAt(month: number): number {
      let rate = initialAnnualRate;
      for (const step of steps) {
        if (month < step.fromMonth) break;
        rate = step.annualRate;
      }
      return rate;
    },
  };
}

/** Yearly variant: each step takes effect from the first month of `fromYear`. */
export function steppedRateFromYears(
  initialAnnualRate: number,
  steps: { fromYear: number; annualRate: number }[],
): RateSchedule {
  return steppedRate(
    initialAnnualRate,
    steps.map((step) => ({
      fromMonth: (step.fromYear - 1) * 12 + 1,
      annualRate: step.annualRate,
    })),
  );
}
