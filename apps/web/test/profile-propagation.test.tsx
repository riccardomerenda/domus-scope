import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db, defaultAppConfig, updateAppConfig } from "../src/persistence/db";
import { createScenario, setMode } from "../src/persistence/scenarios";
import { buildScenarioExport } from "../src/persistence/transfer";
import { ScenarioPage } from "../src/features/scenario/ScenarioPage";
import { ReportPage } from "../src/features/report/ReportPage";
import { ProfilePage } from "../src/features/profile/ProfilePage";
import { ExplainProvider } from "../src/features/explain/ExplainContext";

function renderAt(path: string) {
  return render(
    <ExplainProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/scenario/:id" element={<ScenarioPage />} />
          <Route path="/scenario/:id/report" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>
    </ExplainProvider>,
  );
}

async function seedProfileEnabledScenario() {
  const scenario = await createScenario("Propagation test");
  await setMode(scenario.id, "analytical"); // seeds profileEnabled: true
  await db.appConfig.put({
    ...defaultAppConfig,
    profile: { ...defaultAppConfig.profile, liquidity: 80_000, emergencyFund: 20_000 },
  });
  return scenario;
}

async function bumpLiquidityTo100k() {
  // Same call path as the ProfilePage liquidity field.
  await updateAppConfig({
    profile: { ...defaultAppConfig.profile, liquidity: 100_000, emergencyFund: 20_000 },
  });
}

beforeEach(async () => {
  await db.scenarios.clear();
  await db.appConfig.clear();
  await db.journal.clear();
  await db.revisions.clear();
});

describe("global profile propagation (FR-002/FR-015)", () => {
  // Defaults: price 250k, down payment 50k, no one-time cost items →
  // liquidityAfterPurchase = liquidity − 50k.
  it("results recompute live when the profile liquidity changes", async () => {
    const scenario = await seedProfileEnabledScenario();
    const user = userEvent.setup();
    renderAt(`/scenario/${scenario.id}`);

    await user.click(await screen.findByRole("radio", { name: "Results" }));
    expect(await screen.findByText(/liquidity after purchase/)).toHaveTextContent(/30\.000/);

    await bumpLiquidityTo100k();

    await waitFor(() =>
      expect(screen.getByText(/liquidity after purchase/)).toHaveTextContent(/50\.000/),
    );
  });

  it("the report reads the current profile values", async () => {
    const scenario = await seedProfileEnabledScenario();
    await bumpLiquidityTo100k();
    renderAt(`/scenario/${scenario.id}/report`);

    const row = await screen.findByText("Liquidity after purchase");
    expect(row.closest("tr")).toHaveTextContent(/50\.000/);
  });

  it("the profile page renders the defaults when no config is stored yet", async () => {
    render(
      <ExplainProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </ExplainProvider>,
    );

    const liquidity = await screen.findByRole("spinbutton", { name: "Available savings" });
    expect(liquidity).toHaveValue(60_000);
    expect(screen.getByRole("spinbutton", { name: "Emergency fund (minimum)" })).toHaveValue(
      20_000,
    );
  });

  it("single-scenario export carries the current profile when profileEnabled", async () => {
    const scenario = await seedProfileEnabledScenario();
    await bumpLiquidityTo100k();

    const file = await buildScenarioExport(scenario.id);
    expect(file).not.toBeNull();
    // The scenario opted into the profile: the export must reproduce the same
    // simulation elsewhere, so the current profile values must travel with it.
    expect(file!.appConfig?.profile.liquidity).toBe(100_000);
    expect(file!.appConfig?.profile.emergencyFund).toBe(20_000);
  });
});
