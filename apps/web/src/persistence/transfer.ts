import { z } from "zod";
import { db, type StoredScenario } from "./db";

/**
 * Export/import (FR-017 groundwork). Import is additive and never overwrites:
 * colliding ids get a fresh id and a "(imported)" suffix.
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

const storedScenarioSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  archived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  quick: quickDataSchema,
});

const exportFileSchema = z.object({
  app: z.literal("domus-scope"),
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  scenarios: z.array(storedScenarioSchema),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export async function buildExport(): Promise<ExportFile> {
  const scenarios = await db.scenarios.toArray();
  return { app: "domus-scope", schemaVersion: 1, exportedAt: Date.now(), scenarios };
}

export interface ImportOutcome {
  imported: number;
  renamed: number;
  error?: string;
}

export async function importData(raw: unknown): Promise<ImportOutcome> {
  let parsedJson: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { imported: 0, renamed: 0, error: "The file is not valid JSON." };
    }
  }
  const parsed = exportFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { imported: 0, renamed: 0, error: "The file is not a DomusScope export." };
  }

  let renamed = 0;
  for (const scenario of parsed.data.scenarios) {
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
  return { imported: parsed.data.scenarios.length, renamed };
}

export async function wipeAllData(): Promise<void> {
  await db.scenarios.clear();
}
