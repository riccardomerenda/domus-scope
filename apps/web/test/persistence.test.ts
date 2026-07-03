import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/persistence/db";
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  listScenarios,
  setArchived,
} from "../src/persistence/scenarios";
import { buildExport, importData, wipeAllData } from "../src/persistence/transfer";
import { assessQuickData } from "../src/lib/assess";

beforeEach(async () => {
  await db.scenarios.clear();
});

describe("scenario repository (FR-001)", () => {
  it("creates a scenario whose defaults produce a valid engine result", async () => {
    const scenario = await createScenario("Test flat");
    expect((await listScenarios()).map((s) => s.id)).toEqual([scenario.id]);

    const assessment = assessQuickData(scenario.quick);
    expect(assessment.issues).toBeUndefined();
    expect(assessment.result?.verdict.kind).toBeDefined();
  });

  it("duplicates without touching the original", async () => {
    const original = await createScenario("Original");
    const copy = await duplicateScenario(original.id);

    expect(copy?.id).not.toBe(original.id);
    expect(copy?.title).toBe("Original (copy)");
    expect(copy?.quick).toEqual(original.quick);
    expect(await db.scenarios.count()).toBe(2);
  });

  it("archives, restores, and deletes", async () => {
    const scenario = await createScenario();
    await setArchived(scenario.id, true);
    expect((await db.scenarios.get(scenario.id))?.archived).toBe(true);
    await setArchived(scenario.id, false);
    expect((await db.scenarios.get(scenario.id))?.archived).toBe(false);
    await deleteScenario(scenario.id);
    expect(await db.scenarios.count()).toBe(0);
  });
});

describe("export / import (local-first data safety)", () => {
  it("round-trips through a JSON export", async () => {
    await createScenario("A");
    await createScenario("B");
    const file = await buildExport();

    await wipeAllData();
    expect(await db.scenarios.count()).toBe(0);

    const outcome = await importData(JSON.stringify(file));
    expect(outcome.error).toBeUndefined();
    expect(outcome.imported).toBe(2);
    expect(await db.scenarios.count()).toBe(2);
  });

  it("never overwrites on id collision — imports as renamed copies", async () => {
    await createScenario("A");
    const file = await buildExport();

    const outcome = await importData(JSON.stringify(file));
    expect(outcome.renamed).toBe(1);
    expect(await db.scenarios.count()).toBe(2);
    const titles = (await listScenarios()).map((s) => s.title).sort();
    expect(titles).toEqual(["A", "A (imported)"]);
  });

  it("rejects files that are not DomusScope exports", async () => {
    expect((await importData("not json")).error).toBeTruthy();
    expect((await importData(JSON.stringify({ app: "other" }))).error).toBeTruthy();
  });

  it("still imports version-1 export files (migrated on the fly)", async () => {
    const v1File = {
      app: "domus-scope",
      schemaVersion: 1,
      exportedAt: Date.now(),
      scenarios: [
        {
          id: "legacy-1",
          schemaVersion: 1,
          title: "Legacy scenario",
          archived: false,
          createdAt: 1,
          updatedAt: 2,
          quick: (await createScenario("tmp")).quick,
        },
      ],
    };
    await db.scenarios.clear();

    const outcome = await importData(JSON.stringify(v1File));
    expect(outcome.error).toBeUndefined();
    expect(outcome.imported).toBe(1);

    const migrated = await db.scenarios.get("legacy-1");
    expect(migrated?.schemaVersion).toBe(3);
    expect(migrated?.mode).toBe("quick");
    expect(migrated?.analytical).toBeNull();
    expect(migrated?.qualitative).toEqual({});
  });
});
