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
  mergeAppConfig,
  updateAppConfig,
  QUALITATIVE_FACTORS,
  type AppConfig,
  type PartialAssumptions,
} from "../../persistence/db";
import { formatPercent } from "../../lib/format";
import { useLocale } from "../../i18n";
import { type HelpTopicId } from "../../i18n/help";
import { Button, Card, NumberField, PercentField } from "../../components/ui";
import { InfoDot } from "../../components/InfoDot";
import { CloseIcon, PlusIcon, TrashIcon } from "../../components/Icons";

const ASSUMPTION_KEYS: (keyof EconomicAssumptions & HelpTopicId)[] = [
  "alternativeReturn",
  "homeAppreciation",
  "rentGrowth",
  "inflation",
  "capitalGainsTax",
  "maintenanceRate",
  "recurringTaxRate",
];

export function ProfilePage() {
  const { t } = useLocale();
  // undefined = loading; null = nothing stored yet (render the defaults —
  // the first edit creates the record via updateAppConfig).
  const stored = useLiveQuery(async () => (await db.appConfig.get("app")) ?? null, []);
  if (stored === undefined) return null;
  const config = mergeAppConfig(stored);
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("profile.title")}</h1>
        <p className="mt-0.5 text-sm text-ink-2">{t("profile.subtitle")}</p>
      </div>
      <ProfileCard config={config} />
      <GlobalAssumptionsCard config={config} />
      <PresetsCard config={config} />
      <WeightsCard config={config} />
    </div>
  );
}

function WeightsCard({ config }: { config: AppConfig }) {
  const { t } = useLocale();
  const setWeight = (factor: (typeof QUALITATIVE_FACTORS)[number], value: number) =>
    void updateAppConfig({
      qualitativeWeights: { ...config.qualitativeWeights, [factor]: value },
    });

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("profile.weights")}
        <InfoDot topic="weights" />
      </h2>
      <p className="mt-1 text-xs text-ink-3">{t("profile.weightsHint")}</p>
      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {QUALITATIVE_FACTORS.map((factor) => (
          <label key={factor} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-2">
              {t(`factor.${factor}`)}
              <span className="nums text-ink-3">{config.qualitativeWeights[factor]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={config.qualitativeWeights[factor]}
              onChange={(event) => setWeight(factor, Number(event.target.value))}
              className="w-full accent-ink"
            />
          </label>
        ))}
      </div>
    </Card>
  );
}

function ProfileCard({ config }: { config: AppConfig }) {
  const { t } = useLocale();
  const { profile } = config;
  const set = (patch: Partial<AppConfig["profile"]>) =>
    void updateAppConfig({ profile: { ...profile, ...patch } });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">{t("profile.personal")}</h2>
      <p className="mt-1 text-xs text-ink-3">{t("profile.personalHint")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("profile.liquidity")}
          suffix={t("suffix.eur")}
          value={profile.liquidity}
          min={0}
          step={5_000}
          help="liquidityCheck"
          onChange={(v) => set({ liquidity: v })}
        />
        <NumberField
          label={t("profile.fund")}
          suffix={t("suffix.eur")}
          value={profile.emergencyFund}
          min={0}
          step={1_000}
          help="emergencyFund"
          onChange={(v) => set({ emergencyFund: v })}
        />
        <NumberField
          label={t("profile.currentRent")}
          suffix={t("suffix.eurPerMonth")}
          value={profile.currentMonthlyRent ?? Number.NaN}
          min={0}
          step={50}
          help="currentRent"
          onChange={(v) => set({ currentMonthlyRent: Number.isFinite(v) ? v : null })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">{t("profile.city")}</span>
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
  const { t } = useLocale();
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
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("profile.global")}
        <InfoDot topic="provenance" />
      </h2>
      <p className="mt-1 text-xs text-ink-3">{t("profile.globalHint")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ASSUMPTION_KEYS.map((key) => {
          const source = resolved.provenance[key];
          return (
            <div key={key}>
              <PercentField
                label={t(`assumption.${key}`)}
                value={resolved.values[key]}
                help={key}
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
                    {t("profile.resetDefault", {
                      value: formatPercent(defaultAssumptions[key], 2),
                    })}
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
  const { t } = useLocale();
  const className =
    source === "scenario"
      ? "border-cash/40 text-cash"
      : source === "global"
        ? "border-rent/40 text-rent"
        : "border-hairline text-ink-3";
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {t(`provenance.${source}`)}
    </span>
  );
}

function PresetsCard({ config }: { config: AppConfig }) {
  const { t } = useLocale();
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
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {t("profile.presets")}
        <InfoDot topic="assumptionPreset" />
      </h2>
      <p className="mt-1 text-xs text-ink-3">{t("profile.presetsHint")}</p>

      <div className="mt-3 space-y-2">
        {Object.values(assumptionPresets).map((preset) => (
          <div
            key={preset.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium text-ink">{t(`preset.${preset.id}`)}</div>
              <div className="text-xs text-ink-3">{t(`preset.${preset.id}.desc`)}</div>
            </div>
            <Button onClick={() => applyPreset(preset.values)}>{t("common.apply")}</Button>
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
                  .join(" · ") || t("profile.emptyPreset")}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={() => applyPreset(preset.values)}>{t("common.apply")}</Button>
              <Button
                variant="danger"
                className="px-2"
                aria-label={t("profile.deletePreset", { label: preset.label })}
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
          placeholder={t("profile.presetName")}
          aria-label={t("profile.presetNameAria")}
          className="w-48 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
        />
        <Button onClick={saveCurrentAsPreset} disabled={newLabel.trim() === ""}>
          <PlusIcon /> {t("profile.savePreset")}
        </Button>
        {newLabel ? (
          <Button
            className="px-2"
            aria-label={t("profile.clearPresetName")}
            onClick={() => setNewLabel("")}
          >
            <CloseIcon width={14} height={14} />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
