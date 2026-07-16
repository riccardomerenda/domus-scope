import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { defaultAssumptions, type EconomicAssumptions } from "@domus-scope/engine";
import { db, mergeAppConfig, type StoredScenario } from "../../persistence/db";
import { runSimulation, type SimulationOutcome } from "../../lib/assess";
import { formatEUR, formatEURSigned, formatPercent } from "../../lib/format";
import { seriesMotion } from "../../lib/motion";
import { useLocale } from "../../i18n";
import { Card, LensTag, ToggleField, VerdictChip } from "../../components/ui";

const MAX_SELECTION = 4;
const SERIES_COLORS = ["var(--ds-cmp-1)", "var(--ds-cmp-2)", "var(--ds-cmp-3)", "var(--ds-cmp-4)"];

interface ComparedScenario {
  scenario: StoredScenario;
  outcome: SimulationOutcome;
  color: string;
}

export function ComparePage() {
  const { t } = useLocale();
  const scenarios = useLiveQuery(() => db.scenarios.orderBy("updatedAt").reverse().toArray(), []);
  // undefined = loading: comparisons computed with the default profile would
  // flash wrong values before the stored config arrives.
  const storedConfig = useLiveQuery(async () => (await db.appConfig.get("app")) ?? null, []);
  const appConfig = mergeAppConfig(storedConfig);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const compared = useMemo<ComparedScenario[]>(() => {
    if (!scenarios) return [];
    return selectedIds
      .map((id) => scenarios.find((scenario) => scenario.id === id))
      .filter((scenario): scenario is StoredScenario => Boolean(scenario?.analytical))
      .map((scenario, index) => ({
        scenario,
        outcome: runSimulation(
          { id: scenario.id, title: scenario.title },
          scenario.analytical!,
          appConfig,
        ),
        color: SERIES_COLORS[index] ?? SERIES_COLORS[0]!,
      }));
  }, [scenarios, selectedIds, appConfig]);

  if (!scenarios || storedConfig === undefined) return null;
  const candidates = scenarios.filter((scenario) => !scenario.archived);

  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      if (!checked) return current.filter((existing) => existing !== id);
      if (current.includes(id) || current.length >= MAX_SELECTION) return current;
      return [...current, id];
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("compare.title")}</h1>
        <p className="mt-0.5 text-sm text-ink-2">{t("compare.subtitle", { max: MAX_SELECTION })}</p>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">{t("compare.selection")}</h2>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            {t("compare.none")}{" "}
            <Link to="/" className="underline decoration-dotted underline-offset-2 hover:text-ink">
              {t("compare.createOne")}
            </Link>
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {candidates.map((scenario) => {
              const selectable = scenario.analytical !== null;
              const checked = selectedIds.includes(scenario.id);
              return (
                <li key={scenario.id} className={selectable ? "" : "opacity-50"}>
                  {selectable ? (
                    <ToggleField
                      label={scenario.title}
                      checked={checked}
                      onChange={(value) => toggle(scenario.id, value)}
                    />
                  ) : (
                    <span className="text-sm text-ink-3">
                      {t("compare.quickOnly", { title: scenario.title })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {compared.length >= 2 ? (
        <>
          <KpiTable compared={compared} />
          <AdvantageOverlay compared={compared} />
          <AssumptionDiff compared={compared} />
        </>
      ) : (
        <p className="text-sm text-ink-3">{t("compare.needTwo")}</p>
      )}
    </div>
  );
}

function KpiTable({ compared }: { compared: ComparedScenario[] }) {
  const { t } = useLocale();
  const horizons = new Set(compared.map(({ scenario }) => scenario.analytical!.horizonYears));
  const rows: {
    label: string;
    cells: string[];
    highlight?: boolean;
  }[] = [
    {
      label: t("compare.price"),
      cells: compared.map(({ scenario }) => formatEUR(scenario.analytical!.property.price)),
    },
    {
      label: t("compare.rent"),
      cells: compared.map(({ scenario }) =>
        t("common.perMonth", {
          amount: formatEUR(scenario.analytical!.rentAlternative.equivalentMonthlyRent),
        }),
      ),
    },
    {
      label: t("compare.horizon"),
      cells: compared.map(
        ({ scenario }) => `${scenario.analytical!.horizonYears} ${t("suffix.years")}`,
      ),
      highlight: horizons.size > 1,
    },
    {
      label: t("compare.advantageOwn"),
      cells: compared.map(({ outcome }) =>
        outcome.result ? formatEURSigned(outcome.result.summary.advantageAtHorizon) : "—",
      ),
    },
    {
      label: t("compare.beWealth"),
      cells: compared.map(({ outcome }) =>
        outcome.result?.breakEvens.wealthLiquidation != null
          ? t("common.yearN", { n: outcome.result.breakEvens.wealthLiquidation })
          : t("common.beyond"),
      ),
    },
    {
      label: t("compare.beCost"),
      cells: compared.map(({ outcome }) =>
        outcome.result?.breakEvens.costLiquidation != null
          ? t("common.yearN", { n: outcome.result.breakEvens.costLiquidation })
          : t("common.beyond"),
      ),
    },
    {
      label: t("compare.year1Buy"),
      cells: compared.map(({ outcome }) =>
        outcome.result ? formatEUR(outcome.result.summary.yearOneUnrecoverableBuy) : "—",
      ),
    },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("compare.sideBySide")}</h2>
        <LensTag>{t("results.compositionLens")}</LensTag>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-baseline text-left">
              <th className="py-1.5 pr-3 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
                {t("compare.metric")}
              </th>
              {compared.map(({ scenario, outcome, color }) => (
                <th key={scenario.id} className="py-1.5 pr-3 font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="max-w-36 truncate">{scenario.title}</span>
                    {outcome.result ? (
                      <VerdictChip kind={outcome.result.verdict.kind} />
                    ) : (
                      <span className="text-xs text-critical">{t("compare.invalid")}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="nums">
            {rows.map((row) => (
              <tr
                key={row.label}
                className={`border-b border-hairline last:border-0 ${row.highlight ? "bg-warn/10" : ""}`}
              >
                <td className="py-1.5 pr-3 text-ink-2">
                  {row.label}
                  {row.highlight ? (
                    <span className="ml-1 text-[10px] text-ink-3">{t("compare.differs")}</span>
                  ) : null}
                </td>
                {row.cells.map((cell, index) => (
                  <td key={index} className="py-1.5 pr-3 text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AdvantageOverlay({ compared }: { compared: ComparedScenario[] }) {
  const { t } = useLocale();
  const maxHorizon = Math.max(...compared.map(({ outcome }) => outcome.result?.horizonYears ?? 0));
  const rows = Array.from({ length: maxHorizon }, (_, index) => {
    const year = index + 1;
    const row: Record<string, number> = { year };
    for (const { scenario, outcome } of compared) {
      const wealthYear = outcome.result?.wealthLens.years[index];
      if (wealthYear) row[scenario.id] = wealthYear.advantageLiquidation;
    }
    return row;
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("compare.advantageChart")}</h2>
        <LensTag>{t("results.compositionLens")}</LensTag>
      </div>
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--ds-hairline)" />
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--ds-ink-3)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--ds-baseline)" }}
            />
            <YAxis
              tick={{ fill: "var(--ds-ink-3)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => `${Math.round(value / 1_000)}k€`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--ds-surface)",
                border: "1px solid var(--ds-hairline)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ds-ink)",
              }}
              formatter={(value) => formatEURSigned(Number(value))}
              labelFormatter={(year) => t("results.tooltip.year", { n: String(year) })}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--ds-ink-2)" }} />
            <ReferenceLine y={0} stroke="var(--ds-baseline)" />
            {compared.map(({ scenario, color }) => (
              <Line
                key={scenario.id}
                name={scenario.title}
                dataKey={scenario.id}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                {...seriesMotion()}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AssumptionDiff({ compared }: { compared: ComparedScenario[] }) {
  const { t } = useLocale();
  const keys = Object.keys(defaultAssumptions) as (keyof EconomicAssumptions)[];
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">{t("compare.assumptions")}</h2>
      <p className="mt-0.5 text-xs text-ink-3">{t("compare.assumptionsHint")}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <tbody className="nums">
            {keys.map((key) => {
              const values = compared.map(
                ({ outcome }) => outcome.result?.assumptions.values[key] ?? Number.NaN,
              );
              const differs = values.some((value) => Math.abs(value - (values[0] ?? 0)) > 1e-9);
              return (
                <tr
                  key={key}
                  className={`border-b border-hairline last:border-0 ${differs ? "bg-warn/10" : ""}`}
                >
                  <td className="py-1.5 pr-3 text-ink-2">
                    {t(`assumption.${key}`)}
                    {differs ? (
                      <span className="ml-1 text-[10px] text-ink-3">{t("compare.differs")}</span>
                    ) : null}
                  </td>
                  {values.map((value, index) => (
                    <td key={index} className="py-1.5 pr-3 text-ink">
                      {Number.isFinite(value) ? formatPercent(value, 2) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">{t("compare.footnote")}</p>
    </Card>
  );
}
