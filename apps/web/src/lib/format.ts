/**
 * Presentation-layer formatting (domain spec §10): the engine never rounds or
 * formats; everything user-visible goes through here. it-IT conventions, EUR.
 */
const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurSigned = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export function formatEUR(value: number): string {
  return eur.format(value);
}

export function formatEURSigned(value: number): string {
  return eurSigned.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(epochMs),
  );
}

/** Heuristic display for explanation-drawer input values. */
export function formatTraceValue(key: string, value: number | string): string {
  if (typeof value === "string") return value;
  if (
    /rate|return|growth|ltv|band|appreciation|inflation|share|tax(?!e)/i.test(key) &&
    Math.abs(value) <= 1
  ) {
    return formatPercent(value, 2);
  }
  if (Number.isInteger(value)) return formatNumber(value);
  return formatNumber(value, 2);
}
