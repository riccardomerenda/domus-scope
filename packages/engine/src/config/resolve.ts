import { type EconomicAssumptions } from "../schemas/assumptions";
import { defaultAssumptions } from "../schemas/engine-config";

export type AssumptionSource = "engine-default" | "global" | "scenario";

export interface ResolvedAssumptions {
  values: EconomicAssumptions;
  /** Which layer supplied each effective value (NFR-005, §9 layering). */
  provenance: Record<keyof EconomicAssumptions, AssumptionSource>;
}

type PartialAssumptions = {
  [K in keyof EconomicAssumptions]?: EconomicAssumptions[K] | undefined;
};

/**
 * Layered resolution: engine defaults < global (EngineConfig.assumptions) <
 * scenario overrides. Records the provenance of every effective value so the
 * UI can show where each assumption came from.
 */
export function resolveAssumptions(
  globalLayer?: PartialAssumptions,
  scenarioLayer?: PartialAssumptions,
): ResolvedAssumptions {
  const values: EconomicAssumptions = { ...defaultAssumptions };
  const provenance = Object.fromEntries(
    Object.keys(defaultAssumptions).map((key) => [key, "engine-default"]),
  ) as Record<keyof EconomicAssumptions, AssumptionSource>;

  for (const key of Object.keys(defaultAssumptions) as (keyof EconomicAssumptions)[]) {
    const globalValue = globalLayer?.[key];
    if (globalValue !== undefined) {
      values[key] = globalValue;
      provenance[key] = "global";
    }
    const scenarioValue = scenarioLayer?.[key];
    if (scenarioValue !== undefined) {
      values[key] = scenarioValue;
      provenance[key] = "scenario";
    }
  }
  return { values, provenance };
}
