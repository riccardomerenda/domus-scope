import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  costItemSchema,
  italianPurchaseCostItems,
  italianRentCostItems,
  type CostItem,
} from "@domus-scope/engine";
import { type AnalyticalData } from "../../../persistence/db";
import { formatEUR, formatPercent } from "../../../lib/format";
import { isMessageKey, useLocale, type LocaleContextValue } from "../../../i18n";
import {
  Button,
  Card,
  NumberField,
  PercentField,
  SelectField,
  ToggleField,
} from "../../../components/ui";
import { InfoDot } from "../../../components/InfoDot";
import { CloseIcon, EditIcon, PlusIcon, TrashIcon } from "../../../components/Icons";

export function CostCatalogSection({
  data,
  onChange,
}: {
  data: AnalyticalData;
  onChange: (next: AnalyticalData) => void;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState<CostItem | "new" | null>(null);
  const items = data.costItems;
  const setItems = (costItems: CostItem[]) => onChange({ ...data, costItems });

  // Preset items get their label in the active locale at generation time
  // (labels are user-editable data stored with the scenario).
  const localizeLabel = (item: CostItem): CostItem => {
    const key = `costItem.${item.id}`;
    return isMessageKey(key) ? { ...item, label: t(key) } : item;
  };

  const addItalianPurchase = () => {
    const principal =
      data.financingKind === "mortgage"
        ? Math.max(data.property.price - data.downPayment, 0)
        : undefined;
    const generated = italianPurchaseCostItems({
      propertyPrice: data.property.price,
      ...(data.property.cadastralValue !== null
        ? { cadastralValue: data.property.cadastralValue }
        : {}),
      ...(principal !== undefined && principal > 0 ? { mortgagePrincipal: principal } : {}),
      // Second homes get the 9% registration regime plus the IMU item (Phase 11).
      regime: (data.property.primaryResidence ?? true) ? "primaryExisting" : "otherExisting",
    });
    mergeGenerated(generated.map(localizeLabel));
  };

  const addItalianRent = () => {
    mergeGenerated(
      italianRentCostItems({ monthlyRent: data.rentAlternative.equivalentMonthlyRent }).map(
        localizeLabel,
      ),
    );
  };

  const mergeGenerated = (generated: CostItem[]) => {
    const existing = new Set(items.map((item) => item.id));
    setItems([...items, ...generated.filter((item) => !existing.has(item.id))]);
  };

  const upsert = (item: CostItem) => {
    const index = items.findIndex((existing) => existing.id === item.id);
    setItems(index === -1 ? [...items, item] : items.with(index, item));
    setEditing(null);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {t("costs.title")}
            <InfoDot topic="costCatalog" />
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">{t("costs.hint")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={addItalianPurchase}>{t("costs.addItalianPurchase")}</Button>
          <Button onClick={addItalianRent}>{t("costs.addItalianRent")}</Button>
          <Button variant="primary" onClick={() => setEditing("new")}>
            <PlusIcon /> {t("costs.addCustom")}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{t("costs.empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-hairline">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <ToggleField
                label=""
                checked={item.enabled}
                onChange={(enabled) =>
                  setItems(items.map((it) => (it.id === item.id ? { ...it, enabled } : it)))
                }
              />
              <div className={`min-w-0 flex-1 ${item.enabled ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{item.label}</span>
                  <SideChip side={item.scenario} />
                  {item.sign === "credit" ? (
                    <span className="rounded-full border border-buy/40 px-1.5 text-[10px] text-buy">
                      {t("costs.credit")}
                    </span>
                  ) : null}
                </div>
                <div className="nums text-xs text-ink-3">{describeItem(item, t)}</div>
              </div>
              <Button
                className="px-2"
                aria-label={t("costs.editAria", { label: item.label })}
                onClick={() => setEditing(item)}
              >
                <EditIcon width={14} height={14} />
              </Button>
              <Button
                variant="danger"
                className="px-2"
                aria-label={t("costs.deleteAria", { label: item.label })}
                onClick={() => setItems(items.filter((it) => it.id !== item.id))}
              >
                <TrashIcon width={14} height={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <CostItemDialog
          initial={editing === "new" ? null : editing}
          onSave={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function SideChip({ side }: { side: CostItem["scenario"] }) {
  const { t } = useLocale();
  const className =
    side === "buy"
      ? "border-buy/40 text-buy"
      : side === "rent"
        ? "border-rent/40 text-rent"
        : "border-hairline text-ink-3";
  return (
    <span className={`rounded-full border px-1.5 text-[10px] font-medium ${className}`}>
      {t(`costs.side.${side}`)}
    </span>
  );
}

function describeItem(item: CostItem, t: LocaleContextValue["t"]): string {
  const recoverable =
    item.recoverability.kind === "full"
      ? t("costs.desc.fullyRecoverable")
      : item.recoverability.kind === "partial"
        ? t("costs.desc.partlyRecoverable", {
            share: formatPercent(item.recoverability.share, 0),
          })
        : "";
  if (item.timing.kind === "oneTime") {
    return (
      t("costs.desc.oneTime", {
        amount: formatEUR(item.timing.amount),
        month: item.timing.month,
      }) + recoverable
    );
  }
  const base = item.timing.base;
  const baseText =
    base.kind === "fixedAnnual"
      ? t("costs.desc.fixedPerYear", { amount: formatEUR(base.amount) })
      : base.kind === "percentOfValue"
        ? t("costs.desc.percentOfValue", { rate: formatPercent(base.rate, 2) })
        : base.kind === "percentOfCadastral"
          ? t("costs.desc.percentOfCadastral", { rate: formatPercent(base.rate, 2) })
          : t("costs.desc.percentOfRent", { rate: formatPercent(base.rate, 2) });
  const growth = item.timing.growth;
  const growthText =
    base.kind === "fixedAnnual"
      ? growth.kind === "rate"
        ? t("costs.desc.growingAt", { rate: formatPercent(growth.rate, 1) })
        : growth.kind === "tracksValue"
          ? t("costs.desc.tracksValue")
          : t("costs.desc.tracksRent")
      : "";
  return t("costs.desc.recurring", { base: baseText, growth: growthText, recoverable });
}

/* ---------- Editor dialog ---------- */

interface DraftItem {
  label: string;
  scenario: CostItem["scenario"];
  sign: CostItem["sign"];
  timingKind: "oneTime" | "recurring";
  amount: number;
  month: number;
  baseKind: "fixedAnnual" | "percentOfValue" | "percentOfRent" | "percentOfCadastral";
  rate: number;
  growthKind: "rate" | "tracksValue" | "tracksRent";
  growthRate: number;
  recoverabilityKind: "none" | "full" | "partial";
  recoverableShare: number;
  renovationCredit: boolean;
  notes: string;
}

function toDraft(item: CostItem | null): DraftItem {
  if (!item) {
    return {
      label: "",
      scenario: "buy",
      sign: "cost",
      timingKind: "oneTime",
      amount: 1_000,
      month: 0,
      baseKind: "fixedAnnual",
      rate: 0.01,
      growthKind: "rate",
      growthRate: 0,
      recoverabilityKind: "none",
      recoverableShare: 0.5,
      renovationCredit: false,
      notes: "",
    };
  }
  const base = toDraft(null);
  return {
    ...base,
    label: item.label,
    scenario: item.scenario,
    sign: item.sign,
    renovationCredit: item.renovationCredit === true,
    notes: item.notes,
    recoverabilityKind: item.recoverability.kind,
    recoverableShare:
      item.recoverability.kind === "partial" ? item.recoverability.share : base.recoverableShare,
    ...(item.timing.kind === "oneTime"
      ? { timingKind: "oneTime" as const, amount: item.timing.amount, month: item.timing.month }
      : {
          timingKind: "recurring" as const,
          baseKind: item.timing.base.kind,
          amount: item.timing.base.kind === "fixedAnnual" ? item.timing.base.amount : base.amount,
          rate: item.timing.base.kind === "fixedAnnual" ? base.rate : item.timing.base.rate,
          growthKind: item.timing.growth.kind,
          growthRate: item.timing.growth.kind === "rate" ? item.timing.growth.rate : 0,
        }),
  };
}

function fromDraft(draft: DraftItem, id: string): unknown {
  return {
    id,
    label: draft.label.trim(),
    scenario: draft.scenario,
    sign: draft.sign,
    // Only meaningful for one-time buy-side works (G14).
    renovationCredit:
      draft.renovationCredit && draft.timingKind === "oneTime" && draft.scenario !== "rent",
    enabled: true,
    notes: draft.notes,
    recoverability:
      draft.recoverabilityKind === "partial"
        ? { kind: "partial", share: draft.recoverableShare }
        : { kind: draft.recoverabilityKind },
    timing:
      draft.timingKind === "oneTime"
        ? { kind: "oneTime", month: draft.month, amount: draft.amount }
        : {
            kind: "recurring",
            base:
              draft.baseKind === "fixedAnnual"
                ? { kind: "fixedAnnual", amount: draft.amount }
                : { kind: draft.baseKind, rate: draft.rate },
            growth:
              draft.baseKind === "fixedAnnual" && draft.growthKind === "rate"
                ? { kind: "rate", rate: draft.growthRate }
                : draft.baseKind === "fixedAnnual"
                  ? { kind: draft.growthKind }
                  : { kind: "rate", rate: 0 },
          },
  };
}

function CostItemDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: CostItem | null;
  onSave: (item: CostItem) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<DraftItem>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<DraftItem>) => setDraft((current) => ({ ...current, ...patch }));

  const save = () => {
    const id = initial?.id ?? `custom-${crypto.randomUUID()}`;
    const parsed = costItemSchema.safeParse(fromDraft(draft, id));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("costs.dialog.invalid"));
      return;
    }
    onSave({ ...parsed.data, enabled: initial?.enabled ?? true });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-edge bg-surface p-5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold text-ink">
              {initial ? t("costs.dialog.editTitle") : t("costs.dialog.newTitle")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button aria-label={t("common.close")} className="-mt-1 -mr-2 px-2">
                <CloseIcon />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">
                {t("costs.dialog.label")}
              </span>
              <input
                className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
                value={draft.label}
                onChange={(event) => set({ label: event.target.value })}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label={t("costs.dialog.appliesTo")}
                value={draft.scenario}
                onChange={(event) => set({ scenario: event.target.value as DraftItem["scenario"] })}
              >
                <option value="buy">{t("costs.dialog.buyScenario")}</option>
                <option value="rent">{t("costs.dialog.rentScenario")}</option>
                <option value="both">{t("costs.dialog.both")}</option>
              </SelectField>
              <SelectField
                label={t("costs.dialog.direction")}
                value={draft.sign}
                onChange={(event) => set({ sign: event.target.value as DraftItem["sign"] })}
              >
                <option value="cost">{t("costs.dialog.cost")}</option>
                <option value="credit">{t("costs.dialog.creditOption")}</option>
              </SelectField>
            </div>

            <SelectField
              label={t("costs.dialog.timing")}
              value={draft.timingKind}
              onChange={(event) =>
                set({ timingKind: event.target.value as DraftItem["timingKind"] })
              }
            >
              <option value="oneTime">{t("costs.dialog.oneTime")}</option>
              <option value="recurring">{t("costs.dialog.recurring")}</option>
            </SelectField>

            {draft.timingKind === "oneTime" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label={t("costs.dialog.amount")}
                    suffix={t("suffix.eur")}
                    value={draft.amount}
                    min={0}
                    step={100}
                    onChange={(amount) => set({ amount })}
                  />
                  <NumberField
                    label={t("costs.dialog.month")}
                    value={draft.month}
                    min={0}
                    step={1}
                    onChange={(month) => set({ month })}
                  />
                </div>
                {draft.scenario !== "rent" ? (
                  <ToggleField
                    label={t("costs.dialog.renovationCredit")}
                    checked={draft.renovationCredit}
                    onChange={(renovationCredit) => set({ renovationCredit })}
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <SelectField
                  label={t("costs.dialog.base")}
                  value={draft.baseKind}
                  onChange={(event) =>
                    set({ baseKind: event.target.value as DraftItem["baseKind"] })
                  }
                >
                  <option value="fixedAnnual">{t("costs.dialog.fixedAnnual")}</option>
                  <option value="percentOfValue">{t("costs.dialog.percentValue")}</option>
                  <option value="percentOfRent">{t("costs.dialog.percentRent")}</option>
                  <option value="percentOfCadastral">{t("costs.dialog.percentCadastral")}</option>
                </SelectField>
                {draft.baseKind === "fixedAnnual" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label={t("costs.dialog.amountPerYear")}
                      suffix={t("suffix.eur")}
                      value={draft.amount}
                      min={0}
                      step={100}
                      onChange={(amount) => set({ amount })}
                    />
                    <SelectField
                      label={t("costs.dialog.growth")}
                      value={draft.growthKind}
                      onChange={(event) =>
                        set({ growthKind: event.target.value as DraftItem["growthKind"] })
                      }
                    >
                      <option value="rate">{t("costs.dialog.fixedRate")}</option>
                      <option value="tracksValue">{t("costs.dialog.tracksValue")}</option>
                      <option value="tracksRent">{t("costs.dialog.tracksRent")}</option>
                    </SelectField>
                    {draft.growthKind === "rate" ? (
                      <PercentField
                        label={t("costs.dialog.growthRate")}
                        value={draft.growthRate}
                        onChange={(growthRate) => set({ growthRate })}
                      />
                    ) : null}
                  </div>
                ) : (
                  <PercentField
                    label={
                      draft.baseKind === "percentOfValue"
                        ? t("costs.dialog.percentValuePerYear")
                        : draft.baseKind === "percentOfCadastral"
                          ? t("costs.dialog.percentCadastralPerYear")
                          : t("costs.dialog.percentAnnualRent")
                    }
                    value={draft.rate}
                    onChange={(rate) => set({ rate })}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label={t("costs.dialog.recoverability")}
                value={draft.recoverabilityKind}
                onChange={(event) =>
                  set({
                    recoverabilityKind: event.target.value as DraftItem["recoverabilityKind"],
                  })
                }
              >
                <option value="none">{t("costs.dialog.recoverNone")}</option>
                <option value="full">{t("costs.dialog.recoverFull")}</option>
                <option value="partial">{t("costs.dialog.recoverPartial")}</option>
              </SelectField>
              {draft.recoverabilityKind === "partial" ? (
                <PercentField
                  label={t("costs.dialog.recoverShare")}
                  value={draft.recoverableShare}
                  step={5}
                  onChange={(recoverableShare) => set({ recoverableShare })}
                />
              ) : null}
            </div>

            {error ? <p className="text-sm text-critical">{error}</p> : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button>{t("common.cancel")}</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={save} disabled={draft.label.trim() === ""}>
              {t("costs.dialog.save")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
