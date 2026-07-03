import { assumptionPresets, type AssumptionPresetId } from "@domus-scope/engine";
import { type QuickData } from "../../persistence/db";
import { formatPercent } from "../../lib/format";
import { Card, NumberField, Segmented, SelectField, ToggleField } from "../../components/ui";

const HORIZON_PRESETS = [5, 10, 20, 30];

/** Displays a stored fraction as a percentage number without float dust. */
function toPercentDisplay(fraction: number): number {
  return Math.round(fraction * 10_000) / 100;
}

export function QuickForm({
  value,
  onChange,
}: {
  value: QuickData;
  onChange: (next: QuickData) => void;
}) {
  const set = <K extends keyof QuickData>(key: K, fieldValue: QuickData[K]) =>
    onChange({ ...value, [key]: fieldValue });

  const ltv =
    value.propertyPrice > 0 ? (value.propertyPrice - value.downPayment) / value.propertyPrice : 0;

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">Inputs</h2>
      <div className="space-y-4">
        <NumberField
          label="Property price"
          suffix="€"
          value={value.propertyPrice}
          min={0}
          step={1_000}
          onChange={(v) => set("propertyPrice", v)}
        />
        <NumberField
          label="Equivalent monthly rent (a truly comparable home, FR-004)"
          suffix="€/mo"
          value={value.equivalentMonthlyRent}
          min={0}
          step={50}
          onChange={(v) => set("equivalentMonthlyRent", v)}
        />

        <div>
          <NumberField
            label="Horizon"
            suffix="years"
            value={value.horizonYears}
            min={1}
            step={1}
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
          <span className="mb-1 block text-xs font-medium text-ink-2">Financing</span>
          <Segmented
            label="Financing"
            options={[
              { value: "mortgage", label: "Mortgage" },
              { value: "cash", label: "Cash" },
            ]}
            value={value.financingKind}
            onChange={(kind) => set("financingKind", kind)}
          />
        </div>

        {value.financingKind === "mortgage" ? (
          <div className="space-y-4 rounded-lg border border-hairline p-3">
            <NumberField
              label="Down payment"
              suffix="€"
              value={value.downPayment}
              min={0}
              step={5_000}
              onChange={(v) => set("downPayment", v)}
            />
            <p className="nums -mt-2 text-xs text-ink-3">
              Loan-to-value: {formatPercent(ltv, 0)} · mortgage{" "}
              {new Intl.NumberFormat("it-IT", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(Math.max(value.propertyPrice - value.downPayment, 0))}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Rate (TAN)"
                suffix="%"
                value={toPercentDisplay(value.annualRate)}
                min={0}
                step={0.05}
                onChange={(v) => set("annualRate", v / 100)}
              />
              <NumberField
                label="Duration"
                suffix="years"
                value={value.durationYears}
                min={1}
                step={1}
                onChange={(v) => set("durationYears", v)}
              />
            </div>
          </div>
        ) : null}

        <SelectField
          label="How comparable is the rent to this property?"
          value={value.comparability}
          onChange={(event) =>
            set("comparability", event.target.value as QuickData["comparability"])
          }
        >
          <option value="high">High — same zone, size and quality</option>
          <option value="medium">Medium — close enough</option>
          <option value="low">Low — different home (verdict becomes indicative)</option>
        </SelectField>

        <SelectField
          label="Assumptions preset"
          value={value.assumptionPreset}
          onChange={(event) => set("assumptionPreset", event.target.value as AssumptionPresetId)}
        >
          {Object.values(assumptionPresets).map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} — rents {formatPercent(preset.values.rentGrowth ?? 0, 0)}, home{" "}
              {formatPercent(preset.values.homeAppreciation ?? 0, 1)}, returns{" "}
              {formatPercent(preset.values.alternativeReturn ?? 0, 1)}
            </option>
          ))}
        </SelectField>

        <div className="space-y-3 rounded-lg border border-hairline p-3">
          <ToggleField
            label="Check my liquidity (BR-006)"
            checked={value.liquidityEnabled}
            onChange={(checked) => set("liquidityEnabled", checked)}
          />
          {value.liquidityEnabled ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Available savings"
                suffix="€"
                value={value.liquidityAvailable}
                min={0}
                step={5_000}
                onChange={(v) => set("liquidityAvailable", v)}
              />
              <NumberField
                label="Emergency fund"
                suffix="€"
                value={value.emergencyFund}
                min={0}
                step={1_000}
                onChange={(v) => set("emergencyFund", v)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
