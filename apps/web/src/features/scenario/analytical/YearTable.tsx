import { useState } from "react";
import { type CostLensYear, type WealthLensYear } from "@domus-scope/engine";
import { formatEUR, formatEURSigned } from "../../../lib/format";
import { Card, LensTag } from "../../../components/ui";
import { ChevronDownIcon } from "../../../components/Icons";
import { ExplainableNumber } from "../../explain/ExplainableNumber";

/**
 * The canonical data view (also the accessible fallback for every chart).
 * Yearly totals expand into their traced line items, so any figure can be
 * opened in the explanation drawer (FR-019).
 */
export function YearTable({
  costYears,
  wealthYears,
  basis,
  real,
}: {
  costYears: CostLensYear[];
  wealthYears: WealthLensYear[];
  basis: "hold" | "liquidation";
  real: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (year: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  const deflate = (value: number, deflator: number) => (real ? value / deflator : value);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Year by year</h3>
        <div className="flex items-center gap-1.5">
          <LensTag>both lenses</LensTag>
          <LensTag>{basis}</LensTag>
          {real ? <LensTag>real terms</LensTag> : null}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        Expand a year to open every line item's formula. Expanded breakdowns are always nominal.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-baseline text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <th className="py-1.5 pr-2 font-medium" aria-label="Expand" />
              <th className="py-1.5 pr-3 font-medium">Year</th>
              <th className="py-1.5 pr-3 text-right font-medium">Rent cost</th>
              <th className="py-1.5 pr-3 text-right font-medium">Buy cost</th>
              <th className="py-1.5 pr-3 text-right font-medium">Cum. rent</th>
              <th className="py-1.5 pr-3 text-right font-medium">Cum. buy</th>
              <th className="py-1.5 pr-3 text-right font-medium">Value</th>
              <th className="py-1.5 pr-3 text-right font-medium">Debt</th>
              <th className="py-1.5 pr-3 text-right font-medium">Wealth rent</th>
              <th className="py-1.5 pr-3 text-right font-medium">Wealth buy</th>
              <th className="py-1.5 text-right font-medium">Advantage</th>
            </tr>
          </thead>
          <tbody className="nums">
            {costYears.map((cost, index) => {
              const wealth = wealthYears[index];
              const isOpen = expanded.has(cost.year);
              const cumBuy =
                basis === "liquidation" ? cost.cumulativeBuyLiquidation : cost.cumulativeBuyHold;
              const wealthRent = wealth
                ? basis === "liquidation"
                  ? wealth.wealthRentLiquidation
                  : wealth.wealthRentHold
                : 0;
              const wealthBuy = wealth
                ? basis === "liquidation"
                  ? wealth.wealthBuyLiquidation
                  : wealth.wealthBuyHold
                : 0;
              const advantage = wealthBuy - wealthRent;
              return (
                <YearRow
                  key={cost.year}
                  cost={cost}
                  isOpen={isOpen}
                  onToggle={() => toggle(cost.year)}
                  cells={[
                    deflate(cost.rent.total, cost.deflator),
                    deflate(cost.buy.total, cost.deflator),
                    deflate(cost.cumulativeRent, cost.deflator),
                    deflate(cumBuy, cost.deflator),
                    deflate(cost.propertyValue, cost.deflator),
                    deflate(cost.debtBalance, cost.deflator),
                    deflate(wealthRent, cost.deflator),
                    deflate(wealthBuy, cost.deflator),
                  ]}
                  advantage={deflate(advantage, cost.deflator)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function YearRow({
  cost,
  cells,
  advantage,
  isOpen,
  onToggle,
}: {
  cost: CostLensYear;
  cells: number[];
  advantage: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-hairline">
        <td className="py-1.5 pr-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={`Toggle year ${cost.year} breakdown`}
            className="cursor-pointer rounded p-0.5 text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-rent"
          >
            <ChevronDownIcon
              width={14}
              height={14}
              style={{ transform: isOpen ? "rotate(180deg)" : undefined }}
            />
          </button>
        </td>
        <td className="py-1.5 pr-3 font-medium text-ink">{cost.year}</td>
        {cells.map((value, index) => (
          <td key={index} className="py-1.5 pr-3 text-right text-ink-2">
            {formatEUR(value)}
          </td>
        ))}
        <td
          className={`py-1.5 text-right font-medium ${advantage >= 0 ? "text-good" : "text-critical"}`}
        >
          {formatEURSigned(advantage)}
        </td>
      </tr>
      {isOpen ? (
        <tr className="border-b border-hairline bg-page/60">
          <td />
          <td colSpan={10} className="py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <ItemList
                title={`Rent — year ${cost.year}`}
                items={cost.rent.items}
                total={cost.rent.total}
              />
              <ItemList
                title={`Buy — year ${cost.year}`}
                items={cost.buy.items}
                total={cost.buy.total}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ItemList({
  title,
  items,
  total,
}: {
  title: string;
  items: CostLensYear["rent"]["items"];
  total: number;
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h4>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-2" title={item.label}>
              {item.label}
            </span>
            <ExplainableNumber item={item} className="shrink-0 text-ink" />
          </li>
        ))}
        <li className="mt-0.5 flex items-baseline justify-between gap-3 border-t border-hairline pt-0.5 text-sm font-semibold">
          <span className="text-ink">Total</span>
          <span className="nums text-ink">{formatEUR(total)}</span>
        </li>
      </ul>
    </div>
  );
}
