import { z } from "zod";
import {
  costItemSchema,
  economicAssumptionsSchema,
  prepaymentSchema,
  rateStepSchema,
} from "@domus-scope/engine";
import {
  db,
  mergeAppConfig,
  type AppConfig,
  type JournalEntry,
  type ScenarioRevision,
  type StoredScenario,
} from "./db";

/**
 * Export/import (FR-017). Import is additive and never overwrites: colliding
 * ids get fresh ids (journal entries and revisions are remapped accordingly).
 * Version 1 and 2 export files remain importable, migrated on the fly.
 */

const quickDataSchema = z.object({
  propertyPrice: z.number().positive(),
  equivalentMonthlyRent: z.number().positive(),
  horizonYears: z.number().int().min(1).max(50),
  financingKind: z.enum(["mortgage", "cash"]),
  downPayment: z.number().min(0),
  annualRate: z.number().min(0).lt(1),
  durationYears: z.number().int().min(1).max(50),
  comparability: z.enum(["low", "medium", "high"]),
  assumptionPreset: z.enum(["conservative", "base", "optimistic"]),
  liquidityEnabled: z.boolean(),
  liquidityAvailable: z.number().min(0),
  emergencyFund: z.number().min(0),
});

const concessionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["earlyPossession", "furniture", "remediation", "custom"]),
  direction: z.enum(["youReceive", "youGive"]),
  amount: z.number().min(0),
  label: z.string(),
});

// Absent in pre-Phase-8 exports; negotiationOf() supplies the defaults.
const negotiationDataSchema = z.object({
  askingPrice: z.number().positive().nullable(),
  typicalDiscount: z.number().min(0).max(0.5),
  concessions: z.array(concessionSchema),
});

const analyticalDataSchema = z.object({
  property: z.object({
    price: z.number().positive(),
    // Optional: pre-Phase-8 exports lack it.
    marketValue: z.number().positive().nullable().optional(),
    cadastralValue: z.number().min(0).nullable(),
    // Optional: pre-Phase-11 exports lack it; absent = primary residence.
    primaryResidence: z.boolean().optional(),
    zone: z.string(),
    sizeSqm: z.number().positive().nullable(),
    notes: z.string(),
  }),
  financingKind: z.enum(["mortgage", "cash"]),
  downPayment: z.number().min(0),
  annualRate: z.number().min(0).lt(1),
  durationYears: z.number().int().min(1).max(50),
  // Absent in pre-Phase-10 exports; treated as [] everywhere.
  rateSteps: z.array(rateStepSchema).optional(),
  prepayments: z.array(prepaymentSchema).optional(),
  rentAlternative: z.object({
    equivalentMonthlyRent: z.number().positive(),
    currentMonthlyRent: z.number().min(0).nullable(),
    comparability: z.enum(["low", "medium", "high"]),
  }),
  costItems: z.array(costItemSchema),
  assumptions: economicAssumptionsSchema.partial(),
  horizonYears: z.number().int().min(1).max(50),
  sellingCostRate: z.number().min(0).max(0.2),
  profileEnabled: z.boolean(),
  negotiation: negotiationDataSchema.optional(),
});

const qualitativeScoresSchema = z.object({
  stability: z.number().min(0).max(10).optional(),
  flexibility: z.number().min(0).max(10).optional(),
  space: z.number().min(0).max(10).optional(),
  school: z.number().min(0).max(10).optional(),
  family: z.number().min(0).max(10).optional(),
  work: z.number().min(0).max(10).optional(),
});

const qualitativeWeightsSchema = z.object({
  stability: z.number().min(0).max(10),
  flexibility: z.number().min(0).max(10),
  space: z.number().min(0).max(10),
  school: z.number().min(0).max(10),
  family: z.number().min(0).max(10),
  work: z.number().min(0).max(10),
});

const scenarioBaseFields = {
  id: z.string().min(1),
  title: z.string().min(1),
  archived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
} as const;

