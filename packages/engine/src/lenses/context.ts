import { resolveCostItems, type ResolvedCosts } from "../costs/resolve";
import {
  aggregateByYear,
  buildAmortizationSchedule,
  steppedRateFromYears,
  type AmortizationSchedule,
  type AmortizationYear,
} from "../mortgage";
import { type EconomicAssumptions } from "../schemas/assumptions";
import { type EngineConfig } from "../schemas/engine-config";
import { type ScenarioInput } from "../schemas/scenario-input";

/**
 * Shared projection context: both lenses read the same property-value curve,
 * rent curve, amortization schedule, and resolved cost items, so they can
 * never disagree on the underlying trajectories (BR-017 stays a presentation
 * distinction, not a data fork).
 *
 * Time conventions:
 * - `propertyValueEndOfYear(0)` = market value (defaults to the price paid);
 *   end of year t = marketValue × (1+g)^t.
 * - Year-t rent = base rent × (1+rentGrowth)^(t−1): year 1 is the base rent.
 * - Percent-of-value amounts use the START-of-year value, so year 1 uses the
 *   purchase price exactly (matches the source-document examples).
 */
export interface ProjectionContext {
  input: ScenarioInput;
  config: EngineConfig;
  assumptions: EconomicAssumptions;
  horizonYears: number;
  months: number;
  price: number;
  /** = price for cash purchases. */
  initialOutlay: number;
  mortgagePrincipal: number;
  schedule: AmortizationSchedule | null;
  /** Length = horizon; zero rows after payoff (G7). */
  scheduleYears: AmortizationYear[];
  buyCosts: ResolvedCosts;
  rentCosts: ResolvedCosts;
  propertyValueEndOfYear(t: number): number;
  annualRentAt(t: number): number;
  /** (1 + inflation)^t — divide nominal year-t figures by this for real terms. */
  deflatorAt(t: number): number;
}

export function buildContext(
  input: ScenarioInput,
  config: EngineConfig,
  assumptions: EconomicAssumptions,
): ProjectionContext {
  const horizonYears = input.horizonYears;
  const price = input.property.price;
  // FR-021: the value curve anchors to the market value, not the price paid,
  // so a below-market purchase is day-0 equity, not phantom appreciation.
  const marketValue = input.property.marketValue ?? price;
  const baseAnnualRent = input.rentAlternative.equivalentMonthlyRent * 12;

  const propertyValueEndOfYear = (t: number): number =>
    marketValue * Math.pow(1 + assumptions.homeAppreciation, t);
  const annualRentAt = (t: number): number =>
    baseAnnualRent * Math.pow(1 + assumptions.rentGrowth, t - 1);
  const deflatorAt = (t: number): number => Math.pow(1 + assumptions.inflation, t);

  const mortgagePrincipal =
    input.financing.kind === "mortgage" ? price - input.financing.downPayment : 0;
  const schedule =
    input.financing.kind === "mortgage" && mortgagePrincipal > 0
      ? buildAmortizationSchedule({
          principal: mortgagePrincipal,
          durationYears: input.financing.durationYears,
          // Empty steps degrade to a fixed rate (G9).
          rate: steppedRateFromYears(input.financing.annualRate, input.financing.rateSteps),
          // Prepayments land with the last payment of their year.
          prepayments: input.financing.prepayments.map((event) => ({
            month: event.year * 12,
            amount: event.amount,
            mode: event.mode,
          })),
        })
      : null;
  const scheduleYears = schedule
    ? aggregateByYear(schedule, horizonYears)
    : Array.from({ length: horizonYears }, (_, index) => ({
        year: index + 1,
        interest: 0,
        principal: 0,
        totalPaid: 0,
        closingBalance: 0,
      }));

  const costCtx = {
    horizonYears,
    propertyValueStartOfYear: (t: number) => propertyValueEndOfYear(t - 1),
    annualRentAt,
    cadastralValue: input.property.cadastralValue ?? null,
  };

  return {
    input,
    config,
    assumptions,
    horizonYears,
    months: horizonYears * 12,
    price,
    initialOutlay: input.financing.kind === "mortgage" ? input.financing.downPayment : price,
    mortgagePrincipal,
    schedule,
    scheduleYears,
    buyCosts: resolveCostItems(input.costItems, "buy", costCtx),
    rentCosts: resolveCostItems(input.costItems, "rent", costCtx),
    propertyValueEndOfYear,
    annualRentAt,
    deflatorAt,
  };
}

/** Annual mortgage-interest tax credit (G4), negative or zero. Primary residence only. */
export function interestDeductionAt(ctx: ProjectionContext, yearInterest: number): number {
  if (!ctx.schedule || !ctx.config.toggles.mortgageInterestDeduction) return 0;
  if (!ctx.input.property.primaryResidence) return 0;
  const { rate, annualInterestCap } = ctx.config.taxCredits.mortgageInterestDeduction;
  return -(rate * Math.min(yearInterest, annualInterestCap));
}

/**
 * G14: detrazione ristrutturazione — year-t installment of the credit earned
 * by eligible one-time works (50% of the capped spend over 10 years). ≤ 0.
 */
export function renovationCreditAt(ctx: ProjectionContext, t: number): number {
  if (!ctx.config.toggles.renovationDeduction) return 0;
  const { rate, cap, years } = ctx.config.taxCredits.renovationDeduction;
  let credit = 0;
  for (const event of ctx.buyCosts.oneTime) {
    if (!event.renovationCredit || event.amount <= 0) continue;
    if (t >= event.year && t < event.year + years) {
      credit += (rate * Math.min(event.amount, cap)) / years;
    }
  }
  return -credit;
}

/**
 * G15: plusvalenza — tax due on the property gain if sold at the end of year
 * t. Primary residences are exempt; so are sales from `withinYears` on. The
 * taxable gain is the sale value net of selling costs minus the price paid.
 */
export function propertyGainsTaxAt(ctx: ProjectionContext, t: number): number {
  if (ctx.input.property.primaryResidence) return 0;
  if (t >= ctx.config.propertyCapitalGains.withinYears) return 0;
  const value = ctx.propertyValueEndOfYear(t);
  const gain = value - value * ctx.input.sellingCostRate - ctx.price;
  return gain > 0 ? ctx.config.propertyCapitalGains.rate * gain : 0;
}
