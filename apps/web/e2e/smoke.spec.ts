import { expect, test } from "@playwright/test";

/**
 * Smoke: the §21 blueprint question end-to-end in a real browser —
 * create → quick verdict → full analysis → results → decision → survives reload.
 */
test("full decision journey survives a reload", async ({ page }) => {
  await page.goto("/");

  // Fresh IndexedDB → empty state.
  await page.getByRole("button", { name: /Create your first scenario/ }).click();
  await expect(page.getByText("Buy (mortgage)").first()).toBeVisible();

  // Upgrade to the full analysis.
  await page.getByRole("button", { name: /Deepen with full analysis/ }).click();
  await expect(page.getByText("Cost catalog")).toBeVisible();

  // Results: verdict banner and fragility badge.
  await page.getByRole("radio", { name: "Results" }).click();
  await expect(page.getByText(/Buying leaves you/)).toBeVisible();
  await expect(page.getByTitle(/perturbations that flip the verdict/)).toBeVisible();

  // Negotiation: derived walk-away price and the ZOPA bar for an asking price.
  await page.getByRole("radio", { name: "Negotiation" }).click();
  await expect(page.getByText("Walk-away price")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Asking price" }).fill("260000");
  await expect(page.getByRole("img", { name: /Price scale/ })).toBeVisible();

  // Journal: record the decision.
  await page.getByRole("radio", { name: "Journal" }).click();
  await page.getByLabel("Decision", { exact: true }).fill("Buy it");
  await page.getByLabel("Decision reason").fill("The numbers hold under stress");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded")).toBeVisible();

  // Reload: everything persisted locally.
  await page.reload();
  await page.getByRole("radio", { name: "Journal" }).click();
  await expect(page.getByText("Decision recorded")).toBeVisible();
  await expect(page.getByText(/The numbers hold under stress/)).toBeVisible();
});
