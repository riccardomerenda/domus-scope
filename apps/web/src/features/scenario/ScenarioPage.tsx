import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type QuickData, type StoredScenario } from "../../persistence/db";
import { updateScenario } from "../../persistence/scenarios";
import { assessQuickData } from "../../lib/assess";
import { QuickForm } from "./QuickForm";
import { QuickResultsPanel } from "./QuickResultsPanel";

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
  // key: reseed local state when navigating between scenarios.
  return <ScenarioEditor key={scenario.id} scenario={scenario} />;
}

function ScenarioEditor({ scenario }: { scenario: StoredScenario }) {
  const [title, setTitle] = useState(scenario.title);
  const [quick, setQuick] = useState<QuickData>(scenario.quick);
  const assessment = useMemo(() => assessQuickData(quick), [quick]);

  // Debounced write-through: edits persist automatically (and survive reload).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void updateScenario(scenario.id, { title: title.trim() || "Untitled", quick });
    }, 300);
    return () => clearTimeout(timer);
  }, [title, quick, scenario.id]);

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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <QuickForm value={quick} onChange={setQuick} />
        <QuickResultsPanel assessment={assessment} />
      </div>
    </div>
  );
}
