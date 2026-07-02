import { z } from "zod";
import { money, positiveMoney, years } from "./common";
import { economicAssumptionsSchema } from "./assumptions";
import { financingSchema } from "./financing";

export const quickLiquiditySchema = z.object({
  /** Liquid savings available before the purchase. */
  available: money,
  /** Personal floor that must survive the purchase (BR-006). */
  emergencyFund: money,
});

/**
 * Input for Quick mode (domain spec §2): the derived-threshold quick rule plus
 * simplified year-1 unrecoverable costs.
 */
export const quickInputSchema = z
  .object({
    /** BR-001: must be strictly positive. */
    propertyPrice: positiveMoney,
    /** BR-002: the *equivalent* rent, never blindly the current one (FR-004). */
    equivalentMonthlyRent: positiveMoney,
    horizonYears: years,
    financing: financingSchema,
    /** FR-014/BR-022: "low" caps the verdict at "indicative" and raises W-001. */
    comparability: z.enum(["low", "medium", "high"]).optional(),
    /** Optional: enables the liquidity warnings W-002/W-004. */
    liquidity: quickLiquiditySchema.optional(),
    /** Per-assessment overrides over the config assumption layer (§9). */
    assumptions: economicAssumptionsSchema.partial().default({}),
  })
  .refine((q) => q.financing.kind !== "mortgage" || q.financing.downPayment <= q.propertyPrice, {
    message: "Down payment cannot exceed the property price (LTV > 100%, BR-003)",
    path: ["financing", "downPayment"],
  });

export type QuickLiquidity = z.infer<typeof quickLiquiditySchema>;
export type QuickInput = z.infer<typeof quickInputSchema>;
