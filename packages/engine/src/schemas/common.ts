import { z } from "zod";

/**
 * Fractional annual rate: `0.03` means 3%/year. Growth rates may be negative
 * (BR-012); sanity bounds beyond schema bounds warn instead of blocking (BR-020).
 */
export const annualRate = z.number().gt(-1).lt(1);

/** Non-negative fractional rate (e.g. mortgage rate — negative rates unsupported). */
export const nonNegativeRate = z.number().min(0).lt(1);

/** Amount in EUR, zero allowed. */
export const money = z.number().min(0);

/** Strictly positive amount in EUR. */
export const positiveMoney = z.number().positive();

/** Fraction in [0, 1] (shares, tax rates). */
export const fraction = z.number().min(0).max(1);

/** Whole years in a range wide enough for any mortgage or horizon. */
export const years = z.number().int().min(1).max(50);
