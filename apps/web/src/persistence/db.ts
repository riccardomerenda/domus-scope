import Dexie, { type EntityTable } from "dexie";
import { type AssumptionPresetId } from "@domus-scope/engine";

/**
 * Local-first storage (NFR-004): everything lives in IndexedDB on this device.
 * Records carry a schemaVersion so future phases can migrate them.
 */

export type FinancingKind = "mortgage" | "cash";
export type Comparability = "low" | "medium" | "high";

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

export interface StoredScenario {
  id: string;
  schemaVersion: 1;
  title: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  quick: QuickData;
}

export const db = new Dexie("domus-scope") as Dexie & {
  scenarios: EntityTable<StoredScenario, "id">;
};

// Booleans are not valid IndexedDB keys: `archived` is filtered in memory.
db.version(1).stores({ scenarios: "id, updatedAt" });
