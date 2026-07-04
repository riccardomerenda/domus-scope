import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  assumptionPresets,
  simulate,
  type ScenarioInput,
  type SensitivityResult,
  type EngineConfig,
  type VerdictKind,
} from "@domus-scope/engine";
import { formatEUR, formatEURSigned, formatPercent } from "../../../lib/format";
import { isMessageKey, useLocale, type LocaleContextValue } from "../../../i18n";
import { Card, FragilityBadge, LensTag, VerdictChip } from "../../../components/ui";

function perturbationLabel(
  t: LocaleContextValue["t"],
  entry: SensitivityResult["entries"][number],
): string {
  const key = `perturbation.${entry.id.split(":")[0] ?? ""}`;
  return isMessageKey(key) ? t(key) : entry.label;
}

export function SensitivityPanel({
  sensitivity,
  input,
  config,
}: {
  sensitivity: SensitivityResult;
  input: ScenarioInput;
  config: EngineConfig;
}) {
  const { t } = useLocale();
  const flipping = sensitivity.entries.filter((entry) => entry.flipsVerdict);

  return (
    <div className="space-y-4">
      {/* Fragility summary */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FragilityBadge rating={sensitivity.fragility.rating} />
          <span className="text-sm text-ink-2">
            {t("sensitivity.flipSummary", {
              flipped: sensitivity.fragility.flipped,
              total: sensitivity.fragility.total,
              pct: formatPercent(sensitivity.fragility.index, 0),
            })}
          </span>
          <LensTag>{t("sensitivity.lens")}</LensTag>
        </div>
        {flipping.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-3">{t("sensitivity.flipsLabel")}</span>
            {flipping.map((entry) => (
              <span
                key={entry.id}
                className="rounded-full border border-critical/40 px-2 py-0.5 text-xs text-critical"
              >
                {perturbationLabel(t, entry)} {entry.deltaLabel} →{" "}
                {t(`verdict.${entry.verdictKind}`)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-3">{t("sensitivity.robust")}</p>
        )}
      </Card>

      {/* Tornado */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{t("sensitivity.tornado")}</h3>
          <LensTag>{t("sensitivity.tornadoLens")}</LensTag>
        </div>
        <p className="mt-0.5 text-xs text-ink-3">{t("sensitivity.tornadoHint")}</p>
        <div className="mt-2" style={{ height: Math.max(sensitivity.entries.length * 30, 160) }}>
          <Tornado entries={sensitivity.entries} />
        </div>
      </Card>

      {/* Preset triple */}
      <PresetTriple input={input} config={config} />

      {/* Heatmap */}
      {sensitivity.heatmap ? <Heatmap heatmap={sensitivity.heatmap} /> : null}
    </div>
  );
}

function Tornado({ entries }: { entries: SensitivityResult["entries"] }) {
  const { t } = useLocale();
  const rows = entries.map((entry) => ({
    name: `${perturbationLabel(t, entry)} ${entry.deltaLabel}`,
    delta: entry.advantageDelta,
    flips: entry.flipsVerdict,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--ds-hairline)" />
        <XAxis
          type="number"
          tick={{ fill: "var(--ds-ink-3)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--ds-baseline)" }}
          tickFormatter={(value: number) =>
            `${value >= 0 ? "+" : "−"}${Math.round(Math.abs(value) / 1_000)}k€`
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          width={190}
          tick={{ fill: "var(--ds-ink-2)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--ds-surface)",
            border: "1px solid var(--ds-hairline)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--ds-ink)",
          }}
          formatter={(value) => [formatEURSigned(Number(value)), t("sensitivity.deltaAdvantage")]}
        />
        <ReferenceLine x={0} stroke="var(--ds-baseline)" />
        <Bar dataKey="delta" radius={[0, 3, 3, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.name}
              fill={row.delta >= 0 ? "var(--ds-buy)" : "var(--ds-rent)"}
              stroke={row.flips ? "var(--ds-critical)" : undefined}
              strokeWidth={row.flips ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PresetTriple({ input, config }: { input: ScenarioInput; config: EngineConfig }) {
  const { t } = useLocale();
  const runs = useMemo(
    () =>
      Object.values(assumptionPresets).map((preset) => {
        const result = simulate({ ...input, assumptions: { ...preset.values } }, config);
        return { preset, result };
      }),
    [input, config],
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t("sensitivity.presets")}</h3>
        <LensTag>{t("sensitivity.presetsLens")}</LensTag>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {runs.map(({ preset, result }) => (
          <div key={preset.id} className="rounded-xl border border-hairline p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{t(`preset.${preset.id}`)}</span>
              <VerdictChip kind={result.verdict.kind} />
            </div>
            <dl className="nums mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-3">
                  {t("sensitivity.presetAdvantage", { years: result.horizonYears })}
                </dt>
                <dd
                  className={result.summary.advantageAtHorizon >= 0 ? "text-good" : "text-critical"}
                >
                  {formatEURSigned(result.summary.advantageAtHorizon)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">{t("sensitivity.presetBe")}</dt>
                <dd className="text-ink-2">
                  {result.breakEvens.wealthLiquidation !== null
                    ? t("common.yearN", { n: result.breakEvens.wealthLiquidation })
                    : t("common.beyond")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">{t("sensitivity.presetYear1")}</dt>
                <dd className="text-ink-2">{formatEUR(result.summary.yearOneUnrecoverableBuy)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

const HEATMAP_FILL: Record<VerdictKind, string> = {
  BUY_MORTGAGE: "var(--ds-buy)",
  BUY_CASH: "var(--ds-cash)",
  RENT: "var(--ds-rent)",
  GREY_ZONE: "var(--ds-greyzone)",
};

function Heatmap({ heatmap }: { heatmap: NonNullable<SensitivityResult["heatmap"]> }) {
  const { t } = useLocale();
  // Render rows top-down with the highest appreciation first.
  const rows = [...heatmap.cells].reverse();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t("sensitivity.heatmap")}</h3>
        <LensTag>{t("sensitivity.heatmapLens")}</LensTag>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">{t("sensitivity.heatmapHint")}</p>

      <div className="mt-3 overflow-x-auto">
        <div className="inline-block">
          {rows.map((row) => (
            <div key={row[0]?.homeAppreciation} className="flex items-center">
              <span className="nums w-12 pr-2 text-right text-[10px] text-ink-3">
                {formatPercent(row[0]?.homeAppreciation ?? 0, 0)}
              </span>
              {row.map((cell) => (
                <div
                  key={`${cell.rentGrowth}:${cell.homeAppreciation}`}
                  title={t("sensitivity.heatmapCell", {
                    rent: formatPercent(cell.rentGrowth, 0),
                    appreciation: formatPercent(cell.homeAppreciation, 0),
                    verdict: t(`verdict.${cell.verdictKind}`),
                    advantage: formatEURSigned(cell.advantage),
                  })}
                  className="m-[1px] h-7 w-9 rounded-[3px]"
                  style={{
                    backgroundColor: HEATMAP_FILL[cell.verdictKind],
                    opacity: cell.verdictKind === "GREY_ZONE" ? 0.35 : 0.85,
                  }}
                />
              ))}
            </div>
          ))}
          <div className="flex">
            <span className="w-12" />
            {heatmap.rentGrowthValues.map((value) => (
              <span key={value} className="nums m-[1px] w-9 text-center text-[10px] text-ink-3">
                {formatPercent(value, 0)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-2">
        <span className="text-ink-3">{t("sensitivity.legend")}</span>
        {(Object.keys(HEATMAP_FILL) as VerdictKind[]).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-[3px]"
              style={{
                backgroundColor: HEATMAP_FILL[kind],
                opacity: kind === "GREY_ZONE" ? 0.35 : 0.85,
              }}
            />
            {t(`verdict.${kind}`)}
          </span>
        ))}
      </div>
    </Card>
  );
}
