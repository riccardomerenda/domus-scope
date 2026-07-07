import {
  db,
  type AnalyticalData,
  type JournalEntry,
  type JournalKind,
  type OfferData,
  type QuickData,
  type ScenarioMode,
  type ScenarioRevision,
} from "./db";

/**
 * Decision journal (FR-016) and revision history (FR-020/NFR-007).
 * Revisions store inputs only: results are always recomputed, so a frozen
 * snapshot can never disagree with what the engine would say today.
 */

export interface RevisionSource {
  scenarioId: string;
  title: string;
  mode: ScenarioMode;
  quick: QuickData;
  analytical: AnalyticalData | null;
}

export async function saveRevision(
  source: RevisionSource,
  label: string,
): Promise<ScenarioRevision> {
  const revision: ScenarioRevision = {
    id: crypto.randomUUID(),
    scenarioId: source.scenarioId,
    createdAt: Date.now(),
    label: label.trim() || "Snapshot",
    title: source.title,
    mode: source.mode,
    quick: structuredClone(source.quick),
    analytical: source.analytical ? structuredClone(source.analytical) : null,
  };
  await db.revisions.add(revision);
  return revision;
}

export async function addJournalEntry(
  scenarioId: string,
  kind: Exclude<JournalKind, "decision" | "offer">,
  text: string,
): Promise<void> {
  await db.journal.add({
    id: crypto.randomUUID(),
    scenarioId,
    createdAt: Date.now(),
    kind,
    text: text.trim(),
    decision: null,
    revisionId: null,
  });
}

/** Offer log (FR-024): the price is data, the note is memory. */
export async function addOfferEntry(
  scenarioId: string,
  offer: OfferData,
  note: string,
): Promise<void> {
  await db.journal.add({
    id: crypto.randomUUID(),
    scenarioId,
    createdAt: Date.now(),
    kind: "offer",
    text: note.trim(),
    decision: null,
    revisionId: null,
    offer,
  });
}

/** Records the final decision and freezes the inputs it was based on. */
export async function recordDecision(
  source: RevisionSource,
  decision: string,
  reason: string,
): Promise<void> {
  const revision = await saveRevision(source, `Decision: ${decision}`);
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    scenarioId: source.scenarioId,
    createdAt: Date.now(),
    kind: "decision",
    text: reason.trim(),
    decision: decision.trim(),
    revisionId: revision.id,
  };
  await db.journal.add(entry);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.journal.delete(id);
}

export async function deleteRevision(id: string): Promise<void> {
  await db.revisions.delete(id);
}
