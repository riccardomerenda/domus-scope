import { z } from "zod";
import { annualRate, fraction, nonNegativeRate } from "./common";

/**
 * Economic assumptions (domain spec §7). These exist in three layers with
 * increasing precedence: engine defaults → user globals → scenario overrides
 * (§9); `resolveConfig` records which layer supplied each effective value.
 */
export const economicAssumptionsSchema = z.object({
  /** Expected annual return of the alternative investment (r_alt), net of costs. */
  alternativeReturn: annualRate,
  /** Expected annual home appreciation (g); may be negative (BR-012). */
  homeAppreciation: annualRate,
  /** Expected annual rent growth; may be negative (BR-012). */
  rentGrowth: annualRate,
  /** Expected annual inflation, used by the real-terms view (critique W5). */
  inflation: annualRate,
  /** Capital-gains tax on portfolio gains at liquidation (G5). */
  capitalGainsTax: fraction,
  /** Routine maintenance as a share of property value per year (BR-010). */
  maintenanceRate: nonNegativeRate,
  /** Recurring ownership taxes as a share of property value per year (e.g. IMU). */
  recurringTaxRate: nonNegativeRate,
});

export type EconomicAssumptions = z.infer<typeof economicAssumptionsSchema>;
