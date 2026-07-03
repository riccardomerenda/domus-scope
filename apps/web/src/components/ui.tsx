import { type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { type VerdictKind, type WarningSeverity } from "@domus-scope/engine";
import { CloseIcon, AlertIcon, InfoIcon } from "./Icons";

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-ink text-page hover:opacity-85",
    ghost: "text-ink-2 hover:bg-hairline/60 hover:text-ink",
    danger: "text-critical hover:bg-critical/10",
  };
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

/* ---------- Card ---------- */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-edge bg-surface shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Form fields ---------- */

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-ink-2">{children}</span>;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step,
  min,
  id,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  id?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          className="nums w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
        {suffix ? <span className="w-10 shrink-0 text-xs text-ink-3">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function SelectField({
  label,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        className={`w-full cursor-pointer rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-rent ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-ink"
      />
      {label}
    </label>
  );
}

/** Displays a stored fraction (0.034) as a percent number (3.4) without float dust. */
export function toPercentDisplay(fraction: number): number {
  return Math.round(fraction * 10_000) / 100;
}

export function PercentField({
  label,
  value,
  onChange,
  step = 0.05,
  min = 0,
}: {
  label: string;
  /** Fraction, engine-style: 0.034 = 3.4%. */
  value: number;
  onChange: (fraction: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <NumberField
      label={label}
      suffix="%"
      value={Number.isFinite(value) ? toPercentDisplay(value) : Number.NaN}
      step={step}
      min={min}
      onChange={(percent) => onChange(percent / 100)}
    />
  );
}

/* ---------- Stat tile ---------- */

export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  tone?: "default" | "good" | "bad";
}) {
  const valueClass = tone === "good" ? "text-good" : tone === "bad" ? "text-critical" : "text-ink";
  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <div className="text-[11px] font-medium text-ink-3">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</div>
      {sub ? <div className="nums mt-0.5 text-[11px] text-ink-3">{sub}</div> : null}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg border border-hairline p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value ? "bg-ink text-page" : "text-ink-2 hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Verdict chip ---------- */

export const VERDICT_META: Record<VerdictKind, { label: string; className: string }> = {
  BUY_MORTGAGE: { label: "Buy (mortgage)", className: "bg-buy/15 text-buy border-buy/40" },
  BUY_CASH: { label: "Buy (cash)", className: "bg-cash/15 text-cash border-cash/40" },
  RENT: { label: "Rent", className: "bg-rent/15 text-rent border-rent/40" },
  GREY_ZONE: { label: "Grey zone", className: "bg-greyzone/15 text-ink-2 border-greyzone/40" },
};

export function VerdictChip({ kind, indicative }: { kind: VerdictKind; indicative?: boolean }) {
  const meta = VERDICT_META[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
      {indicative ? <span className="font-normal opacity-75">· indicative</span> : null}
    </span>
  );
}

/* ---------- Warning badge (status colors: icon + label, never color alone) ---------- */

export function WarningBadge({
  id,
  severity,
  message,
}: {
  id: string;
  severity: WarningSeverity;
  message: string;
}) {
  const Icon = severity === "info" ? InfoIcon : AlertIcon;
  const tone =
    severity === "strong"
      ? "text-critical border-critical/40 bg-critical/10"
      : severity === "caution"
        ? "text-serious border-serious/40 bg-serious/10"
        : "text-ink-2 border-hairline bg-surface";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <Icon className="mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">{id}</span> <span className="text-ink-2">{message}</span>
      </div>
    </div>
  );
}

/* ---------- Lens tag (BR-017: outputs always name their method) ---------- */

export function LensTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink-3 uppercase">
      {children}
    </span>
  );
}

/* ---------- Confirm dialog ---------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-edge bg-surface p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-sm font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button aria-label="Close" className="-mt-1 -mr-2 px-2">
                <CloseIcon />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-ink-2">{description}</Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
