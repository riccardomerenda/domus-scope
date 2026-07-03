import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Radix Dialog sets `pointer-events: none` on <body> while open; in jsdom the
// style can outlive Testing Library's cleanup and block the next test's
// pointer interactions. Reset it between tests.
afterEach(() => {
  document.body.style.pointerEvents = "";
});
