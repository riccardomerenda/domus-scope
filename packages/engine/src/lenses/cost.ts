import { oneTimePaidThrough, recoverablePaidThrough } from "../costs/resolve";
import { type CostBreakdown, type LineItem } from "../explain/line-item";
import { MONEY_EPSILON, normalizeZero } from "../lib/numbers";
import {
  interestDeductionAt,
  propertyGainsTaxAt,
  renovationCreditAt,
  type ProjectionContext,
} from "./context";

/**
 * Lens A — unrecoverable costs (domain spec §5). Itemized per year with full
 * traces; the opportunity cost is shown GROSS and always paired with the
 * appreciation credit (critique W2, BR-019), so nothing is silently netted.
 */

export interface CostLensYear {
  year: number;
  deflator: number;
  /** End-of-year figures. */
  propertyValue: number;
  debtBalance: number;
  rent: CostBreakdown;
  buy: CostBreakdown;
  cumulativeRent: number;
  cumulativeBuyHold: number;
  /** Hold cumulative + hypothetical selling costs at the end of year t (W7). */
  cumulativeBuyLiquidation: number;
}

export interface CostLensResult {
  years: CostLensYear[];
  breakEvenHold: number | null;
  breakEvenLiquidation: number | null;
}

function lineItem(
  id: string,
  label: string,
  amount: number,
  formulaId: string,
  inputs: Record<string, number | string>,
): LineItem {
  return {
    id,
    label,
    amount: normalizeZero(amount),
    formulaId,
    inputs,
    lens: "cost",
    sign: amount < 0 ? "credit" : "cost",
  };
}

function toBreakdown(items: LineItem[]): CostBreakdown {
  return { items, total: normalizeZero(items.reduce((sum, entry) => sum + entry.amount, 0)) };
}

