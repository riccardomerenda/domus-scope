/** Collapses IEEE-754 negative zero to positive zero so traces never expose −0. */
export function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}
