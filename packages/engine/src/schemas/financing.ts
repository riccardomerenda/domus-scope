import { z } from "zod";
import { money, nonNegativeRate, positiveMoney, years } from "./common";

/**
 * A scheduled change of the annual rate (G9): from the first month of
 * `fromYear` onward the mortgage re-amortizes the remaining balance over the
 * remaining contractual months at the new rate. An empty list = fixed rate.
 * Paths are explicit data (deterministic scenarios), never a stochastic model.
 */
export const rateStepSchema = z.object({
  /** 1-based contract year the new rate takes effect; year 1 is `annualRate`. */
  fromYear: z.number().int().min(2).max(50),
  annualRate: nonNegativeRate,
});

/**
 * Partial early repayment (estinzione anticipata parziale): extra principal
 * paid together with the last payment of `year`. `reducePayment` re-amortizes
 * over the remaining contractual months (the common Italian bank default);
 * `reduceDuration` keeps the payment and closes the mortgage earlier.
 */
export const prepaymentSchema = z.object({
  year: years,
  amount: positiveMoney,
  mode: z.enum(["reducePayment", "reduceDuration"]).default("reducePayment"),
});

export const mortgageFinancingSchema = z
  .object({
    kind: z.literal("mortgage"),
    /** Down payment in EUR. The mortgage principal is derived: price − downPayment. */
    downPayment: money,
    /** Initial (year-1) annual rate; `rateSteps` override it from their year on. */
    annualRate: nonNegativeRate,
    /** Contract duration; independent from the simulation horizon (BR-004). */
    durationYears: years,
    rateSteps: z.array(rateStepSchema).default([]),
    prepayments: z.array(prepaymentSchema).default([]),
  })
  .refine(
    (m) => m.rateSteps.every((step, i) => i === 0 || step.fromYear > m.rateSteps[i - 1]!.fromYear),
    { message: "Rate steps must have strictly increasing years", path: ["rateSteps"] },
  )
  .refine((m) => m.rateSteps.every((step) => step.fromYear <= m.durationYears), {
    message: "Rate steps beyond the mortgage duration have no effect",
    path: ["rateSteps"],
  });

export const cashFinancingSchema = z.object({
  kind: z.literal("cash"),
});

export const financingSchema = z.discriminatedUnion("kind", [
  mortgageFinancingSchema,
  cashFinancingSchema,
]);

export type RateStep = z.infer<typeof rateStepSchema>;
export type Prepayment = z.infer<typeof prepaymentSchema>;
export type MortgageFinancing = z.infer<typeof mortgageFinancingSchema>;
export type CashFinancing = z.infer<typeof cashFinancingSchema>;
export type Financing = z.infer<typeof financingSchema>;