export function runCostLens(ctx: ProjectionContext): CostLensResult {
  const { assumptions, config } = ctx;
  const opportunityOn = config.toggles.opportunityCost;
  const years: CostLensYear[] = [];

  let cumulativeRent = 0;
  let cumulativeBuyHold = 0;
  let cumulativePrincipal = 0;

  for (let t = 1; t <= ctx.horizonYears; t++) {
    const valueStart = ctx.propertyValueEndOfYear(t - 1);
    const valueEnd = ctx.propertyValueEndOfYear(t);
    const scheduleYear = ctx.scheduleYears[t - 1];
    const interest = scheduleYear?.interest ?? 0;
    const debtBalance = scheduleYear?.closingBalance ?? 0;
    const startOfYearMonth = (t - 1) * 12;

    // ----- Rent side -----
    const rentItems: LineItem[] = [
      lineItem("rent.rent", "Rent", ctx.annualRentAt(t), "cost.rent.year", {
        year: t,
        annualRent: ctx.annualRentAt(t),
        rentGrowth: assumptions.rentGrowth,
      }),
    ];
    for (const series of ctx.rentCosts.recurring) {
      rentItems.push(
        lineItem(
          `rent.item.${series.itemId}`,
          series.label,
          series.annual[t - 1] ?? 0,
          "cost.recurringItem",
          {
            year: t,
            itemId: series.itemId,
          },
        ),
      );
    }
    for (const event of ctx.rentCosts.oneTime) {
      if (event.year !== t) continue;
      rentItems.push(
        lineItem(
          `rent.item.${event.itemId}`,
          event.label,
          event.unrecoverable,
          "cost.oneTimeItem",
          {
            month: event.month,
            itemId: event.itemId,
            fullAmount: event.amount,
          },
        ),
      );
    }
    if (opportunityOn) {
      const tiedDeposits = recoverablePaidThrough(ctx.rentCosts.oneTime, startOfYearMonth);
      if (tiedDeposits !== 0) {
        rentItems.push(
          lineItem(
            "rent.depositOpportunity",
            "Opportunity cost of the deposit",
            tiedDeposits * assumptions.alternativeReturn,
            "cost.depositOpportunity",
            { tiedDeposits, alternativeReturn: assumptions.alternativeReturn },
          ),
        );
      }
    }

    // ----- Buy side -----
    const buyItems: LineItem[] = [];
    if (ctx.schedule) {
      buyItems.push(
        lineItem("buy.interest", "Mortgage interest", interest, "cost.interest.year", {
          year: t,
          method: "exact schedule",
        }),
      );
    }
    buyItems.push(
      lineItem(
        "buy.maintenance",
        "Maintenance",
        valueStart * assumptions.maintenanceRate,
        "cost.maintenance.year",
        {
          year: t,
          valueStartOfYear: valueStart,
          maintenanceRate: assumptions.maintenanceRate,
        },
      ),
      lineItem(
        "buy.recurringTax",
        "Recurring ownership taxes",
        valueStart * assumptions.recurringTaxRate,
        "cost.recurringTax.year",
        { year: t, valueStartOfYear: valueStart, recurringTaxRate: assumptions.recurringTaxRate },
      ),
    );
    for (const series of ctx.buyCosts.recurring) {
      buyItems.push(
        lineItem(
          `buy.item.${series.itemId}`,
          series.label,
          series.annual[t - 1] ?? 0,
          "cost.recurringItem",
          {
            year: t,
            itemId: series.itemId,
          },
        ),
      );
    }
    for (const event of ctx.buyCosts.oneTime) {
      if (event.year !== t) continue;
      buyItems.push(
        lineItem(`buy.item.${event.itemId}`, event.label, event.unrecoverable, "cost.oneTimeItem", {
          month: event.month,
          itemId: event.itemId,
          fullAmount: event.amount,
        }),
      );
    }
    const deduction = interestDeductionAt(ctx, interest);
    if (deduction !== 0) {
      buyItems.push(
        lineItem(
          "buy.deduction",
          "Mortgage interest tax credit",
          deduction,
          "cost.deduction.year",
          {
            year: t,
            interest,
            rate: config.taxCredits.mortgageInterestDeduction.rate,
            annualInterestCap: config.taxCredits.mortgageInterestDeduction.annualInterestCap,
          },
        ),
      );
    }
    const renovationCredit = renovationCreditAt(ctx, t);
    if (renovationCredit !== 0) {
      buyItems.push(
        lineItem(
          "buy.renovationCredit",
          "Renovation tax credit",
          renovationCredit,
          "cost.renovationCredit.year",
          {
            year: t,
            rate: config.taxCredits.renovationDeduction.rate,
            cap: config.taxCredits.renovationDeduction.cap,
            years: config.taxCredits.renovationDeduction.years,
          },
        ),
      );
    }
    if (opportunityOn) {
      const investedCapital =
        ctx.initialOutlay +
        oneTimePaidThrough(ctx.buyCosts.oneTime, startOfYearMonth) +
        cumulativePrincipal;
      buyItems.push(
        lineItem(
          "buy.opportunityCost",
          "Opportunity cost of invested capital",
          investedCapital * assumptions.alternativeReturn,
          "cost.opportunity.year",
          { year: t, investedCapital, alternativeReturn: assumptions.alternativeReturn },
        ),
        // BR-019: always paired with the gross opportunity cost above.
        lineItem(
          "buy.appreciationCredit",
          "Home value gain",
          -(valueEnd - valueStart),
          "cost.appreciationCredit.year",
          { year: t, valueStartOfYear: valueStart, valueEndOfYear: valueEnd },
        ),
      );
    }

    const rent = toBreakdown(rentItems);
    const buy = toBreakdown(buyItems);
    cumulativeRent += rent.total;
    cumulativeBuyHold += buy.total;
    cumulativePrincipal += scheduleYear?.principal ?? 0;

    years.push({
      year: t,
      deflator: ctx.deflatorAt(t),
      propertyValue: valueEnd,
      debtBalance,
      rent,
      buy,
      cumulativeRent,
      cumulativeBuyHold,
      // Liquidation adds the hypothetical sale costs and, for a non-primary
      // property sold within 5 years, the capital-gains tax (G15).
      cumulativeBuyLiquidation:
        cumulativeBuyHold + valueEnd * ctx.input.sellingCostRate + propertyGainsTaxAt(ctx, t),
    });
  }

  return {
    years,
    breakEvenHold: firstYearWhere(
      years,
      (y) => y.cumulativeBuyHold <= y.cumulativeRent + MONEY_EPSILON,
    ),
    breakEvenLiquidation: firstYearWhere(
      years,
      (y) => y.cumulativeBuyLiquidation <= y.cumulativeRent + MONEY_EPSILON,
    ),
  };
}

function firstYearWhere(
  years: CostLensYear[],
  predicate: (year: CostLensYear) => boolean,
): number | null {
  for (const year of years) if (predicate(year)) return year.year;
  return null;
}
