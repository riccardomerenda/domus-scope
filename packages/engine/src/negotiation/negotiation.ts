import { resolveAssumptions } from "../config/resolve";
import { type EconomicAssumptions } from "../schemas/assumptions";
import { defaultEngineConfig, type EngineConfig } from "../schemas/engine-config";
import { type ScenarioInput } from "../schemas/scenario-input";
import { noNegotiationWindowWarning, type EngineWarning } from "../rules/warnings";
import { simulate } from "../simulation/simulate";

/**
 * Negotiation lens (Phase 8, docs/07-negotiation-lens.md, FR-021…FR-023).
 *
 * The reservation price P* is the transaction price at which the wealth-lens
 * advantage at the horizon is zero, holding the market value anchored
 * (BR-023: always derived, never stored). With the value curve fixed,
 * advantage(P) is strictly decreasing in P — every extra euro of price raises
 * the principal or the renter's starting portfolio without changing what the
 * house is worth — so bisection finds the unique crossing deterministically.
 *
 * Like everything else in the engine: no I/O, no rounding, no randomness.
 * Cost items are held as configured while the price varies (BR-025).
 */

/** Fixed iteration count keeps the solver deterministic (§10): no tolerance exits. */
const BISECTION_ITERATIONS = 50;

/**
 * Average discount between asking and closing prices from Banca d'Italia's
 * quarterly housing-market survey ("Sondaggio congiunturale sul mercato delle
 * abitazioni"). A starting point, not a promise — editable per scenario.
 */
export const DEFAULT_TYPICAL_DISCOUNT = 0.085;

/** Joint assumption shift for the stressed reservation range (§2.3 of the plan). */
export interface NegotiationStress {
  assumptionDeltas: Partial<Record<keyof EconomicAssumptions, number>>;
  /** Rate points added to the mortgage rate; ignored for cash purchases. */
  mortgageRateDelta: number;
}

export interface NegotiationPlan {
  /** Transaction-price search domain. */
  bounds: { min: number; max: number };
  /** Reuses the OAT tornado deltas, applied jointly (worst plausible corner). */
  stress: { pessimistic: NegotiationStress; optimistic: NegotiationStress };
}

export type ReservationStatus = "solved" | "buyAlwaysWins" | "rentAlwaysWins";

export interface ReservationSolution {
  /** P* where the advantage crosses zero; null when there is no crossing in bounds. */
  price: number | null;
  status: ReservationStatus;
  bounds: { min: number; max: number };
  advantageAtMin: number;
  advantageAtMax: number;
}

/** Prices where the verdict enters/leaves GREY_ZONE (wealthGreyBandFraction). */
export interface IndifferenceBand {
  /** Below this price the verdict is a clear BUY (null: never clear in bounds). */
  clearBuyBelow: number | null;
  /** Above this price the verdict is a clear RENT (null: never clear in bounds). */
  clearRentAbove: number | null;
}

export type ConcessionKind = "earlyPossession" | "furniture" | "remediation" | "custom";

export interface Concession {
  id: string;
  kind: ConcessionKind;
  /** Receiving value raises your indifference price; giving lowers it. */
  direction: "youReceive" | "youGive";
  /** Price-equivalent in EUR, from the helpers below or user-estimated. */
  amount: number;
  label: string;
}

export type NegotiationWindowKind =
  "askingAcceptable" | "withinTypical" | "needsAtypicalDiscount" | "none";

export interface NegotiationParams {
  askingPrice: number;
  /** Fraction of the asking price a typical negotiation concedes. */
  typicalDiscount?: number;
  concessions?: Concession[];
}

export interface NegotiationResult {
  /** The anchor of the value curve (marketValue ?? price). */
  marketValue: number;
  /** The transaction price the scenario currently evaluates. */
  basePrice: number;
  reservation: ReservationSolution;
  indifferenceBand: IndifferenceBand;
  stress: { pessimistic: ReservationSolution; optimistic: ReservationSolution };
  asking: { price: number; typicalDiscount: number; expectedPrice: number };
  /** 1 − (P* / asking); negative when even the asking price is acceptable; null when P* is. */
  requiredDiscount: number | null;
  window: { kind: NegotiationWindowKind; range: { low: number; high: number } | null };
  concessions: { balance: number; adjustedReservationPrice: number | null };
  warnings: EngineWarning[];
}

