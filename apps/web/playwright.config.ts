import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phase 12: the whole journey must also work at phone size, where the
    // icon-only nav and horizontally-scrolling tables live.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: "**/screenshots.spec.ts", // README shots are desktop-only
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
