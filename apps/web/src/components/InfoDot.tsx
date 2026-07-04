import * as Popover from "@radix-ui/react-popover";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n";
import { helpContent, type HelpTopicId } from "../i18n/help";
import { InfoIcon } from "./Icons";

/**
 * The input-side twin of the explanation drawer: a small ⓘ that opens a
 * popover with what the field is, why it matters, typical Italian values,
 * pitfalls, and the direction of its effect on the verdict.
 */
export function InfoDot({ topic }: { topic: HelpTopicId }) {
  const { locale, t } = useLocale();
  const entry = helpContent[locale][topic];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("help.openAria", { label: entry.title })}
          className="inline-flex cursor-pointer items-center rounded-full text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
        >
          <InfoIcon width={13} height={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-80 rounded-xl border border-edge bg-surface p-4 text-sm shadow-xl"
        >
          <h4 className="font-semibold text-ink">{entry.title}</h4>
          <HelpSection label={t("help.what")} text={entry.what} />
          <HelpSection label={t("help.why")} text={entry.why} />
          <HelpSection label={t("help.typical")} text={entry.typical} />
          <HelpSection label={t("help.pitfall")} text={entry.pitfall} warn />
          <HelpSection label={t("help.direction")} text={entry.direction} strong />
          <div className="mt-3 border-t border-hairline pt-2 text-xs">
            <Popover.Close asChild>
              <Link
                to="/help"
                className="text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {t("common.glossaryLink")}
              </Link>
            </Popover.Close>
          </div>
          <Popover.Arrow className="fill-[var(--ds-hairline)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function HelpSection({
  label,
  text,
  warn = false,
  strong = false,
}: {
  label: string;
  text?: string | undefined;
  warn?: boolean;
  strong?: boolean;
}) {
  if (!text) return null;
  return (
    <div className="mt-2">
      <span
        className={`block text-[10px] font-semibold tracking-wide uppercase ${
          warn ? "text-serious" : "text-ink-3"
        }`}
      >
        {label}
      </span>
      <p
        className={`mt-0.5 text-xs leading-relaxed ${
          strong ? "font-medium text-ink" : "text-ink-2"
        }`}
      >
        {text}
      </p>
    </div>
  );
}
