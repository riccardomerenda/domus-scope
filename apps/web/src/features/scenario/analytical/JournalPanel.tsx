import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { scenarioAtPrice, simulate } from "@domus-scope/engine";
import {
  db,
  QUALITATIVE_FACTORS,
  type AnalyticalData,
  type AppConfig,
  type JournalEntry,
  type JournalKind,
  type OfferParty,
  type ScenarioRevision,
  type StoredScenario,
} from "../../../persistence/db";
import { updateScenario } from "../../../persistence/scenarios";
import {
  addJournalEntry,
  addOfferEntry,
  deleteJournalEntry,
  deleteRevision,
  recordDecision,
  saveRevision,
} from "../../../persistence/journal";
import { engineConfigFor, runSimulation, type SimulationOutcome } from "../../../lib/assess";
import { preferenceIndex } from "../../../lib/qualitative";
import { diffObjects } from "../../../lib/diff";
import { formatDate, formatEUR, formatEURSigned, formatNumber } from "../../../lib/format";
import { useLocale } from "../../../i18n";
import {
  Button,
  Card,
  LensTag,
  NumberField,
  SelectField,
  VerdictChip,
} from "../../../components/ui";
import { InfoDot } from "../../../components/InfoDot";
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

type FreeKind = Exclude<JournalKind, "decision" | "offer">;

