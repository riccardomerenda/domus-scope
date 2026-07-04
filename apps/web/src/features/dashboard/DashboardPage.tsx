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
import { useLocale, type LocaleContextValue } from "../../i18n";
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
  const { t } = useLocale();
  const [showArchived, setShowArchived] = useState(false);
  const scenarios = useLiveQuery(() => db.scenarios.orderBy("updatedAt").reverse().toArray(), []);
  const appConfig =
    useLiveQuery(async () => mergeAppConfig(await db.appConfig.get("app")), []) ??
    mergeAppConfig(null);

  if (!scenarios) return null;
  const visible = scenarios.filter((scenario) => scenario.archived === showArchived);
  const archivedCount = scenarios.filter((scenario) => scenario.archived).length;

  async function onNewScenario() {
    const scenario = await createScenario(t("dashboard.new"));
    void navigate(`/scenario/${scenario.id}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t("dashboard.title")}</h1>
          <p className="mt-0.5 text-sm text-ink-2">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          {archivedCount > 0 || showArchived ? (
            <ToggleField
              label={t("dashboard.archivedToggle", { count: archivedCount })}
              checked={showArchived}
              onChange={setShowArchived}
            />
          ) : null}
          <Button variant="primary" onClick={() => void onNewScenario()}>
            <PlusIcon /> {t("dashboard.new")}
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
  const { t } = useLocale();
  if (archivedView) {
    return <p className="mt-10 text-center text-sm text-ink-3">{t("dashboard.noArchived")}</p>;
  }
  return (
    <Card className="mx-auto mt-10 max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{t("dashboard.empty.title")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{t("dashboard.empty.body")}</p>
      <Button variant="primary" className="mt-5" onClick={onCreate}>
        <PlusIcon /> {t("dashboard.empty.cta")}
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

function summarize(
  scenario: StoredScenario,
  appConfig: AppConfig,
  t: LocaleContextValue["t"],
): CardSummary {
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
              label: t("dashboard.card.advantage", { years: data.horizonYears }),
              value: formatEURSigned(last?.advantageLiquidation ?? 0),
            },
            {
              label: t("dashboard.card.beWealth"),
              value:
                outcome.result.breakEvens.wealthLiquidation !== null
                  ? t("common.yearN", { n: outcome.result.breakEvens.wealthLiquidation })
                  : t("common.beyond"),
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
  const { t } = useLocale();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = summarize(scenario, appConfig, t);

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
            {scenario.mode === "analytical" ? <LensTag>{t("dashboard.card.full")}</LensTag> : null}
          </div>
          {summary.verdictKind && !summary.invalid ? (
            <span className="flex shrink-0 items-center gap-1.5">
              {summary.fragility ? <FragilityBadge rating={summary.fragility} /> : null}
              <VerdictChip kind={summary.verdictKind} indicative={summary.indicative} />
            </span>
          ) : (
            <span className="text-xs text-critical">{t("common.invalidInputs")}</span>
          )}
        </div>
        <dl className="nums mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("dashboard.card.price")}</dt>
            <dd className="text-ink-2">{formatEUR(summary.price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("dashboard.card.rent")}</dt>
            <dd className="text-ink-2">
              {t("common.perMonth", { amount: formatEUR(summary.rent) })}
            </dd>
          </div>
          {summary.rows.map((row) => (
            <div key={row.label} className="flex justify-between">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className="text-ink-2">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-ink-3">
          {t("dashboard.card.updated", { date: formatDate(scenario.updatedAt) })}
        </p>
      </button>

      <div className="mt-3 flex items-center gap-1 border-t border-hairline pt-2">
        <Button
          className="px-2 py-1 text-xs"
          onClick={() => void duplicateScenario(scenario.id)}
          title={t("common.duplicate")}
        >
          <CopyIcon width={14} height={14} /> {t("common.duplicate")}
        </Button>
        <Button
          className="px-2 py-1 text-xs"
          onClick={() => void setArchived(scenario.id, !scenario.archived)}
          title={scenario.archived ? t("common.restore") : t("common.archive")}
        >
          {scenario.archived ? (
            <>
              <RestoreIcon width={14} height={14} /> {t("common.restore")}
            </>
          ) : (
            <>
              <ArchiveIcon width={14} height={14} /> {t("common.archive")}
            </>
          )}
        </Button>
        <Button
          variant="danger"
          className="ml-auto px-2 py-1 text-xs"
          onClick={() => setConfirmDelete(true)}
          title={t("common.delete")}
        >
          <TrashIcon width={14} height={14} /> {t("common.delete")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("dashboard.delete.title", { title: scenario.title })}
        description={t("dashboard.delete.body")}
        confirmLabel={t("dashboard.delete.confirm")}
        onConfirm={() => void deleteScenario(scenario.id)}
      />
    </Card>
  );
}
