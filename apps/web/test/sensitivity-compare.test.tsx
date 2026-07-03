import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../src/persistence/db";
import { createScenario, setMode, updateScenario } from "../src/persistence/scenarios";
import { ScenarioPage } from "../src/features/scenario/ScenarioPage";
import { ComparePage } from "../src/features/compare/ComparePage";
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

describe("sensitivity tab (Phase 5 exit criteria)", () => {
  it("shows the fragility summary, tornado, presets, and heatmap", async () => {
    const scenario = await createScenario("Sensitivity UI");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("radio", { name: "Sensitivity" }));

    expect(await screen.findByText(/perturbations flip/)).toBeInTheDocument();
    expect(screen.getByText("What moves the result")).toBeInTheDocument();
    expect(screen.getByText("Conservative / base / optimistic")).toBeInTheDocument();
    expect(screen.getByText("Where the decision flips")).toBeInTheDocument();
  });

  it("surfaces the fragility badge in the results verdict banner", async () => {
    const scenario = await createScenario("Badge test");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderScenario(scenario.id);

    await user.click(await screen.findByRole("radio", { name: "Results" }));
    await screen.findByText(/Buying leaves you/);

    expect(screen.getByTitle(/perturbations that flip the verdict/)).toBeInTheDocument();
  });
});

describe("comparison view (FR-012)", () => {
  it("aligns KPIs and highlights differing assumptions for selected scenarios", async () => {
    const first = await createScenario("Flat in Milan");
    const second = await createScenario("House in Turin");
    await setMode(first.id, "analytical");
    await setMode(second.id, "analytical");

    // Make the second scenario differ in one assumption and in horizon.
    const stored = await db.scenarios.get(second.id);
    await updateScenario(second.id, {
      analytical: {
        ...stored!.analytical!,
        horizonYears: 20,
        assumptions: { ...stored!.analytical!.assumptions, rentGrowth: 0.05 },
      },
    });

    const user = userEvent.setup();
    render(
      <ExplainProvider>
        <MemoryRouter initialEntries={["/compare"]}>
          <Routes>
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </MemoryRouter>
      </ExplainProvider>,
    );

    await user.click(await screen.findByLabelText("Flat in Milan"));
    await user.click(screen.getByLabelText("House in Turin"));

    expect(await screen.findByText("Side by side")).toBeInTheDocument();
    expect(screen.getByText("Advantage of buying, year by year")).toBeInTheDocument();
    expect(screen.getByText("Effective assumptions")).toBeInTheDocument();
    // Horizon and rent growth differ → highlighted rows.
    expect(screen.getAllByText("(differs!)").length).toBeGreaterThanOrEqual(2);
  });
});
