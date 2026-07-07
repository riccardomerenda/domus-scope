import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { solveReservationPrice } from "@domus-scope/engine";
import { db, defaultAppConfig } from "../src/persistence/db";
import { createScenario, setMode } from "../src/persistence/scenarios";
import { engineConfigFor, runSimulation } from "../src/lib/assess";
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

async function analyticalScenario(title: string) {
  const scenario = await createScenario(title);
  await setMode(scenario.id, "analytical");
  const stored = await db.scenarios.get(scenario.id);
  const outcome = runSimulation({ id: scenario.id, title }, stored!.analytical!, defaultAppConfig);
  const reservation = solveReservationPrice(outcome.input!, engineConfigFor(defaultAppConfig));
  return { scenario, reservation };
}

beforeEach(async () => {
  await db.scenarios.clear();
  await db.appConfig.clear();
  await db.journal.clear();
  await db.revisions.clear();
});

describe("negotiation lens (Phase 8, FR-021…FR-024)", () => {
  it("shows the derived walk-away price and asks for the asking price", async () => {
    const { scenario, reservation } = await analyticalScenario("Nego basics");
    expect(reservation.status).toBe("solved");

    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Negotiation" }));

    expect(await screen.findByText("Your reservation price")).toBeInTheDocument();
    expect(screen.getByText("Walk-away price")).toBeInTheDocument();
    expect(screen.getByText(/Enter the asking price/)).toBeInTheDocument();
  });

  it("classifies a typical-discount window and renders the ZOPA bar", async () => {
    const { scenario, reservation } = await analyticalScenario("Nego window");
    const asking = Math.round(reservation.price! / (1 - 0.04)); // ≈4% needed

    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Negotiation" }));

    fireEvent.change(await screen.findByLabelText("Asking price"), {
      target: { value: String(asking) },
    });

    expect(
      await screen.findByText(/A typical negotiation can reach your boundary/),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Price scale/ })).toBeInTheDocument();
    expect(screen.queryByText(/W-010/)).not.toBeInTheDocument();
  });

  it("raises W-010 when the required discount is atypical", async () => {
    const { scenario, reservation } = await analyticalScenario("Nego W-010");
    const asking = Math.round(reservation.price! / (1 - 0.25)); // 25% needed

    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Negotiation" }));

    fireEvent.change(await screen.findByLabelText("Asking price"), {
      target: { value: String(asking) },
    });

    expect(await screen.findByText(/W-010/)).toBeInTheDocument();
    expect(screen.getByText(/larger-than-typical discount/)).toBeInTheDocument();
  });

  it("converts an early-possession concession and shifts the walk-away", async () => {
    const { scenario } = await analyticalScenario("Nego concessions");
    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Negotiation" }));

    // Default kind is early possession with 3 months × the equivalent rent (950 €).
    expect(await screen.findByText(/3 months ×/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(/Balance \(received − given\)/)).toBeInTheDocument();
    expect(screen.getByText(/Adjusted walk-away/)).toBeInTheDocument();

    // The write-through is debounced (300 ms): wait for the stored record.
    await waitFor(
      async () => {
        const stored = await db.scenarios.get(scenario.id);
        expect(stored?.analytical?.negotiation?.concessions ?? []).toHaveLength(1);
      },
      { timeout: 2_000 },
    );
    const stored = await db.scenarios.get(scenario.id);
    const concessions = stored?.analytical?.negotiation?.concessions ?? [];
    expect(concessions[0]!.amount).toBe(950 * 3);
    expect(concessions[0]!.direction).toBe("youReceive");
  });

  it("records an offer in the journal and re-evaluates it (FR-024)", async () => {
    const { scenario } = await analyticalScenario("Offer log");
    const user = userEvent.setup();
    renderScenario(scenario.id);
    await user.click(await screen.findByRole("radio", { name: "Journal" }));

    expect(await screen.findByText(/Offers & counter-offers/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Offered price"), { target: { value: "240000" } });
    await user.click(screen.getByRole("button", { name: "Record offer" }));

    // The offer row shows the price and the engine's verdict at that price.
    expect(await screen.findByText(/240\.000/)).toBeInTheDocument();
    expect(await screen.findByText(/@ 10y/)).toBeInTheDocument();

    const entries = await db.journal.where("scenarioId").equals(scenario.id).toArray();
    const offer = entries.find((entry) => entry.kind === "offer");
    expect(offer?.offer).toEqual({ party: "counterpart", price: 240_000 });
  });
});
