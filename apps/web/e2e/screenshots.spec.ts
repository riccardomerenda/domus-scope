import { test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * README screenshot generator. Skipped by default (and in CI) — run explicitly:
 *   SCREENSHOTS=1 pnpm --filter @domus-scope/web e2e screenshots.spec.ts
 * Output lands in docs/screenshots/.
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate README images");

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/screenshots",
);

test.use({ viewport: { width: 1280, height: 920 }, colorScheme: "light" });

test("capture README screenshots", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Create your first scenario/ }).click();
  await page.getByText("Buy (mortgage)").first().waitFor();
  await page.waitForTimeout(600);

  // 1) Quick mode: gauge, verdict, year-1 comparison.
  await page.screenshot({ path: path.join(outDir, "quick.png") });

  // 2) Explanation drawer opened from a traced number.
  await page.getByTitle("Explain: Mortgage interest (year 1, simplified)").click();
  await page.getByText("Why this number?").waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "explain.png") });
  await page.keyboard.press("Escape");

  // 3) Full analysis → Results with the two-lens charts.
  await page.getByRole("button", { name: /Deepen with full analysis/ }).click();
  await page.getByText("Cost catalog").waitFor();
  await page.getByRole("radio", { name: "Results" }).click();
  await page.getByText(/Buying leaves you/).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "results.png") });

  // 4) Sensitivity: tornado, flips, heatmap.
  await page.getByRole("radio", { name: "Sensitivity" }).click();
  await page.getByText("What moves the result").waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "sensitivity.png") });
});
