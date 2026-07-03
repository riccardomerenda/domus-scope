import { NavLink, Outlet } from "react-router-dom";
import { HomeIcon, MoonIcon, SettingsIcon, SlidersIcon, SunIcon } from "../components/Icons";
import { useTheme } from "./theme";

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-hairline/70 text-ink" : "text-ink-2 hover:bg-hairline/40 hover:text-ink"
  }`;
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2 px-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-page">
        <HomeIcon width={14} height={14} />
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink">DomusScope</span>
    </div>
  );
}

function ThemeToggle() {
  const { isDark, setPreference } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setPreference(isDark ? "light" : "dark")}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-hairline/40 hover:text-ink"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {isDark ? "Light theme" : "Dark theme"}
    </button>
  );
}

export function Shell() {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface py-5 md:flex">
        <Wordmark />
        <nav className="mt-6 flex flex-col gap-1 px-2">
          <NavLink to="/" end className={navClass}>
            <HomeIcon /> Dashboard
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            <SlidersIcon /> Profile & Assumptions
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <SettingsIcon /> Settings
          </NavLink>
        </nav>
        <div className="mt-auto px-2">
          <ThemeToggle />
          <p className="px-3 pt-2 text-[10px] leading-relaxed text-ink-3">
            Local-first: your data never leaves this device.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 md:hidden">
          <Wordmark />
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              <HomeIcon />
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              <SlidersIcon />
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              <SettingsIcon />
            </NavLink>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
