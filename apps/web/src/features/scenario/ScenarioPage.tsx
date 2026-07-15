import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { runSensitivity } from "@domus-scope/engine";
import {
  db,
  mergeAppConfig,
  type AnalyticalData,
  type QuickData,
  type StoredScenario,
} from "../../persistence/db";
import { quickToAnalytical, setMode, updateScenario } from "../../persistence/scenarios";
import { assessQuickData, engineConfigFor, runSimulation } from "../../lib/assess";
import { useDebouncedSave } from "../../lib/hooks";
import { useLocale } from "../../i18n";
import { Button, Segmented } from "../../components/ui";
import { ArrowRightIcon } from "../../components/Icons";
import { QuickForm } from "./QuickForm";
import { QuickResultsPanel } from "./QuickResultsPanel";
import { InputsPanel } from "./analytical/InputsPanel";
import { JournalPanel } from "./analytical/JournalPanel";
import { NegotiationPanel } from "./analytical/NegotiationPanel";
import { ResultsPanel } from "./analytical/ResultsPanel";
import { SensitivityPanel } from "./analytical/SensitivityPanel";

export function ScenarioPage() {
  const { id } = useParams<{ id: string }>();
  // undefined = still loading; null = confirmed missing.
  const scenario = useLiveQuery(
    async () => (id ? ((await db.scenarios.get(id)) ?? null) : null),
    [id],
  );

  if (scenario === undefined) return null; // loading
  if (!scenario) {
    return <ScenarioNotFound />;
  }
  // key: reseed local state when navigating between scenarios or switching mode.
  return <ScenarioEditor key={`${scenario.id}:${scenario.mode}`} scenario={scenario} />;
}

function ScenarioNotFound() {
  const { t } = useLocale();
  return (
    <div className="py-16 text-center text-sm text-ink-2">
      {t("scenario.notFound")}{" "}
      <Link to="/" className="font-medium text-ink underline underline-offset-4">
        {t("scenario.backToDashboard")}
      </Link>
    </div>
  );
}

function ScenarioEditor({ scenario }: { scenario: StoredScenario }) {
  const { t } = useLocale();
  const [title, setTitle] = useState(scenario.title);
  useDebouncedSave(
    () => void updateScenario(scenario.id, { title: title.trim() || t("scenario.untitled") }),
    [title, scenario.id],
  );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          className="rounded text-sm text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
        >
          {t("scenario.back")}
        </Link>
        <input
          aria-label={t("scenario.titleAria")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold tracking-tight text-ink hover:border-hairline focus-visible:border-hairline focus-visible:outline-2 focus-visible:outline-rent"
        />
        {scenario.archived ? (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-ink-3">
            {t("scenario.archived")}
          </span>
        ) : null}
      </div>

      {scenario.mode === "quick" ? (
        <QuickEditor scenario={scenario} />
      ) : (
        <AnalyticalWorkspace scenario={scenario} />
      )}
    </div>
  );
}

function QuickEditor({ scenario }: { scenario: StoredScenario }) {
  const { t } = useLocale();
  const [quick, setQuick] = useState<QuickData>(scenario.quick);
  const assessment = useMemo(() => assessQuickData(quick), [quick]);
  useDebouncedSave(() => void updateScenario(scenario.id, { quick }), [quick, scenario.id]);

  // Persist the local edits first: setMode reads the scenario from the DB, and
  // a debounced save still in flight would make it seed from stale quick data.
  async function deepen() {
    await updateScenario(scenario.id, { quick });
    await setMode(scenario.id, "analytical");
  }

  return (
    <div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <QuickForm value={quick} onChange={setQuick} />
        <div>
          <QuickResultsPanel assessment={assessment} />
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => void deepen()}>
              {t("scenario.deepen")} <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticalWorkspace({ scenario }: { scenario: StoredScenario }) {
  const { t } = useLocale();
  // undefined = loading; null = no stored config (fall back to defaults).
  const storedConfig = useLiveQuery(async () => (await db.appConfig.get("app")) ?? null, []);
  const [data, setData] = useState<AnalyticalData>(
    () => scenario.analytical ?? quickToAnalytical(scenario.quick),
  );
  const [tab, setTab] = useState<"inputs" | "results" | "sensitivity" | "negotiation" | "journal">(
    "inputs",
  );
  useDebouncedSave(
    () => void updateScenario(scenario.id, { analytical: data }),
    [data, scenario.id],
  );

  // Same stale-read guard as deepen(): flush the form before switching mode.
  async function toQuickView() {
    await updateScenario(scenario.id, { analytical: data });
    await setMode(scenario.id, "quick");
  }

  const appConfig = mergeAppConfig(storedConfig);
  const config = useMemo(() => engineConfigFor(appConfig), [appConfig]);
  const outcome = useMemo(
    () => runSimulation({ id: scenario.id, title: scenario.title }, data, appConfig),
    [scenario.id, scenario.title, data, appConfig],
  );
  const sensitivity = useMemo(
    () => (outcome.input ? runSensitivity(outcome.input, config) : undefined),
    [outcome.input, config],
  );

  if (storedConfig === undefined) return null; // loading app config

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-[38rem] max-w-full">
          <Segmented
            label={t("scenario.tabAria")}
            options={[
              { value: "inputs", label: t("scenario.tab.inputs") },
              { value: "results", label: t("scenario.tab.results") },
              { value: "sensitivity", label: t("scenario.tab.sensitivity") },
              { value: "negotiation", label: t("scenario.tab.negotiation") },
              { value: "journal", label: t("scenario.tab.journal") },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex items-center gap-1">
          <Link
            to={`/scenario/${scenario.id}/report`}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-hairline/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
          >
            {t("scenario.report")}
          </Link>
          <Button onClick={() => void toQuickView()}>{t("scenario.quickView")}</Button>
        </div>
      </div>

      {tab === "inputs" ? (
        <InputsPanel data={data} onChange={setData} appConfig={appConfig} />
      ) : tab === "results" ? (
        <ResultsPanel
          outcome={outcome}
          fragility={sensitivity?.fragility.rating}
          epilogue={{ scores: scenario.qualitative, weights: appConfig.qualitativeWeights }}
        />
      ) : tab === "negotiation" ? (
        <NegotiationPanel data={data} onChange={setData} outcome={outcome} config={config} />
      ) : tab === "journal" ? (
        <JournalPanel scenario={scenario} data={data} outcome={outcome} appConfig={appConfig} />
      ) : outcome.input && sensitivity ? (
        <SensitivityPanel sensitivity={sensitivity} input={outcome.input} config={config} />
      ) : (
        <ResultsPanel outcome={outcome} />
      )}
    </div>
  );
}
