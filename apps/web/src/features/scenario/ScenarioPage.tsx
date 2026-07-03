import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  defaultAppConfig,
  type AnalyticalData,
  type QuickData,
  type StoredScenario,
} from "../../persistence/db";
import { quickToAnalytical, setMode, updateScenario } from "../../persistence/scenarios";
import { assessQuickData, runSimulation } from "../../lib/assess";
import { useDebouncedSave } from "../../lib/hooks";
import { Button, Segmented } from "../../components/ui";
import { ArrowRightIcon } from "../../components/Icons";
import { QuickForm } from "./QuickForm";
import { QuickResultsPanel } from "./QuickResultsPanel";
import { InputsPanel } from "./analytical/InputsPanel";
import { ResultsPanel } from "./analytical/ResultsPanel";

export function ScenarioPage() {
  const { id } = useParams<{ id: string }>();
  // undefined = still loading; null = confirmed missing.
  const scenario = useLiveQuery(
    async () => (id ? ((await db.scenarios.get(id)) ?? null) : null),
    [id],
  );

  if (scenario === undefined) return null; // loading
  if (!scenario) {
    return (
      <div className="py-16 text-center text-sm text-ink-2">
        Scenario not found.{" "}
        <Link to="/" className="font-medium text-ink underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    );
  }
  // key: reseed local state when navigating between scenarios or switching mode.
  return <ScenarioEditor key={`${scenario.id}:${scenario.mode}`} scenario={scenario} />;
}

function ScenarioEditor({ scenario }: { scenario: StoredScenario }) {
  const [title, setTitle] = useState(scenario.title);
  useDebouncedSave(
    () => void updateScenario(scenario.id, { title: title.trim() || "Untitled" }),
    [title, scenario.id],
  );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          className="rounded text-sm text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
        >
          ← Scenarios
        </Link>
        <input
          aria-label="Scenario title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold tracking-tight text-ink hover:border-hairline focus-visible:border-hairline focus-visible:outline-2 focus-visible:outline-rent"
        />
        {scenario.archived ? (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-ink-3">
            archived
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
  const [quick, setQuick] = useState<QuickData>(scenario.quick);
  const assessment = useMemo(() => assessQuickData(quick), [quick]);
  useDebouncedSave(() => void updateScenario(scenario.id, { quick }), [quick, scenario.id]);

  return (
    <div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <QuickForm value={quick} onChange={setQuick} />
        <div>
          <QuickResultsPanel assessment={assessment} />
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => void setMode(scenario.id, "analytical")}>
              Deepen with full analysis <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticalWorkspace({ scenario }: { scenario: StoredScenario }) {
  // undefined = loading; null = no stored config (fall back to defaults).
  const storedConfig = useLiveQuery(async () => (await db.appConfig.get("app")) ?? null, []);
  const [data, setData] = useState<AnalyticalData>(
    () => scenario.analytical ?? quickToAnalytical(scenario.quick),
  );
  const [tab, setTab] = useState<"inputs" | "results">("inputs");
  useDebouncedSave(
    () => void updateScenario(scenario.id, { analytical: data }),
    [data, scenario.id],
  );

  const appConfig = storedConfig ?? defaultAppConfig;
  const outcome = useMemo(
    () => runSimulation({ id: scenario.id, title: scenario.title }, data, appConfig),
    [scenario.id, scenario.title, data, appConfig],
  );

  if (storedConfig === undefined) return null; // loading app config

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-64">
          <Segmented
            label="Workspace tab"
            options={[
              { value: "inputs", label: "Inputs" },
              { value: "results", label: "Results" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <Button onClick={() => void setMode(scenario.id, "quick")}>← Quick view</Button>
      </div>

      {tab === "inputs" ? (
        <InputsPanel data={data} onChange={setData} appConfig={appConfig} />
      ) : (
        <ResultsPanel outcome={outcome} />
      )}
    </div>
  );
}
