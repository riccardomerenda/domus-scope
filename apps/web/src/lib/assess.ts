import {
  assumptionPresets,
  defaultEngineConfig,
  quickAssess,
  simulate,
  validateQuickInput,
  validateScenario,
  type EngineConfig,
  type QuickInput,
  type QuickResult,
  type ScenarioInput,
  type SimulationResult,
  type ValidationIssue,
} from "@domus-scope/engine";
import { type AnalyticalData, type AppConfig, type QuickData } from "../persistence/db";

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

export interface SimulationOutcome {
  input?: ScenarioInput;
  result?: SimulationResult;
  issues?: ValidationIssue[];
}

/** The engine config carrying the user's global assumption layer (§9). */
export function engineConfigFor(appConfig: AppConfig): EngineConfig {
  return { ...defaultEngineConfig, assumptions: appConfig.globalAssumptions };
}

/**
 * Runs the full two-lens simulation for an analytical scenario. The global
 * profile is injected when the scenario opts in (FR-002/FR-015); results are
 * derived, never persisted (NFR-002).
 */
export function runSimulation(
  meta: { id: string; title: string },
  data: AnalyticalData,
  appConfig: AppConfig,
): SimulationOutcome {
  const raw = {
    id: meta.id,
    title: meta.title || "Untitled",
    property: {
      price: data.property.price,
      zone: data.property.zone,
      notes: data.property.notes,
      ...(data.property.marketValue != null && data.property.marketValue > 0
        ? { marketValue: data.property.marketValue }
        : {}),
      ...(data.property.cadastralValue !== null
        ? { cadastralValue: data.property.cadastralValue }
        : {}),
      ...(data.property.sizeSqm !== null && data.property.sizeSqm > 0
        ? { sizeSqm: data.property.sizeSqm }
        : {}),
    },
    financing:
      data.financingKind === "mortgage"
        ? {
            kind: "mortgage" as const,
            downPayment: data.downPayment,
            annualRate: data.annualRate,
            durationYears: data.durationYears,
          }
        : { kind: "cash" as const },
    rentAlternative: {
      equivalentMonthlyRent: data.rentAlternative.equivalentMonthlyRent,
      comparability: data.rentAlternative.comparability,
      ...(data.rentAlternative.currentMonthlyRent !== null
        ? { currentMonthlyRent: data.rentAlternative.currentMonthlyRent }
        : {}),
    },
    costItems: data.costItems,
    assumptions: data.assumptions,
    horizonYears: data.horizonYears,
    sellingCostRate: data.sellingCostRate,
    ...(data.profileEnabled
      ? {
          profile: {
            liquidity: appConfig.profile.liquidity,
            emergencyFund: appConfig.profile.emergencyFund,
          },
        }
      : {}),
  };

  const validated = validateScenario(raw);
  if (!validated.ok) return { issues: validated.error };
  return { input: validated.value, result: simulate(validated.value, engineConfigFor(appConfig)) };
}
