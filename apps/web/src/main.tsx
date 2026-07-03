import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { Shell } from "./app/Shell";
import { ExplainProvider } from "./features/explain/ExplainContext";
import { ComparePage } from "./features/compare/ComparePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { ReportPage } from "./features/report/ReportPage";
import { ScenarioPage } from "./features/scenario/ScenarioPage";
import { SettingsPage } from "./features/settings/SettingsPage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ExplainProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<DashboardPage />} />
              <Route path="scenario/:id" element={<ScenarioPage />} />
              <Route path="compare" element={<ComparePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            {/* Print-optimized, rendered without the app shell. */}
            <Route path="scenario/:id/report" element={<ReportPage />} />
          </Routes>
        </BrowserRouter>
      </ExplainProvider>
    </ThemeProvider>
  </StrictMode>,
);
