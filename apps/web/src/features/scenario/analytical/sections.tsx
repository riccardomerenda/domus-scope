import {
  assumptionPresets,
  frenchMonthlyPayment,
  resolveAssumptions,
  type EconomicAssumptions,
} from "@domus-scope/engine";
import {
  type AnalyticalData,
  type AppConfig,
  type PartialAssumptions,
} from "../../../persistence/db";
import { formatEUR, formatPercent } from "../../../lib/format";
import {
  Card,
  NumberField,
  PercentField,
  Segmented,
  SelectField,
  ToggleField,
} from "../../../components/ui";
import { ProvenanceBadge } from "../../profile/ProfilePage";
import { Link } from "react-router-dom";

export interface SectionProps {
  data: AnalyticalData;
  onChange: (next: AnalyticalData) => void;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function PropertySection({ data, onChange }: SectionProps) {
  const set = (patch: Partial<AnalyticalData["property"]>) =>
    onChange({ ...data, property: { ...data.property, ...patch } });
  return (
    <Section title="Property">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Price"
          suffix="€"
          value={data.property.price}
          min={0}
          step={1_000}
          onChange={(v) => set({ price: v })}
        />
        <NumberField
          label="Cadastral value (registration tax basis)"
          suffix="€"
          value={data.property.cadastralValue ?? Number.NaN}
          min={0}
          step={1_000}
          onChange={(v) => set({ cadastralValue: Number.isFinite(v) ? v : null })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Zone</span>
          <input
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
            value={data.property.zone}
            onChange={(event) => set({ zone: event.target.value })}
          />
        </label>
        <NumberField
          label="Size"
          suffix="m²"
          value={data.property.sizeSqm ?? Number.NaN}
          min={0}
          step={5}
          onChange={(v) => set({ sizeSqm: Number.isFinite(v) && v > 0 ? v : null })}
        />
      </div>
    </Section>
  );
}

export function FinancingSection({ data, onChange }: SectionProps) {
  const principal = Math.max(data.property.price - data.downPayment, 0);
  const payment =
    data.financingKind === "mortgage" && principal > 0 && data.durationYears >= 1
      ? frenchMonthlyPayment(principal, data.annualRate / 12, data.durationYears * 12)
      : 0;
  const ltv = data.property.price > 0 ? principal / data.property.price : 0;

  return (
    <Section title="Financing">
      <Segmented
        label="Financing"
        options={[
          { value: "mortgage", label: "Mortgage" },
          { value: "cash", label: "Cash" },
        ]}
        value={data.financingKind}
        onChange={(financingKind) => onChange({ ...data, financingKind })}
      />
      {data.financingKind === "mortgage" ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Down payment"
              suffix="€"
              value={data.downPayment}
              min={0}
              step={5_000}
              onChange={(v) => onChange({ ...data, downPayment: v })}
            />
            <PercentField
              label="Rate (TAN)"
              value={data.annualRate}
              onChange={(annualRate) => onChange({ ...data, annualRate })}
            />
            <NumberField
              label="Duration"
              suffix="years"
              value={data.durationYears}
              min={1}
              step={1}
              onChange={(v) => onChange({ ...data, durationYears: v })}
            />
          </div>
          <p className="nums text-xs text-ink-3">
            Mortgage {formatEUR(principal)} · LTV {formatPercent(ltv, 0)} · payment ≈{" "}
            <span className="font-medium text-ink-2">{formatEUR(payment)}/mo</span> (exact schedule)
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">
          The full price is paid upfront: no interest, but the whole capital carries opportunity
          cost (BR-014).
        </p>
      )}
    </Section>
  );
}

export function RentSection({ data, onChange }: SectionProps) {
  const set = (patch: Partial<AnalyticalData["rentAlternative"]>) =>
    onChange({ ...data, rentAlternative: { ...data.rentAlternative, ...patch } });
  return (
    <Section
      title="Rent alternative"
      hint="Compare against the rent of a genuinely comparable home — not necessarily what you pay today (FR-004)."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Equivalent monthly rent"
          suffix="€/mo"
          value={data.rentAlternative.equivalentMonthlyRent}
          min={0}
          step={50}
          onChange={(v) => set({ equivalentMonthlyRent: v })}
        />
        <NumberField
          label="Your current rent (informative)"
          suffix="€/mo"
          value={data.rentAlternative.currentMonthlyRent ?? Number.NaN}
          min={0}
          step={50}
          onChange={(v) => set({ currentMonthlyRent: Number.isFinite(v) ? v : null })}
        />
      </div>
      <div className="mt-3">
        <SelectField
          label="Comparability"
          value={data.rentAlternative.comparability}
          onChange={(event) =>
            set({
              comparability: event.target
                .value as AnalyticalData["rentAlternative"]["comparability"],
            })
          }
        >
          <option value="high">High — same zone, size and quality</option>
          <option value="medium">Medium — close enough</option>
          <option value="low">Low — different home (verdict becomes indicative, BR-022)</option>
        </SelectField>
      </div>
    </Section>
  );
}

const ASSUMPTION_FIELDS: { key: keyof EconomicAssumptions; label: string }[] = [
  { key: "alternativeReturn", label: "Alternative return (r_alt)" },
  { key: "homeAppreciation", label: "Home appreciation (g)" },
  { key: "rentGrowth", label: "Rent growth" },
  { key: "inflation", label: "Inflation" },
  { key: "capitalGainsTax", label: "Capital gains tax" },
  { key: "maintenanceRate", label: "Maintenance (% value/yr)" },
  { key: "recurringTaxRate", label: "Ownership taxes (% value/yr)" },
];

export function AssumptionsSection({
  data,
  onChange,
  appConfig,
}: SectionProps & { appConfig: AppConfig }) {
  const resolved = resolveAssumptions(appConfig.globalAssumptions, data.assumptions);

  const setOverride = (key: keyof EconomicAssumptions, fraction: number) => {
    const next: PartialAssumptions = { ...data.assumptions };
    if (Number.isFinite(fraction)) next[key] = fraction;
    onChange({ ...data, assumptions: next });
  };
  const clearOverride = (key: keyof EconomicAssumptions) => {
    const next: PartialAssumptions = { ...data.assumptions };
    delete next[key];
    onChange({ ...data, assumptions: next });
  };

  return (
    <Section
      title="Assumptions"
      hint="Effective values with their provenance (NFR-005). Editing a field creates a scenario override; inherited values come from your global layer or the engine defaults."
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {Object.values(assumptionPresets).map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            onClick={() => onChange({ ...data, assumptions: { ...preset.values } })}
            className="cursor-pointer rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...data, assumptions: {} })}
          className="cursor-pointer rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-3 transition-colors hover:text-ink"
        >
          Clear overrides
        </button>
        <Link
          to="/profile"
          className="ml-auto text-xs text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Edit global layer →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ASSUMPTION_FIELDS.map(({ key, label }) => {
          const source = resolved.provenance[key];
          return (
            <div key={key}>
              <PercentField
                label={label}
                value={resolved.values[key]}
                onChange={(fraction) => setOverride(key, fraction)}
              />
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <ProvenanceBadge source={source} />
                {source === "scenario" ? (
                  <button
                    type="button"
                    onClick={() => clearOverride(key)}
                    className="cursor-pointer text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
                  >
                    inherit
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const HORIZON_PRESETS = [5, 10, 20, 30];

export function SimulationSection({ data, onChange }: SectionProps) {
  return (
    <Section title="Simulation">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <NumberField
            label="Horizon"
            suffix="years"
            value={data.horizonYears}
            min={1}
            step={1}
            onChange={(v) => onChange({ ...data, horizonYears: v })}
          />
          <div className="mt-1.5 flex gap-1.5">
            {HORIZON_PRESETS.map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => onChange({ ...data, horizonYears: years })}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  data.horizonYears === years
                    ? "border-ink bg-ink text-page"
                    : "border-hairline text-ink-2 hover:border-ink-3"
                }`}
              >
                {years}y
              </button>
            ))}
          </div>
        </div>
        <PercentField
          label="Selling costs (liquidation basis, W7)"
          value={data.sellingCostRate}
          onChange={(sellingCostRate) => onChange({ ...data, sellingCostRate })}
        />
      </div>
    </Section>
  );
}

export function ConstraintsSection({
  data,
  onChange,
  appConfig,
}: SectionProps & { appConfig: AppConfig }) {
  return (
    <Section
      title="Personal constraints"
      hint="Liquidity warnings compare the initial outlay (down payment + one-time costs) with your emergency fund (FR-015)."
    >
      <ToggleField
        label={`Check liquidity against my profile (${formatEUR(appConfig.profile.liquidity)} available, ${formatEUR(appConfig.profile.emergencyFund)} fund)`}
        checked={data.profileEnabled}
        onChange={(profileEnabled) => onChange({ ...data, profileEnabled })}
      />
      <p className="mt-2 text-xs text-ink-3">
        Edit the amounts in{" "}
        <Link
          to="/profile"
          className="underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Profile & Assumptions
        </Link>
        .
      </p>
    </Section>
  );
}
