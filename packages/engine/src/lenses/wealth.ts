import { recoverablePaidThrough, type OneTimeEvent } from "../costs/resolve";
import { type CostBreakdown, type LineItem } from "../explain/line-item";
import { MONEY_EPSILON, normalizeZero } from "../lib/numbers";
import {
  interestDeductionAt,
  propertyGainsTaxAt,
  renovationCreditAt,
  type ProjectionContext,
} from "./context";

/**
 * Lens B — net-worth simulation (domain spec §6). Both agents start with the
 * same capital and share the same monthly budget (the max of the two
 * outflows); whoever spends less invests the difference at r_alt. There is no
 * opportunity-cost line item in this lens — it is implicit in the portfolios
 * (critique W1: the lenses are never mixed).
 *
 * Conventions:
 * - Portfolios compound at r_alt / 12 per month (spec §6); deposits made in a
 *   month start earning the following month.
 * - Capital-gains tax applies only on the liquidation basis, to portfolio
 *   gains above contributed capital (G5).
 * - Recoverable one-time payments (deposit, retained renovation value) are
 *   returned flat — no appreciation — on both bases for deposits, and as
 *   extra sale proceeds for buy-side items on the liquidation basis.
 */

export interface WealthLensMonth {
  month: number;
  outflowBuy: number;
  outflowRent: number;
  budget: number;
  buyerDeposit: number;
  renterDeposit: number;
  buyerPortfolio: number;
  renterPortfolio: number;
}

export interface WealthLensYear {
  year: number;
  deflator: number;
  /** End-of-year figures. */
  propertyValue: number;
  debtBalance: number;
  buyerPortfolio: number;
  renterPortfolio: number;
  wealthBuyHold: number;
  wealthBuyLiquidation: number;
  wealthRentHold: number;
  wealthRentLiquidation: number;
  advantageHold: number;
  advantageLiquidation: number;
}

export interface WealthLensResult {
  /** W₀: the capital both agents start with (buyer's full initial outlay). */
  initialCapital: number;
  months: WealthLensMonth[];
  years: WealthLensYear[];
  breakEvenHold: number | null;
  breakEvenLiquidation: number | null;
  /** Traced composition of each side's liquidation wealth at the horizon. */
  buyCompositionAtHorizon: CostBreakdown;
  rentCompositionAtHorizon: CostBreakdown;
}

function oneTimeAtMonth(events: OneTimeEvent[], month: number): number {
  return events.reduce((sum, event) => (event.month === month ? sum + event.amount : sum), 0);
}

function netOfCapitalGains(portfolio: number, contributed: number, taxRate: number): number {
  return portfolio - taxRate * Math.max(portfolio - contributed, 0);
}

/** Wealth-composition item: positive amounts add to wealth, negative subtract. */
function wealthItem(
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
    lens: "wealth",
    sign: amount < 0 ? "cost" : "credit",
  };
}

export function runWealthLens(ctx: ProjectionContext): WealthLensResult {
  const { assumptions } = ctx;
  const monthlyReturn = assumptions.alternativeReturn / 12;
  const taxRate = assumptions.capitalGainsTax;

  // Yearly recurring outflows, annualized once (index 0 = year 1).
  const buyAnnual: number[] = [];
  const rentAnnual: number[] = [];
  for (let t = 1; t <= ctx.horizonYears; t++) {
    const valueStart = ctx.propertyValueEndOfYear(t - 1);
    const interest = ctx.scheduleYears[t - 1]?.interest ?? 0;
    let buy =
      valueStart * assumptions.maintenanceRate +
      valueStart * assumptions.recurringTaxRate +
      interestDeductionAt(ctx, interest) +
      renovationCreditAt(ctx, t);
    for (const series of ctx.buyCosts.recurring) buy += series.annual[t - 1] ?? 0;
    let rent = 0;
    for (const series of ctx.rentCosts.recurring) rent += series.annual[t - 1] ?? 0;
    buyAnnual.push(buy);
    rentAnnual.push(rent);
  }

  // Month 0: the buyer's whole initial outlay defines the shared start capital.
  const initialCapital = ctx.initialOutlay + oneTimeAtMonth(ctx.buyCosts.oneTime, 0);
  let renterPortfolio = initialCapital - oneTimeAtMonth(ctx.rentCosts.oneTime, 0);
  let buyerPortfolio = 0;
  let renterContributed = renterPortfolio;
  let buyerContributed = 0;

  const months: WealthLensMonth[] = [];
  const years: WealthLensYear[] = [];

  for (let month = 1; month <= ctx.months; month++) {
    const year = Math.ceil(month / 12);
    const payment = ctx.schedule?.months[month - 1]?.payment ?? 0;
    const outflowBuy =
      payment + (buyAnnual[year - 1] ?? 0) / 12 + oneTimeAtMonth(ctx.buyCosts.oneTime, month);
    const outflowRent =
      ctx.annualRentAt(year) / 12 +
      (rentAnnual[year - 1] ?? 0) / 12 +
      oneTimeAtMonth(ctx.rentCosts.oneTime, month);

    const budget = Math.max(outflowBuy, outflowRent);
    const buyerDeposit = budget - outflowBuy;
    const renterDeposit = budget - outflowRent;

    buyerPortfolio = buyerPortfolio * (1 + monthlyReturn) + buyerDeposit;
    renterPortfolio = renterPortfolio * (1 + monthlyReturn) + renterDeposit;
    buyerContributed += buyerDeposit;
    renterContributed += renterDeposit;

    months.push({
      month,
      outflowBuy,
      outflowRent,
      budget,
      buyerDeposit,
      renterDeposit,
      buyerPortfolio,
      renterPortfolio,
    });

    if (month % 12 !== 0) continue;

    const propertyValue = ctx.propertyValueEndOfYear(year);
    const debtBalance = ctx.schedule?.months[month - 1]?.closingBalance ?? 0;
    const sellingCosts = propertyValue * ctx.input.sellingCostRate;
    const recoveredBuy = recoverablePaidThrough(ctx.buyCosts.oneTime, month);
    const recoveredRent = recoverablePaidThrough(ctx.rentCosts.oneTime, month);
    const buyerNet = netOfCapitalGains(buyerPortfolio, buyerContributed, taxRate);
    const renterNet = netOfCapitalGains(renterPortfolio, renterContributed, taxRate);
    // G15: plusvalenza on a hypothetical sale at the end of this year.
    const gainsTax = propertyGainsTaxAt(ctx, year);

    const wealthBuyHold = propertyValue - debtBalance + buyerPortfolio;
    const wealthBuyLiquidation =
      propertyValue - debtBalance - sellingCosts + recoveredBuy + buyerNet - gainsTax;
    const wealthRentHold = renterPortfolio + recoveredRent;
    const wealthRentLiquidation = renterNet + recoveredRent;

    years.push({
      year,
      deflator: ctx.deflatorAt(year),
      propertyValue,
      debtBalance,
      buyerPortfolio,
      renterPortfolio,
      wealthBuyHold,
      wealthBuyLiquidation,
      wealthRentHold,
      wealthRentLiquidation,
      advantageHold: wealthBuyHold - wealthRentHold,
      advantageLiquidation: wealthBuyLiquidation - wealthRentLiquidation,
    });
  }

  const last = years.at(-1);
  const compositions = last
    ? buildCompositions(ctx, last)
    : { buy: { items: [], total: 0 }, rent: { items: [], total: 0 } };

  return {
    initialCapital,
    months,
    years,
    breakEvenHold: firstYearWhere(years, (y) => y.advantageHold >= -MONEY_EPSILON),
    breakEvenLiquidation: firstYearWhere(years, (y) => y.advantageLiquidation >= -MONEY_EPSILON),
    buyCompositionAtHorizon: compositions.buy,
    rentCompositionAtHorizon: compositions.rent,
  };
}

