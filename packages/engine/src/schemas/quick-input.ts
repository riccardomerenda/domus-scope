import { z } from "zod";
import { positiveMoney, years } from "./common";
import { financingSchema } from "./financing";

/**
 * Input for Quick mode (domain spec §2): the derived-threshold quick rule plus
 * simplified year-1 unrecoverable costs. Assumptions come from the resolved
 * engine configuration, not from this input.
 */
export const quickInputSchema = z
  .object({
    /** BR-001: must be strictly positive. */
    propertyPrice: positiveMoney,
    /** BR-002: the *equivalent* rent, never blindly the current one (FR-004). */
    equivalentMonthlyRent: positiveMoney,
    horizonYears: years,
    financing: financingSchema,
  })
  .refine((q) => q.financing.kind !== "mortgage" || q.financing.downPayment <= q.propertyPrice, {
    message: "Down payment cannot exceed the property price (LTV > 100%, BR-003)",
    path: ["financing", "downPayment"],
  });

export type QuickInput = z.infer<typeof quickInputSchema>;
