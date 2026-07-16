import { type RateSchedule } from "./rate-schedule";

/**
 * Partial early repayment (estinzione anticipata parziale): `amount` of extra
 * principal paid together with the payment of `month`. `reducePayment`
 * re-amortizes the remaining balance over the remaining contractual months
 * (the common Italian bank default); `reduceDuration` keeps the payment so
 * the mortgage closes earlier. Amounts beyond the open balance are clamped;
 * events after payoff are ignored.
 */
export interface PrepaymentEvent {
  /** 1-based month index. */
  month: number;
  amount: number;
  mode: "reducePayment" | "reduceDuration";
}

export interface AmortizationInput {
  /** Initial mortgage principal in EUR, > 0. */
  principal: number;
  /** Contract duration in whole years; independent from the horizon (BR-004). */
  durationYears: number;
  rate: RateSchedule;
  prepayments?: PrepaymentEvent[];
}

export interface AmortizationMonth {
  /** 1-based month index. */
  month: number;
  openingBalance: number;
  /** Actual cash out: includes any extra principal prepaid this month. */
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface AmortizationSchedule {
  input: { principal: number; durationYears: number };
  /** May end before `durationYears × 12` when prepayments close the loan early. */
  months: AmortizationMonth[];
  /** The initial constant payment; recomputed only on rate changes/prepayments. */
  monthlyPayment: number;
  totalInterest: number;
  totalPrincipal: number;
}

export interface AmortizationYear {
  /** 1-based year index. */
  year: number;
  interest: number;
  principal: number;
  totalPaid: number;
  closingBalance: number;
}

/**
 * Monthly rates below this are treated as exactly zero: over 50 years on any
 * realistic principal they produce sub-cent interest, and keeping them in the
 * arithmetic only injects floating-point noise (denormal quantization).
 */
const ZERO_RATE_THRESHOLD = 1e-12;

function effectiveMonthlyRate(annualRate: number): number {
  const monthlyRate = annualRate / 12;
  return monthlyRate < ZERO_RATE_THRESHOLD ? 0 : monthlyRate;
}

/**
 * Constant payment of a French amortization plan.
 * Zero (or economically zero) rate falls back to linear repayment — no
 * division by zero (TV-04).
 */
export function frenchMonthlyPayment(
  principal: number,
  monthlyRate: number,
  numberOfPayments: number,
): number {
  if (numberOfPayments < 1) {
    throw new RangeError(`Number of payments must be ≥ 1, got ${numberOfPayments}`);
  }
  if (monthlyRate < ZERO_RATE_THRESHOLD) return principal / numberOfPayments;
  // expm1/log1p keep (1+i)^n − 1 accurate for arbitrarily small rates, where
  // the naive Math.pow(1 + i, n) - 1 loses i inside 1 + i and the payment
  // degenerates.
  const growthMinusOne = Math.expm1(numberOfPayments * Math.log1p(monthlyRate));
  return (principal * monthlyRate * (growthMinusOne + 1)) / growthMinusOne;
}

/**
 * Monthly French amortization schedule.
 *
 * Numeric policy (§10): double precision, no intermediate rounding; the final
 * payment absorbs the floating-point residue so the closing balance is exactly
 * zero and yearly aggregates stay consistent.
 */
export function buildAmortizationSchedule(input: AmortizationInput): AmortizationSchedule {
  const { principal, durationYears, rate } = input;
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new RangeError(`Principal must be a finite number > 0, got ${principal}`);
  }
  if (!Number.isInteger(durationYears) || durationYears < 1) {
    throw new RangeError(`Duration must be a whole number of years ≥ 1, got ${durationYears}`);
  }
  const prepaymentsByMonth = new Map<number, PrepaymentEvent[]>();
  for (const event of input.prepayments ?? []) {
    if (!Number.isInteger(event.month) || event.month < 1) {
      throw new RangeError(`Prepayment month must be a whole number ≥ 1, got ${event.month}`);
    }
    if (!Number.isFinite(event.amount) || event.amount <= 0) {
      throw new RangeError(`Prepayment amount must be a finite number > 0, got ${event.amount}`);
    }
    const list = prepaymentsByMonth.get(event.month) ?? [];
    list.push(event);
    prepaymentsByMonth.set(event.month, list);
  }

