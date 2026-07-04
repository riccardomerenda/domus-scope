import { useLocale } from "../../i18n";
import { helpContent, HELP_GROUPS, type HelpTopicId } from "../../i18n/help";
import { Card } from "../../components/ui";
import { HelpSection } from "../../components/InfoDot";

/**
 * The glossary page: the same content the ⓘ popovers show, grouped and
 * browsable. Every topic gets an anchor so popovers can deep-link here.
 */
export function HelpPage() {
  const { t } = useLocale();
  const groups = Object.keys(HELP_GROUPS) as (keyof typeof HELP_GROUPS)[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("help.title")}</h1>
        <p className="mt-0.5 text-sm text-ink-2">{t("help.subtitle")}</p>
      </div>

      <nav className="flex flex-wrap gap-2 text-xs">
        {groups.map((group) => (
          <a
            key={group}
            href={`#help-${group}`}
            className="rounded-full border border-hairline px-2.5 py-1 text-ink-2 hover:text-ink"
          >
            {t(`help.group.${group}`)}
          </a>
        ))}
      </nav>

      {groups.map((group) => (
        <section key={group} id={`help-${group}`} className="scroll-mt-4">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-3 uppercase">
            {t(`help.group.${group}`)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {HELP_GROUPS[group].map((topic) => (
              <TopicCard key={topic} topic={topic} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TopicCard({ topic }: { topic: HelpTopicId }) {
  const { locale, t } = useLocale();
  const entry = helpContent[locale][topic];
  return (
    <Card id={topic} className="scroll-mt-4 p-4">
      <h3 className="text-sm font-semibold text-ink">{entry.title}</h3>
      <HelpSection label={t("help.what")} text={entry.what} />
      <HelpSection label={t("help.why")} text={entry.why} />
      <HelpSection label={t("help.typical")} text={entry.typical} />
      <HelpSection label={t("help.pitfall")} text={entry.pitfall} warn />
      <HelpSection label={t("help.direction")} text={entry.direction} strong />
    </Card>
  );
}
