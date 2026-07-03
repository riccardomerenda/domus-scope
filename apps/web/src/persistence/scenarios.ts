import { db, type QuickData, type StoredScenario } from "./db";

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

export async function createScenario(title = "New scenario"): Promise<StoredScenario> {
  const now = Date.now();
  const scenario: StoredScenario = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    title,
    archived: false,
    createdAt: now,
    updatedAt: now,
    quick: newQuickDefaults(),
  };
  await db.scenarios.add(scenario);
  return scenario;
}

export async function updateScenario(
  id: string,
  patch: Partial<Pick<StoredScenario, "title" | "quick">>,
): Promise<void> {
  await db.scenarios.update(id, { ...patch, updatedAt: Date.now() });
}

export async function duplicateScenario(id: string): Promise<StoredScenario | undefined> {
  const original = await db.scenarios.get(id);
  if (!original) return undefined;
  const now = Date.now();
  const copy: StoredScenario = {
    ...original,
    id: crypto.randomUUID(),
    title: `${original.title} (copy)`,
    archived: false,
    createdAt: now,
    updatedAt: now,
    quick: { ...original.quick },
  };
  await db.scenarios.add(copy);
  return copy;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.scenarios.update(id, { archived, updatedAt: Date.now() });
}

export async function deleteScenario(id: string): Promise<void> {
  await db.scenarios.delete(id);
}

export async function listScenarios(): Promise<StoredScenario[]> {
  return db.scenarios.orderBy("updatedAt").reverse().toArray();
}
