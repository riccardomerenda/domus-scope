import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ThemeProvider } from "./app/theme";
import { Shell } from "./app/Shell";
import { ExplainProvider } from "./features/explain/ExplainContext";
import { DashboardPage } from "./features/dashboard/DashboardPage";
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
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ExplainProvider>
    </ThemeProvider>
  </StrictMode>,
);
