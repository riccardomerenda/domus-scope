import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../src/persistence/db";
import { createScenario, setMode } from "../src/persistence/scenarios";
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

describe("variable-rate path (Phase 10, G9)", () => {
  it("adds a rate step, shows the payment preview, and persists it", async () => {
    const scenario = await createScenario("Variable");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("button", { name: "Add rate change" }));

    // Preview line: initial vs peak payment and the payoff year.
    expect(await screen.findByText(/Payment: .+ initial · .+ peak/)).toBeInTheDocument();

    await waitFor(async () => {
      const stored = await db.scenarios.get(scenario.id);
      expect(stored?.analytical?.rateSteps).toEqual([
        { fromYear: 2, annualRate: expect.closeTo(0.044, 6) as number },
      ]);
    });
  });

  it("fires the payment-shock warning W-011 in the results", async () => {
    const scenario = await createScenario("Shock");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    // Two steps: +1pp from year 2, +2pp from year 3 — well past the 10% shock.
    await user.click(await screen.findByRole("button", { name: "Add rate change" }));
    await user.click(await screen.findByRole("button", { name: "Add rate change" }));
    await user.click(await screen.findByRole("radio", { name: "Results" }));

    expect(
      await screen.findByText(/variable-rate path raises the monthly payment/),
    ).toBeInTheDocument();
  });

  it("adds a prepayment, switches it to shorten the duration, and persists it", async () => {
    const scenario = await createScenario("Prepay");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("button", { name: "Add repayment" }));
    await user.selectOptions(await screen.findByLabelText("Afterwards"), "reduceDuration");

    // Shortened duration shows up in the preview payoff year (< 25).
    const preview = await screen.findByText(/The mortgage closes in year (1\d|2[0-4])\./);
    expect(preview).toBeInTheDocument();

    await waitFor(async () => {
      const stored = await db.scenarios.get(scenario.id);
      expect(stored?.analytical?.prepayments).toEqual([
        { year: 5, amount: 10_000, mode: "reduceDuration" },
      ]);
    });
  });

  it("keeps a pre-Phase-10 analytical record working (fields absent)", async () => {
    const scenario = await createScenario("Legacy");
    await setMode(scenario.id, "analytical");
    // Simulate a record stored before Phase 10.
    const stored = (await db.scenarios.get(scenario.id))!;
    delete stored.analytical!.rateSteps;
    delete stored.analytical!.prepayments;
    await db.scenarios.put(stored);
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("radio", { name: "Results" }));
    expect(await screen.findByText(/Buying leaves you|Renting leaves you/)).toBeInTheDocument();
  });
});
