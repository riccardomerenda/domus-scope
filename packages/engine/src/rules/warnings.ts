/**
 * Warnings catalog (domain spec §8). Warnings never block a computation
 * (NFR-008/BR-020); they travel with the result and the UI renders them.
 */

export type WarningId =
  "W-001" | "W-002" | "W-003" | "W-004" | "W-005" | "W-006" | "W-007" | "W-008" | "W-009";

export type WarningSeverity = "info" | "caution" | "strong";

export interface EngineWarning {
  id: WarningId;
  severity: WarningSeverity;
  /** Default English copy, free of embedded numbers; `context` carries the values. */
  message: string;
  context: Record<string, number | string>;
}

/** W-001 (BR-007/FR-014): the rent used may not match a comparable home. */
export function lowComparabilityWarning(comparability: string): EngineWarning {
  return {
    id: "W-001",
    severity: "caution",
    message:
      "The rent used for comparison may not reflect a truly comparable home; treat the verdict as indicative.",
    context: { comparability },
  };
}

/** W-002 (BR-006/FR-015): liquidity after the initial outlay falls below the fund. */
export function liquidityBelowFundWarning(
  residualLiquidity: number,
  emergencyFund: number,
): EngineWarning {
  return {
    id: "W-002",
    severity: "strong",
    message: "After the initial outlay, liquidity falls below the emergency fund.",
    context: { residualLiquidity, emergencyFund },
  };
}

/** W-003 (BR-005): one-time purchase costs dominate short horizons. */
export function shortHorizonWarning(horizonYears: number, thresholdYears: number): EngineWarning {
  return {
    id: "W-003",
    severity: "caution",
    message: "On short horizons, one-time purchase costs dominate the outcome.",
    context: { horizonYears, thresholdYears },
  };
}

/** W-004: a cash purchase pushes liquidity below the emergency fund. */
export function cashDrainsLiquidityWarning(
  residualLiquidity: number,
  emergencyFund: number,
): EngineWarning {
  return {
    id: "W-004",
    severity: "strong",
    message: "A cash purchase pushes liquidity below the emergency fund.",
    context: { residualLiquidity, emergencyFund },
  };
}

/** W-005: high LTV — the assumed mortgage rate may be optimistic. */
export function highLtvWarning(ltv: number, threshold: number): EngineWarning {
  return {
    id: "W-005",
    severity: "caution",
    message: "High loan-to-value: lenders may price the mortgage above the assumed rate.",
    context: { ltv, threshold },
  };
}

/** W-006 (BR-011): opportunity cost may be disabled only with a visible notice. */
export function opportunityCostDisabledWarning(): EngineWarning {
  return {
    id: "W-006",
    severity: "caution",
    message: "The opportunity cost of tied-up capital is excluded: owning costs are understated.",
    context: {},
  };
}

/** W-009 (BR-020): an assumption lies outside the plausibility bounds. */
export function assumptionOutOfBoundsWarning(
  field: string,
  value: number,
  minRate: number,
  maxRate: number,
): EngineWarning {
  return {
    id: "W-009",
    severity: "caution",
    message: "An assumption lies outside the configured plausibility bounds.",
    context: { field, value, minRate, maxRate },
  };
}
