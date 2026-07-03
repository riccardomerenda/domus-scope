import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
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
import { Button, VerdictChip, VERDICT_META } from "../../components/ui";
import { DownloadIcon } from "../../components/Icons";

/**
 * Print-optimized decision report (FR-017/US-013): inputs, effective
 * assumptions with provenance, results, warnings, qualitative panel, journal,
 * and the not-financial-advice disclaimer. Browser print → PDF.
 */
export function ReportPage() {
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
        Scenario not found.{" "}
        <Link to="/" className="underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    );
  }
  if (!scenario.analytical || !outcome?.result || !outcome.input) {
    return (
      <div className="py-16 text-center text-sm text-ink-2">
        The report needs a valid full-analysis scenario.{" "}
        <Link to={`/scenario/${scenario.id}`} className="underline underline-offset-4">
          Open the scenario
        </Link>{" "}
        and use “Deepen with full analysis”.
      </div>
    );
  }

  const result = outcome.result;
  const data = scenario.analytical;
  const decision = (journal ?? []).find((entry) => entry.kind === "decision");
  const pros = (journal ?? []).filter((entry) => entry.kind === "pro");
  const cons = (journal ?? []).filter((entry) => entry.kind === "con");
  const { index } = preferenceIndex(scenario.qualitative, appConfig.qualitativeWeights);

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
          ← Back to scenario
        </Link>
        <div className="flex gap-2">
          <Button onClick={() => void onExportJson()}>
            <DownloadIcon /> Export JSON
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
      </div>

      <header className="border-b-2 border-ink pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
              DomusScope — decision report
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
            Net-worth advantage of buying at year {result.horizonYears}:{" "}
            <strong>{formatEURSigned(result.summary.advantageAtHorizon)}</strong> (
            {result.summary.basis} basis)
          </span>
        </div>
        {result.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {result.warnings.map((warning) => (
              <li key={warning.id}>
                ⚠ <strong>{warning.id}</strong> {warning.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <ReportSection title="Key figures">
        <table className="nums w-full text-sm">
          <tbody>
            <Row
              label="Year-1 unrecoverable cost — rent"
              value={formatEUR(result.summary.yearOneUnrecoverableRent)}
            />
            <Row
              label="Year-1 unrecoverable cost — buy"
              value={formatEUR(result.summary.yearOneUnrecoverableBuy)}
            />
            <Row
              label="Break-even (wealth, liquidation)"
              value={
                result.breakEvens.wealthLiquidation !== null
                  ? `year ${result.breakEvens.wealthLiquidation}`
                  : "beyond horizon"
              }
            />
            <Row
              label="Break-even (costs, liquidation)"
              value={
                result.breakEvens.costLiquidation !== null
                  ? `year ${result.breakEvens.costLiquidation}`
                  : "beyond horizon"
              }
            />
            <Row
              label="Total mortgage interest within horizon"
              value={formatEUR(result.summary.totalInterest)}
            />
            {result.summary.liquidityAfterPurchase !== null ? (
              <Row
                label="Liquidity after purchase"
                value={formatEUR(result.summary.liquidityAfterPurchase)}
              />
            ) : null}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title="Inputs">
        <table className="nums w-full text-sm">
          <tbody>
            <Row label="Property price" value={formatEUR(data.property.price)} />
            {data.property.zone ? <Row label="Zone" value={data.property.zone} /> : null}
            <Row
              label="Financing"
              value={
                data.financingKind === "mortgage"
                  ? `Mortgage — ${formatEUR(data.property.price - data.downPayment)} at ${formatPercent(data.annualRate, 2)} for ${data.durationYears} years (down payment ${formatEUR(data.downPayment)})`
                  : "Cash purchase"
              }
            />
            <Row
              label="Equivalent rent"
              value={`${formatEUR(data.rentAlternative.equivalentMonthlyRent)}/mo (comparability: ${data.rentAlternative.comparability})`}
            />
            <Row label="Horizon" value={`${data.horizonYears} years`} />
            <Row label="Selling costs" value={formatPercent(data.sellingCostRate, 2)} />
          </tbody>
        </table>
        {data.costItems.filter((item) => item.enabled).length > 0 ? (
          <>
            <h3 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
              Cost items
            </h3>
            <ul className="space-y-0.5 text-xs text-ink-2">
              {data.costItems
                .filter((item) => item.enabled)
                .map((item) => (
                  <li key={item.id}>
                    {item.label} ({item.scenario}
                    {item.sign === "credit" ? ", credit" : ""})
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </ReportSection>

      <ReportSection title="Effective assumptions (with provenance)">
        <table className="nums w-full text-sm">
          <tbody>
            {Object.entries(result.assumptions.values).map(([key, value]) => (
              <Row
                key={key}
                label={key}
                value={`${formatPercent(value, 2)} — ${result.assumptions.provenance[key as keyof typeof result.assumptions.provenance]}`}
              />
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title="Projection (liquidation basis)">
        <table className="nums w-full text-xs">
          <thead>
            <tr className="border-b border-baseline text-left text-[10px] tracking-wide text-ink-3 uppercase">
              <th className="py-1 pr-2 font-medium">Year</th>
              <th className="py-1 pr-2 text-right font-medium">Cum. rent cost</th>
              <th className="py-1 pr-2 text-right font-medium">Cum. buy cost</th>
              <th className="py-1 pr-2 text-right font-medium">Wealth rent</th>
              <th className="py-1 pr-2 text-right font-medium">Wealth buy</th>
              <th className="py-1 text-right font-medium">Advantage</th>
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

      <ReportSection title="Beyond the numbers">
        <p className="text-sm">
          Preference index:{" "}
          {index !== null ? (
            <strong className="nums">{formatNumber(index, 0)} / 100</strong>
          ) : (
            <span className="text-ink-3">not scored</span>
          )}{" "}
          <span className="text-xs text-ink-3">
            (&gt;50 leans toward buying for non-financial reasons; kept separate from the financial
            verdict by design)
          </span>
        </p>
        {(pros.length > 0 || cons.length > 0) && (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-good uppercase">Pros</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
                {pros.map((entry) => (
                  <li key={entry.id}>{entry.text}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-critical uppercase">Cons</h3>
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
            <strong>Decision:</strong> {decision.decision} ({formatDate(decision.createdAt)})
            {decision.text ? ` — “${decision.text}”` : ""}
          </p>
        ) : null}
      </ReportSection>

      <footer className="mt-6 border-t border-baseline pt-3 text-[11px] leading-relaxed text-ink-3">
        <p>
          <strong>Disclaimer:</strong> this report was generated by DomusScope, a personal analysis
          tool. It is not financial, tax, notarial, or investment advice. All figures derive from
          user-provided assumptions ({VERDICT_META[result.verdict.kind].label} is a model output,
          not a recommendation). Data lives only on the user's device.
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