  const numberOfPayments = durationYears * 12;
  const months: AmortizationMonth[] = [];
  let balance = principal;
  let currentAnnualRate = rate.annualRateAt(1);
  let monthlyRate = effectiveMonthlyRate(currentAnnualRate);
  let payment = frenchMonthlyPayment(balance, monthlyRate, numberOfPayments);
  const initialPayment = payment;
  let totalInterest = 0;

  for (let month = 1; month <= numberOfPayments; month++) {
    const annualRate = rate.annualRateAt(month);
    if (!Number.isFinite(annualRate) || annualRate < 0) {
      throw new RangeError(`Annual rate at month ${month} must be ≥ 0, got ${annualRate}`);
    }
    if (annualRate !== currentAnnualRate) {
      // Variable-rate hook (G9): re-amortize the remaining balance over the
      // remaining contractual months at the new rate.
      currentAnnualRate = annualRate;
      monthlyRate = effectiveMonthlyRate(annualRate);
      payment = frenchMonthlyPayment(balance, monthlyRate, numberOfPayments - month + 1);
    }

    const openingBalance = balance;
    const interest = openingBalance * monthlyRate;
    let principalPart = payment - interest;
    let actualPayment = payment;
    if (month === numberOfPayments || principalPart > openingBalance) {
      principalPart = openingBalance;
      actualPayment = interest + principalPart;
    }

    // Extra principal lands after the regular payment of this month; the row's
    // payment is the true cash out, so both lenses see it without special cases.
    const events = prepaymentsByMonth.get(month) ?? [];
    let extraPrincipal = 0;
    let reamortize = false;
    for (const event of events) {
      const extra = Math.min(event.amount, openingBalance - principalPart - extraPrincipal);
      if (extra <= 0) continue;
      extraPrincipal += extra;
      if (event.mode === "reducePayment") reamortize = true;
    }
    principalPart += extraPrincipal;
    actualPayment += extraPrincipal;
    const closingBalance = openingBalance - principalPart;

    months.push({
      month,
      openingBalance,
      payment: actualPayment,
      interest,
      principal: principalPart,
      closingBalance,
    });
    totalInterest += interest;
    balance = closingBalance;

    if (balance === 0) break; // prepaid to zero: the mortgage is closed
    if (reamortize && month < numberOfPayments) {
      payment = frenchMonthlyPayment(balance, monthlyRate, numberOfPayments - month);
    }
  }

  return {
    input: { principal, durationYears },
    months,
    monthlyPayment: initialPayment,
    totalInterest,
    totalPrincipal: principal,
  };
}

/**
 * Aggregates a monthly schedule into years, extending with zero rows beyond
 * payoff so horizons longer than the mortgage are well-defined (G7, TV-05).
 */
export function aggregateByYear(
  schedule: AmortizationSchedule,
  horizonYears: number,
): AmortizationYear[] {
  if (!Number.isInteger(horizonYears) || horizonYears < 1) {
    throw new RangeError(`Horizon must be a whole number of years ≥ 1, got ${horizonYears}`);
  }
  const result: AmortizationYear[] = [];
  for (let year = 1; year <= horizonYears; year++) {
    const firstMonth = (year - 1) * 12 + 1;
    let interest = 0;
    let principalRepaid = 0;
    let totalPaid = 0;
    let closingBalance = 0;
    for (let month = firstMonth; month <= year * 12; month++) {
      const row = schedule.months[month - 1];
      if (row === undefined) break; // beyond payoff: the mortgage is closed
      interest += row.interest;
      principalRepaid += row.principal;
      totalPaid += row.payment;
      closingBalance = row.closingBalance;
    }
    result.push({ year, interest, principal: principalRepaid, totalPaid, closingBalance });
  }
  return result;
}
