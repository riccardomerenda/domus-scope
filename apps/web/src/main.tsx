import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { NotFoundPage } from "./app/NotFoundPage";
import { Shell } from "./app/Shell";
import { LocaleProvider } from "./i18n";
import { ExplainProvider } from "./features/explain/ExplainContext";
import { DashboardPage } from "./features/dashboard/DashboardPage";

// The dashboard stays eager (first paint); every other route — and with the
// scenario/compare routes, Recharts and its d3 stack — loads on demand.
const ScenarioPage = lazy(() =>
  import("./features/scenario/ScenarioPage").then((m) => ({ default: m.ScenarioPage })),
);
const ComparePage = lazy(() =>
  import("./features/compare/ComparePage").then((m) => ({ default: m.ComparePage })),
);
const ProfilePage = lazy(() =>
  import("./features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const HelpPage = lazy(() =>
  import("./features/help/HelpPage").then((m) => ({ default: m.HelpPage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ReportPage = lazy(() =>
  import("./features/report/ReportPage").then((m) => ({ default: m.ReportPage })),
);

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

// IndexedDB is the only system of record: ask the browser to exempt it from
// storage-pressure eviction. Settings reads back the granted/denied status.
void navigator.storage?.persist?.().catch(() => undefined);

// Follows Vite's base so subpath deploys (GitHub Pages) route correctly.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <ExplainProvider>
            <BrowserRouter basename={basename}>
              {/* null fallback: local chunks resolve near-instantly, matching
                  the loading convention of the live queries. */}
              <Suspense fallback={null}>
                <Routes>
                  <Route element={<Shell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="scenario/:id" element={<ScenarioPage />} />
                    <Route path="compare" element={<ComparePage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                  {/* Print-optimized, rendered without the app shell. */}
                  <Route path="scenario/:id/report" element={<ReportPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ExplainProvider>
        </ErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);
