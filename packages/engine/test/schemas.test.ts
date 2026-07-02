import { describe, expect, it } from "vitest";
import {
  costItemSchema,
  defaultEngineConfig,
  engineConfigSchema,
  validateQuickInput,
  validateScenario,
} from "../src";

const validScenario = {
  id: "scn-1",
  title: "Two-room flat, Milan",
  property: { price: 200_000 },
  financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
  rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
  horizonYears: 10,
};

describe("schema validation at the engine boundary", () => {
  it("accepts a minimal valid scenario and fills defaults", () => {
    const result = validateScenario(validScenario);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.costItems).toEqual([]);
      expect(result.value.assumptions).toEqual({});
      expect(result.value.description).toBe("");
    }
  });

  it("BR-001: rejects a non-positive property price", () => {
    const result = validateScenario({
      ...validScenario,
      property: { price: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((issue) => issue.path === "property.price")).toBe(true);
    }
  });

  it("BR-002: rejects a non-positive equivalent rent", () => {
    const result = validateScenario({
      ...validScenario,
      rentAlternative: { equivalentMonthlyRent: 0, comparability: "high" },
    });
    expect(result.ok).toBe(false);
  });

  it("BR-003: rejects a down payment above the property price (LTV > 100%)", () => {
    const result = validateQuickInput({
      propertyPrice: 200_000,
      equivalentMonthlyRent: 1_250,
      horizonYears: 10,
      financing: { kind: "mortgage", downPayment: 250_000, annualRate: 0.03, durationYears: 25 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]?.path).toBe("financing.downPayment");
    }
  });

  it("cost items default to enabled with empty notes", () => {
    const parsed = costItemSchema.parse({
      id: "notary-deed",
      label: "Notary — deed",
      scenario: "buy",
      timing: { kind: "oneTime", month: 0 },
      recoverability: { kind: "none" },
      sign: "cost",
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.notes).toBe("");
  });

  it("ships a schema-valid default engine configuration", () => {
    expect(() => engineConfigSchema.parse(defaultEngineConfig)).not.toThrow();
  });
});
