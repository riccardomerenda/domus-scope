import { type CostBreakdown, type QuickResult } from "@domus-scope/engine";
import { type Assessment } from "../../lib/assess";
import { formatEUR } from "../../lib/format";
import { Card, LensTag, VerdictChip, WarningBadge, VERDICT_META } from "../../components/ui";
import { ExplainableNumber } from "../explain/ExplainableNumber";
import { useExplain } from "../explain/ExplainContext";
import { RuleGauge } from "./RuleGauge";

export function QuickResultsPanel({ assessment }: { assessment: Assessment }) {
  if (assessment.issues) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Fix the inputs to see results</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-critical">
          {assessment.issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <span className="font-medium">{issue.path || "input"}</span>: {issue.message}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  if (!assessment.result) return null;
  return <Results result={assessment.result} />;
}

function Results({ result }: { result: QuickResult }) {
  const { openExplanation } = useExplain();
  const bandReason = result.verdict.reasons.find((reason) => reason.id.startsWith("quick.rule."));

  const bars: { key: string; label: string; colorClass: string; breakdown: CostBreakdown }[] = [
    { key: "rent", label: "Rent", colorClass: "bg-rent", breakdown: result.yearOne.rent },
    ...(result.yearOne.mortgage
      ? [
          {
            key: "mortgage",
            label: "Mortgage",
            colorClass: "bg-buy",
            breakdown: result.yearOne.mortgage,
          },
        ]
      : []),
    { key: "cash", label: "Cash", colorClass: "bg-cash", breakdown: result.yearOne.cash },
  ];
  const maxTotal = Math.max(...bars.map((bar) => bar.breakdown.total), 1);

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictChip
            kind={result.verdict.kind}
            indicative={result.verdict.strength === "indicative"}
          />
          <span className="text-xs text-ink-3">
            provisional — quick rule with simplified year-1 costs
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{bandReason?.message}</p>
        <div className="mt-3">
          <RuleGauge rule={result.rule} />
        </div>
        <button
          type="button"
          onClick={() => openExplanation({ kind: "threshold", rule: result.rule })}
          className="cursor-pointer rounded text-xs font-medium text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
        >
          How is the threshold R* derived?
        </button>
      </Card>

      {/* Year-1 unrecoverable costs */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Unrecoverable costs — year 1</h2>
          <LensTag>quick · simplified</LensTag>
        </div>

        <div
          className="mt-4 space-y-2"
          role="img"
          aria-label="Year-one unrecoverable costs comparison"
        >
          {bars.map((bar) => (
            <div key={bar.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium text-ink-2">{bar.label}</span>
              <div className="relative h-7 flex-1 border-l border-baseline">
                <div
                  className={`absolute inset-y-0 left-0 rounded-r ${bar.colorClass}`}
                  style={{ width: `${Math.max((bar.breakdown.total / maxTotal) * 100, 0.5)}%` }}
                />
              </div>
              <span className="nums w-24 shrink-0 text-right text-sm font-medium text-ink">
                {formatEUR(bar.breakdown.total)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bars.map((bar) => (
            <BreakdownList key={bar.key} title={bar.label} breakdown={bar.breakdown} />
          ))}
        </div>
      </Card>

      {/* Warnings */}
      {result.warnings.length > 0 ? (
        <div className="space-y-2">
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

      <p className="text-[11px] leading-relaxed text-ink-3">
        Quick mode is a first screening ({VERDICT_META[result.verdict.kind].label} is not advice).
        The full multi-year analysis — break-evens, net-worth simulation, sensitivity — arrives with
        the analytical mode.
      </p>
    </div>
  );
}

function BreakdownList({ title, breakdown }: { title: string; breakdown: CostBreakdown }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h3>
      <ul className="space-y-1">
        {breakdown.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-ink-2" title={item.label}>
              {item.label}
            </span>
            <ExplainableNumber item={item} className="shrink-0 text-ink" />
          </li>
        ))}
        <li className="mt-1 flex items-baseline justify-between gap-2 border-t border-hairline pt-1 text-sm font-semibold">
          <span className="text-ink">Total</span>
          <span className="nums text-ink">{formatEUR(breakdown.total)}</span>
        </li>
      </ul>
    </div>
  );
}
