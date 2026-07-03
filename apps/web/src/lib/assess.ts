import {
  assumptionPresets,
  defaultEngineConfig,
  quickAssess,
  validateQuickInput,
  type QuickInput,
  type QuickResult,
  type ValidationIssue,
} from "@domus-scope/engine";
import { type QuickData } from "../persistence/db";

export interface Assessment {
  input?: QuickInput;
  result?: QuickResult;
  issues?: ValidationIssue[];
}

/**
 * Derives the engine result from stored form data. Results are never
 * persisted (NFR-002): stored inputs and computed outputs cannot disagree.
 */
export function assessQuickData(data: QuickData): Assessment {
  const raw = {
    propertyPrice: data.propertyPrice,
    equivalentMonthlyRent: data.equivalentMonthlyRent,
    horizonYears: data.horizonYears,
    financing:
      data.financingKind === "mortgage"
        ? {
            kind: "mortgage" as const,
            downPayment: data.downPayment,
            annualRate: data.annualRate,
            durationYears: data.durationYears,
          }
        : { kind: "cash" as const },
    comparability: data.comparability,
    assumptions: assumptionPresets[data.assumptionPreset].values,
    ...(data.liquidityEnabled
      ? { liquidity: { available: data.liquidityAvailable, emergencyFund: data.emergencyFund } }
      : {}),
  };

  const validated = validateQuickInput(raw);
  if (!validated.ok) return { issues: validated.error };
  return { input: validated.value, result: quickAssess(validated.value, defaultEngineConfig) };
}
