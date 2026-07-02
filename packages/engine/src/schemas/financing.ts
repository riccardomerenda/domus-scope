import { z } from "zod";
import { money, nonNegativeRate, years } from "./common";

export const mortgageFinancingSchema = z.object({
  kind: z.literal("mortgage"),
  /** Down payment in EUR. The mortgage principal is derived: price − downPayment. */
  downPayment: money,
  annualRate: nonNegativeRate,
  /** Contract duration; independent from the simulation horizon (BR-004). */
  durationYears: years,
});

export const cashFinancingSchema = z.object({
  kind: z.literal("cash"),
});

export const financingSchema = z.discriminatedUnion("kind", [
  mortgageFinancingSchema,
  cashFinancingSchema,
]);

export type MortgageFinancing = z.infer<typeof mortgageFinancingSchema>;
export type CashFinancing = z.infer<typeof cashFinancingSchema>;
export type Financing = z.infer<typeof financingSchema>;
