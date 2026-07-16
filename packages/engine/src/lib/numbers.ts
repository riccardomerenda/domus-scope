/** Collapses IEEE-754 negative zero to positive zero so traces never expose −0. */
export function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Absolute tolerance for money comparisons (break-evens, zero checks): one
 * millionth of a euro. Deliberately absolute — €-denominated quantities have
 * a natural scale, so a relative epsilon would only add noise. Rate and band
 * comparisons use `config.epsilon` instead (§10 numeric policy).
 */
export const MONEY_EPSILON = 1e-6;
