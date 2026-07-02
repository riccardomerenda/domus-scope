/**
 * Annual interest rate as a function of the 1-based month index.
 *
 * The MVP ships fixed rates only; variable-rate mortgages (G9) plug in here —
 * the amortization algorithm already recomputes the payment whenever the rate
 * changes, so no redesign is needed.
 */
export interface RateSchedule {
  annualRateAt(month: number): number;
}

export function fixedRate(annualRate: number): RateSchedule {
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new RangeError(`Mortgage annual rate must be a finite number ≥ 0, got ${annualRate}`);
  }
  return { annualRateAt: () => annualRate };
}