/** Rent you stop paying by moving in `months` earlier (FR-023). */
export function earlyPossessionEquivalent(equivalentMonthlyRent: number, months: number): number {
  return equivalentMonthlyRent * months;
}

/** Σ received − Σ given, in EUR. */
export function concessionBalance(concessions: Concession[]): number {
  return concessions.reduce(
    (sum, c) => sum + (c.direction === "youReceive" ? c.amount : -c.amount),
    0,
  );
}

/** P* shifted by the concession balance; null stays null (no crossing to shift). */
export function adjustedReservationPrice(
  reservationPrice: number | null,
  concessions: Concession[],
): number | null {
  if (reservationPrice === null) return null;
  return reservationPrice + concessionBalance(concessions);
}

/**
 * The scenario re-priced at a candidate transaction price, with the value
 * curve anchored to the current market value so the sweep compares like with
 * like. Also what the offer log uses to evaluate an offered price.
 */
export function scenarioAtPrice(input: ScenarioInput, price: number): ScenarioInput {
  const marketValue = input.property.marketValue ?? input.property.price;
  return { ...input, property: { ...input.property, price, marketValue } };
}

export function defaultNegotiationPlan(
  input: ScenarioInput,
  askingPrice?: number,
): NegotiationPlan {
  const marketValue = input.property.marketValue ?? input.property.price;
  const top = Math.max(marketValue, input.property.price, askingPrice ?? 0);
  const min = input.financing.kind === "mortgage" ? Math.max(input.financing.downPayment, 1) : 1;
  const shift = 0.01;
  return {
    bounds: { min, max: Math.max(top * 2, min + 1) },
    stress: {
      pessimistic: {
        assumptionDeltas: {
          rentGrowth: -shift,
          homeAppreciation: -shift,
          alternativeReturn: shift,
          maintenanceRate: shift / 2,
        },
        mortgageRateDelta: shift,
      },
      optimistic: {
        assumptionDeltas: {
          rentGrowth: shift,
          homeAppreciation: shift,
          alternativeReturn: -shift,
          maintenanceRate: -shift / 2,
        },
        mortgageRateDelta: -shift,
      },
    },
  };
}

function applyStress(
  input: ScenarioInput,
  config: EngineConfig,
  stress: NegotiationStress,
): ScenarioInput {
  const base = resolveAssumptions(config.assumptions, input.assumptions).values;
  const overrides: ScenarioInput["assumptions"] = { ...input.assumptions };
  for (const [key, delta] of Object.entries(stress.assumptionDeltas)) {
    const k = key as keyof EconomicAssumptions;
    overrides[k] = base[k] + delta;
  }
  const financing =
    input.financing.kind === "mortgage"
      ? {
          ...input.financing,
          annualRate: Math.max(input.financing.annualRate + stress.mortgageRateDelta, 0),
        }
      : input.financing;
  return { ...input, assumptions: overrides, financing };
}

/**
 * Bisection for a decreasing f over [lo, hi]. Returns null unless
 * f(lo) ≥ 0 ≥ f(hi) (the crossing must be bracketed).
 */
