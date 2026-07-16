import { useMemo, useState } from "react";
import {
  aggregateByYear,
  buildAmortizationSchedule,
  fixedRate,
  type CostBreakdown,
  type SimulationResult,
} from "@domus-scope/engine";
import { type FragilityRating } from "@domus-scope/engine";
import { type QualitativeScores, type QualitativeWeights } from "../../../persistence/db";
import { type SimulationOutcome } from "../../../lib/assess";
import { preferenceIndex } from "../../../lib/qualitative";
import { formatEUR, formatEURSigned, formatNumber } from "../../../lib/format";
import { isMessageKey, useLocale } from "../../../i18n";
import {
  Card,
  FragilityBadge,
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

export interface EpilogueData {
  scores: QualitativeScores;
  weights: QualitativeWeights;
}

export function ResultsPanel({
  outcome,
  fragility,
  epilogue,
}: {
  outcome: SimulationOutcome;
  fragility?: FragilityRating | undefined;
  epilogue?: EpilogueData | undefined;
}) {
  const { t } = useLocale();
  if (outcome.issues) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">{t("results.fixInputs")}</h2>
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
  return (
    <Results
      result={outcome.result}
      input={outcome.input}
      fragility={fragility}
      epilogue={epilogue}
    />
  );
}

function Results({
  result,
  input,
  fragility,
  epilogue,
}: {
  result: SimulationResult;
  input: NonNullable<SimulationOutcome["input"]>;
  fragility?: FragilityRating | undefined;
  epilogue?: EpilogueData | undefined;
}) {
  const { t } = useLocale();
  const [basis, setBasis] = useState<"hold" | "liquidation">(result.summary.basis);
  const [real, setReal] = useState(false);

  const deflate = (value: number, deflator: number) => (real ? value / deflator : value);
  const basisLabel = t(`results.basis.${basis}`);
  const realSuffix = real ? t("results.lens.real") : "";

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
  const advantageReasonKey = advantageReason ? `reason.${advantageReason.id}` : null;

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictChip
            kind={result.verdict.kind}
            indicative={result.verdict.strength === "indicative"}
          />
          {fragility ? <FragilityBadge rating={fragility} /> : null}
          {/* Live region: the verdict recomputes as inputs change elsewhere. */}
          <span role="status" className="nums text-sm text-ink-2">
            {t("results.banner")}{" "}
            <strong className={advantage >= 0 ? "text-good" : "text-critical"}>
              {formatEURSigned(advantage)}
            </strong>{" "}
            {t("results.bannerRest", {
              years: result.horizonYears,
              basis: basisLabel,
              real: real ? t("results.bannerReal") : "",
            })}
          </span>
        </div>
        {advantageReasonKey ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {isMessageKey(advantageReasonKey)
              ? t(advantageReasonKey)
              : (advantageReason?.message ?? "")}
          </p>
        ) : null}
        {result.warnings.length > 0 ? (
          <div className="mt-3 space-y-2">
            {result.warnings.map((warning) => (
              <WarningBadge key={warning.id} id={warning.id} severity={warning.severity} />
            ))}
          </div>
        ) : null}
      </Card>

      {/* View toggles */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-56">
          <Segmented
            label={t("results.basisAria")}
            options={[
              { value: "liquidation", label: t("results.ifSold") },
              { value: "hold", label: t("results.ifHeld") },
            ]}
            value={basis}
            onChange={setBasis}
          />
        </div>
        <ToggleField label={t("results.realToggle")} checked={real} onChange={setReal} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label={t("results.kpi.year1Rent")}
          value={formatEUR(result.summary.yearOneUnrecoverableRent)}
        />
        <StatTile
          label={t("results.kpi.year1Buy")}
          value={formatEUR(result.summary.yearOneUnrecoverableBuy)}
        />
        <StatTile
          label={t("results.kpi.beWealth", { basis: basisLabel })}
          value={
            breakEvenWealth !== null
              ? t("common.yearN", { n: breakEvenWealth })
              : t("common.beyondHorizon")
          }
        />
        <StatTile
          label={t("results.kpi.beCost", { basis: basisLabel })}
          value={
            breakEvenCost !== null
              ? t("common.yearN", { n: breakEvenCost })
              : t("common.beyondHorizon")
          }
        />
        <StatTile
          label={t("results.kpi.advantage", {
            years: result.horizonYears,
            real: real ? t("results.kpi.advantageReal") : "",
          })}
          value={formatEURSigned(advantage)}
          tone={advantage >= 0 ? "good" : "bad"}
          sub={
            result.summary.liquidityAfterPurchase !== null
              ? t("results.kpi.liquidityAfter", {
                  amount: formatEUR(result.summary.liquidityAfterPurchase),
                })
              : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("results.chart.costs")}
          lens={t("results.lens.cost", { basis: basisLabel, real: realSuffix })}
          description={t("results.chart.costsDesc")}
        >
          <RentVsBuyLines rows={costRows} />
        </ChartCard>
        <ChartCard
          title={t("results.chart.wealth")}
          lens={t("results.lens.wealth", { basis: basisLabel, real: realSuffix })}
          description={t("results.chart.wealthDesc")}
        >
          <RentVsBuyLines rows={wealthRows} />
        </ChartCard>
        <ChartCard
          title={t("results.chart.advantage")}
          lens={t("results.lens.wealth", { basis: basisLabel, real: realSuffix })}
          description={t("results.chart.advantageDesc")}
        >
          <AdvantageBars rows={advantageRows} />
        </ChartCard>
        {anatomyRows ? (
          <ChartCard
            title={t("results.chart.anatomy")}
            lens={t("results.lens.exact")}
            description={t("results.chart.anatomyDesc")}
          >
            <MortgageAnatomyBars rows={anatomyRows} />
          </ChartCard>
        ) : null}
        <ChartCard
          title={t("results.chart.composition")}
          lens={t("results.lens.nominal")}
          description={t("results.chart.compositionDesc")}
        >
          <CostCompositionBars rows={compositionRows} />
        </ChartCard>
        <HorizonComposition
          title={t("results.compositionBuy")}
          breakdown={result.wealthLens.buyCompositionAtHorizon}
        />
      </div>

      <HorizonComposition
        title={t("results.compositionRent")}
        breakdown={result.wealthLens.rentCompositionAtHorizon}
        inline
      />

      <YearTable
        costYears={result.costLens.years}
        wealthYears={result.wealthLens.years}
        basis={basis}
        real={real}
      />

      {epilogue ? <Epilogue epilogue={epilogue} advantage={advantage} basis={basis} /> : null}
    </div>
  );
}

