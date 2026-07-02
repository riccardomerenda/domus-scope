import { type CostBreakdown, type LineItem, type Lens, type Sign } from "../explain/line-item";
import { normalizeZero } from "../lib/numbers";
import { mergeAssumptions, type EconomicAssumptions } from "../schemas/assumptions";
import { defaultEngineConfig, type EngineConfig } from "../schemas/engine-config";
import { type MortgageFinancing } from "../schemas/financing";
import { type QuickInput } from "../schemas/quick-input";
import { assessQuickRule, type QuickBand, type QuickRuleAssessment } from "./quick-rule";
import { type Verdict } from "./verdict";
import {
  assumptionOutOfBoundsWarning,
  cashDrainsLiquidityWarning,
  highLtvWarning,
  liquidityBelowFundWarning,
  lowComparabilityWarning,
  opportunityCostDisabledWarning,
  shortHorizonWarning,
  type EngineWarning,
} from "./warnings";

export interface QuickYearOne {
  /** W9: Quick mode uses the simplified interest preview, and says so. */
  method: "simplified";
  rent: CostBreakdown;
  /** Present only when the input financing is a mortgage. */
  mortgage?: CostBreakdown;
  /** Always computable: a cash purchase needs no financing parameters. */
  cash: CostBreakdown;
}

export interface QuickResult {
  rule: QuickRuleAssessment;
  yearOne: QuickYearOne;
  verdict: Verdict;
  warnings: EngineWarning[];
}

/**
 * Quick mode (domain spec §2, source-doc flow 11.1): derived-threshold rule,
 * simplified year-1 unrecoverable costs, provisional verdict, warnings.
 */
export function quickAssess(
  input: QuickInput,
  config: EngineConfig = defaultEngineConfig,
): QuickResult {
  const assumptions = mergeAssumptions(config.assumptions, input.assumptions);
  const rule = assessQuickRule(input, assumptions, config);

  const rent = rentYearOne(input.equivalentMonthlyRent);
  const cash = cashYearOne(input.propertyPrice, assumptions, config);
  const mortgage =
    input.financing.kind === "mortgage"
      ? mortgageYearOne(input.propertyPrice, input.financing, assumptions, config)
      : undefined;
  const selectedBuy = mortgage ?? cash;

  return {
    rule,
    yearOne: { method: "simplified", rent, cash, ...(mortgage ? { mortgage } : {}) },
    verdict: buildVerdict(input, rule, rent.total, selectedBuy.total),
    warnings: collectWarnings(input, assumptions, config, rule),
  };
}

const QUICK_LENS: Lens = "quick";

function item(
  id: string,
  label: string,
  amount: number,
  formulaId: string,
  inputs: Record<string, number | string>,
  sign: Sign = "cost",
): LineItem {
  return { id, label, amount: normalizeZero(amount), formulaId, inputs, lens: QUICK_LENS, sign };
}

function breakdown(items: LineItem[]): CostBreakdown {
  return { items, total: normalizeZero(items.reduce((sum, entry) => sum + entry.amount, 0)) };
}

function rentYearOne(monthlyRent: number): CostBreakdown {
  return breakdown([
    item("rent.rent", "Rent (year 1)", monthlyRent * 12, "quick.rent.year1", {
      monthlyRent,
      months: 12,
    }),
  ]);
}

/**
 * Shared owner cost lines: maintenance and recurring taxes on the full price,
 * plus — when the opportunity toggle is on (BR-011) — the gross opportunity
 * cost on the invested capital paired with the appreciation credit (BR-019).
 */
function ownerYearOneItems(
  price: number,
  investedCapital: number,
  assumptions: EconomicAssumptions,
  config: EngineConfig,
): LineItem[] {
  const items: LineItem[] = [
    item(
      "buy.maintenance",
      "Maintenance (year 1)",
      price * assumptions.maintenanceRate,
      "quick.maintenance",
      {
        propertyPrice: price,
        maintenanceRate: assumptions.maintenanceRate,
      },
    ),
    item(
      "buy.recurringTax",
      "Recurring ownership taxes (year 1)",
      price * assumptions.recurringTaxRate,
      "quick.recurringTax",
      { propertyPrice: price, recurringTaxRate: assumptions.recurringTaxRate },
    ),
  ];
  if (config.toggles.opportunityCost) {
    items.push(
      item(
        "buy.opportunityCost",
        "Opportunity cost of invested capital (year 1)",
        investedCapital * assumptions.alternativeReturn,
        "quick.opportunity",
        { investedCapital, alternativeReturn: assumptions.alternativeReturn },
      ),
      item(
        "buy.appreciationCredit",
        "Expected home value gain (year 1)",
        -(price * assumptions.homeAppreciation),
        "quick.appreciationCredit",
        { propertyPrice: price, homeAppreciation: assumptions.homeAppreciation },
        "credit",
      ),
    );
  }
  return items;
}

