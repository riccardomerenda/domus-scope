import { type LineItem } from "@domus-scope/engine";
import { formatEUR } from "../../lib/format";
import { useLocale } from "../../i18n";
import { useExplain } from "./ExplainContext";

/**
 * A monetary figure that opens its explanation trace on click — the app's
 * signature interaction. Dotted underline signals "this number can talk".
 */
export function ExplainableNumber({
  item,
  className = "",
}: {
  item: LineItem;
  className?: string;
}) {
  const { openExplanation } = useExplain();
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={() => openExplanation({ kind: "lineItem", item })}
      title={t("help.openAria", { label: item.label })}
      className={`nums cursor-pointer rounded underline decoration-ink-3 decoration-dotted underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent ${className}`}
    >
      {formatEUR(item.amount)}
    </button>
  );
}
