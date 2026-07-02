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
};
