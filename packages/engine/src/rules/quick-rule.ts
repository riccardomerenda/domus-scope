import { type EconomicAssumptions } from "../schemas/assumptions";
import { type EngineConfig } from "../schemas/engine-config";
import { type QuickInput } from "../schemas/quick-input";
import { normalizeZero } from "../lib/numbers";

export type QuickBand = "above" | "within" | "below";

export interface ThresholdTerm {
  id: string;
  label: string;
  value: number;
}

export interface QuickRuleAssessment {
  /** R: annual equivalent rent / property price. */
  rentToPrice: number;
  /** R*: the derived threshold (BR-018), sum of `derivation.terms`. */
  threshold: number;
  greyBand: number;
  ltv: number;
  band: QuickBand;
  derivation: {
    formulaId: string;
    terms: ThresholdTerm[];
    inputs: Record<string, number>;
  };
}

/**
 * The quick rule with a derived threshold (domain spec §2, critique W3):
 * `R* = m% + tax% + LTV·i + (1 − LTV)·r_alt − g`. The classic "5% rule" is the
 * special case its original assumptions produce.
 */
export function assessQuickRule(
  input: Pick<QuickInput, "propertyPrice" | "equivalentMonthlyRent" | "financing">,
  assumptions: EconomicAssumptions,
  config: EngineConfig,
): QuickRuleAssessment {
  const { propertyPrice, equivalentMonthlyRent, financing } = input;
  const annualRent = equivalentMonthlyRent * 12;
  const rentToPrice = annualRent / propertyPrice;

  const ltv =
    financing.kind === "mortgage" ? (propertyPrice - financing.downPayment) / propertyPrice : 0;
  const mortgageRate = financing.kind === "mortgage" ? financing.annualRate : 0;

  const terms: ThresholdTerm[] = [
    { id: "maintenance", label: "Maintenance (% of value)", value: assumptions.maintenanceRate },
    {
      id: "recurringTax",
      label: "Recurring ownership taxes (% of value)",
      value: assumptions.recurringTaxRate,
    },
    { id: "debtCost", label: "Debt cost (LTV × mortgage rate)", value: ltv * mortgageRate },
  ];
  if (config.toggles.opportunityCost) {
    terms.push({
      id: "equityOpportunity",
      label: "Equity opportunity ((1 − LTV) × alternative return)",
      value: (1 - ltv) * assumptions.alternativeReturn,
    });
    // BR-019: the appreciation offset always pairs with the opportunity term.
    terms.push({
      id: "appreciationOffset",
      label: "Appreciation offset (−g)",
      value: normalizeZero(-assumptions.homeAppreciation),
    });
  }
  const threshold = terms.reduce((sum, term) => sum + term.value, 0);

  const band: QuickBand =
    rentToPrice - (threshold + config.greyBand) > config.epsilon
      ? "above"
      : threshold - config.greyBand - rentToPrice > config.epsilon
        ? "below"
        : "within";

  return {
    rentToPrice,
    threshold,
    greyBand: config.greyBand,
    ltv,
    band,
    derivation: {
      formulaId: "quick.threshold.derived",
      terms,
      inputs: {
        propertyPrice,
        equivalentMonthlyRent,
        annualRent,
        ltv,
        mortgageRate,
        alternativeReturn: assumptions.alternativeReturn,
        homeAppreciation: assumptions.homeAppreciation,
        maintenanceRate: assumptions.maintenanceRate,
        recurringTaxRate: assumptions.recurringTaxRate,
      },
    },
  };
}
