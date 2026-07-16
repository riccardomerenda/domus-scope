import { Component, type ReactNode } from "react";
import { Button } from "../components/ui";
import { DownloadIcon } from "../components/Icons";
import { useLocale } from "../i18n";
import { buildExport } from "../persistence/transfer";
import { downloadJson, exportFilename } from "../lib/download";

/**
 * Last-resort recovery screen: a render-time throw anywhere below must never
 * strand the user's data. The export path talks to Dexie directly, so a
 * backup can be downloaded even while the React tree is broken.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override render() {
    if (this.state.error) return <CrashScreen error={this.state.error} />;
    return this.props.children;
  }
}

function CrashScreen({ error }: { error: Error }) {
  const { t } = useLocale();

  async function onExport() {
    downloadJson(exportFilename(), await buildExport());
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{t("crash.title")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{t("crash.body")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t("crash.reload")}
        </Button>
        <Button onClick={() => void onExport()}>
          <DownloadIcon /> {t("crash.export")}
        </Button>
      </div>
      <details className="mt-6 text-xs text-ink-3">
        <summary className="cursor-pointer">{t("crash.details")}</summary>
        <pre className="mt-2 whitespace-pre-wrap overflow-x-auto">
          {String(error.stack ?? error)}
        </pre>
      </details>
    </main>
  );
}
