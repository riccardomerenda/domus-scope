import { useMemo, useState } from "react";
import {
  aggregateByYear,
  buildAmortizationSchedule,
  fixedRate,
  type CostBreakdown,
  type SimulationResult,
} from "@domus-scope/engine";
import { type SimulationOutcome } from "../../../lib/assess";
import { formatEUR, formatEURSigned } from "../../../lib/format";
import {
  Card,
  LensTag,
  Segmented,
  StatTile,
  ToggleField,
  VerdictChip,
  WarningBadge,
} from "../../../components/ui";
import { ExplainableNumber } from "../../explain/ExplainableNumber";
import {
  AdvantageBars,
  ChartCard,
  CostCompositionBars,
  MortgageAnatomyBars,
  RentVsBuyLines,
  type CompositionRow,
} from "./charts";
import { YearTable } from "./YearTable";

export function ResultsPanel({ outcome }: { outcome: SimulationOutcome }) {
  if (outcome.issues) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Fix the inputs to see results</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-critical">
          {outcome.issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <span className="font-medium">{issue.path || "input"}</span>: {issue.message}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  if (!outcome.result || !outcome.input) return null;
  return <Results result={outcome.result} input={outcome.input} />;
}

function Results({
  result,
  input,
}: {
  result: SimulationResult;
  input: NonNullable<SimulationOutcome["input"]>;
}) {
  const [basis, setBasis] = useState<"hold" | "liquidation">(result.summary.basis);
  const [real, setReal] = useState(false);

  const deflate = (value: number, deflator: number) => (real ? value / deflator : value);

  const costRows = useMemo(
    () =>
      result.costLens.years.map((year) => ({
        year: year.year,
        rent: deflate(year.cumulativeRent, year.deflator),
        buy: deflate(
          basis === "liquidation" ? year.cumulativeBuyLiquidation : year.cumulativeBuyHold,
          year.deflator,
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deflate depends only on `real`
    [result, basis, real],
  );

  const wealthRows = useMemo(
    () =>
      result.wealthLens.years.map((year) => ({
        year: year.year,
        rent: deflate(
          basis === "liquidation" ? year.wealthRentLiquidation : year.wealthRentHold,
          year.deflator,
        ),
        buy: deflate(
          basis === "liquidation" ? year.wealthBuyLiquidation : year.wealthBuyHold,
          year.deflator,
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deflate depends only on `real`
    [result, basis, real],
  );

  const advantageRows = useMemo(
    () => wealthRows.map((row) => ({ year: row.year, advantage: row.buy - row.rent })),
    [wealthRows],
  );

  const anatomyRows = useMemo(() => {
    if (input.financing.kind !== "mortgage") return null;
    const principal = input.property.price - input.financing.downPayment;
    if (principal <= 0) return null;
    const schedule = buildAmortizationSchedule({
      principal,
      durationYears: input.financing.durationYears,
      rate: fixedRate(input.financing.annualRate),
    });
    return aggregateByYear(schedule, input.horizonYears).map((year) => ({
      year: year.year,
      interest: year.interest,
      principal: year.principal,
    }));
  }, [input]);

  const compositionRows = useMemo<CompositionRow[]>(
    () =>
      result.costLens.years.map((year) => {
        const row: CompositionRow = {
          year: year.year,
          interest: 0,
          upkeep: 0,
          items: 0,
          opportunity: 0,
          credits: 0,
        };
        for (const item of year.buy.items) {
          if (item.id === "buy.interest") row.interest += item.amount;
          else if (item.id === "buy.maintenance" || item.id === "buy.recurringTax")
            row.upkeep += item.amount;
          else if (item.id === "buy.opportunityCost") row.opportunity += item.amount;
          else if (item.id === "buy.appreciationCredit" || item.id === "buy.deduction")
            row.credits += item.amount;
          else row.items += item.amount;
        }
        return row;
      }),
    [result],
  );

  const breakEvenWealth =
    basis === "liquidation" ? result.breakEvens.wealthLiquidation : result.breakEvens.wealthHold;
  const breakEvenCost =
    basis === "liquidation" ? result.breakEvens.costLiquidation : result.breakEvens.costHold;
  const lastYear = result.wealthLens.years.at(-1);
  const advantage = lastYear
    ? deflate(
        basis === "liquidation" ? lastYear.advantageLiquidation : lastYear.advantageHold,
        lastYear.deflator,
      )
    : 0;

  const advantageReason = result.verdict.reasons.find((reason) => reason.id === "wealth.advantage");

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictChip
            kind={result.verdict.kind}
            indicative={result.verdict.strength === "indicative"}
          />
          <span className="nums text-sm text-ink-2">
            Buying leaves you{" "}
            <strong className={advantage >= 0 ? "text-good" : "text-critical"}>
              {formatEURSigned(advantage)}
            </strong>{" "}
            vs renting after {result.horizonYears} years ({basis} basis
            {real ? ", real terms" : ""}).
          </span>
        </div>
        {advantageReason ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{advantageReason.message}</p>
        ) : null}
        {result.warnings.length > 0 ? (
          <div className="mt-3 space-y-2">
            {result.warnings.map((warning) => (
              <WarningBadge
                key={warning.id}
                id={warning.id}
                severity={warning.severity}
                message={warning.message}
              />
            ))}
          </div>
        ) : null}
      </Card>

      {/* View toggles */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-56">
          <Segmented
            label="Basis"
            options={[
              { value: "liquidation", label: "If sold" },
              { value: "hold", label: "If held" },
            ]}
            value={basis}
            onChange={setBasis}
          />
        </div>
        <ToggleField label="Real terms (deflated by inflation)" checked={real} onChange={setReal} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Year-1 cost — rent"
          value={formatEUR(result.summary.yearOneUnrecoverableRent)}
        />
        <StatTile
          label="Year-1 cost — buy"
          value={formatEUR(result.summary.yearOneUnrecoverableBuy)}
        />
        <StatTile
          label={`Break-even (wealth, ${basis})`}
          value={breakEvenWealth !== null ? `year ${breakEvenWealth}` : "beyond horizon"}
        />
        <StatTile
          label={`Break-even (costs, ${basis})`}
          value={breakEvenCost !== null ? `year ${breakEvenCost}` : "beyond horizon"}
        />
        <StatTile
          label={`Advantage @ ${result.horizonYears}y${real ? " (real)" : ""}`}
          value={formatEURSigned(advantage)}
          tone={advantage >= 0 ? "good" : "bad"}
          sub={
            result.summary.liquidityAfterPurchase !== null
              ? `liquidity after purchase ${formatEUR(result.summary.liquidityAfterPurchase)}`
              : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cumulative unrecoverable costs"
          lens={`cost lens · ${basis}${real ? " · real" : ""}`}
          description="What each path burns, year after year — the money that never comes back."
        >
          <RentVsBuyLines rows={costRows} />
        </ChartCard>
        <ChartCard
          title="Net worth over time"
          lens={`wealth lens · ${basis}${real ? " · real" : ""}`}
          description="Same starting capital, same monthly budget: who is richer at each year-end."
        >
          <RentVsBuyLines rows={wealthRows} />
        </ChartCard>
        <ChartCard
          title="If you sold in year t"
          lens={`wealth lens · ${basis}${real ? " · real" : ""}`}
          description="The signature question: net advantage of having bought, if you liquidated at each year."
        >
          <AdvantageBars rows={advantageRows} />
        </ChartCard>
        {anatomyRows ? (
          <ChartCard
            title="Mortgage anatomy"
            lens="exact schedule"
            description="Each year's payments split into interest (a cost) and principal (your wealth, BR-008)."
          >
            <MortgageAnatomyBars rows={anatomyRows} />
          </ChartCard>
        ) : null}
        <ChartCard
          title="Buy-side cost composition"
          lens="cost lens · nominal"
          description="What makes up the owning costs; value gains and tax credits push below zero."
        >
          <CostCompositionBars rows={compositionRows} />
        </ChartCard>
        <HorizonComposition
          title="Wealth at horizon — buy"
          breakdown={result.wealthLens.buyCompositionAtHorizon}
        />
      </div>

      <HorizonComposition
        title="Wealth at horizon — rent"
        breakdown={result.wealthLens.rentCompositionAtHorizon}
        inline
      />

      <YearTable
        costYears={result.costLens.years}
        wealthYears={result.wealthLens.years}
        basis={basis}
        real={real}
      />
    </div>
  );
}

function HorizonComposition({
  title,
  breakdown,
  inline = false,
}: {
  title: string;
  breakdown: CostBreakdown;
  inline?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <LensTag>wealth lens · liquidation</LensTag>
      </div>
      <ul className={`mt-3 ${inline ? "grid gap-x-8 gap-y-1 sm:grid-cols-2" : "space-y-1"}`}>
        {breakdown.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-2" title={item.label}>
              {item.label}
            </span>
            <ExplainableNumber item={item} className="shrink-0 text-ink" />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-1.5 text-sm font-semibold">
        <span className="text-ink">Total</span>
        <span className="nums text-ink">{formatEUR(breakdown.total)}</span>
      </div>
    </Card>
  );
}
