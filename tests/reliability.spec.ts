import { expect, test, type Page } from "@playwright/test";
import articles from "../public/articles/articles.json";

type Event = { name: string; params: Record<string, unknown> };
async function events(page: Page, name: string): Promise<Event[]> {
  return page.evaluate((name) => ((window as Window & { __ZS_ANALYTICS_LOG__?: Event[] }).__ZS_ANALYTICS_LOG__ || []).filter((e) => e.name === name), name);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __ZS_DISABLE_ANALYTICS__: true, __ZS_ANALYTICS_LOG__: [] }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  Object.assign(page, { reliabilityErrors: errors });
  await page.route(/google-analytics\.com|googletagmanager\.com|firebaseinstallations\.googleapis\.com/, (route) => route.abort());
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { reliabilityErrors?: string[] }).reliabilityErrors || [], "page runtime and hydration errors").toEqual([]);
});
async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect.poll(async () => (await events(page, "portfolio_route_view")).length, { timeout: 15000 }).toBeGreaterThan(0);
}

test("series links update results, composable filters preserve campaigns, and history restores state", async ({ page }) => {
  const series = articles.find((a) => a.series)!.series!;
  await gotoReady(page, "/articles?utm_source=test&utm_campaign=preserve");
  const rows = page.getByTestId("article-list-item-root");
  await expect(rows).toHaveCount(articles.length);
  await rows.getByRole("link", { name: `Series: ${series}`, exact: true }).first().click();
  await expect(page).toHaveURL(/utm_campaign=preserve/);
  await expect(rows).toHaveCount(articles.filter((a) => a.series === series).length);
  await page.goBack();
  await expect(rows).toHaveCount(articles.length);
  await page.goForward();
  await expect(rows).toHaveCount(articles.filter((a) => a.series === series).length);
  await gotoReady(page, "/articles?utm_source=test&utm_campaign=preserve");
  await page.getByLabel("Filter by series", { exact: true }).selectOption(series);
  await expect(page).toHaveURL(/utm_campaign=preserve/);
  await page.getByRole("textbox", { name: "Search articles" }).fill("no such article qwerty");
  await expect(page.getByText("No articles match the current search.")).toBeVisible();
  await expect(page).toHaveURL(/q=no/);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(rows).toHaveCount(articles.filter((a) => a.series === series).length);
  await page.goBack();
  await expect(page.getByLabel("Filter by series", { exact: true })).toHaveValue("");
  await expect(rows).toHaveCount(articles.length);
  expect((await events(page, "portfolio_route_view")).length).toBe(1);
});
test("work-log dialogs have stable links, restore on history, and close direct links", async ({ page }) => {
  await gotoReady(page, "/work-logs?utm_campaign=logs");
  const latest = page.getByRole("button", { name: /Most recent session/ });
  await latest.click();
  await expect(page).toHaveURL(/log=/);
  const url = page.url();
  const title = await page.getByRole("dialog").getByRole("heading", { level: 2 }).textContent();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(latest).toBeFocused();
  await page.goForward();
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText(title!);
  await gotoReady(page, url);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/log=/);
  await expect(page).toHaveURL(/utm_campaign=logs/);
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: "Switch to timeline view" }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Activity", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("work-log-activity-timeline")).toBeVisible();
});
test("Recallable emits one meaningful demo completion per attempt with no entered content", async ({ page }) => {
  await gotoReady(page, "/recallable/demo?utm_source=test");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Show answer", exact: true }).click();
    await page.getByRole("button", { name: "Good", exact: true }).click();
  }
  expect(await events(page, "product_demo_start")).toHaveLength(1);
  expect(await events(page, "product_view")).toHaveLength(1);
  const complete = await events(page, "product_demo_complete");
  expect(complete).toHaveLength(1);
  expect(complete[0].params.product_id).toBe("5031ef4c-2724-54a4-92ca-42d270a59716");
  expect(complete[0].params.product_slug).toBe("recallable");
  expect(complete[0].params).not.toHaveProperty("text");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("button", { name: "Show answer", exact: true }).click();
  expect(await events(page, "product_demo_start")).toHaveLength(2);
});
test("long-section attention pauses when hidden, discards removed elements, and resets on navigation", async ({ page }) => {
  await page.clock.install();
  await gotoReady(page, "/articles");
  await expect.poll(async () => (await events(page, "portfolio_route_view")).length).toBe(1);
  await page.evaluate(() => {
    const section = document.createElement("section");
    section.dataset.analyticsSection = "long_test";
    section.style.cssText = "position:fixed;inset:0 0 auto;height:5000px;width:100%;pointer-events:none";
    document.body.append(section);
    Object.assign(window, { __visible: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (window as Window & { __visible?: boolean }).__visible ? "visible" : "hidden" });
  });
  await page.clock.runFor(1000);
  await expect.poll(async () => (await events(page, "portfolio_section_view")).filter((e) => e.params.section_key === "long_test").length).toBe(1);
  await page.clock.runFor(3000);
  await page.evaluate(() => { Object.assign(window, { __visible: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(60000);
  expect((await events(page, "portfolio_section_engaged")).filter((e) => e.params.section_key === "long_test")).toHaveLength(0);
  await page.evaluate(() => { Object.assign(window, { __visible: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(3000);
  let attention = (await events(page, "portfolio_section_engaged")).filter((e) => e.params.section_key === "long_test");
  expect(attention.map((e) => e.params.engagement_bucket)).toEqual(["5s"]);
  await page.evaluate(() => document.querySelector('[data-analytics-section="long_test"]')?.remove());
  await page.clock.runFor(60000);
  attention = (await events(page, "portfolio_section_engaged")).filter((e) => e.params.section_key === "long_test");
  expect(attention).toHaveLength(1);
  const menu = page.getByRole("button", { name: "Open menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByTestId("site-nav").getByRole("link", { name: "Apps", exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await page.evaluate(() => {
    const section = document.createElement("section");
    section.dataset.analyticsSection = "long_test";
    section.style.cssText = "position:fixed;inset:0 0 auto;height:5000px;width:100%;pointer-events:none";
    document.body.append(section);
  });
  await page.clock.runFor(3000);
  expect((await events(page, "portfolio_section_engaged")).filter((e) => e.params.section_key === "long_test")).toHaveLength(1);
});

test("Transactions completes only after approving and settling the sample request", async ({ page }) => {
  await gotoReady(page, "/transactions/demo");
  await page.getByRole("button", { name: "Settle sample balance" }).click();
  expect(await events(page, "product_demo_complete")).toHaveLength(0);
  await page.getByRole("button", { name: "Approve request" }).click();
  await page.getByRole("button", { name: "Settle sample balance" }).click();
  expect(await events(page, "product_demo_start")).toHaveLength(1);
  expect(await events(page, "product_demo_complete")).toHaveLength(1);
});
test("Content Manager requires explicit approval and never sends edited draft text", async ({ page }) => {
  await gotoReady(page, "/content-manager/demo");
  await page.getByLabel("Publication text", { exact: true }).fill("Private synthetic draft that must never be sent");
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  expect(await events(page, "product_demo_complete")).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  expect(await events(page, "product_demo_complete")).toHaveLength(1);
  const log = await page.evaluate(() => (window as Window & { __ZS_ANALYTICS_LOG__?: Event[] }).__ZS_ANALYTICS_LOG__);
  expect(JSON.stringify(log)).not.toContain("Private synthetic draft");
});
test("Better Workspace task completion emits once and store actions have one canonical event", async ({ page }) => {
  await gotoReady(page, "/better-workspace/demo");
  await page.getByRole("checkbox", { name: "Sketch the weekly journal" }).check();
  await page.getByRole("checkbox", { name: "Sketch the weekly journal" }).uncheck();
  await page.getByRole("checkbox", { name: "Sketch the weekly journal" }).check();
  expect(await events(page, "product_demo_start")).toHaveLength(1);
  expect(await events(page, "product_demo_complete")).toHaveLength(1);
  await page.route("https://apps.apple.com/**", (route) => route.fulfill({ body: "Mock store" }));
  // Prevent leaving the page while exercising the actual delegated click tracker.
  await page.getByRole("link", { name: "Install for iPhone & iPad", exact: true }).evaluate((anchor) => anchor.addEventListener("click", (event) => event.preventDefault()));
  await page.getByRole("link", { name: "Install for iPhone & iPad", exact: true }).click();
  const resources = await events(page, "project_resource_click");
  expect(resources).toHaveLength(1);
  expect(resources[0].params.action_type).toBe("store");
  expect(resources[0].params.product_slug).toBe("better-workspace");
  expect(await events(page, "outbound_click")).toHaveLength(0);
});
test("article chronology, contents anchors and related project transitions remain source-backed", async ({ page }) => {
  const article = articles.find((a) => a.projectIds?.length)!;
  await gotoReady(page, article.href);
  const header = page.getByTestId("article-header-block");
  if (Date.parse(article.updatedAt) <= Date.parse(article.publishedAt!)) await expect(header).not.toContainText("Updated");
  await expect(header).toContainText(/min read/);
  const contents = page.getByTestId("article-contents");
  if (await contents.count()) {
    await contents.getByText("Contents", { exact: true }).click();
    for (const link of await contents.getByRole("link").all()) {
      const id = (await link.getAttribute("href"))!.slice(1);
      expect(await page.evaluate((id) => document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length, id)).toBe(1);
    }
  }
  await page.getByTestId("article-connected-project-card").first().click();
  expect(await events(page, "article_project_click")).toHaveLength(1);
});

test("saved display preferences restore without resurrecting old searches or overriding explicit URLs", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("articles.filters.v1", JSON.stringify({ viewMode: "grid", sort: "oldest", searchQuery: "obsolete-filter", visibilityFilter: "all" })));
  await gotoReady(page, "/articles");
  await expect(page.getByTestId("article-card-root")).toHaveCount(articles.length);
  await expect(page.getByRole("textbox", { name: "Search articles" })).toHaveValue("");
  await expect(page).toHaveURL(/view=grid/);
  await gotoReady(page, "/articles?view=list&sort=newest");
  await expect(page.getByTestId("article-list-item-root")).toHaveCount(articles.length);
  await expect(page).toHaveURL(/view=list&sort=newest/);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("articles.filters.v1") || "{}"));
  expect(saved).toEqual({ viewMode: "list", sort: "newest" });
});
