/**
 * Explanation trace model (BR-021, FR-019, NFR-001).
 *
 * Every monetary figure the engine produces is a `LineItem` carrying the id of
 * the formula that produced it and the resolved input values it consumed, so
 * the UI can answer "why this number?" without any extra engine work.
 */

/** The methodological lens a figure belongs to. Lenses are never mixed (BR-017). */
export type Lens = "cost" | "wealth" | "quick";

export type Sign = "cost" | "credit";

export interface LineItem {
  /** Stable identifier, e.g. `"buy.opportunityCost"`. */
  id: string;
  /** Human-readable label. */
  label: string;
  /**
   * Amount in EUR, signed: credits carry negative amounts so breakdown totals
   * are plain sums. Unrounded — the engine never rounds; presentation does (§10).
   */
  amount: number;
  /** Key into {@link formulaRegistry}. */
  formulaId: string;
  /** Resolved input values the formula consumed. */
  inputs: Record<string, number | string>;
  lens: Lens;
  sign: Sign;
}

export interface CostBreakdown {
  items: LineItem[];
  /** Sum of item amounts (credits are negative). */
  total: number;
}

export interface FormulaDescriptor {
  id: string;
  /** Display expression, e.g. `"payment = P · [i(1+i)^n] / [(1+i)^n − 1]"`. */
  expression: string;
  description: string;
}

/**
 * Registry of every formula the engine can cite in a trace. Modules add their
 * formulas here; the UI renders entries verbatim in explanation drawers.
 */
