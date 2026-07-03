import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db, defaultAppConfig } from "../src/persistence/db";
import { createScenario, deleteScenario, setMode } from "../src/persistence/scenarios";
import { recordDecision, saveRevision } from "../src/persistence/journal";
import { preferenceIndex } from "../src/lib/qualitative";
import { diffObjects } from "../src/lib/diff";
import { buildExport, importData, wipeAllData } from "../src/persistence/transfer";
import { ScenarioPage } from "../src/features/scenario/ScenarioPage";
import { ReportPage } from "../src/features/report/ReportPage";
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

beforeEach(async () => {
  await wipeAllData();
});

describe("preference index (BR-015)", () => {
  it("weights scores and normalizes to 0–100, never touching euros", () => {
    const weights = { ...defaultAppConfig.qualitativeWeights, stability: 10, flexibility: 0 };
    // flexibility has weight 0 → excluded even if scored.
    const { index, scoredFactors } = preferenceIndex({ stability: 8, flexibility: 2 }, weights);
    expect(scoredFactors).toEqual(["stability"]);
    expect(index).toBe(80);
    expect(preferenceIndex({}, weights).index).toBeNull();
  });
});

describe("structural diff (NFR-007)", () => {
  it("reports only changed flattened paths", () => {
    const changes = diffObjects(
      { a: 1, nested: { rate: 0.03 }, list: [1, 2] },
      { a: 1, nested: { rate: 0.04 }, list: [1, 3] },
    );
    expect(changes).toEqual([
      { path: "list[1]", from: 2, to: 3 },
      { path: "nested.rate", from: 0.03, to: 0.04 },
    ]);
  });
});

describe("journal & decision record (FR-016, FR-020)", () => {
  it("records pros, a decision with a frozen revision, and survives reload", async () => {
    const scenario = await createScenario("Journal test");
    await setMode(scenario.id, "analytical");
    const user = userEvent.setup();
    renderAt(`/scenario/${scenario.id}`);

    await user.click(await screen.findByRole("radio", { name: "Journal" }));

    // Add a pro entry.
    await user.selectOptions(await screen.findByLabelText("Type"), "pro");
    await user.type(screen.getByPlaceholderText(/North-facing/), "Great terrace");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Great terrace")).toBeInTheDocument();

    // Record the decision.
    await user.type(screen.getByLabelText("Decision"), "Buy it");
    await user.type(screen.getByLabelText("Decision reason"), "Break-even inside our horizon");
    await user.click(screen.getByRole("button", { name: "Record decision" }));

    expect(await screen.findByText("Decision recorded")).toBeInTheDocument();
    expect(screen.getByText(/Break-even inside our horizon/)).toBeInTheDocument();
    // The decision froze a revision.
    const revisions = await db.revisions.where("scenarioId").equals(scenario.id).toArray();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.label).toBe("Decision: Buy it");
    // And it persisted.
    const entries = await db.journal.where("scenarioId").equals(scenario.id).toArray();
    expect(entries.map((entry) => entry.kind).sort()).toEqual(["decision", "pro"]);
  });

  it("cascades journal and revisions on scenario delete", async () => {
    const scenario = await createScenario("Cascade test");
    await setMode(scenario.id, "analytical");
    const stored = await db.scenarios.get(scenario.id);
    await recordDecision(
      {
        scenarioId: scenario.id,
        title: scenario.title,
        mode: "analytical",
        quick: stored!.quick,
        analytical: stored!.analytical,
      },
      "Wait",
      "",
    );
    await deleteScenario(scenario.id);
    expect(await db.journal.count()).toBe(0);
    expect(await db.revisions.count()).toBe(0);
  });

  it("round-trips journal and revisions through export/import with id remapping", async () => {
    const scenario = await createScenario("Transfer test");
    await setMode(scenario.id, "analytical");
    const stored = await db.scenarios.get(scenario.id);
    await recordDecision(
      {
        scenarioId: scenario.id,
        title: scenario.title,
        mode: "analytical",
        quick: stored!.quick,
        analytical: stored!.analytical,
      },
      "Buy it",
      "reason",
    );
    const file = await buildExport();

    // Import over the existing data: everything collides → fresh ids, remapped links.
    const outcome = await importData(JSON.stringify(file));
    expect(outcome.error).toBeUndefined();
    expect(outcome.renamed).toBe(1);
    expect(await db.scenarios.count()).toBe(2);
    expect(await db.journal.count()).toBe(2);
    expect(await db.revisions.count()).toBe(2);

    // The imported decision entry must point at the imported revision.
    for (const entry of await db.journal.toArray()) {
      expect(entry.revisionId).not.toBeNull();
      const revision = await db.revisions.get(entry.revisionId!);
      expect(revision?.scenarioId).toBe(entry.scenarioId);
    }
  });
});

describe("report (FR-017/US-013 — §21 blueprint, printable and remembered)", () => {
  it("renders verdict, projection, decision, and the disclaimer", async () => {
    const scenario = await createScenario("Report test");
    await setMode(scenario.id, "analytical");
    const stored = await db.scenarios.get(scenario.id);
    await recordDecision(
      {
        scenarioId: scenario.id,
        title: scenario.title,
        mode: "analytical",
        quick: stored!.quick,
        analytical: stored!.analytical,
      },
      "Buy it",
      "numbers hold",
    );
    await saveRevision(
      {
        scenarioId: scenario.id,
        title: scenario.title,
        mode: "analytical",
        quick: stored!.quick,
        analytical: stored!.analytical,
      },
      "extra snapshot",
    );

    renderAt(`/scenario/${scenario.id}/report`);

    expect(await screen.findByText(/decision report/i)).toBeInTheDocument();
    expect(screen.getByText("Key figures")).toBeInTheDocument();
    expect(screen.getByText("Projection (liquidation basis)")).toBeInTheDocument();
    expect(screen.getByText(/Decision:/)).toBeInTheDocument();
    expect(
      screen.getByText(/not financial, tax, notarial, or investment advice/),
    ).toBeInTheDocument();
  });
});