function buildCompositions(
  ctx: ProjectionContext,
  last: WealthLensYear,
): { buy: CostBreakdown; rent: CostBreakdown } {
  const sellingCosts = last.propertyValue * ctx.input.sellingCostRate;
  const recoveredBuy = recoverablePaidThrough(ctx.buyCosts.oneTime, ctx.months);
  const recoveredRent = recoverablePaidThrough(ctx.rentCosts.oneTime, ctx.months);
  const taxRate = ctx.assumptions.capitalGainsTax;
  const gainsTax = propertyGainsTaxAt(ctx, last.year);

  // Net portfolios via the liquidation identity, so each breakdown sums to
  // its liquidation wealth exactly.
  const buyerPortfolioNet =
    last.wealthBuyLiquidation -
    (last.propertyValue - last.debtBalance - sellingCosts + recoveredBuy - gainsTax);
  const renterPortfolioNet = last.wealthRentLiquidation - recoveredRent;

  const buyItems: LineItem[] = [
    wealthItem("wealth.buy.homeValue", "Property value", last.propertyValue, "wealth.homeValue", {
      year: last.year,
    }),
    wealthItem("wealth.buy.debt", "Outstanding debt", -last.debtBalance, "wealth.debt", {
      year: last.year,
    }),
    wealthItem("wealth.buy.sellingCosts", "Selling costs", -sellingCosts, "wealth.sellingCosts", {
      sellingCostRate: ctx.input.sellingCostRate,
    }),
  ];
  if (recoveredBuy !== 0) {
    buyItems.push(
      wealthItem(
        "wealth.buy.recoveredCapital",
        "Recovered capital (renovation value)",
        recoveredBuy,
        "wealth.recoveredCapital",
        {},
      ),
    );
  }
  if (gainsTax !== 0) {
    buyItems.push(
      wealthItem(
        "wealth.buy.propertyGainsTax",
        "Capital-gains tax on the property (sold <5y, non-primary)",
        -gainsTax,
        "wealth.propertyGainsTax",
        {
          year: last.year,
          rate: ctx.config.propertyCapitalGains.rate,
          withinYears: ctx.config.propertyCapitalGains.withinYears,
        },
      ),
    );
  }
  buyItems.push(
    wealthItem(
      "wealth.buy.portfolio",
      "Investment portfolio (net of capital gains tax)",
      buyerPortfolioNet,
      "wealth.portfolio",
      { grossPortfolio: last.buyerPortfolio, capitalGainsTax: taxRate },
    ),
  );

  const rentItems: LineItem[] = [
    wealthItem(
      "wealth.rent.portfolio",
      "Investment portfolio (net of capital gains tax)",
      renterPortfolioNet,
      "wealth.portfolio",
      { grossPortfolio: last.renterPortfolio, capitalGainsTax: taxRate },
    ),
  ];
  if (recoveredRent !== 0) {
    rentItems.push(
      wealthItem("wealth.rent.deposits", "Returned deposits", recoveredRent, "wealth.deposits", {}),
    );
  }

  return {
    buy: { items: buyItems, total: normalizeZero(last.wealthBuyLiquidation) },
    rent: { items: rentItems, total: normalizeZero(last.wealthRentLiquidation) },
  };
}

function firstYearWhere(
  years: WealthLensYear[],
  predicate: (year: WealthLensYear) => boolean,
): number | null {
  for (const year of years) if (predicate(year)) return year.year;
  return null;
}
