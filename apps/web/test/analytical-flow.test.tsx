import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../src/persistence/db";
import { createScenario, setMode } from "../src/persistence/scenarios";
import { runSimulation } from "../src/lib/assess";
import { defaultAppConfig } from "../src/persistence/db";
import { ScenarioPage } from "../src/features/scenario/ScenarioPage";
import { ExplainProvider } from "../src/features/explain/ExplainContext";

function renderScenario(id: string) {
  return render(
    <ExplainProvider>
      <MemoryRouter initialEntries={[`/scenario/${id}`]}>
        <Routes>
          <Route path="/scenario/:id" element={<ScenarioPage />} />
        </Routes>
      </MemoryRouter>
    </ExplainProvider>,
  );
}

beforeEach(async () => {
  await db.scenarios.clear();
  await db.appConfig.clear();
});

describe("analytical mode (Phase 4 exit criteria — flow 11.2)", () => {
  it("upgrading from quick seeds the analytical form and shows the sectioned inputs", async () => {
    const scenario = await createScenario("Analytical test");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("button", { name: /Deepen with full analysis/ }));

    expect(await screen.findByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Cost catalog")).toBeInTheDocument();
    expect(screen.getByText("Rent alternative")).toBeInTheDocument();
    expect(screen.getByText("Assumptions")).toBeInTheDocument();
    // The seeded scenario overrides (from the quick preset) show their provenance.
    expect(screen.getAllByText("scenario override").length).toBeGreaterThan(0);

    const stored = await db.scenarios.get(scenario.id);
    expect(stored?.mode).toBe("analytical");
    expect(stored?.analytical?.property.price).toBe(stored?.quick.propertyPrice);
  });

  it("shows the results tab with verdict, KPIs, and the traceable year table", async () => {
    const scenario = await createScenario("Results test");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("radio", { name: "Results" }));

    expect(await screen.findByText(/Buying leaves you/)).toBeInTheDocument();
    expect(screen.getByText(/Year-1 cost — rent/)).toBeInTheDocument();
    expect(screen.getByText("Year by year")).toBeInTheDocument();
    expect(screen.getByText("If you sold in year t")).toBeInTheDocument();
  });

  it("expands a year row and opens the explanation drawer from a line item (FR-019)", async () => {
    const scenario = await createScenario("Trace test");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("radio", { name: "Results" }));
    await user.click(await screen.findByLabelText("Toggle year 1 breakdown"));
    await user.click(await screen.findByTitle("Explain: Mortgage interest"));

    expect(await screen.findByText("Why this number?")).toBeInTheDocument();
    expect(screen.getByText(/interest_t = Σ interest_m/)).toBeInTheDocument();
  });

  it("adds the Italian cost presets and the totals reflect them", async () => {
    const scenario = await createScenario("Presets test");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByText("+ Italian purchase costs"));
    expect(await screen.findByText("Registration tax")).toBeInTheDocument();
    expect(screen.getByText("Buyer agency fee")).toBeInTheDocument();
  });

  it("injects the global profile so liquidity warnings surface in the banner (FR-015)", async () => {
    const scenario = await createScenario("Liquidity test");
    await setMode(scenario.id, "analytical");
    const stored = await db.scenarios.get(scenario.id);

    // Cash purchase with a profile that cannot afford it.
    await db.scenarios.update(scenario.id, {
      analytical: { ...stored!.analytical!, financingKind: "cash" as const },
    });
    await db.appConfig.put({
      ...defaultAppConfig,
      profile: { ...defaultAppConfig.profile, liquidity: 260_000, emergencyFund: 20_000 },
    });

    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Results" }));

    expect(await screen.findByText(/W-004/)).toBeInTheDocument();
    expect(screen.getByText(/W-002/)).toBeInTheDocument();
  });

  it("runSimulation resolves provenance across all three layers (NFR-005)", async () => {
    const scenario = await createScenario("Provenance test");
    await setMode(scenario.id, "analytical");
    const stored = await db.scenarios.get(scenario.id);
    const outcome = runSimulation({ id: scenario.id, title: scenario.title }, stored!.analytical!, {
      ...defaultAppConfig,
      globalAssumptions: { inflation: 0.03 },
    });

    expect(outcome.result).toBeDefined();
    const provenance = outcome.result!.assumptions.provenance;
    expect(provenance.inflation).toBe("global");
    expect(provenance.rentGrowth).toBe("scenario"); // seeded from the quick preset
    expect(provenance.recurringTaxRate).toBe("engine-default");
  });
});
