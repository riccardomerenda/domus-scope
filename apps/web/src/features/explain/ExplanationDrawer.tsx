import * as Dialog from "@radix-ui/react-dialog";
import { formulaRegistry } from "@domus-scope/engine";
import { formatEUR, formatPercent, formatTraceValue } from "../../lib/format";
import { Button, LensTag } from "../../components/ui";
import { CloseIcon } from "../../components/Icons";
import { type ExplainPayload } from "./ExplainContext";

export function ExplanationDrawer({
  payload,
  onClose,
}: {
  payload: ExplainPayload | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={payload !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-0 right-0 z-50 h-full w-[min(24rem,92vw)] overflow-y-auto border-l border-edge bg-surface p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold text-ink">Why this number?</Dialog.Title>
            <Dialog.Close asChild>
              <Button aria-label="Close explanation" className="-mt-1 -mr-2 px-2">
                <CloseIcon />
              </Button>
            </Dialog.Close>
          </div>
          {payload ? <DrawerBody payload={payload} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DrawerBody({ payload }: { payload: ExplainPayload }) {
  if (payload.kind === "threshold") return <ThresholdBody rule={payload.rule} />;
  return <LineItemBody payload={payload} />;
}

function LineItemBody({ payload }: { payload: Extract<ExplainPayload, { kind: "lineItem" }> }) {
  const { item } = payload;
  const formula = formulaRegistry[item.formulaId];
  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{item.label}</span>
          <LensTag>{item.lens} lens</LensTag>
        </div>
        <div className="nums mt-1 text-2xl font-semibold text-ink">{formatEUR(item.amount)}</div>
        {item.sign === "credit" ? (
          <p className="mt-1 text-xs text-ink-3">
            A credit: it reduces the unrecoverable costs of this scenario.
          </p>
        ) : null}
      </div>
      {formula ? (
        <FormulaBlock expression={formula.expression} description={formula.description} />
      ) : null}
      <InputsTable inputs={item.inputs} />
    </div>
  );
}

function ThresholdBody({ rule }: { rule: Extract<ExplainPayload, { kind: "threshold" }>["rule"] }) {
  const formula = formulaRegistry[rule.derivation.formulaId];
  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">Derived threshold R*</span>
          <LensTag>quick rule</LensTag>
        </div>
        <div className="nums mt-1 text-2xl font-semibold text-ink">
          {formatPercent(rule.threshold, 2)}
        </div>
        <p className="mt-1 text-xs text-ink-3">
          Derived from your assumptions (BR-018) — not a hardcoded “5% rule”.
        </p>
      </div>
      {formula ? (
        <FormulaBlock expression={formula.expression} description={formula.description} />
      ) : null}
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Terms</h3>
        <table className="w-full text-sm">
          <tbody>
            {rule.derivation.terms.map((term) => (
              <tr key={term.id} className="border-b border-hairline last:border-0">
                <td className="py-1.5 pr-2 text-ink-2">{term.label}</td>
                <td className="nums py-1.5 text-right font-medium text-ink">
                  {formatPercent(term.value, 2)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pr-2 font-semibold text-ink">R*</td>
              <td className="nums py-1.5 text-right font-semibold text-ink">
                {formatPercent(rule.threshold, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <InputsTable inputs={rule.derivation.inputs} />
    </div>
  );
}

function FormulaBlock({ expression, description }: { expression: string; description: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Formula</h3>
      <code className="block rounded-lg border border-hairline bg-page px-3 py-2 text-xs text-ink">
        {expression}
      </code>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{description}</p>
    </div>
  );
}

function InputsTable({ inputs }: { inputs: Record<string, number | string> }) {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Values used</h3>
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-2 text-ink-2">{key}</td>
              <td className="nums py-1.5 text-right font-medium text-ink">
                {formatTraceValue(key, value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
