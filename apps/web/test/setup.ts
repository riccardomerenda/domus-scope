import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

afterEach(() => {
  // Without vitest `globals`, Testing Library's auto-cleanup never registers:
  // unmount explicitly or containers (and their live queries) accumulate.
  cleanup();
  // Radix Dialog sets `pointer-events: none` on <body> while open; in jsdom
  // the style can outlive cleanup and block the next test's interactions.
  document.body.style.pointerEvents = "";
});

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// ThemeProvider reads the system color scheme; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
