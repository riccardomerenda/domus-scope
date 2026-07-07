import { useDeferredValue, useMemo, useState } from "react";
import {
  concessionBalance,
  earlyPossessionEquivalent,
  runNegotiation,
  type Concession,
  type ConcessionKind,
  type EngineConfig,
  type NegotiationResult,
} from "@domus-scope/engine";
import { negotiationOf, type AnalyticalData, type NegotiationData } from "../../../persistence/db";
import { type SimulationOutcome } from "../../../lib/assess";
import { formatEUR, formatPercent } from "../../../lib/format";
import { useLocale } from "../../../i18n";
import {
  Button,
  Card,
  LensTag,
  NumberField,
  PercentField,
  SelectField,
  WarningBadge,
} from "../../../components/ui";
import { InfoDot } from "../../../components/InfoDot";
import { TrashIcon } from "../../../components/Icons";

/**
 * Negotiation lens (Phase 8, FR-021…FR-023): reservation price with grey band
 * and stressed range, the ZOPA view against the asking price, and the
 * concession converter. Reads the simulation input; never feeds back into the
 * verdict (BR-024).
 */
export function NegotiationPanel({
  data,
  onChange,
  outcome,
  config,
}: {
  data: AnalyticalData;
  onChange: (data: AnalyticalData) => void;
  outcome: SimulationOutcome;
  config: EngineConfig;
}) {
  const { t } = useLocale();
  const nego = negotiationOf(data);
  const setNego = (patch: Partial<NegotiationData>) =>
    onChange({ ...data, negotiation: { ...nego, ...patch } });

  const anchor = data.property.marketValue ?? null;
  const anchorValue = anchor && anchor > 0 ? anchor : data.property.price;

  // The solvers are ~300 simulations; deferring keeps typing responsive.
  const deferredAsking = useDeferredValue(nego.askingPrice);
  const deferredDiscount = useDeferredValue(nego.typicalDiscount);
  const hasAsking = deferredAsking !== null && deferredAsking > 0;

  const result = useMemo(() => {
    if (!outcome.input) return null;
    // Without an asking price the anchor stands in, so the reservation card
    // still works; the window card renders only for a real asking price.
    return runNegotiation(
      outcome.input,
      {
        askingPrice: hasAsking ? deferredAsking : anchorValue,
        typicalDiscount: deferredDiscount,
        concessions: nego.concessions,
      },
      config,
    );
  }, [
    outcome.input,
    config,
    hasAsking,
    deferredAsking,
    anchorValue,
    deferredDiscount,
    nego.concessions,
  ]);

  return (
    <div className="space-y-4">
      <InputsCard
        nego={nego}
        setNego={setNego}
        anchorValue={anchorValue}
        anchorSet={anchor !== null}
      />
      {result ? <ReservationCard result={result} /> : null}
      {result && hasAsking ? (
        <WindowCard result={result} />
      ) : result ? (
        <Card className="p-4">
          <p className="text-sm text-ink-3">{t("negotiation.needAsking")}</p>
        </Card>
      ) : null}
      <ConcessionsCard
        nego={nego}
        setNego={setNego}
        monthlyRent={data.rentAlternative.equivalentMonthlyRent}
        reservationPrice={result?.reservation.price ?? null}
        adjusted={result?.concessions.adjustedReservationPrice ?? null}
      />
    </div>
  );
}

function InputsCard({
  nego,
  setNego,
  anchorValue,
  anchorSet,
}: {
  nego: NegotiationData;
  setNego: (patch: Partial<NegotiationData>) => void;
  anchorValue: number;
  anchorSet: boolean;
}) {
  const { t } = useLocale();
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("negotiation.inputs")}
        <InfoDot topic="zopa" />
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">{t("negotiation.inputsHint")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("negotiation.asking")}
          suffix={t("suffix.eur")}
          value={nego.askingPrice ?? Number.NaN}
          min={0}
          step={1_000}
          help="askingPrice"
          onChange={(v) => setNego({ askingPrice: Number.isFinite(v) && v > 0 ? v : null })}
        />
        <PercentField
          label={t("negotiation.typicalDiscount")}
          value={nego.typicalDiscount}
          step={0.5}
          help="typicalDiscount"
          onChange={(fraction) =>
            setNego({ typicalDiscount: Math.min(Math.max(fraction, 0), 0.5) })
          }
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <span>
          {t("negotiation.anchor", { value: formatEUR(anchorValue) })}{" "}
          <span className="text-ink-3">
            ({anchorSet ? t("negotiation.anchorSet") : t("negotiation.anchorDefault")})
          </span>
        </span>
        <InfoDot topic="marketValue" />
      </p>
    </Card>
  );
}

