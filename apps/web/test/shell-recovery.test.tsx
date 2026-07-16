import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "../src/app/ErrorBoundary";
import { NotFoundPage } from "../src/app/NotFoundPage";
import { Shell } from "../src/app/Shell";
import { ThemeProvider } from "../src/app/theme";
import { LocaleProvider } from "../src/i18n";
import { SettingsPage } from "../src/features/settings/SettingsPage";

function Bomb(): never {
  throw new Error("boom");
}

function renderShellAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<p>home</p>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("crash recovery (Phase 9)", () => {
  it("catches a render error and offers reload + data export", () => {
    // React reports caught render errors via console.error; keep output clean.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export all data" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("renders children untouched when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});

describe("not-found route (Phase 9)", () => {
  it("renders a friendly 404 with a way home", () => {
    renderShellAt("/definitely-not-a-route");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
  });
});

describe("shell a11y (Phase 9)", () => {
  it("gives every icon-only mobile nav link an accessible name", () => {
    renderShellAt("/");
    // Desktop (text label) + mobile (aria-label) → two links per destination.
    for (const name of ["Dashboard", "Compare", "Profile & Assumptions", "Glossary", "Settings"]) {
      expect(screen.getAllByRole("link", { name })).toHaveLength(2);
    }
  });

  it("keeps <html lang> in sync with the locale", () => {
    localStorage.setItem("ds-locale", "it");
    try {
      const { unmount } = render(<LocaleProvider>x</LocaleProvider>);
      expect(document.documentElement.lang).toBe("it");
      unmount();
      localStorage.setItem("ds-locale", "en");
      render(<LocaleProvider>x</LocaleProvider>);
      expect(document.documentElement.lang).toBe("en");
    } finally {
      localStorage.removeItem("ds-locale");
    }
  });
});

describe("storage persistence status (Phase 9)", () => {
  it("nudges toward backups when storage is best-effort", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: () => Promise.resolve(false) },
    });
    try {
      render(
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>,
      );
      expect(await screen.findByText(/Storage is best-effort/)).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, "storage", original);
      else Reflect.deleteProperty(navigator, "storage");
    }
  });

  it("shows nothing while the status is unknown (API missing)", () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>,
    );
    expect(screen.queryByText(/Storage is/)).not.toBeInTheDocument();
  });
});
