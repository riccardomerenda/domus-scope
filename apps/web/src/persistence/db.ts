import Dexie, { type EntityTable } from "dexie";
import {
  type AssumptionPresetId,
  type CostItem,
  type EconomicAssumptions,
} from "@domus-scope/engine";

/**
 * Local-first storage (NFR-004): everything lives in IndexedDB on this device.
 * Records carry a schemaVersion; Dexie migrations upgrade them in place.
 */

export type FinancingKind = "mortgage" | "cash";
export type Comparability = "low" | "medium" | "high";

// Explicit `| undefined` keeps this assignable from Zod's partial output
// under exactOptionalPropertyTypes.
export type PartialAssumptions = {
  [K in keyof EconomicAssumptions]?: EconomicAssumptions[K] | undefined;
};

/**
 * Quick-mode form data. Flat on purpose: mortgage fields survive switching to
 * cash and back. Rates are stored as fractions (0.03 = 3%), like the engine.
 */
export interface QuickData {
  propertyPrice: number;
  equivalentMonthlyRent: number;
  horizonYears: number;
  financingKind: FinancingKind;
  downPayment: number;
  annualRate: number;
  durationYears: number;
  comparability: Comparability;
  assumptionPreset: AssumptionPresetId;
  liquidityEnabled: boolean;
  liquidityAvailable: number;
  emergencyFund: number;
}

/** Analytical-mode data: mirrors the engine's ScenarioInput, storage-friendly. */
export interface AnalyticalData {
  property: {
    price: number;
    cadastralValue: number | null;
    zone: string;
    sizeSqm: number | null;
    notes: string;
  };
  financingKind: FinancingKind;
  downPayment: number;
  annualRate: number;
  durationYears: number;
  rentAlternative: {
    equivalentMonthlyRent: number;
    currentMonthlyRent: number | null;
    comparability: Comparability;
  };
  costItems: CostItem[];
  /** Scenario-layer assumption overrides (§9 layering). */
  assumptions: PartialAssumptions;
  horizonYears: number;
  sellingCostRate: number;
  /** Inject the global profile into the simulation (liquidity warnings, FR-015). */
  profileEnabled: boolean;
}

export type ScenarioMode = "quick" | "analytical";

export interface StoredScenario {
  id: string;
  schemaVersion: 2;
  title: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  mode: ScenarioMode;
  quick: QuickData;
  /** Seeded from `quick` on first upgrade; null until then. */
  analytical: AnalyticalData | null;
}

/** Saved user preset for the assumptions layer (FR-018). */
export interface UserPreset {
  id: string;
  label: string;
  values: PartialAssumptions;
}

/** Single-record app configuration: personal profile + global assumption layer. */
export interface AppConfig {
  id: "app";
  schemaVersion: 2;
  profile: {
    liquidity: number;
    emergencyFund: number;
    currentMonthlyRent: number | null;
    city: string;
    notes: string;
  };
  /** Global assumptions (override engine defaults; scenarios override these). */
  globalAssumptions: PartialAssumptions;
  userPresets: UserPreset[];
}

export const defaultAppConfig: AppConfig = {
  id: "app",
  schemaVersion: 2,
  profile: {
    liquidity: 60_000,
    emergencyFund: 20_000,
    currentMonthlyRent: null,
    city: "",
    notes: "",
  },
  globalAssumptions: {},
  userPresets: [],
};

export const db = new Dexie("domus-scope") as Dexie & {
  scenarios: EntityTable<StoredScenario, "id">;
  appConfig: EntityTable<AppConfig, "id">;
};

// Booleans are not valid IndexedDB keys: `archived` is filtered in memory.
db.version(1).stores({ scenarios: "id, updatedAt" });
db.version(2)
  .stores({ scenarios: "id, updatedAt", appConfig: "id" })
  .upgrade(async (tx) => {
    await tx
      .table("scenarios")
      .toCollection()
      .modify((scenario: Record<string, unknown>) => {
        scenario.schemaVersion = 2;
        scenario.mode ??= "quick";
        scenario.analytical ??= null;
      });
  });

export async function updateAppConfig(patch: Partial<Omit<AppConfig, "id">>): Promise<void> {
  const current = (await db.appConfig.get("app")) ?? defaultAppConfig;
  await db.appConfig.put({ ...current, ...patch, id: "app", schemaVersion: 2 });
}
