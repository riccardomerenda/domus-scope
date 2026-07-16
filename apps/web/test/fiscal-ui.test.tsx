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

describe("Italian fiscal modeling (Phase 11, G13/G14/G15)", () => {
  it("persists the primary-residence toggle and switches the preset regime", async () => {
    const scenario = await createScenario("Second home");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    // Turn "primary residence" off → second-home tax regime.
    await user.click(
      await screen.findByLabelText("Primary residence (abitazione principale)"),
    );
    await waitFor(async () => {
      const stored = await db.scenarios.get(scenario.id);
      expect(stored?.analytical?.property.primaryResidence).toBe(false);
    });

    // The Italian presets now include IMU alongside the 9% registration tax.
    await user.click(screen.getByRole("button", { name: "+ Italian purchase costs" }));
    expect(await screen.findByText("IMU (second home)")).toBeInTheDocument();
    expect(screen.getByText("Registration tax")).toBeInTheDocument();
  });

  it("keeps the primary-residence presets IMU-free", async () => {
    const scenario = await createScenario("First home");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("button", { name: "+ Italian purchase costs" }));
    expect(await screen.findByText("Registration tax")).toBeInTheDocument();
    expect(screen.queryByText("IMU (second home)")).not.toBeInTheDocument();
  });

  it("saves a custom work with the renovation tax credit flag", async () => {
    const scenario = await createScenario("Renovation");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("button", { name: "Custom item" }));
    await user.type(await screen.findByLabelText("Label"), "Bathroom works");
    await user.click(
      screen.getByLabelText("Eligible for the renovation tax credit (50% over 10 years)"),
    );
    await user.click(screen.getByRole("button", { name: "Save item" }));

    await waitFor(async () => {
      const stored = await db.scenarios.get(scenario.id);
      const item = stored?.analytical?.costItems.find((i) => i.label === "Bathroom works");
      expect(item?.renovationCredit).toBe(true);
    });
  });
});
