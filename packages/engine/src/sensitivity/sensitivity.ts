import { resolveAssumptions } from "../config/resolve";
import { type EconomicAssumptions } from "../schemas/assumptions";
import { defaultEngineConfig, type EngineConfig } from "../schemas/engine-config";
import { type ScenarioInput } from "../schemas/scenario-input";
import { type VerdictKind } from "../rules/verdict";
import { simulate } from "../simulation/simulate";

/**
 * Sensitivity analysis (critique W6, FR-011): one-at-a-time perturbations for
 * the tornado view, a fragility index answering "how fragile is this
 * conclusion?", and a rent-growth × home-appreciation verdict heatmap.
 *
 * The metric is the wealth-lens advantage at the horizon on the configured
 * basis (`SimulationSummary.advantageAtHorizon`).
 */

export type PerturbationTarget =
  | { kind: "assumption"; key: keyof EconomicAssumptions }
  | { kind: "mortgageRate" }
  | { kind: "rentRelative" }
  | { kind: "horizonYears" };

export interface Perturbation {
  id: string;
  label: string;
  /** Human-readable delta, e.g. "+1.0 pp", "−10%", "+5 y". */
  deltaLabel: string;
  target: PerturbationTarget;
  /** Rate points for rates, fraction for relative targets, years for horizon. */
  delta: number;
}

export interface HeatmapSpec {
  rentGrowth: { min: number; max: number; steps: number };
  homeAppreciation: { min: number; max: number; steps: number };
}

export interface SensitivityPlan {
  perturbations: Perturbation[];
  /** Null skips the grid (e.g. dashboard badges need only the OAT run). */
  heatmap: HeatmapSpec | null;
}

export interface TornadoEntry {
  id: string;
  label: string;
  deltaLabel: string;
  advantage: number;
  /** vs the base advantage; the tornado bar length. */
  advantageDelta: number;
  verdictKind: VerdictKind;
  flipsVerdict: boolean;
}

export type FragilityRating = "solid" | "sensitive" | "fragile";

export interface HeatmapCell {
  rentGrowth: number;
  homeAppreciation: number;
  advantage: number;
  verdictKind: VerdictKind;
}

export interface HeatmapResult {
  rentGrowthValues: number[];
  homeAppreciationValues: number[];
  /** Row-major: one row per homeAppreciation value. */
  cells: HeatmapCell[][];
}

export interface SensitivityResult {
  baseAdvantage: number;
  baseVerdict: VerdictKind;
  /** Sorted by |advantageDelta| descending. */
  entries: TornadoEntry[];
  fragility: {
    flipped: number;
    total: number;
    /** flipped / total. */
    index: number;
    rating: FragilityRating;
  };
  heatmap: HeatmapResult | null;
}

/** ≤ this share of flips still reads as "sensitive"; above it, "fragile". */
const FRAGILE_THRESHOLD = 0.25;

function ratePerturbations(
  key: keyof EconomicAssumptions,
  label: string,
  deltaPoints: number,
): Perturbation[] {
  const pp = (deltaPoints * 100).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return [
    {
      id: `${key}:+`,
      label,
      deltaLabel: `+${pp} pp`,
      target: { kind: "assumption", key },
      delta: deltaPoints,
    },
    {
      id: `${key}:-`,
      label,
      deltaLabel: `−${pp} pp`,
      target: { kind: "assumption", key },
      delta: -deltaPoints,
    },
  ];
}

export function defaultSensitivityPlan(input: ScenarioInput): SensitivityPlan {
  const perturbations: Perturbation[] = [
    ...ratePerturbations("rentGrowth", "Rent growth", 0.01),
    ...ratePerturbations("homeAppreciation", "Home appreciation", 0.01),
    ...ratePerturbations("alternativeReturn", "Alternative return", 0.01),
    ...ratePerturbations("maintenanceRate", "Maintenance", 0.005),
    {
      id: "rent:+",
      label: "Equivalent rent",
      deltaLabel: "+10%",
      target: { kind: "rentRelative" },
      delta: 0.1,
    },
    {
      id: "rent:-",
      label: "Equivalent rent",
      deltaLabel: "−10%",
      target: { kind: "rentRelative" },
      delta: -0.1,
    },
    {
      id: "horizon:+",
      label: "Horizon",
      deltaLabel: "+5 y",
      target: { kind: "horizonYears" },
      delta: 5,
    },
    {
      id: "horizon:-",
      label: "Horizon",
      deltaLabel: "−5 y",
      target: { kind: "horizonYears" },
      delta: -5,
    },
  ];
  if (input.financing.kind === "mortgage") {
    perturbations.push(
      {
        id: "mortgageRate:+",
        label: "Mortgage rate",
        deltaLabel: "+1.0 pp",
        target: { kind: "mortgageRate" },
        delta: 0.01,
      },
      {
        id: "mortgageRate:-",
        label: "Mortgage rate",
        deltaLabel: "−1.0 pp",
        target: { kind: "mortgageRate" },
        delta: -0.01,
      },
    );
  }
  return {
    perturbations,
    heatmap: {
      rentGrowth: { min: 0, max: 0.06, steps: 7 },
      homeAppreciation: { min: -0.02, max: 0.04, steps: 7 },
    },
  };
}

