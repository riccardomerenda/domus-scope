import { z } from "zod";
import { costItemSchema, economicAssumptionsSchema } from "@domus-scope/engine";
import { db, type StoredScenario } from "./db";

/**
 * Export/import (FR-017 groundwork). Import is additive and never overwrites:
 * colliding ids get a fresh id and a "(imported)" suffix. Version-1 export
 * files remain importable (migrated on the fly).
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

const analyticalDataSchema = z.object({
  property: z.object({
    price: z.number().positive(),
    cadastralValue: z.number().min(0).nullable(),
    zone: z.string(),
    sizeSqm: z.number().positive().nullable(),
    notes: z.string(),
  }),
  financingKind: z.enum(["mortgage", "cash"]),
  downPayment: z.number().min(0),
  annualRate: z.number().min(0).lt(1),
  durationYears: z.number().int().min(1).max(50),
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
});

const scenarioV1Schema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  archived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  quick: quickDataSchema,
});

const scenarioV2Schema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(2),
  title: z.string().min(1),
  archived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  mode: z.enum(["quick", "analytical"]),
  quick: quickDataSchema,
  analytical: analyticalDataSchema.nullable(),
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

export type ExportFile = z.infer<typeof exportFileV2Schema>;

export async function buildExport(): Promise<ExportFile> {
  const scenarios = await db.scenarios.toArray();
  const appConfig = (await db.appConfig.get("app")) ?? null;
  return { app: "domus-scope", schemaVersion: 2, exportedAt: Date.now(), scenarios, appConfig };
}

export interface ImportOutcome {
  imported: number;
  renamed: number;
  configImported: boolean;
  error?: string;
}

function migrateV1(file: z.infer<typeof exportFileV1Schema>): ExportFile {
  return {
    app: "domus-scope",
    schemaVersion: 2,
    exportedAt: file.exportedAt,
    appConfig: null,
    scenarios: file.scenarios.map((scenario) => ({
      ...scenario,
      schemaVersion: 2 as const,
      mode: "quick" as const,
      analytical: null,
    })),
  };
}

export async function importData(raw: unknown): Promise<ImportOutcome> {
  let parsedJson: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return {
        imported: 0,
        renamed: 0,
        configImported: false,
        error: "The file is not valid JSON.",
      };
    }
  }

  let file: ExportFile;
  const v2 = exportFileV2Schema.safeParse(parsedJson);
  if (v2.success) {
    file = v2.data;
  } else {
    const v1 = exportFileV1Schema.safeParse(parsedJson);
    if (!v1.success) {
      return {
        imported: 0,
        renamed: 0,
        configImported: false,
        error: "The file is not a DomusScope export.",
      };
    }
    file = migrateV1(v1.data);
  }

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
    if (collision) renamed += 1;
    await db.scenarios.add(record);
  }

  // App config imports only when this device has none (never overwrite).
  let configImported = false;
  if (file.appConfig && !(await db.appConfig.get("app"))) {
    await db.appConfig.put(file.appConfig);
    configImported = true;
  }

  return { imported: file.scenarios.length, renamed, configImported };
}

export async function wipeAllData(): Promise<void> {
  await db.scenarios.clear();
  await db.appConfig.clear();
}
