import { z } from "zod";
import { money, positiveMoney, years } from "./common";
import { costItemSchema } from "./cost-item";
import { economicAssumptionsSchema } from "./assumptions";
import { financingSchema } from "./financing";

export const propertySchema = z.object({
  price: positiveMoney,
  /** Basis for Italian registration tax on existing homes (G1). */
  cadastralValue: money.optional(),
  zone: z.string().default(""),
  sizeSqm: z.number().positive().optional(),
  notes: z.string().default(""),
});

export const rentAlternativeSchema = z.object({
  /** BR-002/FR-004: the rent of a genuinely comparable home. */
  equivalentMonthlyRent: positiveMoney,
  /** The user's current rent — informative, warned against if not comparable. */
  currentMonthlyRent: money.optional(),
  /** Low comparability caps verdict strength at "indicative" (BR-022, G8). */
  comparability: z.enum(["low", "medium", "high"]),
});

export const personalProfileSchema = z.object({
  liquidity: money,
  /** Threshold for the strong liquidity warning (BR-006, W-002). */
  emergencyFund: money,
  stabilityScore: z.number().min(0).max(10).optional(),
  flexibilityScore: z.number().min(0).max(10).optional(),
  notes: z.string().default(""),
});

/**
 * Full input for Analytical mode (`simulate()`, domain spec §5–§7).
 */
export const scenarioInputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().default(""),
    property: propertySchema,
    financing: financingSchema,
    rentAlternative: rentAlternativeSchema,
    costItems: z.array(costItemSchema).default([]),
    /** Scenario-layer overrides over the global assumption layer (§9). */
    assumptions: economicAssumptionsSchema.partial().default({}),
    profile: personalProfileSchema.optional(),
    horizonYears: years,
  })
  .refine((s) => s.financing.kind !== "mortgage" || s.financing.downPayment <= s.property.price, {
    message: "Down payment cannot exceed the property price (LTV > 100%, BR-003)",
    path: ["financing", "downPayment"],
  });

export type Property = z.infer<typeof propertySchema>;
export type RentAlternative = z.infer<typeof rentAlternativeSchema>;
export type PersonalProfile = z.infer<typeof personalProfileSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