function bisectDecreasing(
  f: (x: number) => number,
  lo: number,
  hi: number,
  fLo: number,
  fHi: number,
): number | null {
  if (fLo < 0 || fHi > 0) return null;
  let a = lo;
  let b = hi;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (a + b) / 2;
    if (f(mid) >= 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/**
 * Solves advantage(P) = 0 over the plan bounds (FR-021). `buyAlwaysWins` /
 * `rentAlwaysWins` report which side holds across the whole searched range.
 */
export function solveReservationPrice(
  input: ScenarioInput,
  config: EngineConfig = defaultEngineConfig,
  planOverrides?: Partial<NegotiationPlan>,
): ReservationSolution {
  const plan = { ...defaultNegotiationPlan(input), ...planOverrides };
  const { min, max } = plan.bounds;
  const advantageAt = (price: number): number =>
    simulate(scenarioAtPrice(input, price), config).summary.advantageAtHorizon;

  const advantageAtMin = advantageAt(min);
  const advantageAtMax = advantageAt(max);
  const base = { bounds: plan.bounds, advantageAtMin, advantageAtMax };

  if (advantageAtMin < 0) return { price: null, status: "rentAlwaysWins", ...base };
  if (advantageAtMax > 0) return { price: null, status: "buyAlwaysWins", ...base };
  const price = bisectDecreasing(advantageAt, min, max, advantageAtMin, advantageAtMax);
  // Unreachable fallback: the brackets above guarantee a crossing.
  if (price === null) return { price: null, status: "rentAlwaysWins", ...base };
  return { price, status: "solved", ...base };
}

/**
 * Prices where |advantage| = wealthGreyBandFraction × P — the edges of the
 * GREY_ZONE verdict along the price axis. Each edge is solved independently
 * and reported null when not bracketed by the bounds.
 */
function solveIndifferenceBand(
  input: ScenarioInput,
  config: EngineConfig,
  bounds: { min: number; max: number },
): IndifferenceBand {
  const fraction = config.wealthGreyBandFraction;
  const advantageAt = (price: number): number =>
    simulate(scenarioAtPrice(input, price), config).summary.advantageAtHorizon;

  const solveEdge = (sign: 1 | -1): number | null => {
    // f(P) = advantage(P) − sign·fraction·P, decreasing for realistic configs.
    const f = (price: number): number => advantageAt(price) - sign * fraction * price;
    return bisectDecreasing(f, bounds.min, bounds.max, f(bounds.min), f(bounds.max));
  };

  return { clearBuyBelow: solveEdge(1), clearRentAbove: solveEdge(-1) };
}

/**
 * The full negotiation read (FR-021/FR-022/FR-023): reservation price with
 * grey band and stressed range, the window against the asking price and the
 * typical discount, concession-adjusted boundary, and W-010 when the required
 * discount is atypical. Never feeds back into the scenario verdict (BR-024).
 */
export function runNegotiation(
  input: ScenarioInput,
  params: NegotiationParams,
  config: EngineConfig = defaultEngineConfig,
  planOverrides?: Partial<NegotiationPlan>,
): NegotiationResult {
  const typicalDiscount = params.typicalDiscount ?? DEFAULT_TYPICAL_DISCOUNT;
  const concessions = params.concessions ?? [];
  const askingPrice = params.askingPrice;
  const plan = { ...defaultNegotiationPlan(input, askingPrice), ...planOverrides };

  const reservation = solveReservationPrice(input, config, plan);
  const indifferenceBand = solveIndifferenceBand(input, config, plan.bounds);
  const stress = {
    pessimistic: solveReservationPrice(
      applyStress(input, config, plan.stress.pessimistic),
      config,
      plan,
    ),
    optimistic: solveReservationPrice(
      applyStress(input, config, plan.stress.optimistic),
      config,
      plan,
    ),
  };

  const expectedPrice = askingPrice * (1 - typicalDiscount);
  // buyAlwaysWins means P* lies above the whole searched range, hence above asking.
  const effectiveReservation =
    reservation.status === "buyAlwaysWins" ? Number.POSITIVE_INFINITY : reservation.price;

  const requiredDiscount = reservation.price !== null ? 1 - reservation.price / askingPrice : null;

  let window: NegotiationResult["window"];
  if (effectiveReservation === null) {
    window = { kind: "none", range: null };
  } else if (effectiveReservation >= askingPrice) {
    window = { kind: "askingAcceptable", range: { low: expectedPrice, high: askingPrice } };
  } else if (effectiveReservation >= expectedPrice) {
    window = { kind: "withinTypical", range: { low: expectedPrice, high: effectiveReservation } };
  } else {
    window = { kind: "needsAtypicalDiscount", range: null };
  }

  const warnings: EngineWarning[] =
    window.kind === "needsAtypicalDiscount" || window.kind === "none"
      ? [
          noNegotiationWindowWarning(
            askingPrice,
            reservation.price,
            requiredDiscount,
            typicalDiscount,
          ),
        ]
      : [];

  return {
    marketValue: input.property.marketValue ?? input.property.price,
    basePrice: input.property.price,
    reservation,
    indifferenceBand,
    stress,
    asking: { price: askingPrice, typicalDiscount, expectedPrice },
    requiredDiscount,
    window,
    concessions: {
      balance: concessionBalance(concessions),
      adjustedReservationPrice: adjustedReservationPrice(reservation.price, concessions),
    },
    warnings,
  };
}
