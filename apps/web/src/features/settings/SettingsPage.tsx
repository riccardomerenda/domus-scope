import { useRef, useState } from "react";
import { Button, Card, ConfirmDialog, SelectField } from "../../components/ui";
import { DownloadIcon, UploadIcon, TrashIcon } from "../../components/Icons";
import {
  buildExport,
  importData,
  wipeAllData,
  type ImportOutcome,
} from "../../persistence/transfer";
import { useTheme, type ThemePreference } from "../../app/theme";
import { useLocale, type LocalePreference } from "../../i18n";
import { useStoragePersistence } from "../../lib/hooks";
import { downloadJson, exportFilename } from "../../lib/download";

export function SettingsPage() {
  const { t, preference: localePreference, setPreference: setLocalePreference } = useLocale();
  const { preference, setPreference } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const persisted = useStoragePersistence();

  async function onExport() {
    downloadJson(exportFilename(), await buildExport());
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    setImportOutcome(await importData(text));
  }

  const importMessage = (outcome: ImportOutcome): string => {
    if (outcome.error) return t(`settings.error.${outcome.error}`);
    return (
      t("settings.imported", { count: outcome.imported }) +
      (outcome.renamed > 0 ? t("settings.renamed", { count: outcome.renamed }) : "") +
      (outcome.configImported ? t("settings.configImported") : ".")
    );
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{t("settings.title")}</h1>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">{t("settings.appearance")}</h2>
        <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
          <SelectField
            label={t("settings.theme")}
            value={preference}
            onChange={(event) => setPreference(event.target.value as ThemePreference)}
          >
            <option value="system">{t("settings.theme.system")}</option>
            <option value="light">{t("settings.theme.light")}</option>
            <option value="dark">{t("settings.theme.dark")}</option>
          </SelectField>
          <SelectField
            label={t("settings.language")}
            value={localePreference}
            onChange={(event) => setLocalePreference(event.target.value as LocalePreference)}
          >
            <option value="auto">{t("settings.language.auto")}</option>
            {/* Language names stay in their own language on purpose. */}
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </SelectField>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">{t("settings.data")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{t("settings.dataBody")}</p>
        {persisted !== null ? (
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            {persisted ? t("settings.storagePersistent") : t("settings.storageBestEffort")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => void onExport()}>
            <DownloadIcon /> {t("settings.export")}
          </Button>
          <Button onClick={() => fileInput.current?.click()}>
            <UploadIcon /> {t("settings.import")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label={t("settings.importAria")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImportFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {importOutcome ? (
          <p
            className={`mt-2 text-sm ${importOutcome.error ? "text-critical" : "text-ink-2"}`}
            role="status"
          >
            {importMessage(importOutcome)}
          </p>
        ) : null}
      </Card>

      <Card className="border-critical/30 p-4">
        <h2 className="text-sm font-semibold text-critical">{t("settings.danger")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("settings.dangerBody")}</p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirmWipe(true)}>
          <TrashIcon /> {t("settings.wipe")}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title={t("settings.wipeTitle")}
        description={t("settings.wipeBody")}
        confirmLabel={t("settings.wipeConfirm")}
        onConfirm={() => void wipeAllData()}
      />
    </div>
  );
}