const scenarioV1Schema = z.object({
  ...scenarioBaseFields,
  schemaVersion: z.literal(1),
  quick: quickDataSchema,
});

const scenarioV2Schema = z.object({
  ...scenarioBaseFields,
  schemaVersion: z.literal(2),
  mode: z.enum(["quick", "analytical"]),
  quick: quickDataSchema,
  analytical: analyticalDataSchema.nullable(),
});

const scenarioV3Schema = z.object({
  ...scenarioBaseFields,
  schemaVersion: z.literal(3),
  mode: z.enum(["quick", "analytical"]),
  quick: quickDataSchema,
  analytical: analyticalDataSchema.nullable(),
  qualitative: qualitativeScoresSchema,
});

const appConfigSchema = z.object({
  id: z.literal("app"),
  schemaVersion: z.literal(2),
  profile: z.object({
    liquidity: z.number().min(0),
    emergencyFund: z.number().min(0),
    currentMonthlyRent: z.number().min(0).nullable(),
    city: z.string(),
    notes: z.string(),
  }),
  globalAssumptions: economicAssumptionsSchema.partial(),
  userPresets: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      values: economicAssumptionsSchema.partial(),
    }),
  ),
  // Absent in v2 exports; normalized by mergeAppConfig on import.
  qualitativeWeights: qualitativeWeightsSchema.optional(),
});

const journalEntrySchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  createdAt: z.number(),
  kind: z.enum(["note", "visit", "pro", "con", "decision", "offer"]),
  text: z.string(),
  decision: z.string().nullable(),
  revisionId: z.string().nullable(),
  // Offer entries only (FR-024); absent in pre-Phase-8 exports.
  offer: z
    .object({ party: z.enum(["you", "counterpart"]), price: z.number().positive() })
    .nullable()
    .optional(),
});

const revisionSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  createdAt: z.number(),
  label: z.string(),
  title: z.string(),
  mode: z.enum(["quick", "analytical"]),
  quick: quickDataSchema,
  analytical: analyticalDataSchema.nullable(),
});

const exportFileV1Schema = z.object({
  app: z.literal("domus-scope"),
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  scenarios: z.array(scenarioV1Schema),
});

const exportFileV2Schema = z.object({
  app: z.literal("domus-scope"),
  schemaVersion: z.literal(2),
  exportedAt: z.number(),
  scenarios: z.array(scenarioV2Schema),
  appConfig: appConfigSchema.nullable(),
});

const exportFileV3Schema = z.object({
  app: z.literal("domus-scope"),
  schemaVersion: z.literal(3),
  exportedAt: z.number(),
  scenarios: z.array(scenarioV3Schema),
  appConfig: appConfigSchema.nullable(),
  journal: z.array(journalEntrySchema),
  revisions: z.array(revisionSchema),
});

export type ExportFile = z.infer<typeof exportFileV3Schema>;

export async function buildExport(): Promise<ExportFile> {
  return {
    app: "domus-scope",
    schemaVersion: 3,
    exportedAt: Date.now(),
    scenarios: await db.scenarios.toArray(),
    appConfig: (await db.appConfig.get("app")) ?? null,
    journal: await db.journal.toArray(),
    revisions: await db.revisions.toArray(),
  };
}

/** Error codes; the UI maps them to localized copy (`settings.error.*`). */
export type ImportErrorCode = "invalidJson" | "notExport";

export interface ImportOutcome {
  imported: number;
  renamed: number;
  configImported: boolean;
  error?: ImportErrorCode;
}

