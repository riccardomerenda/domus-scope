import { assumptionPresets, type AssumptionPresetId } from "@domus-scope/engine";
import { type QuickData } from "../../persistence/db";
import { formatEUR, formatPercent } from "../../lib/format";
import { useLocale } from "../../i18n";
import {
  Card,
  NumberField,
  PercentField,
  Segmented,
  SelectField,
  ToggleField,
} from "../../components/ui";

const HORIZON_PRESETS = [5, 10, 20, 30];

export function QuickForm({
  value,
  onChange,
}: {
  value: QuickData;
  onChange: (next: QuickData) => void;
}) {
  const { t } = useLocale();
  const set = <K extends keyof QuickData>(key: K, fieldValue: QuickData[K]) =>
    onChange({ ...value, [key]: fieldValue });

  const ltv =
    value.propertyPrice > 0 ? (value.propertyPrice - value.downPayment) / value.propertyPrice : 0;

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">{t("quick.inputs")}</h2>
      <div className="space-y-4">
        <NumberField
          label={t("quick.price")}
          suffix={t("suffix.eur")}
          value={value.propertyPrice}
          min={0}
          step={1_000}
          help="price"
          onChange={(v) => set("propertyPrice", v)}
        />
        <NumberField
          label={t("quick.equivalentRent")}
          suffix={t("suffix.eurPerMonth")}
          value={value.equivalentMonthlyRent}
          min={0}
          step={50}
          help="equivalentRent"
          onChange={(v) => set("equivalentMonthlyRent", v)}
        />

        <div>
          <NumberField
            label={t("quick.horizon")}
            suffix={t("suffix.years")}
            value={value.horizonYears}
            min={1}
            step={1}
            help="horizon"
            onChange={(v) => set("horizonYears", v)}
          />
          <div className="mt-1.5 flex gap-1.5">
            {HORIZON_PRESETS.map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => set("horizonYears", years)}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  value.horizonYears === years
                    ? "border-ink bg-ink text-page"
                    : "border-hairline text-ink-2 hover:border-ink-3"
                }`}
              >
                {years}y
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            {t("quick.financing")}
          </span>
          <Segmented
            label={t("quick.financing")}
            options={[
              { value: "mortgage", label: t("quick.mortgage") },
              { value: "cash", label: t("quick.cash") },
            ]}
            value={value.financingKind}
            onChange={(kind) => set("financingKind", kind)}
          />
        </div>

        {value.financingKind === "mortgage" ? (
          <div className="space-y-4 rounded-lg border border-hairline p-3">
            <NumberField
              label={t("quick.downPayment")}
              suffix={t("suffix.eur")}
              value={value.downPayment}
              min={0}
              step={5_000}
              help="downPayment"
              onChange={(v) => set("downPayment", v)}
            />
            <p className="nums -mt-2 text-xs text-ink-3">
              {t("quick.ltvLine", {
                ltv: formatPercent(ltv, 0),
                amount: formatEUR(Math.max(value.propertyPrice - value.downPayment, 0)),
              })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <PercentField
                label={t("quick.rate")}
                value={value.annualRate}
                help="rateTAN"
                onChange={(annualRate) => set("annualRate", annualRate)}
              />
              <NumberField
                label={t("quick.duration")}
                suffix={t("suffix.years")}
                value={value.durationYears}
                min={1}
                step={1}
                help="durationYears"
                onChange={(v) => set("durationYears", v)}
              />
            </div>
          </div>
        ) : null}

        <SelectField
          label={t("quick.comparability")}
          value={value.comparability}
          help="comparability"
          onChange={(event) =>
            set("comparability", event.target.value as QuickData["comparability"])
          }
        >
          <option value="high">{t("comparability.high")}</option>
          <option value="medium">{t("comparability.medium")}</option>
          <option value="low">{t("comparability.low")}</option>
        </SelectField>

        <SelectField
          label={t("quick.preset")}
          value={value.assumptionPreset}
          help="assumptionPreset"
          onChange={(event) => set("assumptionPreset", event.target.value as AssumptionPresetId)}
        >
          {Object.values(assumptionPresets).map((preset) => (
            <option key={preset.id} value={preset.id}>
              {t("preset.optionSummary", {
                label: t(`preset.${preset.id}`),
                rents: formatPercent(preset.values.rentGrowth ?? 0, 0),
                home: formatPercent(preset.values.homeAppreciation ?? 0, 1),
                returns: formatPercent(preset.values.alternativeReturn ?? 0, 1),
              })}
            </option>
          ))}
        </SelectField>

        <div className="space-y-3 rounded-lg border border-hairline p-3">
          <div className="flex items-center gap-1.5">
            <ToggleField
              label={t("quick.liquidityCheck")}
              checked={value.liquidityEnabled}
              onChange={(checked) => set("liquidityEnabled", checked)}
            />
          </div>
          {value.liquidityEnabled ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={t("quick.liquidityAvailable")}
                suffix={t("suffix.eur")}
                value={value.liquidityAvailable}
                min={0}
                step={5_000}
                help="liquidityCheck"
                onChange={(v) => set("liquidityAvailable", v)}
              />
              <NumberField
                label={t("quick.emergencyFund")}
                suffix={t("suffix.eur")}
                value={value.emergencyFund}
                min={0}
                step={1_000}
                help="emergencyFund"
                onChange={(v) => set("emergencyFund", v)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