function ReservationCard({ result }: { result: NegotiationResult }) {
  const { t } = useLocale();
  const { reservation, indifferenceBand, stress } = result;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {t("negotiation.reservationTitle")}
          <InfoDot topic="reservationPrice" />
        </h3>
        <LensTag>{t("negotiation.reservationLens")}</LensTag>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">{t("negotiation.reservationHint")}</p>

      {reservation.price !== null ? (
        <div className="mt-3">
          <div className="text-[11px] font-medium text-ink-3">{t("negotiation.walkAway")}</div>
          <div className="nums text-2xl font-semibold tracking-tight text-ink">
            {formatEUR(reservation.price)}
          </div>
          <dl className="nums mt-2 space-y-1 text-xs text-ink-2">
            {indifferenceBand.clearBuyBelow !== null && indifferenceBand.clearRentAbove !== null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">{t("negotiation.greyZone")}</dt>
                <dd>
                  {formatEUR(indifferenceBand.clearBuyBelow)} –{" "}
                  {formatEUR(indifferenceBand.clearRentAbove)}
                </dd>
              </div>
            ) : null}
            {stress.pessimistic.price !== null && stress.optimistic.price !== null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">{t("negotiation.stressed")}</dt>
                <dd>
                  {t("negotiation.stressedRange", {
                    pessimistic: formatEUR(stress.pessimistic.price),
                    optimistic: formatEUR(stress.optimistic.price),
                  })}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-xs text-ink-3">{t("negotiation.stressedHint")}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          {reservation.status === "buyAlwaysWins"
            ? t("negotiation.buyAlwaysWins", { max: formatEUR(reservation.bounds.max) })
            : t("negotiation.rentAlwaysWins", { min: formatEUR(reservation.bounds.min) })}
        </p>
      )}
    </Card>
  );
}