export const formulaRegistry: Record<string, FormulaDescriptor> = {
  "mortgage.payment.french": {
    id: "mortgage.payment.french",
    expression: "payment = P · [i · (1+i)^n] / [(1+i)^n − 1]",
    description:
      "French (constant-payment) amortization: P = principal, i = monthly rate, n = number of monthly payments.",
  },
  "mortgage.payment.zeroRate": {
    id: "mortgage.payment.zeroRate",
    expression: "payment = P / n",
    description: "Zero-rate mortgage: the principal is repaid linearly with no interest.",
  },
  "mortgage.interest.month": {
    id: "mortgage.interest.month",
    expression: "interest_m = balance_{m−1} · i",
    description: "Monthly interest accrues on the opening balance at the monthly rate.",
  },
  "mortgage.principal.month": {
    id: "mortgage.principal.month",
    expression: "principal_m = payment − interest_m",
    description: "The part of the payment that reduces debt and becomes net worth (BR-008).",
  },
  "quick.rentToPrice": {
    id: "quick.rentToPrice",
    expression: "R = (monthly_rent × 12) / price",
    description: "Annual equivalent rent as a fraction of the property price.",
  },
  "quick.threshold.derived": {
    id: "quick.threshold.derived",
    expression: "R* = m% + tax% + LTV·i + (1 − LTV)·r_alt − g",
    description:
      "Derived quick-rule threshold (BR-018): maintenance + recurring taxes + blended cost " +
      "of capital − expected home appreciation. The classic 5% emerges only under the " +
      "assumptions that generate it.",
  },
  "quick.rent.year1": {
    id: "quick.rent.year1",
    expression: "rent_year1 = monthly_rent × 12",
    description: "Simplified year-1 unrecoverable cost of the rent scenario.",
  },
  "quick.interest.simplified": {
    id: "quick.interest.simplified",
    expression: "interest_year1 ≈ P × i",
    description:
      "Simplified year-1 interest preview (critique W9). The exact amortization schedule " +
      "yields slightly less because the balance declines during the year.",
  },
  "quick.opportunity": {
    id: "quick.opportunity",
    expression: "opportunity = invested_capital × r_alt",
    description:
      "Gross opportunity cost of the capital tied up in the purchase (BR-014). Always " +
      "paired with the appreciation credit (BR-019).",
  },
  "quick.maintenance": {
    id: "quick.maintenance",
    expression: "maintenance = price × m%",
    description: "Expected routine maintenance for year 1 (BR-010).",
  },
  "quick.recurringTax": {
    id: "quick.recurringTax",
    expression: "tax = price × tax%",
    description:
      "Recurring ownership taxes for year 1 (e.g. IMU; 0 for an Italian primary residence).",
  },
  "quick.appreciationCredit": {
    id: "quick.appreciationCredit",
    expression: "credit = −(price × g)",
    description:
      "Expected year-1 home value gain, shown as a negative line so the gross opportunity " +
      "cost is never silently netted (critique W2, BR-019).",
  },
  "cost.rent.year": {
    id: "cost.rent.year",
    expression: "rent_t = rent_base × (1 + rent_growth)^(t−1)",
    description: "Annual rent for year t; year 1 is the base equivalent rent.",
  },
  "cost.interest.year": {
    id: "cost.interest.year",
    expression: "interest_t = Σ interest_m over the months of year t",
    description:
      "Exact mortgage interest from the amortization schedule (not the simplified preview).",
  },
  "cost.maintenance.year": {
    id: "cost.maintenance.year",
    expression: "maintenance_t = value_{t−1} × m%",
    description: "Routine maintenance on the start-of-year property value (BR-010).",
  },
  "cost.recurringTax.year": {
    id: "cost.recurringTax.year",
    expression: "tax_t = value_{t−1} × tax%",
    description: "Recurring ownership taxes on the start-of-year property value.",
  },
  "cost.recurringItem": {
    id: "cost.recurringItem",
    expression: "amount_t per the item's base and growth (cost catalog §4)",
    description: "A recurring cost-catalog item, resolved for year t.",
  },
  "cost.oneTimeItem": {
    id: "cost.oneTimeItem",
    expression: "unrecoverable share of a one-time payment",
    description:
      "One-time cost-catalog item: only the unrecoverable share is a cost; recoverable " +
      "shares contribute opportunity cost and return at liquidation (BR-016).",
  },
  "cost.deduction.year": {
    id: "cost.deduction.year",
    expression: "credit_t = −rate × min(interest_t, cap)",
    description: "Mortgage-interest tax credit (G4), a negative unrecoverable cost.",
  },
  "cost.renovationCredit.year": {
    id: "cost.renovationCredit.year",
    expression: "credit_t = −rate × min(spend, cap) / years, for `years` years from the work",
    description:
      "Renovation tax credit (G14, detrazione ristrutturazione): eligible works return a " +
      "share of the capped spend in equal annual IRPEF installments.",
  },
  "cost.opportunity.year": {
    id: "cost.opportunity.year",
    expression: "opportunity_t = invested_capital_{start of t} × r_alt",
    description:
      "Gross opportunity cost of capital tied in the purchase: initial outlay + one-time " +
      "costs paid + principal repaid. Always paired with the appreciation credit (BR-019).",
  },
  "cost.appreciationCredit.year": {
    id: "cost.appreciationCredit.year",
    expression: "credit_t = −(value_t − value_{t−1})",
    description:
      "Home value gain of year t, shown explicitly so the gross opportunity cost is never " +
      "silently netted (critique W2).",
  },
  "cost.depositOpportunity": {
    id: "cost.depositOpportunity",
    expression: "opportunity_t = tied_deposits × r_alt",
    description: "Opportunity cost of recoverable renter capital (deposit), per BR-016.",
  },
  "wealth.homeValue": {
    id: "wealth.homeValue",
    expression: "value_t = price × (1 + g)^t",
    description: "Property value at the end of year t (Wealth lens).",
  },
  "wealth.debt": {
    id: "wealth.debt",
    expression: "−balance_t",
    description: "Outstanding mortgage principal at the end of year t.",
  },
  "wealth.sellingCosts": {
    id: "wealth.sellingCosts",
    expression: "−value_t × selling_cost_rate",
    description: "Hypothetical sale transaction costs (liquidation basis, critique W7).",
  },
  "wealth.recoveredCapital": {
    id: "wealth.recoveredCapital",
    expression: "Σ recoverable shares of one-time payments",
    description: "Capital returned at liquidation (retained renovation value), flat.",
  },
  "wealth.portfolio": {
    id: "wealth.portfolio",
    expression:
      "P_m = P_{m−1} × (1 + r_alt/12) + (budget_m − outflow_m); net = P − cgt × max(P − contributed, 0)",
    description:
      "Budget-symmetric investment portfolio: whoever spends less each month invests the " +
      "difference. Capital-gains tax applies at liquidation (G5).",
  },
  "wealth.deposits": {
    id: "wealth.deposits",
    expression: "Σ recoverable renter payments",
    description: "Deposits returned to the renter, flat (BR-016).",
  },
  "wealth.propertyGainsTax": {
    id: "wealth.propertyGainsTax",
    expression: "tax = rate × max(value_t − selling_costs − price, 0)",
    description:
      "Italian plusvalenza (G15): the gain on a non-primary property sold within 5 years " +
      "of purchase is taxed; primary residences and later sales are exempt.",
  },
};
