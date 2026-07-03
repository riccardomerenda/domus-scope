import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  QUALITATIVE_FACTORS,
  type AnalyticalData,
  type AppConfig,
  type JournalEntry,
  type JournalKind,
  type ScenarioRevision,
  type StoredScenario,
} from "../../../persistence/db";
import { updateScenario } from "../../../persistence/scenarios";
import {
  addJournalEntry,
  deleteJournalEntry,
  deleteRevision,
  recordDecision,
  saveRevision,
} from "../../../persistence/journal";
import { runSimulation, type SimulationOutcome } from "../../../lib/assess";
import { FACTOR_LABELS, preferenceIndex } from "../../../lib/qualitative";
import { diffObjects } from "../../../lib/diff";
import { formatDate, formatEURSigned, formatNumber } from "../../../lib/format";
import { Button, Card, LensTag, SelectField, VerdictChip } from "../../../components/ui";
import { TrashIcon } from "../../../components/Icons";

/** Diff values are flattened primitives; objects can't reach here, but be safe. */
function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return value.toString();
    default:
      return JSON.stringify(value) ?? "—";
  }
}

const KIND_META: Record<Exclude<JournalKind, "decision">, { label: string; className: string }> = {
  note: { label: "Note", className: "border-hairline text-ink-3" },
  visit: { label: "Visit", className: "border-rent/40 text-rent" },
  pro: { label: "Pro", className: "border-good/40 text-good" },
  con: { label: "Con", className: "border-critical/40 text-critical" },
};

export function JournalPanel({
  scenario,
  data,
  outcome,
  appConfig,
}: {
  scenario: StoredScenario;
  data: AnalyticalData;
  outcome: SimulationOutcome;
  appConfig: AppConfig;
}) {
  const entries = useLiveQuery(
    () => db.journal.where("scenarioId").equals(scenario.id).reverse().sortBy("createdAt"),
    [scenario.id],
  );
  const revisions = useLiveQuery(
    () => db.revisions.where("scenarioId").equals(scenario.id).reverse().sortBy("createdAt"),
    [scenario.id],
  );

  const revisionSource = {
    scenarioId: scenario.id,
    title: scenario.title,
    mode: "analytical" as const,
    quick: scenario.quick,
    analytical: data,
  };

  return (
    <div className="space-y-4">
      <QualitativeCard scenario={scenario} appConfig={appConfig} />
      <DecisionCard
        entries={entries ?? []}
        outcome={outcome}
        onDecide={(decision, reason) => void recordDecision(revisionSource, decision, reason)}
      />
      <EntriesCard scenarioId={scenario.id} entries={entries ?? []} />
      <HistoryCard
        revisions={revisions ?? []}
        current={data}
        appConfig={appConfig}
        onSave={(label) => void saveRevision(revisionSource, label)}
      />
    </div>
  );
}

function QualitativeCard({
  scenario,
  appConfig,
}: {
  scenario: StoredScenario;
  appConfig: AppConfig;
}) {
  const { index, scoredFactors } = preferenceIndex(
    scenario.qualitative,
    appConfig.qualitativeWeights,
  );
  const setScore = (factor: (typeof QUALITATIVE_FACTORS)[number], value: number) =>
    void updateScenario(scenario.id, {
      qualitative: { ...scenario.qualitative, [factor]: value },
    });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Beyond the numbers (BR-015)</h3>
        <LensTag>never mixed with euros</LensTag>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        For each factor: how much would buying this home improve it for you? 0 = much worse than
        renting, 5 = neutral, 10 = much better. Weights come from{" "}
        <Link
          to="/profile"
          className="underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          your profile
        </Link>
        .
      </p>
      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {QUALITATIVE_FACTORS.map((factor) => (
          <label key={factor} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-2">
              {FACTOR_LABELS[factor]}
              <span className="nums text-ink-3">
                {scenario.qualitative[factor] ?? "—"} · weight{" "}
                {appConfig.qualitativeWeights[factor]}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={scenario.qualitative[factor] ?? 5}
              onChange={(event) => setScore(factor, Number(event.target.value))}
              className="w-full accent-ink"
            />
          </label>
        ))}
      </div>
      <p className="nums mt-3 border-t border-hairline pt-2 text-sm text-ink-2">
        Preference index:{" "}
        {index !== null ? (
          <strong className="text-ink">{formatNumber(index, 0)} / 100</strong>
        ) : (
          <span className="text-ink-3">score at least one factor</span>
        )}{" "}
        <span className="text-xs text-ink-3">
          ({scoredFactors.length} factors scored; &gt;50 leans toward buying, non-financially)
        </span>
      </p>
    </Card>
  );
}

