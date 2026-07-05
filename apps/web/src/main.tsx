import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { Shell } from "./app/Shell";
import { LocaleProvider } from "./i18n";
import { ExplainProvider } from "./features/explain/ExplainContext";
import { ComparePage } from "./features/compare/ComparePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { HelpPage } from "./features/help/HelpPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { ReportPage } from "./features/report/ReportPage";
import { ScenarioPage } from "./features/scenario/ScenarioPage";
import { SettingsPage } from "./features/settings/SettingsPage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

// Follows Vite's base so subpath deploys (GitHub Pages) route correctly.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ExplainProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<DashboardPage />} />
                <Route path="scenario/:id" element={<ScenarioPage />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              {/* Print-optimized, rendered without the app shell. */}
              <Route path="scenario/:id/report" element={<ReportPage />} />
            </Routes>
          </BrowserRouter>
        </ExplainProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);