function mortgageYearOne(
  price: number,
  financing: MortgageFinancing,
  assumptions: EconomicAssumptions,
  config: EngineConfig,
): CostBreakdown {
  const principal = price - financing.downPayment;
  return breakdown([
    item(
      "buy.interest",
      "Mortgage interest (year 1, simplified)",
      principal * financing.annualRate,
      "quick.interest.simplified",
      { principal, annualRate: financing.annualRate },
    ),
    ...ownerYearOneItems(price, financing.downPayment, assumptions, config),
  ]);
}

function cashYearOne(
  price: number,
  assumptions: EconomicAssumptions,
  config: EngineConfig,
): CostBreakdown {
  // BR-014: cash is not free — the whole price becomes invested capital.
  return breakdown(ownerYearOneItems(price, price, assumptions, config));
}

const BAND_REASON_MESSAGE: Record<QuickBand, string> = {
  above:
    "The rent-to-price ratio exceeds the derived threshold beyond the grey band; buying deserves full analysis.",
  within:
    "The rent-to-price ratio falls inside the grey band around the derived threshold; the quick rule cannot discriminate.",
  below:
    "The rent-to-price ratio sits below the derived threshold beyond the grey band; renting is relatively cheap.",
};

function buildVerdict(
  input: QuickInput,
  rule: QuickRuleAssessment,
  rentTotal: number,
  buyTotal: number,
): Verdict {
  const kind =
    rule.band === "within"
      ? "GREY_ZONE"
      : rule.band === "below"
        ? "RENT"
        : input.financing.kind === "mortgage"
          ? "BUY_MORTGAGE"
          : "BUY_CASH";
  return {
    kind,
    // BR-022: low comparability caps the verdict strength.
    strength: input.comparability === "low" ? "indicative" : "standard",
    reasons: [
      {
        id: `quick.rule.${rule.band}`,
        message: BAND_REASON_MESSAGE[rule.band],
        params: {
          rentToPrice: rule.rentToPrice,
          threshold: rule.threshold,
          greyBand: rule.greyBand,
        },
      },
      {
        id: "quick.yearOne.comparison",
        message:
          "Simplified year-1 unrecoverable costs of the selected purchase option, compared with renting.",
        params: { rentYearOne: rentTotal, buyYearOne: buyTotal },
      },
    ],
  };
}

function collectWarnings(
  input: QuickInput,
  assumptions: EconomicAssumptions,
  config: EngineConfig,
  rule: QuickRuleAssessment,
): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  if (input.comparability === "low") {
    warnings.push(lowComparabilityWarning(input.comparability));
  }
  if (input.horizonYears < config.warningThresholds.shortHorizonYears) {
    warnings.push(
      shortHorizonWarning(input.horizonYears, config.warningThresholds.shortHorizonYears),
    );
  }
  if (
    input.financing.kind === "mortgage" &&
    rule.ltv - config.warningThresholds.highLtv > config.epsilon
  ) {
    warnings.push(highLtvWarning(rule.ltv, config.warningThresholds.highLtv));
  }
  if (input.liquidity) {
    const capitalRequired =
      input.financing.kind === "mortgage" ? input.financing.downPayment : input.propertyPrice;
    const residual = input.liquidity.available - capitalRequired;
    if (residual < input.liquidity.emergencyFund) {
      warnings.push(
        input.financing.kind === "cash"
          ? cashDrainsLiquidityWarning(residual, input.liquidity.emergencyFund)
          : liquidityBelowFundWarning(residual, input.liquidity.emergencyFund),
      );
    }
  }
  if (!config.toggles.opportunityCost) {
    warnings.push(opportunityCostDisabledWarning());
  }

  // BR-020: sanity bounds on rate-like values, warn-only.
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