/** BR-015: financial delta and personal preference side by side, never summed. */
function Epilogue({
  epilogue,
  advantage,
  basis,
}: {
  epilogue: EpilogueData;
  advantage: number;
  basis: "hold" | "liquidation";
}) {
  const { t } = useLocale();
  const { index, scoredFactors } = preferenceIndex(epilogue.scores, epilogue.weights);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">{t("results.epilogue.numbers")}</h3>
        <p className="nums mt-2 text-xl font-semibold text-ink">{formatEURSigned(advantage)}</p>
        <p className="mt-1 text-xs text-ink-3">
          {t("results.epilogue.numbersNote", { basis: t(`results.basis.${basis}`) })}
        </p>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">{t("results.epilogue.priorities")}</h3>
        {index !== null ? (
          <>
            <p className="nums mt-2 text-xl font-semibold text-ink">
              {formatNumber(index, 0)} / 100
            </p>
            <div className="mt-2 space-y-1">
              {scoredFactors.map((factor) => (
                <div key={factor} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 text-ink-3">{t(`factor.${factor}`)}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-hairline">
                    <div
                      className="h-1.5 rounded-full bg-ink-3"
                      style={{ width: `${((epilogue.scores[factor] ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                  <span className="nums w-4 text-right text-ink-2">{epilogue.scores[factor]}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-3">{t("results.epilogue.score")}</p>
        )}
        <p className="mt-2 text-xs text-ink-3">{t("results.epilogue.note")}</p>
      </Card>
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
  const { t } = useLocale();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <LensTag>{t("results.compositionLens")}</LensTag>
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
        <span className="text-ink">{t("common.total")}</span>
        <span className="nums text-ink">{formatEUR(breakdown.total)}</span>
      </div>
    </Card>
  );
}
