import { type EconomicAssumptions } from "../schemas/assumptions";

/**
 * Assumption presets (domain spec §9). Data, not code: they accelerate
 * scenario creation and are freely overridable — never predictions.
 */
export type AssumptionPresetId = "conservative" | "base" | "optimistic";

export interface AssumptionPreset {
  id: AssumptionPresetId;
  label: string;
  description: string;
  values: Partial<EconomicAssumptions>;
}

export const assumptionPresets: Record<AssumptionPresetId, AssumptionPreset> = {
  conservative: {
    id: "conservative",
    label: "Conservative",
    description: "Stresses buying: slow rents, flat home values, weak alternative returns.",
    values: {
      rentGrowth: 0.02,
      homeAppreciation: 0,
      alternativeReturn: 0.03,
      maintenanceRate: 0.012,
    },
  },
  base: {
    id: "base",
    label: "Base",
    description: "Middle-of-the-road assumptions.",
    values: {
      rentGrowth: 0.03,
      homeAppreciation: 0.015,
      alternativeReturn: 0.045,
      maintenanceRate: 0.01,
    },
  },
  optimistic: {
    id: "optimistic",
    label: "Optimistic",
    description: "Favors buying: fast rents, appreciating homes, strong returns.",
    values: {
      rentGrowth: 0.05,
      homeAppreciation: 0.025,
      alternativeReturn: 0.055,
      maintenanceRate: 0.01,
    },
  },
};
