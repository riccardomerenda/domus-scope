import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { type EconomicAssumptions } from "@domus-scope/engine";
import { db, mergeAppConfig } from "../../persistence/db";
import { buildScenarioExport } from "../../persistence/transfer";
import { runSimulation } from "../../lib/assess";
import { preferenceIndex } from "../../lib/qualitative";
import {
  formatDate,
  formatEUR,
  formatEURSigned,
  formatNumber,
  formatPercent,
} from "../../lib/format";
import { useLocale } from "../../i18n";
import { Button, VerdictChip } from "../../components/ui";
import { DownloadIcon } from "../../components/Icons";

/**
 * Print-optimized decision report (FR-017/US-013): inputs, effective
 * assumptions with provenance, results, warnings, qualitative panel, journal,
 * and the not-financial-advice disclaimer. Browser print → PDF.
 */
export function ReportPage() {
  const { t } = useLocale();
  const { id } = useParams<{ id: string }>();
  const scenario = useLiveQuery(
    async () => (id ? ((await db.scenarios.get(id)) ?? null) : null),
    [id],
  );
  const appConfig =
    useLiveQuery(async () => mergeAppConfig(await db.appConfig.get("app")), []) ??
    mergeAppConfig(null);
  const journal = useLiveQuery(
    () => (id ? db.journal.where("scenarioId").equals(id).sortBy("createdAt") : []),
    [id],
  );

  // Reports print on the light theme; restore the user's choice on exit.
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => {
      if (wasDark) document.documentElement.classList.add("dark");
    };
  }, []);

  const outcome = useMemo(
    () =>
      scenario?.analytical
        ? runSimulation({ id: scenario.id, title: scenario.title }, scenario.analytical, appConfig)
        : undefined,
    [scenario, appConfig],
  );

  if (scenario === undefined) return null;
  if (!scenario) {
    return (
      <div className="py-16 text-center text-sm text-ink-2">
        {t("scenario.notFound")}{" "}
        <Link to="/" className="underline underline-offset-4">
          {t("scenario.backToDashboard")}
        </Link>
      </div>
    );
  }
  if (!scenario.analytical || !outcome?.result || !outcome.input) {
    return (
      <div className="py-16 text-center text-sm text-ink-2">
        {t("report.needsAnalytical")}{" "}
        <Link to={`/scenario/${scenario.id}`} className="underline underline-offset-4">
          {t("report.openScenario")}
        </Link>{" "}
        {t("report.andDeepen")}
      </div>
    );
  }

  const result = outcome.result;
  const data = scenario.analytical;
  const decision = (journal ?? []).find((entry) => entry.kind === "decision");
  const pros = (journal ?? []).filter((entry) => entry.kind === "pro");
  const cons = (journal ?? []).filter((entry) => entry.kind === "con");
  const { index } = preferenceIndex(scenario.qualitative, appConfig.qualitativeWeights);
  const assumptionKeys = Object.keys(result.assumptions.values) as (keyof EconomicAssumptions)[];

  async function onExportJson() {
    const file = await buildScenarioExport(scenario!.id);
    if (!file) return;
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `domus-scope-${scenario!.title.toLowerCase().replaceAll(/\s+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl bg-page px-6 py-8 text-ink">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link to={`/scenario/${scenario.id}`} className="text-sm text-ink-3 hover:text-ink">
          {t("report.back")}
        </Link>
        <div className="flex gap-2">
          <Button onClick={() => void onExportJson()}>
            <DownloadIcon /> {t("report.exportJson")}
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            {t("report.print")}
          </Button>
        </div>
      </div>

      <header className="border-b-2 border-ink pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
              {t("report.kicker")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{scenario.title}</h1>
          </div>
          <p className="nums text-xs text-ink-3">{formatDate(Date.now())}</p>
        </div>
      </header>

      {/* Verdict */}
      <section className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictChip
            kind={result.verdict.kind}
            indicative={result.verdict.strength === "indicative"}
          />
          <span className="nums text-sm">
            {t("report.advantageLine", { years: result.horizonYears })}{" "}
            <strong>{formatEURSigned(result.summary.advantageAtHorizon)}</strong>{" "}
            {t("report.basisSuffix", { basis: t(`results.basis.${result.summary.basis}`) })}
          </span>
        </div>
        {result.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {result.warnings.map((warning) => (
              <li key={warning.id}>
                ⚠ <strong>{warning.id}</strong> {t(`warning.${warning.id}`)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <ReportSection title={t("report.keyFigures")}>
        <table className="nums w-full text-sm">
          <tbody>
            <Row
              label={t("report.year1Rent")}
              value={formatEUR(result.summary.yearOneUnrecoverableRent)}
            />
            <Row
              label={t("report.year1Buy")}
              value={formatEUR(result.summary.yearOneUnrecoverableBuy)}
            />
            <Row
              label={t("report.beWealth")}
              value={
                result.breakEvens.wealthLiquidation !== null
                  ? t("common.yearN", { n: result.breakEvens.wealthLiquidation })
                  : t("common.beyondHorizon")
              }
            />
            <Row
              label={t("report.beCost")}
              value={
                result.breakEvens.costLiquidation !== null
                  ? t("common.yearN", { n: result.breakEvens.costLiquidation })
                  : t("common.beyondHorizon")
              }
            />
            <Row
              label={t("report.totalInterest")}
              value={formatEUR(result.summary.totalInterest)}
            />
            {result.summary.liquidityAfterPurchase !== null ? (
              <Row
                label={t("report.liquidityAfter")}
                value={formatEUR(result.summary.liquidityAfterPurchase)}
              />
            ) : null}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title={t("report.inputs")}>
        <table className="nums w-full text-sm">
          <tbody>
            <Row label={t("report.price")} value={formatEUR(data.property.price)} />
            {data.property.zone ? (
              <Row label={t("report.zone")} value={data.property.zone} />
            ) : null}
            <Row
              label={t("report.financing")}
              value={
                data.financingKind === "mortgage"
                  ? t("report.financingMortgage", {
                      principal: formatEUR(data.property.price - data.downPayment),
                      rate: formatPercent(data.annualRate, 2),
                      years: data.durationYears,
                      down: formatEUR(data.downPayment),
                    })
                  : t("report.financingCash")
              }
            />
            <Row
              label={t("report.rent")}
              value={t("report.rentValue", {
                rent: formatEUR(data.rentAlternative.equivalentMonthlyRent),
                comparability: data.rentAlternative.comparability,
              })}
            />
            <Row
              label={t("report.horizon")}
              value={t("report.horizonValue", { years: data.horizonYears })}
            />
            <Row label={t("report.sellingCosts")} value={formatPercent(data.sellingCostRate, 2)} />
          </tbody>
        </table>
        {data.costItems.filter((item) => item.enabled).length > 0 ? (
          <>
            <h3 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
              {t("report.costItems")}
            </h3>
            <ul className="space-y-0.5 text-xs text-ink-2">
              {data.costItems
                .filter((item) => item.enabled)
                .map((item) => (
                  <li key={item.id}>
                    {item.label} ({t(`costs.side.${item.scenario}`)}
                    {item.sign === "credit" ? `, ${t("costs.credit")}` : ""})
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </ReportSection>

      <ReportSection title={t("report.assumptions")}>
        <table className="nums w-full text-sm">
          <tbody>
            {assumptionKeys.map((key) => (
              <Row
                key={key}
                label={t(`assumption.${key}`)}
                value={`${formatPercent(result.assumptions.values[key], 2)} — ${t(
                  `provenance.${result.assumptions.provenance[key]}`,
                )}`}
              />
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title={t("report.projection")}>
        <table className="nums w-full text-xs">
          <thead>
            <tr className="border-b border-baseline text-left text-[10px] tracking-wide text-ink-3 uppercase">
              <th className="py-1 pr-2 font-medium">{t("yearTable.year")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("report.cumRent")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("report.cumBuy")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("yearTable.wealthRent")}</th>
              <th className="py-1 pr-2 text-right font-medium">{t("yearTable.wealthBuy")}</th>
              <th className="py-1 text-right font-medium">{t("yearTable.advantage")}</th>
            </tr>
          </thead>
          <tbody>
            {result.costLens.years.map((costYear, indexRow) => {
              const wealthYear = result.wealthLens.years[indexRow];
              return (
                <tr key={costYear.year} className="border-b border-hairline last:border-0">
                  <td className="py-1 pr-2">{costYear.year}</td>
                  <td className="py-1 pr-2 text-right">{formatEUR(costYear.cumulativeRent)}</td>
                  <td className="py-1 pr-2 text-right">
                    {formatEUR(costYear.cumulativeBuyLiquidation)}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {formatEUR(wealthYear?.wealthRentLiquidation ?? 0)}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {formatEUR(wealthYear?.wealthBuyLiquidation ?? 0)}
                  </td>
                  <td className="py-1 text-right">
                    {formatEURSigned(wealthYear?.advantageLiquidation ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title={t("report.beyondNumbers")}>
        <p className="text-sm">
          {t("journal.preferenceIndex")}{" "}
          {index !== null ? (
            <strong className="nums">{formatNumber(index, 0)} / 100</strong>
          ) : (
            <span className="text-ink-3">{t("report.notScored")}</span>
          )}{" "}
          <span className="text-xs text-ink-3">{t("report.indexNote")}</span>
        </p>
        {(pros.length > 0 || cons.length > 0) && (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-good uppercase">
                {t("report.pros")}
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
                {pros.map((entry) => (
                  <li key={entry.id}>{entry.text}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-critical uppercase">
                {t("report.cons")}
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
                {cons.map((entry) => (
                  <li key={entry.id}>{entry.text}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {decision ? (
          <p className="mt-3 rounded-lg border border-good/40 p-2 text-sm">
            <strong>{t("report.decision")}</strong> {decision.decision} (
            {formatDate(decision.createdAt)}){decision.text ? ` — “${decision.text}”` : ""}
          </p>
        ) : null}
      </ReportSection>

      <footer className="mt-6 border-t border-baseline pt-3 text-[11px] leading-relaxed text-ink-3">
        <p>
          <strong>{t("report.disclaimerLabel")}</strong>{" "}
          {t("report.disclaimer", { verdict: t(`verdict.${result.verdict.kind}`) })}
        </p>
      </footer>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-hairline pb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="py-1 pr-3 text-ink-2">{label}</td>
      <td className="py-1 text-right font-medium">{value}</td>
    </tr>
  );
}
