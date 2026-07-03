import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../src/persistence/db";
import { createScenario } from "../src/persistence/scenarios";
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
});

describe("quick-mode flow (Phase 3 exit criteria)", () => {
  it("shows an explained provisional verdict for a fresh scenario", async () => {
    const scenario = await createScenario("First evaluation");
    renderScenario(scenario.id);

    // Default inputs land above the derived threshold → buy-favorable.
    expect(await screen.findByText("Buy (mortgage)")).toBeInTheDocument();
    expect(screen.getByText(/Unrecoverable costs — year 1/)).toBeInTheDocument();
    // The three-bar comparison always includes the cash alternative.
    expect(screen.getAllByText("Cash").length).toBeGreaterThan(0);
  });

  it("opens the explanation drawer from a line item (FR-019)", async () => {
    const scenario = await createScenario();
    const user = userEvent.setup();
    renderScenario(scenario.id);

    const interestNumber = await screen.findByTitle(
      "Explain: Mortgage interest (year 1, simplified)",
    );
    await user.click(interestNumber);

    expect(await screen.findByText("Why this number?")).toBeInTheDocument();
    expect(screen.getByText("interest_year1 ≈ P × i")).toBeInTheDocument();
    expect(screen.getByText(/quick lens/i)).toBeInTheDocument();
  });

  it("explains the derived threshold with its terms", async () => {
    const scenario = await createScenario();
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByText("How is the threshold R* derived?"));

    expect(await screen.findByText("Derived threshold R*")).toBeInTheDocument();
    expect(screen.getByText(/R\* = m% \+ tax%/)).toBeInTheDocument();
  });

  it("fires the short-horizon warning and persists the edit (BR-005 + reload survival)", async () => {
    const scenario = await createScenario();
    renderScenario(scenario.id);

    const horizon = await screen.findByLabelText(/^Horizon/);
    // fireEvent instead of user-event: jsdom cannot focus number inputs reliably.
    fireEvent.change(horizon, { target: { value: "2" } });

    expect(await screen.findByText(/one-time purchase costs dominate/)).toBeInTheDocument();

    // The debounced write-through lands in IndexedDB (survives reload).
    await waitFor(async () => {
      const stored = await db.scenarios.get(scenario.id);
      expect(stored?.quick.horizonYears).toBe(2);
    });
  });

  it("switching to cash changes the provisional verdict entity", async () => {
    const scenario = await createScenario();
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await screen.findByText("Buy (mortgage)");
    await user.click(screen.getByRole("radio", { name: "Cash" }));

    expect(await screen.findByText("Buy (cash)")).toBeInTheDocument();
  });
});
