import Dexie, { type EntityTable } from "dexie";
import {
  DEFAULT_TYPICAL_DISCOUNT,
  type AssumptionPresetId,
  type Concession,
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

/** Negotiation-lens inputs (FR-022/FR-023): the asking side of the ZOPA view. */
export interface NegotiationData {
  askingPrice: number | null;
  /** Fraction of the asking price a typical negotiation concedes. */
  typicalDiscount: number;
  concessions: Concession[];
}

export const defaultNegotiationData: NegotiationData = {
  askingPrice: null,
  typicalDiscount: DEFAULT_TYPICAL_DISCOUNT,
  concessions: [],
};

/** Normalizes records stored before Phase 8 (field absent → defaults). */
export function negotiationOf(data: AnalyticalData): NegotiationData {
  return data.negotiation ?? defaultNegotiationData;
}

/** Analytical-mode data: mirrors the engine's ScenarioInput, storage-friendly. */
export interface AnalyticalData {
  property: {
    price: number;
    /** Value anchor when it differs from the price (FR-021); pre-Phase-8 records lack it. */
    marketValue?: number | null | undefined;
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
  /** Negotiation inputs (Phase 8); pre-Phase-8 records lack it — use negotiationOf(). */
  negotiation?: NegotiationData | undefined;
}

export type ScenarioMode = "quick" | "analytical";

/**
 * Qualitative factors (BR-015): scored per scenario, weighted in the profile,
 * always kept strictly separate from the financial verdict.
 */
export const QUALITATIVE_FACTORS = [
  "stability",
  "flexibility",
  "space",
  "school",
  "family",
  "work",
] as const;
export type QualitativeFactor = (typeof QUALITATIVE_FACTORS)[number];
/** 0–10 per factor: "how much would buying this home improve this for you?" */
// Explicit `| undefined` keeps this assignable from Zod's optional output
// under exactOptionalPropertyTypes.
export type QualitativeScores = { [K in QualitativeFactor]?: number | undefined };
export type QualitativeWeights = Record<QualitativeFactor, number>;

export interface StoredScenario {
  id: string;
  schemaVersion: 3;
  title: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  mode: ScenarioMode;
  quick: QuickData;
  /** Seeded from `quick` on first upgrade; null until then. */
  analytical: AnalyticalData | null;
  qualitative: QualitativeScores;
}

export type JournalKind = "note" | "visit" | "pro" | "con" | "decision" | "offer";

export type OfferParty = "you" | "counterpart";

/** Offer-log payload (FR-024): the engine re-evaluates each offered price. */
export interface OfferData {
  party: OfferParty;
  price: number;
}

export interface JournalEntry {
  id: string;
  scenarioId: string;
  createdAt: number;
  kind: JournalKind;
  text: string;
  /** Decision entries carry a short label and freeze a revision (FR-016). */
  decision: string | null;
  revisionId: string | null;
  /** Offer entries only; pre-Phase-8 records lack the field. */
  offer?: OfferData | null | undefined;
}

/** Immutable input snapshot (FR-020/NFR-007): results are recomputed, never stored. */
export interface ScenarioRevision {
  id: string;
  scenarioId: string;
  createdAt: number;
  label: string;
  title: string;
  mode: ScenarioMode;
  quick: QuickData;
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
  /** How much each qualitative factor matters to you (0–10, BR-015). */
  qualitativeWeights: QualitativeWeights;
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
  qualitativeWeights: {
    stability: 5,
    flexibility: 5,
    space: 5,
    school: 5,
    family: 5,
    work: 5,
  },
};

/** Fills fields added after a config was first stored (schema-tolerant read). */
export function mergeAppConfig(stored: AppConfig | null | undefined): AppConfig {
  if (!stored) return defaultAppConfig;
  return {
    ...defaultAppConfig,
    ...stored,
    qualitativeWeights: {
      ...defaultAppConfig.qualitativeWeights,
      ...(stored.qualitativeWeights ?? {}),
    },
  };
}

export const db = new Dexie("domus-scope") as Dexie & {
  scenarios: EntityTable<StoredScenario, "id">;
  appConfig: EntityTable<AppConfig, "id">;
  journal: EntityTable<JournalEntry, "id">;
  revisions: EntityTable<ScenarioRevision, "id">;
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
db.version(3)
  .stores({
    scenarios: "id, updatedAt",
    appConfig: "id",
    journal: "id, scenarioId, createdAt",
    revisions: "id, scenarioId, createdAt",
  })
  .upgrade(async (tx) => {
    await tx
      .table("scenarios")
      .toCollection()
      .modify((scenario: Record<string, unknown>) => {
        scenario.schemaVersion = 3;
        scenario.qualitative ??= {};
      });
  });

export async function updateAppConfig(patch: Partial<Omit<AppConfig, "id">>): Promise<void> {
  const current = mergeAppConfig(await db.appConfig.get("app"));
  await db.appConfig.put({ ...current, ...patch, id: "app", schemaVersion: 2 });
}
