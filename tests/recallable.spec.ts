import { expect, test } from "@playwright/test";

const shotDir = process.env.RECALLABLE_SHOT_DIR;

for (const width of [1280, 390]) {
  test(`Recallable portfolio page, gallery and help pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const missing: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.host === "127.0.0.1:3001" && response.status() >= 400) missing.push(`${response.status()} ${url.pathname}`);
    });

    await page.goto("/projects/recallable");
    await expect(page.getByTestId("project-header-title-row").getByRole("heading", { name: "Recallable", exact: true })).toBeVisible();
    const hero = page.getByTestId("project-header-hero").locator("img").first();
    await expect(hero).toBeVisible();
    await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("project-readme")).toBeAttached();
    for (const label of [
      "iPhone: Home opens on a card, the answer with typeset math, and a focused round",
      "iPad: Home with every deck, and progress across decks",
      "Mac: Home with the next card",
      "Apple Watch: a typeset question, the answer with ratings, and the next card",
    ]) {
      const image = page.getByRole("img", { name: label, exact: true }).first();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(page.getByRole("link", { name: /Support/ }).first()).toHaveAttribute("href", /\/recallable\/support$/);
    // iOS 1.0 is public (October 24, 2026); the private source repository stays unlinked.
    await expect(page.locator('a[href*="github.com/ZSturman/Recallable"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    if (shotDir) {
      await page.waitForTimeout(800);
      await page.screenshot({ animations: "disabled", path: `${shotDir}/portfolio-${width === 1280 ? "desktop" : "mobile"}.png` });
    }

    for (const [route, heading] of [["privacy", "Recallable Privacy Policy"], ["support", "Recallable Help & Support"]]) {
      await page.goto(`/recallable/${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /Contact Zachary|Send a support request/ })).toHaveAttribute("href", "/contact");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    // Shared deck links land here when Recallable isn't installed (Firebase rewrites /recallable/deck/<id>).
    await page.goto("/recallable/deck");
    await expect(page.getByRole("heading", { name: "Someone shared a deck with you", exact: true })).toBeVisible();
    await expect(page.getByTestId("get-recallable")).toHaveAttribute("href", "https://apps.apple.com/app/id6822919785");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // The home page is the project listing; Recallable is featured and listed.
    await page.goto("/");
    await expect(page.locator('[data-testid="selected-work-item"][data-project-slug="recallable"]')).toBeVisible();
    const thumbnail = page.getByRole("img", { name: "Recallable thumbnail", exact: true }).first();
    await thumbnail.scrollIntoViewIfNeeded();
    await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await thumbnail.click();
    await expect.poll(() => page.url()).toMatch(/projects\/recallable|[?&]project=recallable/); // desktop opens the project modal

    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });
}