function applyPerturbation(
  input: ScenarioInput,
  baseAssumptions: EconomicAssumptions,
  perturbation: Perturbation,
): ScenarioInput {
  const { target, delta } = perturbation;
  switch (target.kind) {
    case "assumption":
      return {
        ...input,
        assumptions: {
          ...input.assumptions,
          [target.key]: baseAssumptions[target.key] + delta,
        },
      };
    case "mortgageRate":
      if (input.financing.kind !== "mortgage") return input;
      return {
        ...input,
        financing: {
          ...input.financing,
          annualRate: Math.max(input.financing.annualRate + delta, 0),
        },
      };
    case "rentRelative":
      return {
        ...input,
        rentAlternative: {
          ...input.rentAlternative,
          equivalentMonthlyRent: input.rentAlternative.equivalentMonthlyRent * (1 + delta),
        },
      };
    case "horizonYears":
      return {
        ...input,
        horizonYears: Math.min(50, Math.max(1, Math.round(input.horizonYears + delta))),
      };
  }
}

function gridValues(spec: { min: number; max: number; steps: number }): number[] {
  if (spec.steps < 2) return [spec.min];
  const step = (spec.max - spec.min) / (spec.steps - 1);
  return Array.from({ length: spec.steps }, (_, index) => spec.min + index * step);
}

export function runSensitivity(
  input: ScenarioInput,
  config: EngineConfig = defaultEngineConfig,
  planOverrides?: Partial<SensitivityPlan>,
): SensitivityResult {
  const plan: SensitivityPlan = { ...defaultSensitivityPlan(input), ...planOverrides };
  const base = simulate(input, config);
  const baseAdvantage = base.summary.advantageAtHorizon;
  const baseVerdict = base.verdict.kind;
  const baseAssumptions = resolveAssumptions(config.assumptions, input.assumptions).values;

  const entries: TornadoEntry[] = plan.perturbations
    .map((perturbation) => {
      const result = simulate(applyPerturbation(input, baseAssumptions, perturbation), config);
      return {
        id: perturbation.id,
        label: perturbation.label,
        deltaLabel: perturbation.deltaLabel,
        advantage: result.summary.advantageAtHorizon,
        advantageDelta: result.summary.advantageAtHorizon - baseAdvantage,
        verdictKind: result.verdict.kind,
        flipsVerdict: result.verdict.kind !== baseVerdict,
      };
    })
    .sort((a, b) => Math.abs(b.advantageDelta) - Math.abs(a.advantageDelta));

  const flipped = entries.filter((entry) => entry.flipsVerdict).length;
  const index = entries.length > 0 ? flipped / entries.length : 0;
  const rating: FragilityRating =
    flipped === 0 ? "solid" : index <= FRAGILE_THRESHOLD ? "sensitive" : "fragile";

  let heatmap: HeatmapResult | null = null;
  if (plan.heatmap) {
    const rentGrowthValues = gridValues(plan.heatmap.rentGrowth);
    const homeAppreciationValues = gridValues(plan.heatmap.homeAppreciation);
    heatmap = {
      rentGrowthValues,
      homeAppreciationValues,
      cells: homeAppreciationValues.map((homeAppreciation) =>
        rentGrowthValues.map((rentGrowth) => {
          const result = simulate(
            {
              ...input,
              assumptions: { ...input.assumptions, rentGrowth, homeAppreciation },
            },
            config,
          );
          return {
            rentGrowth,
            homeAppreciation,
            advantage: result.summary.advantageAtHorizon,
            verdictKind: result.verdict.kind,
          };
        }),
      ),
    };
  }

  return {
    baseAdvantage,
    baseVerdict,
    entries,
    fragility: { flipped, total: entries.length, index, rating },
    heatmap,
  };
}
