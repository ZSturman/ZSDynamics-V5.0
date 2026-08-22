import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type ChangeSummary = { changedRoutes?: unknown };

function routeCandidates(): string[] {
  const routes = new Set<string>(["/", "/articles", "/work-logs"]);
  const summaryPath = process.env.PORTFOLIO_CHANGED_ROUTES_FILE;
  if (summaryPath && fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as ChangeSummary;
      for (const route of Array.isArray(summary.changedRoutes) ? summary.changedRoutes : []) {
        if (typeof route === "string" && route.startsWith("/")) routes.add(route);
      }
    } catch {
      // The representative routes below still cover the public site.
    }
  }
  try {
    const projects = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/projects/projects.json"), "utf8")) as Array<{ href?: string }>;
    const articles = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/articles/articles.json"), "utf8")) as Array<{ href?: string }>;
    if (projects[0]?.href) routes.add(projects[0].href);
    if (articles[0]?.href) routes.add(articles[0].href);
  } catch {
    // Route availability will be caught by the base-page coverage.
  }
  return [...routes].slice(0, 8);
}

function attachDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const baseOrigin = new URL(process.env.PORTFOLIO_QA_BASE_URL || "https://zacharysturman.com").origin;
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const type = request.resourceType();
    if (["document", "script", "stylesheet", "image", "fetch", "xhr"].includes(type) && new URL(request.url()).origin === baseOrigin) {
      failedRequests.push(`${type}: ${request.url()} (${request.failure()?.errorText || "failed"})`);
    }
  });
  return { consoleErrors, failedRequests };
}

async function expectUsableLayout(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not horizontally overflow its viewport").toBeLessThanOrEqual(2);
  await expect(page.locator("body")).toBeVisible();
}

test.describe("Live portfolio production QA", () => {
  test("homepage and primary navigation load without browser errors", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.getByTestId("site-page-frame")).toBeVisible();
    const articlesLink = page.locator('a[href="/articles"]').first();
    await expect(articlesLink).toBeVisible();
    await articlesLink.click();
    await expect(page).toHaveURL(/\/articles$/);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const workLogsLink = page.locator('a[href="/work-logs"]').first();
    await expect(workLogsLink).toBeVisible();
    await workLogsLink.click();
    await expect(page).toHaveURL(/\/work-logs$/);
    await expectUsableLayout(page);
    await page.waitForTimeout(500);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });

  test("important and changed routes return usable pages", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    for (const route of routeCandidates()) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should load`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
      await expectUsableLayout(page);
    }
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });

  test("visible primary images load", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const response = await page.goto("/", { waitUntil: "networkidle", timeout: 30_000 });
    expect(response?.status()).toBeLessThan(400);
    const brokenImages = await page.locator("img").evaluateAll((images) => (images as HTMLImageElement[])
      .filter((image) => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("src") || "unknown image"));
    expect(brokenImages, "visible images should complete successfully").toEqual([]);
    await expectUsableLayout(page);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });
});
