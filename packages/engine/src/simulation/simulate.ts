import { resolveAssumptions, type ResolvedAssumptions } from "../config/resolve";
import { oneTimePaidThrough } from "../costs/resolve";
import { buildContext, type ProjectionContext } from "../lenses/context";
import { runCostLens, type CostLensResult } from "../lenses/cost";
import { runWealthLens, type WealthLensResult } from "../lenses/wealth";
import { type Reason, type Verdict, type VerdictKind } from "../rules/verdict";
import {
  assumptionOutOfBoundsWarning,
  cashDrainsLiquidityWarning,
  highLtvWarning,
  horizonBeyondPayoffWarning,
  liquidityBelowFundWarning,
  lowComparabilityWarning,
  negativeEquityWarning,
  opportunityCostDisabledWarning,
  shortHorizonWarning,
  type EngineWarning,
} from "../rules/warnings";
import { defaultEngineConfig, type EngineConfig } from "../schemas/engine-config";
import { type ScenarioInput } from "../schemas/scenario-input";

export interface BreakEvens {
  costHold: number | null;
  costLiquidation: number | null;
  wealthHold: number | null;
  wealthLiquidation: number | null;
}

export interface SimulationSummary {
  horizonYears: number;
  basis: "hold" | "liquidation";
  yearOneUnrecoverableRent: number;
  yearOneUnrecoverableBuy: number;
  /** Mortgage interest paid within the horizon (exact schedule). */
  totalInterest: number;
  /** Liquidity − (initial outlay + month-0 costs); null without a profile. */
  liquidityAfterPurchase: number | null;
  /** Wealth-lens advantage of buying at the horizon, on `basis`. */
  advantageAtHorizon: number;
  /** Same, deflated by inflation (critique W5). */
  advantageAtHorizonReal: number;
}

export interface SimulationResult {
  scenarioId: string;
  horizonYears: number;
  assumptions: ResolvedAssumptions;
  costLens: CostLensResult;
  wealthLens: WealthLensResult;
  breakEvens: BreakEvens;
  summary: SimulationSummary;
  verdict: Verdict;
  warnings: EngineWarning[];
}

/**
 * Analytical mode (domain spec §5–§8): both lenses over the full horizon,
 * four break-evens, an explained verdict, and the warnings catalog.
 */
export function simulate(
  input: ScenarioInput,
  config: EngineConfig = defaultEngineConfig,
): SimulationResult {
  const assumptions = resolveAssumptions(config.assumptions, input.assumptions);
  const ctx = buildContext(input, config, assumptions.values);
  const costLens = runCostLens(ctx);
  const wealthLens = runWealthLens(ctx);

  const lastWealth = wealthLens.years.at(-1);
  const firstCost = costLens.years.at(0);
  if (!lastWealth || !firstCost) {
    throw new RangeError("The horizon must contain at least one year");
  }

  const basis = config.toggles.liquidationBasis ? "liquidation" : "hold";
  const advantage =
    basis === "liquidation" ? lastWealth.advantageLiquidation : lastWealth.advantageHold;

  const breakEvens: BreakEvens = {
    costHold: costLens.breakEvenHold,
    costLiquidation: costLens.breakEvenLiquidation,
    wealthHold: wealthLens.breakEvenHold,
    wealthLiquidation: wealthLens.breakEvenLiquidation,
  };

  const liquidityAfterPurchase = input.profile
    ? input.profile.liquidity - (ctx.initialOutlay + oneTimePaidThrough(ctx.buyCosts.oneTime, 0))
    : null;

  const summary: SimulationSummary = {
    horizonYears: ctx.horizonYears,
    basis,
    yearOneUnrecoverableRent: firstCost.rent.total,
    yearOneUnrecoverableBuy: firstCost.buy.total,
    totalInterest: ctx.scheduleYears.reduce((sum, year) => sum + year.interest, 0),
    liquidityAfterPurchase,
    advantageAtHorizon: advantage,
    advantageAtHorizonReal: advantage / ctx.deflatorAt(ctx.horizonYears),
  };

  return {
    scenarioId: input.id,
    horizonYears: ctx.horizonYears,
    assumptions,
    costLens,
    wealthLens,
    breakEvens,
    summary,
    verdict: buildVerdict(ctx, costLens, breakEvens, advantage, basis),
    warnings: collectWarnings(ctx, costLens, liquidityAfterPurchase),
  };
}

