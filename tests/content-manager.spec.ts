import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__ = true; });
});
for (const width of [390, 1280]) {
  test(`Content Manager publication pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/content-manager");
    await expect(page.getByRole("heading", { level: 1, name: "Social Posts Content Manager", exact: true })).toBeVisible();
    await expect(page.getByTestId("beta-status")).toContainText("No public beta invitation");
    for (const image of await page.locator("main img").all()) {
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Setup & support", exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Setup & Support" })).toBeVisible();
    await page.getByRole("link", { name: "Privacy policy", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await page.goto("/projects/content-manager");
    await expect(page.getByTestId("project-header-title-row").getByRole("heading", { name: "Social Posts Content Manager", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
