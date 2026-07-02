import { z } from "zod";
import { economicAssumptionsSchema, type EconomicAssumptions } from "./assumptions";

export const featureTogglesSchema = z.object({
  /** BR-011: disabling the opportunity-cost line always raises W-006. */
  opportunityCost: z.boolean(),
  /** BR-019: displayed whenever the opportunity cost is displayed. */
  appreciationCredit: z.boolean(),
  /** G4: 19% of mortgage interest, capped (Italian primary residence). */
  mortgageInterestDeduction: z.boolean(),
  /** Critique W5: deflate cumulative figures by inflation. */
  realTermsView: z.boolean(),
  /** Critique W7: include selling costs at each horizon (honest default). */
  liquidationBasis: z.boolean(),
});

/** BR-020: outside these bounds the engine warns (W-009) but never blocks. */
export const sanityBoundsSchema = z.object({
  minRate: z.number(),
  maxRate: z.number(),
});

export const engineConfigSchema = z.object({
  /** Grey band around the derived threshold R*, in rate points (§2). */
  greyBand: z.number().min(0).max(0.05),
  /** Relative epsilon for money comparisons (§10 determinism policy). */
  epsilon: z.number().positive(),
  toggles: featureTogglesSchema,
  sanityBounds: sanityBoundsSchema,
  /** Engine-default assumption layer (lowest precedence, §9). */
  assumptions: economicAssumptionsSchema,
});

export type FeatureToggles = z.infer<typeof featureTogglesSchema>;
export type SanityBounds = z.infer<typeof sanityBoundsSchema>;
export type EngineConfig = z.infer<typeof engineConfigSchema>;

/** The "Base" preset of the domain spec (§9) as the engine-default layer. */
export const defaultAssumptions: EconomicAssumptions = {
  alternativeReturn: 0.045,
  homeAppreciation: 0.015,
  rentGrowth: 0.03,
  inflation: 0.02,
  capitalGainsTax: 0.26,
  maintenanceRate: 0.01,
  recurringTaxRate: 0,
};

export const defaultEngineConfig: EngineConfig = {
  greyBand: 0.005,
  epsilon: 1e-9,
  toggles: {
    opportunityCost: true,
    appreciationCredit: true,
    mortgageInterestDeduction: true,
    realTermsView: false,
    liquidationBasis: true,
  },
  sanityBounds: { minRate: -0.1, maxRate: 0.15 },
  assumptions: defaultAssumptions,
};