function buildVerdict(
  ctx: ProjectionContext,
  costLens: CostLensResult,
  breakEvens: BreakEvens,
  advantage: number,
  basis: "hold" | "liquidation",
): Verdict {
  const greyBand = ctx.price * ctx.config.wealthGreyBandFraction;
  const kind: VerdictKind =
    Math.abs(advantage) <= greyBand
      ? "GREY_ZONE"
      : advantage > 0
        ? ctx.input.financing.kind === "mortgage"
          ? "BUY_MORTGAGE"
          : "BUY_CASH"
        : "RENT";

  const reasons: Reason[] = [
    {
      id: "wealth.advantage",
      message:
        "Net-worth difference (buy − rent) at the horizon: the primary financial signal (Wealth lens).",
      params: { advantage, horizonYears: ctx.horizonYears, basis, greyBand },
    },
    {
      id: "wealth.breakEven",
      message: "First year in which buying's net worth overtakes renting (liquidation basis).",
      params: { year: breakEvens.wealthLiquidation ?? "not within horizon" },
    },
    {
      id: "cost.breakEven",
      message:
        "First year in which cumulative unrecoverable costs of buying drop below renting, selling costs included (Cost lens).",
      params: { year: breakEvens.costLiquidation ?? "not within horizon" },
    },
  ];

  // Ranked cost drivers: the largest cumulated line items across the horizon.
  const totals = new Map<string, { label: string; total: number }>();
  for (const year of costLens.years) {
    for (const item of [...year.rent.items, ...year.buy.items]) {
      const entry = totals.get(item.id) ?? { label: item.label, total: 0 };
      entry.total += item.amount;
      totals.set(item.id, entry);
    }
  }
  const drivers = [...totals.entries()]
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
    .slice(0, 3);
  for (const [itemId, { label, total }] of drivers) {
    reasons.push({
      id: "cost.driver",
      message: "One of the largest cumulated cost-lens line items over the horizon.",
      params: { itemId, label, cumulativeAmount: total },
    });
  }

  return {
    kind,
    // BR-022: low rent comparability caps the verdict strength.
    strength: ctx.input.rentAlternative.comparability === "low" ? "indicative" : "standard",
    reasons,
  };
}

function collectWarnings(
  ctx: ProjectionContext,
  costLens: CostLensResult,
  liquidityAfterPurchase: number | null,
): EngineWarning[] {
  const { input, config, assumptions } = ctx;
  const warnings: EngineWarning[] = [];

  if (input.rentAlternative.comparability === "low") {
    warnings.push(lowComparabilityWarning(input.rentAlternative.comparability));
  }
  if (input.horizonYears < config.warningThresholds.shortHorizonYears) {
    warnings.push(
      shortHorizonWarning(input.horizonYears, config.warningThresholds.shortHorizonYears),
    );
  }
  if (input.financing.kind === "mortgage") {
    const ltv = ctx.mortgagePrincipal / ctx.price;
    if (ltv - config.warningThresholds.highLtv > config.epsilon) {
      warnings.push(highLtvWarning(ltv, config.warningThresholds.highLtv));
    }
    if (input.horizonYears > input.financing.durationYears) {
      warnings.push(horizonBeyondPayoffWarning(input.horizonYears, input.financing.durationYears));
    }
  }
  if (input.profile && liquidityAfterPurchase !== null) {
    if (liquidityAfterPurchase < input.profile.emergencyFund) {
      // TV-09: the generic warning always fires; cash adds the specific one.
      warnings.push(liquidityBelowFundWarning(liquidityAfterPurchase, input.profile.emergencyFund));
      if (input.financing.kind === "cash") {
        warnings.push(
          cashDrainsLiquidityWarning(liquidityAfterPurchase, input.profile.emergencyFund),
        );
      }
    }
  }
  if (!config.toggles.opportunityCost) {
    warnings.push(opportunityCostDisabledWarning());
  }

  const negativeEquityYear = costLens.years.find(
    (year) => year.propertyValue - year.debtBalance < -1e-6,
  );
  if (negativeEquityYear) {
    warnings.push(negativeEquityWarning(negativeEquityYear.year));
  }

  // BR-020: sanity bounds, warn-only.
  const { minRate, maxRate } = config.sanityBounds;
  const rateFields: [string, number][] = [
    ["alternativeReturn", assumptions.alternativeReturn],
    ["homeAppreciation", assumptions.homeAppreciation],
    ["rentGrowth", assumptions.rentGrowth],
    ["inflation", assumptions.inflation],
  ];
  if (input.financing.kind === "mortgage") {
    rateFields.push(["mortgage.annualRate", input.financing.annualRate]);
  }
  for (const [field, value] of rateFields) {
    if (value < minRate - config.epsilon || value > maxRate + config.epsilon) {
      warnings.push(assumptionOutOfBoundsWarning(field, value, minRate, maxRate));
    }
  }

  return warnings;
}
