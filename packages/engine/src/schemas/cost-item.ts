import { z } from "zod";
import { annualRate, fraction, money, nonNegativeRate } from "./common";

/**
 * Cost catalog (domain spec §4) — the configurability backbone. Every cost in
 * the system, built-in or user-defined, has this same shape; the simulation
 * only ever consumes resolved cost items, never hardcoded fees.
 */

export const costBaseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixedAnnual"), amount: money }),
  z.object({ kind: z.literal("percentOfValue"), rate: nonNegativeRate }),
  z.object({ kind: z.literal("percentOfRent"), rate: nonNegativeRate }),
]);

export const costGrowthSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rate"), rate: annualRate }),
  z.object({ kind: z.literal("tracksValue") }),
  z.object({ kind: z.literal("tracksRent") }),
]);

export const costTimingSchema = z.discriminatedUnion("kind", [
  /** A single payment of `amount` EUR at the given month (0 = at closing). */
  z.object({ kind: z.literal("oneTime"), month: z.number().int().min(0), amount: money }),
  /**
   * A yearly cost. `growth` applies to `fixedAnnual` bases only: percent bases
   * inherently track their reference (value or rent) and ignore it.
   */
  z.object({ kind: z.literal("recurring"), base: costBaseSchema, growth: costGrowthSchema }),
]);

export const recoverabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  /** Fully returned (e.g. rental deposit): contributes opportunity cost only (BR-016). */
  z.object({ kind: z.literal("full") }),
  /** Partially embodied in the asset (e.g. renovation adding value). */
  z.object({ kind: z.literal("partial"), share: fraction }),
]);

export const costItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  scenario: z.enum(["buy", "rent", "both"]),
  timing: costTimingSchema,
  recoverability: recoverabilitySchema,
  /** "credit" models negative costs such as tax deductions (G4). */
  sign: z.enum(["cost", "credit"]),
  enabled: z.boolean().default(true),
  notes: z.string().default(""),
});

export type CostBase = z.infer<typeof costBaseSchema>;
export type CostGrowth = z.infer<typeof costGrowthSchema>;
export type CostTiming = z.infer<typeof costTimingSchema>;
export type Recoverability = z.infer<typeof recoverabilitySchema>;
export type CostItem = z.infer<typeof costItemSchema>;
