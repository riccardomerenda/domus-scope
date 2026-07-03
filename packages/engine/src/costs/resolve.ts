import { type CostItem } from "../schemas/cost-item";

/**
 * Cost-item resolution (domain spec §4): turns the declarative catalog into
 * concrete yearly amounts and one-time events. This module is the only place
 * that interprets CostItem semantics — the lenses consume resolved numbers.
 *
 * Conventions:
 * - Amounts are signed: `sign: "credit"` items produce negative numbers.
 * - Recurring items are always unrecoverable (recoverability applies to
 *   one-time items: deposits, renovations).
 * - `growth` applies to `fixedAnnual` bases only; percent bases inherently
 *   track their reference (start-of-year property value, year-t annual rent).
 */

export interface OneTimeEvent {
  itemId: string;
  label: string;
  /** 0 = at closing. Events beyond the horizon are dropped. */
  month: number;
  /** Year the event belongs to (month 0 → year 1). */
  year: number;
  /** Full signed cash amount. */
  amount: number;
  /** Signed share that never comes back (Lens A cost). */
  unrecoverable: number;
  /** Signed share returned at liquidation (deposit, renovation value). */
  recoverable: number;
}

export interface RecurringSeries {
  itemId: string;
  label: string;
  /** Signed annual amounts; index 0 = year 1. */
  annual: number[];
}

export interface ResolvedCosts {
  oneTime: OneTimeEvent[];
  recurring: RecurringSeries[];
}

export interface CostResolutionContext {
  horizonYears: number;
  /** Property value at the START of year t (t = 1 → price). */
  propertyValueStartOfYear(t: number): number;
  /** Annual rent for year t (t = 1 → base rent × 12). */
  annualRentAt(t: number): number;
}

function recoverableShare(item: CostItem): number {
  switch (item.recoverability.kind) {
    case "none":
      return 0;
    case "full":
      return 1;
    case "partial":
      return item.recoverability.share;
  }
}

export function resolveCostItems(
  items: CostItem[],
  side: "buy" | "rent",
  ctx: CostResolutionContext,
): ResolvedCosts {
  const oneTime: OneTimeEvent[] = [];
  const recurring: RecurringSeries[] = [];

  for (const item of items) {
    if (!item.enabled) continue;
    if (item.scenario !== side && item.scenario !== "both") continue;
    const signFactor = item.sign === "credit" ? -1 : 1;

    if (item.timing.kind === "oneTime") {
      const { month, amount } = item.timing;
      if (month > ctx.horizonYears * 12) continue;
      const signedAmount = signFactor * amount;
      const recoverable = signedAmount * recoverableShare(item);
      oneTime.push({
        itemId: item.id,
        label: item.label,
        month,
        year: Math.max(1, Math.ceil(month / 12)),
        amount: signedAmount,
        unrecoverable: signedAmount - recoverable,
        recoverable,
      });
      continue;
    }

    const { base, growth } = item.timing;
    const annual: number[] = [];
    for (let year = 1; year <= ctx.horizonYears; year++) {
      let amount: number;
      switch (base.kind) {
        case "fixedAnnual":
          switch (growth.kind) {
            case "rate":
              amount = base.amount * Math.pow(1 + growth.rate, year - 1);
              break;
            case "tracksValue":
              amount =
                (base.amount * ctx.propertyValueStartOfYear(year)) /
                ctx.propertyValueStartOfYear(1);
              break;
            case "tracksRent":
              amount = (base.amount * ctx.annualRentAt(year)) / ctx.annualRentAt(1);
              break;
          }
          break;
        case "percentOfValue":
          amount = base.rate * ctx.propertyValueStartOfYear(year);
          break;
        case "percentOfRent":
          amount = base.rate * ctx.annualRentAt(year);
          break;
      }
      annual.push(signFactor * amount);
    }
    recurring.push({ itemId: item.id, label: item.label, annual });
  }

  return { oneTime, recurring };
}

/** Total signed one-time cash paid at or before `month`. */
export function oneTimePaidThrough(events: OneTimeEvent[], month: number): number {
  return events.reduce((sum, event) => (event.month <= month ? sum + event.amount : sum), 0);
}

/** Total signed recoverable capital paid at or before `month`. */
export function recoverablePaidThrough(events: OneTimeEvent[], month: number): number {
  return events.reduce((sum, event) => (event.month <= month ? sum + event.recoverable : sum), 0);
}