function WindowCard({ result }: { result: NegotiationResult }) {
  const { t } = useLocale();
  const { window, asking, requiredDiscount } = result;
  const kindParams =
    window.range !== null
      ? { low: formatEUR(window.range.low), high: formatEUR(window.range.high) }
      : {};

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("negotiation.windowTitle")}
        <InfoDot topic="zopa" />
      </h3>
      <p className="mt-0.5 text-sm text-ink-2">
        {t(`negotiation.window.${window.kind}`, kindParams)}
      </p>
      <dl className="nums mt-2 space-y-1 text-xs text-ink-2">
        <div>{t("negotiation.expected", { value: formatEUR(asking.expectedPrice) })}</div>
        {requiredDiscount !== null ? (
          <div>
            {t("negotiation.requiredDiscount", { value: formatPercent(requiredDiscount, 1) })}
          </div>
        ) : null}
      </dl>

      <div className="mt-4">
        <ZopaBar result={result} />
      </div>

      {result.warnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {result.warnings.map((warning) => (
            <WarningBadge key={warning.id} id={warning.id} severity={warning.severity} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * One-dimensional price scale: verdict zones along the price axis (buy /
 * grey / rent), the asking and expected anchors above, the reservation
 * marker with its stress whisker below. Zone identity is carried by the
 * captions, never by color alone.
 */
function ZopaBar({ result }: { result: NegotiationResult }) {
  const { t } = useLocale();
  const { reservation, indifferenceBand, stress, asking } = result;

  const marks = [
    asking.price,
    asking.expectedPrice,
    reservation.price,
    indifferenceBand.clearBuyBelow,
    indifferenceBand.clearRentAbove,
    stress.pessimistic.price,
    stress.optimistic.price,
  ].filter((v): v is number => v !== null);
  if (marks.length === 0) return null;

  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const pad = Math.max((hi - lo) * 0.08, hi * 0.01);
  const min = Math.max(lo - pad, 0);
  const max = hi + pad;
  const x = (price: number): string => `${(((price - min) / (max - min)) * 100).toFixed(2)}%`;
  const xNum = (price: number): number => ((price - min) / (max - min)) * 100;
  const anchorFor = (price: number): "start" | "middle" | "end" => {
    const p = xNum(price);
    return p < 12 ? "start" : p > 88 ? "end" : "middle";
  };

  // Zone edges along the axis; a null reservation degenerates to one zone.
  const greyLow =
    indifferenceBand.clearBuyBelow ??
    (reservation.status === "buyAlwaysWins" ? max : (reservation.price ?? min));
  const greyHigh =
    indifferenceBand.clearRentAbove ??
    (reservation.status === "buyAlwaysWins" ? max : (reservation.price ?? min));

  const trackY = 44;
  const trackH = 12;

  return (
    <svg
      width="100%"
      height="118"
      role="img"
      aria-label={t("negotiation.bar.aria", {
        min: formatEUR(min),
        max: formatEUR(max),
        reservation: reservation.price !== null ? formatEUR(reservation.price) : "—",
      })}
    >
      {/* Asking anchor (row 1) */}
      <text
        x={x(asking.price)}
        y={10}
        textAnchor={anchorFor(asking.price)}
        fontSize={11}
        fill="var(--ds-ink-2)"
      >
        {t("negotiation.bar.asking")} {formatEUR(asking.price)}
      </text>
      <line
        x1={x(asking.price)}
        x2={x(asking.price)}
        y1={14}
        y2={trackY + trackH}
        stroke="var(--ds-ink-3)"
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />
      {/* Expected anchor (row 2) */}
      <text
        x={x(asking.expectedPrice)}
        y={28}
        textAnchor={anchorFor(asking.expectedPrice)}
        fontSize={11}
        fill="var(--ds-ink-2)"
      >
        {t("negotiation.bar.expected")} {formatEUR(asking.expectedPrice)}
      </text>
      <line
        x1={x(asking.expectedPrice)}
        x2={x(asking.expectedPrice)}
        y1={32}
        y2={trackY + trackH}
        stroke="var(--ds-ink-3)"
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />

      {/* Verdict zones (buy / grey / rent), 2px surface gaps at the seams */}
      <rect
        x="0"
        y={trackY}
        width={x(greyLow)}
        height={trackH}
        rx={3}
        fill="var(--ds-buy)"
        opacity={0.8}
      >
        <title>{t("verdict.BUY_MORTGAGE")}</title>
      </rect>
      {greyHigh > greyLow ? (
        <rect
          x={x(greyLow)}
          y={trackY}
          width={`${Math.max(xNum(greyHigh) - xNum(greyLow), 0).toFixed(2)}%`}
          height={trackH}
          rx={3}
          fill="var(--ds-greyzone)"
          opacity={0.35}
        >
          <title>
            {t("negotiation.bar.greyTitle", {
              low: formatEUR(greyLow),
              high: formatEUR(greyHigh),
            })}
          </title>
        </rect>
      ) : null}
      <rect
        x={x(greyHigh)}
        y={trackY}
        width={`${Math.max(100 - xNum(greyHigh), 0).toFixed(2)}%`}
        height={trackH}
        rx={3}
        fill="var(--ds-rent)"
        opacity={0.8}
      >
        <title>{t("verdict.RENT")}</title>
      </rect>
      <line
        x1={x(greyLow)}
        x2={x(greyLow)}
        y1={trackY - 1}
        y2={trackY + trackH + 1}
        stroke="var(--ds-surface)"
        strokeWidth={2}
      />
      <line
        x1={x(greyHigh)}
        x2={x(greyHigh)}
        y1={trackY - 1}
        y2={trackY + trackH + 1}
        stroke="var(--ds-surface)"
        strokeWidth={2}
      />

      {/* Stress whisker below the track */}
      {stress.pessimistic.price !== null && stress.optimistic.price !== null ? (
        <g stroke="var(--ds-ink-3)" strokeWidth={1.5}>
          <title>
            {t("negotiation.bar.stressTitle", {
              low: formatEUR(stress.pessimistic.price),
              high: formatEUR(stress.optimistic.price),
            })}
          </title>
          <line
            x1={x(stress.pessimistic.price)}
            x2={x(stress.optimistic.price)}
            y1={trackY + trackH + 8}
            y2={trackY + trackH + 8}
          />
          <line
            x1={x(stress.pessimistic.price)}
            x2={x(stress.pessimistic.price)}
            y1={trackY + trackH + 4}
            y2={trackY + trackH + 12}
          />
          <line
            x1={x(stress.optimistic.price)}
            x2={x(stress.optimistic.price)}
            y1={trackY + trackH + 4}
            y2={trackY + trackH + 12}
          />
        </g>
      ) : null}

      {/* Reservation marker */}
      {reservation.price !== null ? (
        <g>
          <line
            x1={x(reservation.price)}
            x2={x(reservation.price)}
            y1={trackY - 4}
            y2={trackY + trackH + 14}
            stroke="var(--ds-ink)"
            strokeWidth={2}
          />
          <text
            x={x(reservation.price)}
            y={trackY + trackH + 28}
            textAnchor={anchorFor(reservation.price)}
            fontSize={11}
            fontWeight={600}
            fill="var(--ds-ink)"
          >
            {t("negotiation.bar.reservation")} {formatEUR(reservation.price)}
          </text>
        </g>
      ) : null}

      {/* Zone captions: identity in text, never color alone */}
      <text x="0" y={114} fontSize={10} fill="var(--ds-ink-3)">
        {t("negotiation.bar.buySide")}
      </text>
      <text x="100%" y={114} textAnchor="end" fontSize={10} fill="var(--ds-ink-3)">
        {t("negotiation.bar.rentSide")}
      </text>
    </svg>
  );
}

const CONCESSION_KINDS: ConcessionKind[] = [
  "earlyPossession",
  "furniture",
  "remediation",
  "custom",
];

function ConcessionsCard({
  nego,
  setNego,
  monthlyRent,
  reservationPrice,
  adjusted,
}: {
  nego: NegotiationData;
  setNego: (patch: Partial<NegotiationData>) => void;
  monthlyRent: number;
  reservationPrice: number | null;
  adjusted: number | null;
}) {
  const { t } = useLocale();
  const [kind, setKind] = useState<ConcessionKind>("earlyPossession");
  const [direction, setDirection] = useState<Concession["direction"]>("youReceive");
  const [months, setMonths] = useState(3);
  const [amount, setAmount] = useState(Number.NaN);
  const [label, setLabel] = useState("");

  const computedAmount =
    kind === "earlyPossession" ? earlyPossessionEquivalent(monthlyRent, months) : amount;
  const canAdd = Number.isFinite(computedAmount) && computedAmount > 0;

  const add = () => {
    if (!canAdd) return;
    const concession: Concession = {
      id: crypto.randomUUID(),
      kind,
      direction,
      amount: computedAmount,
      label: label.trim() || t(`concession.${kind}`),
    };
    setNego({ concessions: [...nego.concessions, concession] });
    setLabel("");
  };

  const balance = concessionBalance(nego.concessions);

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("negotiation.concessionsTitle")}
        <InfoDot topic="concessions" />
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">{t("negotiation.concessionsHint")}</p>

      <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,6rem)_minmax(0,1fr)_auto]">
        <SelectField
          label={t("negotiation.concessionKind")}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as ConcessionKind;
            setKind(next);
            setDirection(next === "remediation" ? "youGive" : "youReceive");
          }}
        >
          {CONCESSION_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`concession.${k}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("negotiation.direction")}
          value={direction}
          onChange={(event) => setDirection(event.target.value as Concession["direction"])}
        >
          <option value="youReceive">{t("negotiation.youReceive")}</option>
          <option value="youGive">{t("negotiation.youGive")}</option>
        </SelectField>
        {kind === "earlyPossession" ? (
          <NumberField
            label={t("negotiation.months")}
            value={months}
            min={0}
            step={1}
            onChange={(v) => setMonths(Number.isFinite(v) && v >= 0 ? v : 0)}
          />
        ) : (
          <NumberField
            label={t("negotiation.amount")}
            suffix={t("suffix.eur")}
            value={amount}
            min={0}
            step={500}
            onChange={setAmount}
          />
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            {t("negotiation.labelField")}
          </span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
          />
        </label>
        <Button variant="primary" onClick={add} disabled={!canAdd}>
          {t("common.add")}
        </Button>
      </div>
      {kind === "earlyPossession" ? (
        <p className="nums mt-1 text-xs text-ink-3">
          {t("negotiation.monthsEquivalent", {
            months,
            rent: formatEUR(monthlyRent),
            value: formatEUR(computedAmount),
          })}
        </p>
      ) : null}

      {nego.concessions.length > 0 ? (
        <>
          <ul className="mt-4 space-y-2">
            {nego.concessions.map((concession) => (
              <li key={concession.id} className="flex items-center gap-2 text-sm">
                <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                  {t(`concession.${concession.kind}`)}
                </span>
                <span className="min-w-0 flex-1 text-ink-2">{concession.label}</span>
                <span className="nums shrink-0 text-xs text-ink-2">
                  {concession.direction === "youReceive" ? "+" : "−"}
                  {formatEUR(concession.amount)}{" "}
                  <span className="text-ink-3">
                    (
                    {concession.direction === "youReceive"
                      ? t("negotiation.youReceive")
                      : t("negotiation.youGive")}
                    )
                  </span>
                </span>
                <Button
                  variant="danger"
                  className="-my-1 px-1.5"
                  aria-label={t("negotiation.deleteConcession", { label: concession.label })}
                  onClick={() =>
                    setNego({
                      concessions: nego.concessions.filter((c) => c.id !== concession.id),
                    })
                  }
                >
                  <TrashIcon width={13} height={13} />
                </Button>
              </li>
            ))}
          </ul>
          <p className="nums mt-3 border-t border-hairline pt-2 text-sm text-ink-2">
            {t("negotiation.balance", { value: formatEUR(balance) })}
            {reservationPrice !== null && adjusted !== null ? (
              <strong className="ml-2 text-ink">
                {t("negotiation.adjustedWalkAway", { value: formatEUR(adjusted) })}
              </strong>
            ) : null}
          </p>
        </>
      ) : null}
    </Card>
  );
}
