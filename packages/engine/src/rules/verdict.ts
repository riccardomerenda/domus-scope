export type VerdictKind = "BUY_MORTGAGE" | "BUY_CASH" | "RENT" | "GREY_ZONE";

/** BR-022: low rent comparability caps the verdict at "indicative". */
export type VerdictStrength = "standard" | "indicative";

export interface Reason {
  /** Stable identifier, e.g. `"quick.rule.above"`; UIs may translate from it. */
  id: string;
  /** Default English copy, free of embedded numbers; `params` carries the values. */
  message: string;
  params: Record<string, number | string>;
}

export interface Verdict {
  kind: VerdictKind;
  strength: VerdictStrength;
  reasons: Reason[];
}
