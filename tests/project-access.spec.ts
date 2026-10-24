import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__ = true; });
  await context.route(/google-analytics\.com|googletagmanager\.com/, route => route.abort());
});
for (const width of [390, 1280]) {
  test(`Visitors can try Transactions and editorial review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/transactions/demo");
    await expect(page.getByTestId("demo-balance")).toHaveText("$6.00");
    await page.getByRole("button", { name: "Approve request", exact: true }).click();
    await expect(page.getByTestId("demo-balance")).toHaveText("$37.00");
    await page.getByLabel("Description", { exact: true }).fill("Museum tickets");
    await page.getByLabel("Amount owed ($)", { exact: true }).fill("12.50");
    await page.getByRole("button", { name: "Add sample request" }).click();
    await expect(page.getByTestId("demo-balance")).toHaveText("$37.00");
    await page.getByRole("button", { name: "Approve request", exact: true }).click();
    await expect(page.getByTestId("demo-balance")).toHaveText("$49.50");
    await page.getByRole("button", { name: "Settle sample balance" }).click();
    await expect(page.getByTestId("demo-balance")).toHaveText("$0.00");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/content-manager/demo");
    await page.getByLabel("Publication text").fill("A sample publication.");
    await page.getByRole("button", { name: "Mark ready", exact: true }).click();
    // Approval must be withdrawn when the exact draft changes.
    await page.getByLabel("Publication text").fill("A revised sample publication.");
    await expect(page.getByRole("button", { name: "Confirm approval" })).toHaveCount(0);
    await page.getByRole("button", { name: "Mark ready", exact: true }).click();
    await page.getByRole("button", { name: "Confirm approval" }).click();
    await page.getByRole("button", { name: "Reject & next" }).click();
    await expect(page.getByRole("heading", { name: "Sample queue reviewed" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Ready");
    await expect(page.getByRole("status")).toContainText("Rejected");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/recallable/demo");
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.getByText("Saturn.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("1 sample review completed.");
    expect(errors).toEqual([]);
  });
}

test("Store actions and public product resources lead visitors to the apps", async ({ page }) => {
  for (const [route, id] of [["better-workspace", "6822519097"], ["better-signals", "6824696184"], ["recallable", "6822919785"]]) {
    await page.goto(`/${route}`);
    await expect(page.locator(`a[href*="${id}"]`).first()).toBeVisible();
  }
  await page.goto("/content-manager");
  await expect(page.getByRole("link", { name: "Try the demo", exact: true })).toHaveAttribute("href", "/content-manager/demo");
  const response = await page.request.get("/api/projects/transactions.json");
  const { data } = await response.json();
  expect(data.description).toContain("Expo/React Native");
  expect(data.resources.map((r: { url: string }) => r.url)).toContain("/transactions/demo");
  expect(data.resources.some((r: { url: string }) => r.url.includes("6826151834"))).toBe(false);
});