function DecisionCard({
  entries,
  outcome,
  onDecide,
}: {
  entries: JournalEntry[];
  outcome: SimulationOutcome;
  onDecide: (decision: string, reason: string) => void;
}) {
  const decision = entries.find((entry) => entry.kind === "decision");
  const [decisionText, setDecisionText] = useState("");
  const [reason, setReason] = useState("");

  if (decision) {
    return (
      <Card className="border-good/30 p-4">
        <h3 className="text-sm font-semibold text-ink">Decision recorded</h3>
        <p className="mt-2 text-sm text-ink-2">
          <strong className="text-ink">{decision.decision}</strong> — decided on{" "}
          {formatDate(decision.createdAt)}
          {decision.revisionId ? " (inputs frozen in the history below)" : ""}.
        </p>
        {decision.text ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-2">“{decision.text}”</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">Record the final decision (FR-016)</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Freezes today's inputs so future-you can see exactly what this choice was based on.
        {outcome.result ? (
          <span className="ml-1">
            Current verdict: <VerdictChip kind={outcome.result.verdict.kind} />
          </span>
        ) : null}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
        <input
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
          placeholder="Decision (e.g. “Buy it”)"
          aria-label="Decision"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why? (your future self will thank you)"
          aria-label="Decision reason"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
        />
        <Button
          variant="primary"
          disabled={decisionText.trim() === ""}
          onClick={() => {
            onDecide(decisionText, reason);
            setDecisionText("");
            setReason("");
          }}
        >
          Record decision
        </Button>
      </div>
    </Card>
  );
}

function EntriesCard({ scenarioId, entries }: { scenarioId: string; entries: JournalEntry[] }) {
  const [kind, setKind] = useState<Exclude<JournalKind, "decision">>("note");
  const [text, setText] = useState("");
  const visible = entries.filter((entry) => entry.kind !== "decision");

  const add = () => {
    if (text.trim() === "") return;
    void addJournalEntry(scenarioId, kind, text);
    setText("");
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">Journal</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Notes, visits, pros and cons — the qualitative memory of this evaluation.
      </p>
      <div className="mt-3 flex gap-2">
        <div className="w-28 shrink-0">
          <SelectField
            label="Type"
            value={kind}
            onChange={(event) => setKind(event.target.value as Exclude<JournalKind, "decision">)}
          >
            <option value="note">Note</option>
            <option value="visit">Visit</option>
            <option value="pro">Pro</option>
            <option value="con">Con</option>
          </SelectField>
        </div>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-2">Entry</span>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => (event.key === "Enter" ? add() : undefined)}
              placeholder="e.g. “North-facing living room, felt dark at 3pm”"
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
            />
            <Button variant="primary" onClick={add} disabled={text.trim() === ""}>
              Add
            </Button>
          </div>
        </label>
      </div>

      {visible.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {visible.map((entry) => {
            const meta = KIND_META[entry.kind as Exclude<JournalKind, "decision">];
            return (
              <li key={entry.id} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
                >
                  {meta.label}
                </span>
                <span className="min-w-0 flex-1 text-ink-2">{entry.text}</span>
                <span className="nums shrink-0 text-[11px] text-ink-3">
                  {formatDate(entry.createdAt)}
                </span>
                <Button
                  variant="danger"
                  className="-my-1 px-1.5"
                  aria-label="Delete entry"
                  onClick={() => void deleteJournalEntry(entry.id)}
                >
                  <TrashIcon width={13} height={13} />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

function HistoryCard({
  revisions,
  current,
  appConfig,
  onSave,
}: {
  revisions: ScenarioRevision[];
  current: AnalyticalData;
  appConfig: AppConfig;
  onSave: (label: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [diffId, setDiffId] = useState<string | null>(null);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">History (FR-020)</h3>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Snapshot label…"
            aria-label="Snapshot label"
            className="w-44 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
          />
          <Button
            onClick={() => {
              onSave(label);
              setLabel("");
            }}
          >
            Save snapshot
          </Button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        Snapshots freeze inputs; results are always recomputed, so “compare to now” explains exactly
        why a verdict changed (NFR-007).
      </p>

      {revisions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">No snapshots yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {revisions.map((revision) => (
            <RevisionRow
              key={revision.id}
              revision={revision}
              appConfig={appConfig}
              showDiff={diffId === revision.id}
              onToggleDiff={() => setDiffId(diffId === revision.id ? null : revision.id)}
              current={current}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RevisionRow({
  revision,
  appConfig,
  current,
  showDiff,
  onToggleDiff,
}: {
  revision: ScenarioRevision;
  appConfig: AppConfig;
  current: AnalyticalData;
  showDiff: boolean;
  onToggleDiff: () => void;
}) {
  const outcome = useMemo(
    () =>
      revision.analytical
        ? runSimulation(
            { id: revision.scenarioId, title: revision.title },
            revision.analytical,
            appConfig,
          )
        : undefined,
    [revision, appConfig],
  );
  const changes = useMemo(
    () => (showDiff && revision.analytical ? diffObjects(revision.analytical, current) : []),
    [showDiff, revision, current],
  );

  return (
    <li className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{revision.label}</span>
        <span className="nums text-[11px] text-ink-3">{formatDate(revision.createdAt)}</span>
        {outcome?.result ? (
          <>
            <VerdictChip kind={outcome.result.verdict.kind} />
            <span className="nums text-xs text-ink-2">
              {formatEURSigned(outcome.result.summary.advantageAtHorizon)} @{" "}
              {outcome.result.horizonYears}y
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-3">quick-mode snapshot</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {revision.analytical ? (
            <Button className="px-2 py-1 text-xs" onClick={onToggleDiff}>
              {showDiff ? "Hide diff" : "Compare to now"}
            </Button>
          ) : null}
          <Button
            variant="danger"
            className="px-1.5"
            aria-label={`Delete snapshot ${revision.label}`}
            onClick={() => void deleteRevision(revision.id)}
          >
            <TrashIcon width={13} height={13} />
          </Button>
        </span>
      </div>
      {showDiff ? (
        changes.length === 0 ? (
          <p className="mt-2 text-xs text-ink-3">No input differences vs the current state.</p>
        ) : (
          <table className="nums mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] tracking-wide text-ink-3 uppercase">
                <th className="py-1 pr-2 font-medium">Input</th>
                <th className="py-1 pr-2 font-medium">Then</th>
                <th className="py-1 font-medium">Now</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.path} className="border-b border-hairline last:border-0">
                  <td className="py-1 pr-2 text-ink-2">{change.path}</td>
                  <td className="py-1 pr-2 text-ink-3">{formatDiffValue(change.from)}</td>
                  <td className="py-1 font-medium text-ink">{formatDiffValue(change.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </li>
  );
}
