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

export function SettingsPage() {
  const { preference, setPreference } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  async function onExport() {
    const data = await buildExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `domus-scope-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    setImportOutcome(await importData(text));
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        <div className="mt-3 max-w-xs">
          <SelectField
            label="Theme"
            value={preference}
            onChange={(event) => setPreference(event.target.value as ThemePreference)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Your data</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Everything is stored locally in this browser (IndexedDB) — nothing is ever sent anywhere.
          Export a JSON backup before clearing browser data or switching machines.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => void onExport()}>
            <DownloadIcon /> Export all data
          </Button>
          <Button onClick={() => fileInput.current?.click()}>
            <UploadIcon /> Import backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="Import backup file"
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
            {importOutcome.error
              ? importOutcome.error
              : `Imported ${importOutcome.imported} scenario(s)` +
                (importOutcome.renamed > 0
                  ? `, ${importOutcome.renamed} renamed to avoid collisions.`
                  : ".")}
          </p>
        ) : null}
      </Card>

      <Card className="border-critical/30 p-4">
        <h2 className="text-sm font-semibold text-critical">Danger zone</h2>
        <p className="mt-1 text-sm text-ink-2">
          Permanently delete every scenario stored on this device.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirmWipe(true)}>
          <TrashIcon /> Delete all data
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Delete all local data?"
        description="Every scenario on this device will be permanently removed. Export a backup first if in doubt."
        confirmLabel="Delete everything"
        onConfirm={() => void wipeAllData()}
      />
    </div>
  );
}
