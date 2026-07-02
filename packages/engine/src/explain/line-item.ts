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
  /** Amount in EUR, unrounded — the engine never rounds; presentation does (§10). */
  amount: number;
  /** Key into {@link formulaRegistry}. */
  formulaId: string;
  /** Resolved input values the formula consumed. */
  inputs: Record<string, number | string>;
  lens: Lens;
  sign: Sign;
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
};