function parseExportFile(parsedJson: unknown): ExportFile | null {
  const v3 = exportFileV3Schema.safeParse(parsedJson);
  if (v3.success) return v3.data;

  const v2 = exportFileV2Schema.safeParse(parsedJson);
  if (v2.success) {
    return {
      ...v2.data,
      schemaVersion: 3,
      journal: [],
      revisions: [],
      scenarios: v2.data.scenarios.map((scenario) => ({
        ...scenario,
        schemaVersion: 3 as const,
        qualitative: {},
      })),
    };
  }

  const v1 = exportFileV1Schema.safeParse(parsedJson);
  if (v1.success) {
    return {
      app: "domus-scope",
      schemaVersion: 3,
      exportedAt: v1.data.exportedAt,
      appConfig: null,
      journal: [],
      revisions: [],
      scenarios: v1.data.scenarios.map((scenario) => ({
        ...scenario,
        schemaVersion: 3 as const,
        mode: "quick" as const,
        analytical: null,
        qualitative: {},
      })),
    };
  }
  return null;
}

export async function importData(raw: unknown): Promise<ImportOutcome> {
  let parsedJson: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { imported: 0, renamed: 0, configImported: false, error: "invalidJson" };
    }
  }

  const file = parseExportFile(parsedJson);
  if (!file) {
    return { imported: 0, renamed: 0, configImported: false, error: "notExport" };
  }

  // Scenarios first; colliding ids get fresh ones and dependents are remapped.
  const scenarioIdMap = new Map<string, string>();
  let renamed = 0;
  for (const scenario of file.scenarios) {
    const collision = await db.scenarios.get(scenario.id);
    const record: StoredScenario = collision
      ? {
          ...scenario,
          id: crypto.randomUUID(),
          title: `${scenario.title} (imported)`,
          updatedAt: Date.now(),
        }
      : scenario;
    scenarioIdMap.set(scenario.id, record.id);
    if (collision) renamed += 1;
    await db.scenarios.add(record);
  }

  // Revisions next (journal entries reference them). Always fresh ids.
  const revisionIdMap = new Map<string, string>();
  for (const revision of file.revisions) {
    const scenarioId = scenarioIdMap.get(revision.scenarioId) ?? revision.scenarioId;
    if (!(await db.scenarios.get(scenarioId))) continue; // orphan: skip
    const record: ScenarioRevision = { ...revision, id: crypto.randomUUID(), scenarioId };
    revisionIdMap.set(revision.id, record.id);
    await db.revisions.add(record);
  }
  for (const entry of file.journal) {
    const scenarioId = scenarioIdMap.get(entry.scenarioId) ?? entry.scenarioId;
    if (!(await db.scenarios.get(scenarioId))) continue; // orphan: skip
    const record: JournalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      scenarioId,
      revisionId: entry.revisionId ? (revisionIdMap.get(entry.revisionId) ?? null) : null,
    };
    await db.journal.add(record);
  }

  // App config imports only when this device has none (never overwrite).
  let configImported = false;
  if (file.appConfig && !(await db.appConfig.get("app"))) {
    await db.appConfig.put(mergeAppConfig(file.appConfig as AppConfig));
    configImported = true;
  }

  return { imported: file.scenarios.length, renamed, configImported };
}

/**
 * Single-scenario export (US-013), including its journal and revisions. The
 * current app config travels along: profile-enabled scenarios and global
 * assumption overrides are not reproducible without it, and import only
 * applies it on devices that have none.
 */
export async function buildScenarioExport(scenarioId: string): Promise<ExportFile | null> {
  const scenario = await db.scenarios.get(scenarioId);
  if (!scenario) return null;
  return {
    app: "domus-scope",
    schemaVersion: 3,
    exportedAt: Date.now(),
    scenarios: [scenario],
    appConfig: (await db.appConfig.get("app")) ?? null,
    journal: await db.journal.where("scenarioId").equals(scenarioId).toArray(),
    revisions: await db.revisions.where("scenarioId").equals(scenarioId).toArray(),
  };
}

export async function wipeAllData(): Promise<void> {
  await db.transaction("rw", [db.scenarios, db.appConfig, db.journal, db.revisions], async () => {
    await db.scenarios.clear();
    await db.appConfig.clear();
    await db.journal.clear();
    await db.revisions.clear();
  });
}
