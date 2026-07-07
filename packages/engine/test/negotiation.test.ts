import { describe, expect, it } from "vitest";
import {
  adjustedReservationPrice,
  concessionBalance,
  defaultEngineConfig,
  DEFAULT_TYPICAL_DISCOUNT,
  earlyPossessionEquivalent,
  runNegotiation,
  scenarioAtPrice,
  scenarioInputSchema,
  simulate,
  solveReservationPrice,
  type Concession,
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
    id: "nego",
    title: "Negotiation reference",
    property: { price: 200_000 },
    financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
    rentAlternative: { equivalentMonthlyRent: 1_250, comparability: "high" },
    horizonYears: 10,
    ...overrides,
  });
}

describe("market value vs. transaction price (FR-021 anchor)", () => {
  it("defaults marketValue to the price: existing results are untouched", () => {
    const implicit = simulate(referenceScenario(), transcriptConfig);
    const explicit = simulate(
      referenceScenario({ property: { price: 200_000, marketValue: 200_000 } }),
      transcriptConfig,
    );
    expect(explicit).toStrictEqual(implicit);
  });

  it("a below-market purchase beats paying full market value", () => {
    const atMarket = simulate(referenceScenario(), transcriptConfig);
    const bargain = simulate(
      referenceScenario({ property: { price: 180_000, marketValue: 200_000 } }),
      transcriptConfig,
    );
    expect(bargain.summary.advantageAtHorizon).toBeGreaterThan(atMarket.summary.advantageAtHorizon);
  });

  it("anchors percent-of-value costs to the market value, not the price paid", () => {
    // Same house (V = 200k) at two prices: year-1 maintenance must not change.
    const cheap = simulate(
      referenceScenario({ property: { price: 150_000, marketValue: 200_000 } }),
      transcriptConfig,
    );
    const dear = simulate(
      referenceScenario({ property: { price: 200_000, marketValue: 200_000 } }),
      transcriptConfig,
    );
    const maintenance = (result: typeof cheap): number =>
      result.costLens.years[0]!.buy.items.find((item) => item.id === "buy.maintenance")!.amount;
    expect(maintenance(cheap)).toBeCloseTo(maintenance(dear), 6);
  });
});

describe("solveReservationPrice (FR-021)", () => {
  const input = referenceScenario();
  const reservation = solveReservationPrice(input, transcriptConfig);

  it("solves above the base price when the base verdict favors buying", () => {
    const base = simulate(input, transcriptConfig);
    expect(base.summary.advantageAtHorizon).toBeGreaterThan(0);
    expect(reservation.status).toBe("solved");
    expect(reservation.price).not.toBeNull();
    expect(reservation.price!).toBeGreaterThan(200_000);
    expect(reservation.price!).toBeLessThan(reservation.bounds.max);
  });

  it("is a true inverse: simulating at P* lands on the indifference point", () => {
    const atReservation = simulate(scenarioAtPrice(input, reservation.price!), transcriptConfig);
    expect(Math.abs(atReservation.summary.advantageAtHorizon)).toBeLessThan(0.01);
  });

  it("reports rentAlwaysWins when renting wins across the whole searched range", () => {
    const bounded = solveReservationPrice(input, transcriptConfig, {
      bounds: { min: 380_000, max: 420_000 },
    });
    expect(bounded.status).toBe("rentAlwaysWins");
    expect(bounded.price).toBeNull();
    expect(bounded.advantageAtMin).toBeLessThan(0);
  });

  it("reports buyAlwaysWins when buying wins across the whole searched range", () => {
    const bounded = solveReservationPrice(input, transcriptConfig, {
      bounds: { min: 40_000, max: 100_000 },
    });
    expect(bounded.status).toBe("buyAlwaysWins");
    expect(bounded.price).toBeNull();
    expect(bounded.advantageAtMax).toBeGreaterThan(0);
  });
});

