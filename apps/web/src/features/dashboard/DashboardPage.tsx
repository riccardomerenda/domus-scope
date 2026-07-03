import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { runSensitivity, type FragilityRating } from "@domus-scope/engine";
import { db, mergeAppConfig, type AppConfig, type StoredScenario } from "../../persistence/db";
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  setArchived,
} from "../../persistence/scenarios";
import { assessQuickData, engineConfigFor, runSimulation } from "../../lib/assess";
import { formatDate, formatEUR, formatEURSigned, formatPercent } from "../../lib/format";
import {
  Button,
  Card,
  ConfirmDialog,
  FragilityBadge,
  LensTag,
  ToggleField,
  VerdictChip,
} from "../../components/ui";
import { ArchiveIcon, CopyIcon, PlusIcon, RestoreIcon, TrashIcon } from "../../components/Icons";

export function DashboardPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const scenarios = useLiveQuery(() => db.scenarios.orderBy("updatedAt").reverse().toArray(), []);
  const appConfig =
    useLiveQuery(async () => mergeAppConfig(await db.appConfig.get("app")), []) ??
    mergeAppConfig(null);

  if (!scenarios) return null;
  const visible = scenarios.filter((scenario) => scenario.archived === showArchived);
  const archivedCount = scenarios.filter((scenario) => scenario.archived).length;

  async function onNewScenario() {
    const scenario = await createScenario();
    void navigate(`/scenario/${scenario.id}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Scenarios</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Each scenario compares renting, buying with a mortgage, and buying cash.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {archivedCount > 0 || showArchived ? (
            <ToggleField
              label={`Archived (${archivedCount})`}
              checked={showArchived}
              onChange={setShowArchived}
            />
          ) : null}
          <Button variant="primary" onClick={() => void onNewScenario()}>
            <PlusIcon /> New scenario
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState archivedView={showArchived} onCreate={() => void onNewScenario()} />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {visible.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} appConfig={appConfig} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ archivedView, onCreate }: { archivedView: boolean; onCreate: () => void }) {
  if (archivedView) {
    return <p className="mt-10 text-center text-sm text-ink-3">No archived scenarios.</p>;
  }
  return (
    <Card className="mt-10 mx-auto max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">Don't compare rent to a mortgage payment</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        A mortgage payment hides wealth inside it: the principal portion becomes yours, only the
        interest is a cost. DomusScope compares what each choice really burns —{" "}
        <strong>unrecoverable costs</strong> — and what each builds. Every number can be opened to
        see its formula and assumptions.
      </p>
      <Button variant="primary" className="mt-5" onClick={onCreate}>
        <PlusIcon /> Create your first scenario
      </Button>
    </Card>
  );
}

interface CardSummary {
  verdictKind: VerdictKindOf | undefined;
  indicative: boolean;
  fragility: FragilityRating | undefined;
  price: number;
  rent: number;
  rows: { label: string; value: string }[];
  invalid: boolean;
}

type VerdictKindOf = Parameters<typeof VerdictChip>[0]["kind"];

function summarize(scenario: StoredScenario, appConfig: AppConfig): CardSummary {
  if (scenario.mode === "analytical" && scenario.analytical) {
    const data = scenario.analytical;
    const outcome = runSimulation({ id: scenario.id, title: scenario.title }, data, appConfig);
    const last = outcome.result?.wealthLens.years.at(-1);
    const fragility = outcome.input
      ? runSensitivity(outcome.input, engineConfigFor(appConfig), { heatmap: null }).fragility
          .rating
      : undefined;
    return {
      verdictKind: outcome.result?.verdict.kind,
      indicative: outcome.result?.verdict.strength === "indicative",
      fragility,
      price: data.property.price,
      rent: data.rentAlternative.equivalentMonthlyRent,
      invalid: !outcome.result,
      rows: outcome.result
        ? [
            {
              label: `Δ @ ${data.horizonYears}y`,
              value: formatEURSigned(last?.advantageLiquidation ?? 0),
            },
            {
              label: "BE wealth",
              value:
                outcome.result.breakEvens.wealthLiquidation !== null
                  ? `year ${outcome.result.breakEvens.wealthLiquidation}`
                  : "beyond",
            },
          ]
        : [],
    };
  }
  const assessment = assessQuickData(scenario.quick);
  const rule = assessment.result?.rule;
  return {
    verdictKind: assessment.result?.verdict.kind,
    indicative: assessment.result?.verdict.strength === "indicative",
    fragility: undefined,
    price: scenario.quick.propertyPrice,
    rent: scenario.quick.equivalentMonthlyRent,
    invalid: !assessment.result,
    rows: rule
      ? [
          { label: "R", value: formatPercent(rule.rentToPrice, 1) },
          { label: "R*", value: formatPercent(rule.threshold, 1) },
        ]
      : [],
  };
}

function ScenarioCard({ scenario, appConfig }: { scenario: StoredScenario; appConfig: AppConfig }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = summarize(scenario, appConfig);

  return (
    <Card className="group relative p-4 transition-shadow hover:shadow-md">
      <button
        type="button"
        className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rent"
        onClick={() => void navigate(`/scenario/${scenario.id}`)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-medium text-ink">{scenario.title}</h3>
            {scenario.mode === "analytical" ? <LensTag>full</LensTag> : null}
          </div>
          {summary.verdictKind && !summary.invalid ? (
            <span className="flex shrink-0 items-center gap-1.5">
              {summary.fragility ? <FragilityBadge rating={summary.fragility} /> : null}
              <VerdictChip kind={summary.verdictKind} indicative={summary.indicative} />
            </span>
          ) : (
            <span className="text-xs text-critical">invalid inputs</span>
          )}
        </div>
        <dl className="nums mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-3">Price</dt>
            <dd className="text-ink-2">{formatEUR(summary.price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">Rent</dt>
            <dd className="text-ink-2">{formatEUR(summary.rent)}/mo</dd>
          </div>
          {summary.rows.map((row) => (
            <div key={row.label} className="flex justify-between">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className="text-ink-2">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-ink-3">Updated {formatDate(scenario.updatedAt)}</p>
      </button>

      <div className="mt-3 flex items-center gap-1 border-t border-hairline pt-2">
        <Button
          className="px-2 py-1 text-xs"
          onClick={() => void duplicateScenario(scenario.id)}
          title="Duplicate"
        >
          <CopyIcon width={14} height={14} /> Duplicate
        </Button>
        <Button
          className="px-2 py-1 text-xs"
          onClick={() => void setArchived(scenario.id, !scenario.archived)}
          title={scenario.archived ? "Restore" : "Archive"}
        >
          {scenario.archived ? (
            <>
              <RestoreIcon width={14} height={14} /> Restore
            </>
          ) : (
            <>
              <ArchiveIcon width={14} height={14} /> Archive
            </>
          )}
        </Button>
        <Button
          variant="danger"
          className="ml-auto px-2 py-1 text-xs"
          onClick={() => setConfirmDelete(true)}
          title="Delete"
        >
          <TrashIcon width={14} height={14} /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${scenario.title}”?`}
        description="This permanently removes the scenario from this device. There is no undo."
        confirmLabel="Delete scenario"
        onConfirm={() => void deleteScenario(scenario.id)}
      />
    </Card>
  );
}
