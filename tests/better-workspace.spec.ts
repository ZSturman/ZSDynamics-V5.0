import { expect, test } from "@playwright/test";

// Also imported by the live-production config. Keep automation out of GA4.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__ = true; });
});

for (const width of [1280, 390]) {
  test(`Better Workspace public release and demo at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/projects/better-workspace");
    await expect(page.getByTestId("project-header-title-row").getByRole("heading", { name: "Better Workspace", exact: true })).toBeVisible();
    const actions = page.getByTestId("project-header-resource-row");
    for (const label of ["Download for Mac", "Try Demo", "View Source", "Visit"]) {
      await expect(actions.getByRole("button", { name: new RegExp(`${label}$`) })).toBeVisible();
    }
    await expect(actions.getByRole("button", { name: /privacy|support/i })).toHaveCount(0);
    const hero = page.getByTestId("project-header-hero").locator("img").first();
    await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.waitForLoadState("networkidle");
    await page.goto("/better-workspace");
    await expect(page.getByRole("heading", { name: "Better Workspace", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download for Mac", exact: true }).first()).toHaveAttribute("href", "https://github.com/ZSturman/Better-Workspace-Public/releases/download/v1.0/BetterWorkspace-1.0-8-mac.zip");
    await expect(page.getByRole("link", { name: "View Source", exact: true }).first()).toHaveAttribute("href", "https://github.com/ZSturman/Better-Workspace-Public");
    await expect(page.getByTestId("store-status")).toContainText(/App Store/);
    await expect(page.getByRole("link", { name: "Get on the App Store" })).toHaveCount(0);
    for (const image of await page.locator("main img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ fullPage: true, animations: "disabled", path: `docs/images/better-workspace/release-${width}.png` });
    await page.waitForLoadState("networkidle");
    await page.goto("/better-workspace/demo");
    await expect(page.getByRole("heading", { name: "A little workspace. A next step." })).toBeVisible();
    for (const title of ["2. Projects & tasks", "3. Ideas", "4. Quick Capture", "5. Progress & work", "6. Across devices"]) {
      await page.getByRole("button", { name: title, exact: true }).click();
      const img = page.locator("figure img");
      await expect.poll(() => img.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    }
    await page.getByRole("checkbox", { name: "Sketch the weekly journal" }).check();
    await expect(page.getByText(/1 of 1 sample tasks complete/)).toBeVisible();
    await page.getByLabel("Try a quick capture").fill("Fictional autumn leaf collection");
    await page.getByRole("button", { name: "Capture in demo" }).click();
    await expect(page.getByLabel("Demo inbox")).toContainText("Fictional autumn leaf collection");
    await page.getByRole("button", { name: "Start sample session" }).click();
    await page.getByRole("button", { name: "Finish sample session" }).click();
    await expect(page.getByText(/Sample session finished/)).toBeVisible();
    await page.getByRole("button", { name: "Reset demonstration" }).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByLabel("Demo inbox")).toHaveText("Demo inbox · 0");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ fullPage: true, animations: "disabled", path: `docs/images/better-workspace/demo-${width}.png` });
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByLabel("Demo inbox")).toHaveText("Demo inbox · 0");
    for (const [route, heading] of [["privacy", "Better Workspace Privacy Policy"], ["support", "Setup & Support"]]) {
      await page.waitForLoadState("networkidle");
      await page.goto(`/better-workspace/${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
