import { expect, test, type Page } from "@playwright/test";

// Runs under playwright.contact.config.ts. GA4 stays suppressed and the
// session stream runs in observe-only mode (window.__ZS_SESSION_LOG__):
// batches are recorded in the page and nothing is sent to /collect.

type Batch = { sid: string; tab: string; events: Array<{ id: string; seq: number; ts: number; name: string; props: Record<string, string | number> }> };
type LoggedEvent = { name: string; params: Record<string, string | number> };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __ZS_DISABLE_ANALYTICS__: true, __ZS_ANALYTICS_LOG__: [], __ZS_SESSION_LOG__: [] });
    window.open = () => null; // resource buttons open external links in new tabs
  });
  await page.route(/google-analytics\.com|googletagmanager\.com|firebaseinstallations\.googleapis\.com/, (r) => r.abort());
  await page.route("**/collect", () => { throw new Error("observe-only mode must not send to /collect"); });
});

async function batches(page: Page): Promise<Batch[]> {
  await page.evaluate(() => (window as unknown as { __ZS_FLUSH_SESSION__?: () => void }).__ZS_FLUSH_SESSION__?.());
  return page.evaluate(() => (window as unknown as { __ZS_SESSION_LOG__: Batch[] }).__ZS_SESSION_LOG__);
}

/** Wait until hydration has started the collector and recorded a page view. */
async function streamReady(page: Page, path: string): Promise<void> {
  await page.waitForFunction((expected) => {
    const w = window as unknown as { __ZS_FLUSH_SESSION__?: () => void; __ZS_SESSION_LOG__: Batch[] };
    w.__ZS_FLUSH_SESSION__?.();
    return w.__ZS_SESSION_LOG__.some((b) => b.events.some((e) => e.name === "page_view" && e.props.path === expected));
  }, path);
}

async function gaEvents(page: Page): Promise<LoggedEvent[]> {
  return page.evaluate(() => (window as unknown as { __ZS_ANALYTICS_LOG__: LoggedEvent[] }).__ZS_ANALYTICS_LOG__);
}

test("one session spans client-side navigation with ordered, allow-listed events", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("selected-work-item").first()).toBeVisible();
  await streamReady(page, "/");
  await page.mouse.move(200, 200);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const slug = await page.getByTestId("selected-work-item").first().getAttribute("data-project-slug");
  await page.getByTestId("selected-work-item").first().getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${slug}$`));
  await streamReady(page, `/projects/${slug}`);
  await page.mouse.wheel(0, 800);

  const all = await batches(page);
  expect(new Set(all.map((b) => b.sid)).size).toBe(1);
  const events = all.flatMap((b) => b.events);
  const views = events.filter((e) => e.name === "page_view");
  expect(views.map((e) => e.props.path)).toEqual(["/", `/projects/${slug}`]);
  expect(views[0].props.nav).toBe("landing");
  expect(views[1].props.nav).toBe("route");
  const seqs = events.map((e) => e.seq);
  expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
  expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  const homeAttention = events.filter((e) => e.name === "page_attention" && e.props.pv === views[0].props.pv);
  expect(homeAttention.at(-1)?.props.final).toBe(1);
  expect(Number(homeAttention.at(-1)?.props.scrolls)).toBeGreaterThan(0);
  expect(events.some((e) => e.name === "project_open" && e.props.project_slug === slug)).toBe(true);
  // Exposure-only events and free text never enter the stream.
  expect(events.some((e) => e.name === "portfolio_section_view")).toBe(false);
  for (const event of events) expect(JSON.stringify(event.props)).not.toMatch(/https?:\/\/|_title|label"/);
});

test("a deep-link landing keeps its first page view and project open in order", async ({ page }) => {
  await page.goto("/");
  const slug = await page.getByTestId("selected-work-item").first().getAttribute("data-project-slug");
  const href = `/projects/${slug}`;
  const fresh = page;
  await fresh.goto(href); // full document load: the page's own effects run before the layout's
  await streamReady(fresh, href);
  const events = (await batches(fresh)).flatMap((b) => b.events);
  expect(events[0].name).toBe("page_view");
  expect(events[0].props.nav).toBe("landing");
  const open = events.findIndex((e) => e.name === "project_open");
  expect(open).toBeGreaterThan(0);
  expect(events.filter((e) => e.name === "page_view")).toHaveLength(1);
});

test("background time is not counted as foreground or active time", async ({ page }) => {
  await page.goto("/projects");
  await streamReady(page, "/projects");
  await page.mouse.move(100, 100);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(2_500);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500);
  const events = (await batches(page)).flatMap((b) => b.events);
  const attention = events.filter((e) => e.name === "page_attention").at(-1)!;
  const view = events.find((e) => e.name === "page_view")!;
  const elapsed = attention.ts - view.ts;
  expect(Number(attention.props.hidden_count)).toBe(1);
  expect(Number(attention.props.fg_ms)).toBeLessThan(elapsed - 2_000);
  expect(Number(attention.props.active_ms)).toBeLessThanOrEqual(Number(attention.props.fg_ms));
});

test("a project-card resource click records where it happened, not the last visible section", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects");
  const card = page.locator('[data-analytics-surface="project_grid"], [data-analytics-surface="project_list"]').filter({ has: page.locator('[data-analytics-item="project_resource"]') }).first();
  await expect(card).toBeVisible();
  const cardSlug = await card.getAttribute("data-analytics-project-slug");
  const surface = await card.getAttribute("data-analytics-surface");
  await card.locator('[data-analytics-item="project_resource"]').first().click();
  const clicks = (await gaEvents(page)).filter((e) => e.name === "project_resource_click");
  expect(clicks).toHaveLength(1);
  expect(clicks[0].params.project_slug).toBe(cardSlug);
  expect(clicks[0].params.surface).toBe(surface);
  expect(clicks[0].params.destination_category).toBeTruthy();
  expect(clicks[0].params.section_label).toBeUndefined();
  const streamClick = (await batches(page)).flatMap((b) => b.events).find((e) => e.name === "project_resource_click");
  expect(streamClick?.props.surface).toBe(surface);
});
