import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`Better Workspace portfolio and release links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/projects/better-workspace");
    await expect(page.getByTestId("project-header-title-row").getByRole("heading", { name: "Better Workspace", exact: true })).toBeVisible();
    const hero = page.getByTestId("project-header-hero").locator("img").first();
    await expect(hero).toBeVisible();
    await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("project-readme")).toBeAttached();
    for (const label of ["Mac Overview with scored Next Action (sample workspace)", "iPhone idea priority and scoring (sample workspace)", "iPad project details and work plan (sample workspace)"]) {
      const image = page.getByRole("img", { name: label, exact: true }).first();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const titleRow = page.getByTestId("project-header-title-row");
    await expect(titleRow).toBeInViewport();
    await expect.poll(() => titleRow.evaluate(el => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 1) return false;
      }
      return true;
    })).toBe(true);
    await page.screenshot({ animations: "disabled", path: `docs/images/better-workspace/portfolio-${width === 1280 ? "desktop" : "mobile"}.png` });
    for (const [route, heading] of [["privacy", "Better Workspace Privacy Policy"], ["support", "Setup & Support"]]) {
      await page.goto(`/better-workspace/${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /Contact Zachary|Send a support request/ })).toHaveAttribute("href", "/contact");
    }
    expect(errors).toEqual([]);
  });
}
