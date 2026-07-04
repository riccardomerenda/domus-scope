import {
  assumptionPresets,
  frenchMonthlyPayment,
  resolveAssumptions,
  type EconomicAssumptions,
} from "@domus-scope/engine";
import { Link } from "react-router-dom";
import {
  type AnalyticalData,
  type AppConfig,
  type PartialAssumptions,
} from "../../../persistence/db";
import { formatEUR, formatPercent } from "../../../lib/format";
import { useLocale } from "../../../i18n";
import { type HelpTopicId } from "../../../i18n/help";
import {
  Card,
  NumberField,
  PercentField,
  Segmented,
  SelectField,
  ToggleField,
} from "../../../components/ui";
import { InfoDot } from "../../../components/InfoDot";
import { ProvenanceBadge } from "../../profile/ProfilePage";

export interface SectionProps {
  data: AnalyticalData;
  onChange: (next: AnalyticalData) => void;
}

function Section({
  title,
  hint,
  help,
  children,
}: {
  title: string;
  hint?: string;
  help?: HelpTopicId;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {title}
        {help ? <InfoDot topic={help} /> : null}
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function PropertySection({ data, onChange }: SectionProps) {
  const { t } = useLocale();
  const set = (patch: Partial<AnalyticalData["property"]>) =>
    onChange({ ...data, property: { ...data.property, ...patch } });
  return (
    <Section title={t("inputs.property")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("quick.price")}
          suffix={t("suffix.eur")}
          value={data.property.price}
          min={0}
          step={1_000}
          help="price"
          onChange={(v) => set({ price: v })}
        />
        <NumberField
          label={t("inputs.cadastral")}
          suffix={t("suffix.eur")}
          value={data.property.cadastralValue ?? Number.NaN}
          min={0}
          step={1_000}
          help="cadastralValue"
          onChange={(v) => set({ cadastralValue: Number.isFinite(v) ? v : null })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">{t("inputs.zone")}</span>
          <input
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
            value={data.property.zone}
            onChange={(event) => set({ zone: event.target.value })}
          />
        </label>
        <NumberField
          label={t("inputs.size")}
          suffix={t("suffix.sqm")}
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
  const { t } = useLocale();
  const principal = Math.max(data.property.price - data.downPayment, 0);
  const payment =
    data.financingKind === "mortgage" && principal > 0 && data.durationYears >= 1
      ? frenchMonthlyPayment(principal, data.annualRate / 12, data.durationYears * 12)
      : 0;
  const ltv = data.property.price > 0 ? principal / data.property.price : 0;

  return (
    <Section title={t("inputs.financing")} help="financingKind">
      <Segmented
        label={t("inputs.financing")}
        options={[
          { value: "mortgage", label: t("quick.mortgage") },
          { value: "cash", label: t("quick.cash") },
        ]}
        value={data.financingKind}
        onChange={(financingKind) => onChange({ ...data, financingKind })}
      />
      {data.financingKind === "mortgage" ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label={t("quick.downPayment")}
              suffix={t("suffix.eur")}
              value={data.downPayment}
              min={0}
              step={5_000}
              help="downPayment"
              onChange={(v) => onChange({ ...data, downPayment: v })}
            />
            <PercentField
              label={t("quick.rate")}
              value={data.annualRate}
              help="rateTAN"
              onChange={(annualRate) => onChange({ ...data, annualRate })}
            />
            <NumberField
              label={t("quick.duration")}
              suffix={t("suffix.years")}
              value={data.durationYears}
              min={1}
              step={1}
              help="durationYears"
              onChange={(v) => onChange({ ...data, durationYears: v })}
            />
          </div>
          <p className="nums text-xs text-ink-3">
            {t("inputs.paymentLine", {
              amount: formatEUR(principal),
              ltv: formatPercent(ltv, 0),
              payment: formatEUR(payment),
            })}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">{t("inputs.cashNote")}</p>
      )}
    </Section>
  );
}

export function RentSection({ data, onChange }: SectionProps) {
  const { t } = useLocale();
  const set = (patch: Partial<AnalyticalData["rentAlternative"]>) =>
    onChange({ ...data, rentAlternative: { ...data.rentAlternative, ...patch } });
  return (
    <Section title={t("inputs.rent")} hint={t("inputs.rentHint")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("inputs.equivalentRent")}
          suffix={t("suffix.eurPerMonth")}
          value={data.rentAlternative.equivalentMonthlyRent}
          min={0}
          step={50}
          help="equivalentRent"
          onChange={(v) => set({ equivalentMonthlyRent: v })}
        />
        <NumberField
          label={t("inputs.currentRent")}
          suffix={t("suffix.eurPerMonth")}
          value={data.rentAlternative.currentMonthlyRent ?? Number.NaN}
          min={0}
          step={50}
          help="currentRent"
          onChange={(v) => set({ currentMonthlyRent: Number.isFinite(v) ? v : null })}
        />
      </div>
      <div className="mt-3">
        <SelectField
          label={t("inputs.comparability")}
          value={data.rentAlternative.comparability}
          help="comparability"
          onChange={(event) =>
            set({
              comparability: event.target
                .value as AnalyticalData["rentAlternative"]["comparability"],
            })
          }
        >
          <option value="high">{t("comparability.high")}</option>
          <option value="medium">{t("comparability.medium")}</option>
          <option value="low">{t("comparability.low.analytical")}</option>
        </SelectField>
      </div>
    </Section>
  );
}

const ASSUMPTION_FIELDS: { key: keyof EconomicAssumptions; help: HelpTopicId }[] = [
  { key: "alternativeReturn", help: "alternativeReturn" },
  { key: "homeAppreciation", help: "homeAppreciation" },
  { key: "rentGrowth", help: "rentGrowth" },
  { key: "inflation", help: "inflation" },
  { key: "capitalGainsTax", help: "capitalGainsTax" },
  { key: "maintenanceRate", help: "maintenanceRate" },
  { key: "recurringTaxRate", help: "recurringTaxRate" },
];

export function AssumptionsSection({
  data,
  onChange,
  appConfig,
}: SectionProps & { appConfig: AppConfig }) {
  const { t } = useLocale();
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
      title={t("inputs.assumptions")}
      hint={t("inputs.assumptionsHint")}
      help="assumptionPreset"
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {Object.values(assumptionPresets).map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={t(`preset.${preset.id}.desc`)}
            onClick={() => onChange({ ...data, assumptions: { ...preset.values } })}
            className="cursor-pointer rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            {t(`preset.${preset.id}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...data, assumptions: {} })}
          className="cursor-pointer rounded-full border border-hairline px-2.5 py-0.5 text-xs text-ink-3 transition-colors hover:text-ink"
        >
          {t("inputs.clearOverrides")}
        </button>
        <Link
          to="/profile"
          className="ml-auto text-xs text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("inputs.editGlobal")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ASSUMPTION_FIELDS.map(({ key, help }) => {
          const source = resolved.provenance[key];
          return (
            <div key={key}>
              <PercentField
                label={t(`assumption.${key}`)}
                value={resolved.values[key]}
                help={help}
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
                    {t("inputs.inherit")}
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
  const { t } = useLocale();
  return (
    <Section title={t("inputs.simulation")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <NumberField
            label={t("quick.horizon")}
            suffix={t("suffix.years")}
            value={data.horizonYears}
            min={1}
            step={1}
            help="horizon"
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
          label={t("inputs.sellingCosts")}
          value={data.sellingCostRate}
          help="sellingCostRate"
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
  const { t } = useLocale();
  return (
    <Section
      title={t("inputs.constraints")}
      hint={t("inputs.constraintsHint")}
      help="profileEnabled"
    >
      <ToggleField
        label={t("inputs.profileToggle", {
          liquidity: formatEUR(appConfig.profile.liquidity),
          fund: formatEUR(appConfig.profile.emergencyFund),
        })}
        checked={data.profileEnabled}
        onChange={(profileEnabled) => onChange({ ...data, profileEnabled })}
      />
      <p className="mt-2 text-xs text-ink-3">
        {t("inputs.editAmountsIn")}{" "}
        <Link
          to="/profile"
          className="underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("nav.profile")}
        </Link>
        .
      </p>
    </Section>
  );
}
