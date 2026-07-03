import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  assumptionPresets,
  defaultAssumptions,
  resolveAssumptions,
  type EconomicAssumptions,
} from "@domus-scope/engine";
import {
  db,
  defaultAppConfig,
  updateAppConfig,
  type AppConfig,
  type PartialAssumptions,
} from "../../persistence/db";
import { formatPercent } from "../../lib/format";
import { Button, Card, NumberField, PercentField } from "../../components/ui";
import { CloseIcon, PlusIcon, TrashIcon } from "../../components/Icons";

const ASSUMPTION_FIELDS: { key: keyof EconomicAssumptions; label: string }[] = [
  { key: "alternativeReturn", label: "Alternative return (net, r_alt)" },
  { key: "homeAppreciation", label: "Home appreciation (g)" },
  { key: "rentGrowth", label: "Rent growth" },
  { key: "inflation", label: "Inflation" },
  { key: "capitalGainsTax", label: "Capital gains tax" },
  { key: "maintenanceRate", label: "Maintenance (% of value / year)" },
  { key: "recurringTaxRate", label: "Recurring ownership taxes (% of value / year)" },
];

export function ProfilePage() {
  const stored = useLiveQuery(() => db.appConfig.get("app"), []);
  if (stored === undefined) return null;
  const config = stored ?? defaultAppConfig;
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Profile & Assumptions</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Your personal constraints and the global assumption layer every scenario inherits
          (scenarios can still override each value).
        </p>
      </div>
      <ProfileCard config={config} />
      <GlobalAssumptionsCard config={config} />
      <PresetsCard config={config} />
    </div>
  );
}

function ProfileCard({ config }: { config: AppConfig }) {
  const { profile } = config;
  const set = (patch: Partial<AppConfig["profile"]>) =>
    void updateAppConfig({ profile: { ...profile, ...patch } });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Personal profile (FR-002)</h2>
      <p className="mt-1 text-xs text-ink-3">
        Used by the liquidity warnings: buying must not push you below your emergency fund (BR-006).
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Available savings"
          suffix="€"
          value={profile.liquidity}
          min={0}
          step={5_000}
          onChange={(v) => set({ liquidity: v })}
        />
        <NumberField
          label="Emergency fund (minimum)"
          suffix="€"
          value={profile.emergencyFund}
          min={0}
          step={1_000}
          onChange={(v) => set({ emergencyFund: v })}
        />
        <NumberField
          label="Current rent (informative)"
          suffix="€/mo"
          value={profile.currentMonthlyRent ?? Number.NaN}
          min={0}
          step={50}
          onChange={(v) => set({ currentMonthlyRent: Number.isFinite(v) ? v : null })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">City</span>
          <input
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
            value={profile.city}
            onChange={(event) => set({ city: event.target.value })}
          />
        </label>
      </div>
    </Card>
  );
}

function GlobalAssumptionsCard({ config }: { config: AppConfig }) {
  const resolved = resolveAssumptions(config.globalAssumptions);

  const setValue = (key: keyof EconomicAssumptions, fraction: number) => {
    const next: PartialAssumptions = { ...config.globalAssumptions };
    if (Number.isFinite(fraction)) next[key] = fraction;
    void updateAppConfig({ globalAssumptions: next });
  };
  const clearValue = (key: keyof EconomicAssumptions) => {
    const next: PartialAssumptions = { ...config.globalAssumptions };
    delete next[key];
    void updateAppConfig({ globalAssumptions: next });
  };

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Global assumptions</h2>
      <p className="mt-1 text-xs text-ink-3">
        Values you set here override the engine defaults (NFR-005: provenance is always shown).
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ASSUMPTION_FIELDS.map(({ key, label }) => {
          const source = resolved.provenance[key];
          return (
            <div key={key}>
              <PercentField
                label={label}
                value={resolved.values[key]}
                onChange={(fraction) => setValue(key, fraction)}
              />
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <ProvenanceBadge source={source} />
                {source === "global" ? (
                  <button
                    type="button"
                    onClick={() => clearValue(key)}
                    className="cursor-pointer text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
                  >
                    reset to default ({formatPercent(defaultAssumptions[key], 2)})
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ProvenanceBadge({ source }: { source: "engine-default" | "global" | "scenario" }) {
  const meta =
    source === "scenario"
      ? { label: "scenario override", className: "border-cash/40 text-cash" }
      : source === "global"
        ? { label: "your global value", className: "border-rent/40 text-rent" }
        : { label: "engine default", className: "border-hairline text-ink-3" };
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function PresetsCard({ config }: { config: AppConfig }) {
  const [newLabel, setNewLabel] = useState("");

  const applyPreset = (values: PartialAssumptions) =>
    void updateAppConfig({ globalAssumptions: { ...values } });

  const saveCurrentAsPreset = () => {
    const label = newLabel.trim();
    if (!label) return;
    void updateAppConfig({
      userPresets: [
        ...config.userPresets,
        { id: crypto.randomUUID(), label, values: { ...config.globalAssumptions } },
      ],
    });
    setNewLabel("");
  };

  const deletePreset = (id: string) =>
    void updateAppConfig({ userPresets: config.userPresets.filter((p) => p.id !== id) });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Assumption presets (FR-018)</h2>
      <p className="mt-1 text-xs text-ink-3">
        Presets are starting points, not predictions. Applying one replaces the global layer.
      </p>

      <div className="mt-3 space-y-2">
        {Object.values(assumptionPresets).map((preset) => (
          <div
            key={preset.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium text-ink">{preset.label}</div>
              <div className="text-xs text-ink-3">{preset.description}</div>
            </div>
            <Button onClick={() => applyPreset(preset.values)}>Apply</Button>
          </div>
        ))}
        {config.userPresets.map((preset) => (
          <div
            key={preset.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium text-ink">{preset.label}</div>
              <div className="nums text-xs text-ink-3">
                {Object.entries(preset.values)
                  .flatMap(([key, value]) =>
                    value === undefined ? [] : [`${key} ${formatPercent(value, 1)}`],
                  )
                  .join(" · ") || "empty (engine defaults)"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={() => applyPreset(preset.values)}>Apply</Button>
              <Button
                variant="danger"
                className="px-2"
                aria-label={`Delete preset ${preset.label}`}
                onClick={() => deletePreset(preset.id)}
              >
                <TrashIcon width={14} height={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Preset name…"
          aria-label="New preset name"
          className="w-48 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
        />
        <Button onClick={saveCurrentAsPreset} disabled={newLabel.trim() === ""}>
          <PlusIcon /> Save current as preset
        </Button>
        {newLabel ? (
          <Button className="px-2" aria-label="Clear preset name" onClick={() => setNewLabel("")}>
            <CloseIcon width={14} height={14} />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
