import { type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEUR } from "../../../lib/format";
import { useLocale } from "../../../i18n";
import { Card, LensTag } from "../../../components/ui";

/**
 * Chart set for the Results screen (UI design §3.4). Follows the dataviz
 * rules: entity colors are fixed (rent=blue, buy=aqua), compositions use an
 * ordinal single-hue ramp, one axis per chart, legends for ≥2 series, hover
 * tooltips everywhere, text in ink tokens.
 */

const AXIS_TICK = { fill: "var(--ds-ink-3)", fontSize: 11 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--ds-surface)",
  border: "1px solid var(--ds-hairline)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ds-ink)",
} as const;
const LEGEND_STYLE = { fontSize: 12, color: "var(--ds-ink-2)" } as const;

function axisEUR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("it-IT", { maximumFractionDigits: 1 })}M€`;
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString("it-IT")}k€`;
  return `${Math.round(value)}€`;
}

function tooltipEUR(value: number | string | (number | string)[]): string {
  return typeof value === "number" ? formatEUR(value) : String(value);
}

export function ChartCard({
  title,
  lens,
  description,
  children,
}: {
  title: string;
  lens: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <LensTag>{lens}</LensTag>
      </div>
      {description ? <p className="mt-0.5 mb-1 text-xs text-ink-3">{description}</p> : null}
      <div className="mt-2 h-60">{children}</div>
    </Card>
  );
}

export interface TwoSeriesRow {
  year: number;
  rent: number;
  buy: number;
}

export function RentVsBuyLines({ rows }: { rows: TwoSeriesRow[] }) {
  const { t } = useLocale();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--ds-hairline)" />
        <XAxis
          dataKey="year"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ds-baseline)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={axisEUR}
          width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => tooltipEUR(value)}
          labelFormatter={(year) => t("results.tooltip.year", { n: String(year) })}
        />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Line
          name={t("results.series.rent")}
          dataKey="rent"
          stroke="var(--ds-rent)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          name={t("results.series.buy")}
          dataKey="buy"
          stroke="var(--ds-buy)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AdvantageBars({ rows }: { rows: { year: number; advantage: number }[] }) {
  const { t } = useLocale();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--ds-hairline)" />
        <XAxis
          dataKey="year"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ds-baseline)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={axisEUR}
          width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [tooltipEUR(value), t("results.tooltip.buyMinusRent")]}
          labelFormatter={(year) => t("results.tooltip.sellAt", { n: String(year) })}
        />
        <ReferenceLine y={0} stroke="var(--ds-baseline)" />
        <Bar name={t("results.series.advantage")} dataKey="advantage" radius={[3, 3, 0, 0]}>
          {rows.map((row) => (
            <Cell key={row.year} fill={row.advantage >= 0 ? "var(--ds-buy)" : "var(--ds-rent)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MortgageAnatomyBars({
  rows,
}: {
  rows: { year: number; interest: number; principal: number }[];
}) {
  const { t } = useLocale();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--ds-hairline)" />
        <XAxis
          dataKey="year"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ds-baseline)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={axisEUR}
          width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => tooltipEUR(value)}
          labelFormatter={(year) => t("results.tooltip.year", { n: String(year) })}
        />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Bar
          name={t("results.series.interest")}
          dataKey="interest"
          stackId="payment"
          fill="var(--ds-seq-1)"
        />
        <Bar
          name={t("results.series.principal")}
          dataKey="principal"
          stackId="payment"
          fill="var(--ds-seq-3)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface CompositionRow {
  year: number;
  interest: number;
  upkeep: number;
  items: number;
  opportunity: number;
  credits: number;
}

export function CostCompositionBars({ rows }: { rows: CompositionRow[] }) {
  const { t } = useLocale();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--ds-hairline)" />
        <XAxis
          dataKey="year"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ds-baseline)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={axisEUR}
          width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => tooltipEUR(value)}
          labelFormatter={(year) => t("results.tooltip.year", { n: String(year) })}
        />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <ReferenceLine y={0} stroke="var(--ds-baseline)" />
        <Bar
          name={t("results.series.interestShort")}
          dataKey="interest"
          stackId="cost"
          fill="var(--ds-seq-1)"
        />
        <Bar
          name={t("results.series.upkeep")}
          dataKey="upkeep"
          stackId="cost"
          fill="var(--ds-seq-2)"
        />
        <Bar
          name={t("results.series.items")}
          dataKey="items"
          stackId="cost"
          fill="var(--ds-seq-3)"
        />
        <Bar
          name={t("results.series.opportunity")}
          dataKey="opportunity"
          stackId="cost"
          fill="var(--ds-seq-4)"
        />
        <Bar
          name={t("results.series.credits")}
          dataKey="credits"
          stackId="cost"
          fill="var(--ds-buy)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
