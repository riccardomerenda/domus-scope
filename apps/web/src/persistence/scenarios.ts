import { assumptionPresets } from "@domus-scope/engine";
import {
  db,
  defaultAppConfig,
  defaultNegotiationData,
  type AnalyticalData,
  type QuickData,
  type ScenarioMode,
  type StoredScenario,
} from "./db";

export function newQuickDefaults(): QuickData {
  return {
    propertyPrice: 250_000,
    equivalentMonthlyRent: 950,
    horizonYears: 10,
    financingKind: "mortgage",
    downPayment: 50_000,
    annualRate: 0.034,
    durationYears: 25,
    comparability: "medium",
    assumptionPreset: "base",
    liquidityEnabled: false,
    liquidityAvailable: 80_000,
    emergencyFund: 20_000,
  };
}

/** Seeds the analytical form from the quick form (first upgrade only). */
export function quickToAnalytical(quick: QuickData): AnalyticalData {
  return {
    property: {
      price: quick.propertyPrice,
      marketValue: null,
      cadastralValue: null,
      zone: "",
      sizeSqm: null,
      notes: "",
    },
    financingKind: quick.financingKind,
    downPayment: quick.downPayment,
    annualRate: quick.annualRate,
    durationYears: quick.durationYears,
    rentAlternative: {
      equivalentMonthlyRent: quick.equivalentMonthlyRent,
      currentMonthlyRent: null,
      comparability: quick.comparability,
    },
    costItems: [],
    assumptions: { ...assumptionPresets[quick.assumptionPreset].values },
    horizonYears: quick.horizonYears,
    sellingCostRate: 0.0366,
    profileEnabled: true,
    negotiation: { ...defaultNegotiationData },
  };
}

export async function createScenario(title = "New scenario"): Promise<StoredScenario> {
  const now = Date.now();
  const scenario: StoredScenario = {
    id: crypto.randomUUID(),
    schemaVersion: 3,
    title,
    archived: false,
    createdAt: now,
    updatedAt: now,
    mode: "quick",
    quick: newQuickDefaults(),
    analytical: null,
    qualitative: {},
  };
  await db.scenarios.add(scenario);
  return scenario;
}

export async function updateScenario(
  id: string,
  patch: Partial<Pick<StoredScenario, "title" | "quick" | "analytical" | "qualitative">>,
): Promise<void> {
  await db.scenarios.update(id, { ...patch, updatedAt: Date.now() });
}

/**
 * Switches the scenario mode. The first upgrade to analytical seeds the form
 * from the quick inputs and — if the user filled the quick liquidity check but
 * has no stored profile yet — seeds the global profile from it too.
 */
export async function setMode(id: string, mode: ScenarioMode): Promise<void> {
  const scenario = await db.scenarios.get(id);
  if (!scenario) return;

  let analytical = scenario.analytical;
  if (mode === "analytical" && analytical === null) {
    analytical = quickToAnalytical(scenario.quick);
    if (scenario.quick.liquidityEnabled && !(await db.appConfig.get("app"))) {
      await db.appConfig.put({
        ...defaultAppConfig,
        profile: {
          ...defaultAppConfig.profile,
          liquidity: scenario.quick.liquidityAvailable,
          emergencyFund: scenario.quick.emergencyFund,
        },
      });
    }
  }
  await db.scenarios.update(id, { mode, analytical, updatedAt: Date.now() });
}

export async function duplicateScenario(id: string): Promise<StoredScenario | undefined> {
  const original = await db.scenarios.get(id);
  if (!original) return undefined;
  const now = Date.now();
  const copy: StoredScenario = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    title: `${original.title} (copy)`,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.scenarios.add(copy);
  return copy;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.scenarios.update(id, { archived, updatedAt: Date.now() });
}

export async function deleteScenario(id: string): Promise<void> {
  // Cascade: journal entries and revisions belong to the scenario.
  await db.transaction("rw", [db.scenarios, db.journal, db.revisions], async () => {
    await db.journal.where("scenarioId").equals(id).delete();
    await db.revisions.where("scenarioId").equals(id).delete();
    await db.scenarios.delete(id);
  });
}

export async function listScenarios(): Promise<StoredScenario[]> {
  return db.scenarios.orderBy("updatedAt").reverse().toArray();
}