const KIND_STYLE: Record<FreeKind, string> = {
  note: "border-hairline text-ink-3",
  visit: "border-rent/40 text-rent",
  pro: "border-good/40 text-good",
  con: "border-critical/40 text-critical",
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
      <OffersCard
        scenarioId={scenario.id}
        entries={entries ?? []}
        outcome={outcome}
        appConfig={appConfig}
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
  const { t } = useLocale();
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
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {t("journal.qualitative")}
          <InfoDot topic="qualitative" />
        </h3>
        <LensTag>{t("journal.qualitativeLens")}</LensTag>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        {t("journal.qualitativeHint")}{" "}
        <Link
          to="/profile"
          className="underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("journal.qualitativeHintLink")}
        </Link>
        .
      </p>
      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {QUALITATIVE_FACTORS.map((factor) => (
          <label key={factor} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-2">
              {t(`factor.${factor}`)}
              <span className="nums text-ink-3">
                {scenario.qualitative[factor] ?? "—"} · {t("journal.weight")}{" "}
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
        {t("journal.preferenceIndex")}{" "}
        {index !== null ? (
          <strong className="text-ink">{formatNumber(index, 0)} / 100</strong>
        ) : (
          <span className="text-ink-3">{t("journal.scoreOne")}</span>
        )}{" "}
        <span className="text-xs text-ink-3">
          {t("journal.factorsScored", { count: scoredFactors.length })}
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
  const { t } = useLocale();
  const decision = entries.find((entry) => entry.kind === "decision");
  const [decisionText, setDecisionText] = useState("");
  const [reason, setReason] = useState("");

  if (decision) {
    return (
      <Card className="border-good/30 p-4">
        <h3 className="text-sm font-semibold text-ink">{t("journal.decisionRecorded")}</h3>
        <p className="mt-2 text-sm text-ink-2">
          <strong className="text-ink">{decision.decision}</strong> —{" "}
          {t("journal.decidedOn", { date: formatDate(decision.createdAt) })}
          {decision.revisionId ? t("journal.frozenNote") : ""}.
        </p>
        {decision.text ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-2">“{decision.text}”</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">{t("journal.recordTitle")}</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        {t("journal.recordHint")}
        {outcome.result ? (
          <span className="ml-1">
            {t("journal.currentVerdict")} <VerdictChip kind={outcome.result.verdict.kind} />
          </span>
        ) : null}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
        <input
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
          placeholder={t("journal.decisionPlaceholder")}
          aria-label={t("journal.decisionLabel")}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("journal.reasonPlaceholder")}
          aria-label={t("journal.reasonLabel")}
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
          {t("journal.recordButton")}
        </Button>
      </div>
    </Card>
  );
}

/** Offer log (FR-024): every offered price re-runs the engine, value-anchored. */
function OffersCard({
  scenarioId,
  entries,
  outcome,
  appConfig,
}: {
  scenarioId: string;
  entries: JournalEntry[];
  outcome: SimulationOutcome;
  appConfig: AppConfig;
}) {
  const { t } = useLocale();
  const [party, setParty] = useState<OfferParty>("counterpart");
  const [price, setPrice] = useState(Number.NaN);
  const [note, setNote] = useState("");
  const offers = entries.filter((entry) => entry.kind === "offer");

  const config = useMemo(() => engineConfigFor(appConfig), [appConfig]);
  const verdicts = useMemo(() => {
    if (!outcome.input) return new Map<string, ReturnType<typeof simulate>>();
    const input = outcome.input;
    return new Map(
      offers
        .filter((entry) => entry.offer)
        .map((entry) => [entry.id, simulate(scenarioAtPrice(input, entry.offer!.price), config)]),
    );
  }, [offers, outcome.input, config]);

  const add = () => {
    if (!Number.isFinite(price) || price <= 0) return;
    void addOfferEntry(scenarioId, { party, price }, note);
    setPrice(Number.NaN);
    setNote("");
  };

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("journal.offers")}
        <InfoDot topic="offerLog" />
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">{t("journal.offersHint")}</p>

      <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,10rem)_minmax(0,1fr)_auto]">
        <SelectField
          label={t("journal.offerParty")}
          value={party}
          onChange={(event) => setParty(event.target.value as OfferParty)}
        >
          <option value="you">{t("journal.party.you")}</option>
          <option value="counterpart">{t("journal.party.counterpart")}</option>
        </SelectField>
        <NumberField
          label={t("journal.offerPrice")}
          suffix={t("suffix.eur")}
          value={price}
          min={0}
          step={1_000}
          onChange={setPrice}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            {t("journal.offerNote")}
          </span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => (event.key === "Enter" ? add() : undefined)}
            placeholder={t("journal.offerNotePlaceholder")}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
          />
        </label>
        <Button variant="primary" onClick={add} disabled={!Number.isFinite(price) || price <= 0}>
          {t("journal.addOffer")}
        </Button>
      </div>

      {offers.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {offers.map((entry) => {
            const result = verdicts.get(entry.id);
            return (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                  {entry.offer?.party === "you"
                    ? t("journal.party.you")
                    : t("journal.party.counterpart")}
                </span>
                <span className="nums font-medium text-ink">
                  {entry.offer ? formatEUR(entry.offer.price) : "—"}
                </span>
                {result ? (
                  <>
                    <VerdictChip kind={result.verdict.kind} />
                    <span className="nums text-xs text-ink-2">
                      {formatEURSigned(result.summary.advantageAtHorizon)} @ {result.horizonYears}y
                    </span>
                  </>
                ) : null}
                {entry.text ? (
                  <span className="min-w-0 flex-1 text-ink-2">{entry.text}</span>
                ) : (
                  <span className="min-w-0 flex-1" />
                )}
                <span className="nums shrink-0 text-[11px] text-ink-3">
                  {formatDate(entry.createdAt)}
                </span>
                <Button
                  variant="danger"
                  className="-my-1 px-1.5"
                  aria-label={t("journal.deleteOffer")}
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

function EntriesCard({ scenarioId, entries }: { scenarioId: string; entries: JournalEntry[] }) {
  const { t } = useLocale();
  const [kind, setKind] = useState<FreeKind>("note");
  const [text, setText] = useState("");
  const visible = entries.filter((entry) => entry.kind !== "decision" && entry.kind !== "offer");

  const add = () => {
    if (text.trim() === "") return;
    void addJournalEntry(scenarioId, kind, text);
    setText("");
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">{t("journal.title")}</h3>
      <p className="mt-0.5 text-xs text-ink-3">{t("journal.hint")}</p>
      <div className="mt-3 flex gap-2">
        <div className="w-28 shrink-0">
          <SelectField
            label={t("journal.type")}
            value={kind}
            onChange={(event) => setKind(event.target.value as FreeKind)}
          >
            <option value="note">{t("journal.kind.note")}</option>
            <option value="visit">{t("journal.kind.visit")}</option>
            <option value="pro">{t("journal.kind.pro")}</option>
            <option value="con">{t("journal.kind.con")}</option>
          </SelectField>
        </div>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-2">{t("journal.entry")}</span>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => (event.key === "Enter" ? add() : undefined)}
              placeholder={t("journal.entryPlaceholder")}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
            />
            <Button variant="primary" onClick={add} disabled={text.trim() === ""}>
              {t("common.add")}
            </Button>
          </div>
        </label>
      </div>

      {visible.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {visible.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${KIND_STYLE[entry.kind as FreeKind]}`}
              >
                {t(`journal.kind.${entry.kind as FreeKind}`)}
              </span>
              <span className="min-w-0 flex-1 text-ink-2">{entry.text}</span>
              <span className="nums shrink-0 text-[11px] text-ink-3">
                {formatDate(entry.createdAt)}
              </span>
              <Button
                variant="danger"
                className="-my-1 px-1.5"
                aria-label={t("journal.deleteEntry")}
                onClick={() => void deleteJournalEntry(entry.id)}
              >
                <TrashIcon width={13} height={13} />
              </Button>
            </li>
          ))}
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
  const { t } = useLocale();
  const [label, setLabel] = useState("");
  const [diffId, setDiffId] = useState<string | null>(null);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t("journal.history")}</h3>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("journal.snapshotPlaceholder")}
            aria-label={t("journal.snapshotAria")}
            className="w-44 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
          />
          <Button
            onClick={() => {
              onSave(label);
              setLabel("");
            }}
          >
            {t("journal.saveSnapshot")}
          </Button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">{t("journal.historyHint")}</p>

      {revisions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">{t("journal.noSnapshots")}</p>
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
  const { t } = useLocale();
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
          <span className="text-xs text-ink-3">{t("journal.quickSnapshot")}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {revision.analytical ? (
            <Button className="px-2 py-1 text-xs" onClick={onToggleDiff}>
              {showDiff ? t("journal.hideDiff") : t("journal.compareToNow")}
            </Button>
          ) : null}
          <Button
            variant="danger"
            className="px-1.5"
            aria-label={t("journal.deleteSnapshot", { label: revision.label })}
            onClick={() => void deleteRevision(revision.id)}
          >
            <TrashIcon width={13} height={13} />
          </Button>
        </span>
      </div>
      {showDiff ? (
        changes.length === 0 ? (
          <p className="mt-2 text-xs text-ink-3">{t("journal.noDiff")}</p>
        ) : (
          <table className="nums mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] tracking-wide text-ink-3 uppercase">
                <th className="py-1 pr-2 font-medium">{t("journal.diffInput")}</th>
                <th className="py-1 pr-2 font-medium">{t("journal.diffThen")}</th>
                <th className="py-1 font-medium">{t("journal.diffNow")}</th>
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