describe("runNegotiation (FR-022): window against asking price", () => {
  const input = referenceScenario();
  const reservationPrice = solveReservationPrice(input, transcriptConfig).price!;

  it("orders the boundaries: pessimistic ≤ P* ≤ optimistic, grey band around P*", () => {
    const result = runNegotiation(input, { askingPrice: 250_000 }, transcriptConfig);
    expect(result.reservation.price).toBeCloseTo(reservationPrice, 2);
    const { clearBuyBelow, clearRentAbove } = result.indifferenceBand;
    expect(clearBuyBelow).not.toBeNull();
    expect(clearRentAbove).not.toBeNull();
    expect(clearBuyBelow!).toBeLessThan(result.reservation.price!);
    expect(clearRentAbove!).toBeGreaterThan(result.reservation.price!);
    expect(result.stress.pessimistic.price!).toBeLessThan(result.reservation.price!);
    expect(result.stress.optimistic.price!).toBeGreaterThan(result.reservation.price!);
  });

  it("askingAcceptable: even the asking price beats renting", () => {
    const result = runNegotiation(
      input,
      { askingPrice: Math.floor(reservationPrice * 0.9) },
      transcriptConfig,
    );
    expect(result.window.kind).toBe("askingAcceptable");
    expect(result.window.range).not.toBeNull();
    expect(result.requiredDiscount).not.toBeNull();
    expect(result.requiredDiscount!).toBeLessThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("withinTypical: a typical negotiation can reach the boundary", () => {
    const askingPrice = reservationPrice / (1 - 0.04); // requires a 4% discount
    const result = runNegotiation(input, { askingPrice }, transcriptConfig);
    expect(result.window.kind).toBe("withinTypical");
    expect(result.window.range!.low).toBeCloseTo(askingPrice * (1 - DEFAULT_TYPICAL_DISCOUNT), 6);
    expect(result.window.range!.high).toBeCloseTo(result.reservation.price!, 2);
    expect(result.requiredDiscount!).toBeCloseTo(0.04, 3);
    expect(result.warnings).toHaveLength(0);
  });

  it("needsAtypicalDiscount: raises W-010 with the required discount", () => {
    const askingPrice = reservationPrice / (1 - 0.2); // requires a 20% discount
    const result = runNegotiation(input, { askingPrice }, transcriptConfig);
    expect(result.window.kind).toBe("needsAtypicalDiscount");
    expect(result.window.range).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.id).toBe("W-010");
    expect(result.warnings[0]!.context.typicalDiscount).toBe(DEFAULT_TYPICAL_DISCOUNT);
  });

  it("none: no acceptable price in the searched range raises W-010", () => {
    const result = runNegotiation(input, { askingPrice: 400_000 }, transcriptConfig, {
      bounds: { min: 380_000, max: 420_000 },
    });
    expect(result.reservation.status).toBe("rentAlwaysWins");
    expect(result.window.kind).toBe("none");
    expect(result.warnings.map((w) => w.id)).toEqual(["W-010"]);
  });

  it("buyAlwaysWins in a capped range reads as askingAcceptable", () => {
    const result = runNegotiation(input, { askingPrice: 90_000 }, transcriptConfig, {
      bounds: { min: 40_000, max: 100_000 },
    });
    expect(result.reservation.status).toBe("buyAlwaysWins");
    expect(result.window.kind).toBe("askingAcceptable");
    expect(result.requiredDiscount).toBeNull();
  });

  it("honors a custom typical discount", () => {
    const askingPrice = reservationPrice / (1 - 0.04);
    const strict = runNegotiation(input, { askingPrice, typicalDiscount: 0.02 }, transcriptConfig);
    expect(strict.window.kind).toBe("needsAtypicalDiscount");
  });

  it("is deterministic (NFR-002)", () => {
    const params = { askingPrice: 250_000 };
    expect(runNegotiation(input, params, transcriptConfig)).toStrictEqual(
      runNegotiation(input, params, transcriptConfig),
    );
  });
});

describe("concessions (FR-023)", () => {
  const concessions: Concession[] = [
    {
      id: "c1",
      kind: "earlyPossession",
      direction: "youReceive",
      amount: earlyPossessionEquivalent(1_250, 3),
      label: "Early possession (3 months)",
    },
    { id: "c2", kind: "remediation", direction: "youGive", amount: 2_000, label: "Remediation" },
  ];

  it("prices early possession as saved rent", () => {
    expect(earlyPossessionEquivalent(1_250, 3)).toBe(3_750);
  });

  it("balances received minus given and shifts the reservation price", () => {
    expect(concessionBalance(concessions)).toBe(1_750);
    expect(adjustedReservationPrice(200_000, concessions)).toBe(201_750);
    expect(adjustedReservationPrice(null, concessions)).toBeNull();
  });

  it("flows through runNegotiation", () => {
    const input = referenceScenario();
    const result = runNegotiation(input, { askingPrice: 250_000, concessions }, transcriptConfig);
    expect(result.concessions.balance).toBe(1_750);
    expect(result.concessions.adjustedReservationPrice).toBeCloseTo(
      result.reservation.price! + 1_750,
      6,
    );
  });
});
