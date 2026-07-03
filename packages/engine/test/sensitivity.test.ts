import { describe, expect, it } from "vitest";
import {
  defaultEngineConfig,
  runSensitivity,
  scenarioInputSchema,
  simulate,
  type EngineConfig,
  type ScenarioInput,
} from "../src";

const transcriptConfig: EngineConfig = {
  ...defaultEngineConfig,
  toggles: { ...defaultEngineConfig.toggles, mortgageInterestDeduction: false },
  assumptions: {
    alternativeReturn: 0.05,
    homeAppreciation: 0,
    rentGrowth: 0,
    inflation: 0.02,
    capitalGainsTax: 0.26,
    maintenanceRate: 0.01,
    recurringTaxRate: 0,
  },
};

function referenceScenario(overrides: Record<string, unknown> = {}): ScenarioInput {
  return scenarioInputSchema.parse({
    id: "sens",
    title: "Sensitivity reference",
    property: { price: 200_000 },
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
    ...overrides,
  });
}

describe("runSensitivity (critique W6, FR-011)", () => {
  const input = referenceScenario();
  const result = runSensitivity(input, transcriptConfig);

  it("anchors to the base simulation and sorts the tornado by impact", () => {
    const base = simulate(input, transcriptConfig);
    expect(result.baseAdvantage).toBe(base.summary.advantageAtHorizon);
    expect(result.baseVerdict).toBe(base.verdict.kind);

    const magnitudes = result.entries.map((entry) => Math.abs(entry.advantageDelta));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
  });

  it("includes mortgage-rate perturbations only for mortgage scenarios", () => {
    expect(result.entries.some((entry) => entry.id.startsWith("mortgageRate"))).toBe(true);
    const cash = runSensitivity(
      referenceScenario({ financing: { kind: "cash" } }),
      transcriptConfig,
      { heatmap: null },
    );
    expect(cash.entries.some((entry) => entry.id.startsWith("mortgageRate"))).toBe(false);
  });

  it("perturbations move the advantage in the economically expected direction", () => {
    const byId = new Map(result.entries.map((entry) => [entry.id, entry]));
    // Higher rent growth favors buying; higher alternative return favors renting.
    expect(byId.get("rentGrowth:+")!.advantageDelta).toBeGreaterThan(0);
    expect(byId.get("rentGrowth:-")!.advantageDelta).toBeLessThan(0);
    expect(byId.get("alternativeReturn:+")!.advantageDelta).toBeLessThan(0);
    expect(byId.get("mortgageRate:+")!.advantageDelta).toBeLessThan(0);
  });

  it("computes the fragility index and a solid rating for a lopsided case", () => {
    // Rent at 7.5% of price is decisively buy-favorable: nothing should flip it.
    expect(result.fragility.flipped).toBe(0);
    expect(result.fragility.rating).toBe("solid");
    expect(result.fragility.index).toBe(0);
    expect(result.fragility.total).toBe(result.entries.length);
  });

  it("detects verdict flips near the frontier (fragile conclusions)", () => {
    // A borderline scenario: low rent-to-price, buy and rent nearly tie.
    const borderline = runSensitivity(
      referenceScenario({
        rentAlternative: { equivalentMonthlyRent: 700, comparability: "high" },
        horizonYears: 15,
      }),
      transcriptConfig,
      { heatmap: null },
    );
    expect(borderline.fragility.flipped).toBeGreaterThan(0);
    expect(["sensitive", "fragile"]).toContain(borderline.fragility.rating);
    const flipping = borderline.entries.filter((entry) => entry.flipsVerdict);
    expect(flipping.every((entry) => entry.verdictKind !== borderline.baseVerdict)).toBe(true);
  });

  it("builds the verdict heatmap with monotone advantage along both axes", () => {
    expect(result.heatmap).not.toBeNull();
    const heatmap = result.heatmap!;
    expect(heatmap.cells).toHaveLength(7);
    expect(heatmap.cells[0]).toHaveLength(7);

    // Along a row (fixed appreciation) advantage rises with rent growth (PT-03).
    for (const row of heatmap.cells) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i]!.advantage).toBeGreaterThanOrEqual(row[i - 1]!.advantage - 1e-6);
      }
    }
    // Along a column (fixed rent growth) advantage rises with appreciation.
    for (let col = 0; col < 7; col++) {
      for (let rowIndex = 1; rowIndex < heatmap.cells.length; rowIndex++) {
        expect(heatmap.cells[rowIndex]![col]!.advantage).toBeGreaterThanOrEqual(
          heatmap.cells[rowIndex - 1]![col]!.advantage - 1e-6,
        );
      }
    }
  });

  it("is deterministic (NFR-002)", () => {
    expect(runSensitivity(input, transcriptConfig)).toStrictEqual(
      runSensitivity(input, transcriptConfig),
    );
  });
});
