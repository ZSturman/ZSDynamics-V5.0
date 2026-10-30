import { expect, test, type Page } from "@playwright/test";

// Runs under playwright.contact.config.ts (mocked contact API and Turnstile).
// GA4 stays suppressed; the test-only __ZS_ANALYTICS_LOG__ observer records
// which events the site would send.

type LoggedEvent = { name: string; params: Record<string, string | number> };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const store = window.sessionStorage;
    const previous = JSON.parse(store.getItem("__zs_test_events") || "[]");
    const log: unknown[] = previous;
    const push = log.push.bind(log);
    log.push = (...items: unknown[]) => {
      const result = push(...items);
      store.setItem("__zs_test_events", JSON.stringify(log));
      return result;
    };
    Object.assign(window, { __ZS_DISABLE_ANALYTICS__: true, __ZS_ANALYTICS_LOG__: log });
  });
  await page.route(/google-analytics\.com|googletagmanager\.com|firebaseinstallations\.googleapis\.com/, (r) => r.abort());
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `const callbacks={};window.turnstile={render(el,o){el.textContent='Verification complete';callbacks[o.action]=o.callback;setTimeout(()=>o.callback('test-token'),0);return o.action;},reset(id){setTimeout(()=>callbacks[id]?.('fresh-token'),0);},remove(id){delete callbacks[id];}};`,
    }),
  );
});

async function events(page: Page): Promise<LoggedEvent[]> {
  return page.evaluate(() => JSON.parse(window.sessionStorage.getItem("__zs_test_events") || "[]"));
}

const named = (list: LoggedEvent[], name: string) => list.filter((event) => event.name === name);

test("campaign visitor journey records attributed, non-duplicated conversions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("https://api.example.test/contact", (r) =>
    r.fulfill({ status: 200, json: { ok: true, status: "received", reference: "test-ref" } }),
  );

  // 1–2. Campaign landing; parameters stay in the URL for GA4's landing page view.
  await page.goto("/?utm_source=email&utm_medium=outreach&utm_campaign=journey-test");
  await expect(page).toHaveURL(/utm_campaign=journey-test/);
  await expect(page.getByTestId("selected-work-item").first()).toBeVisible();

  // 3. Open a featured project.
  const firstSlug = await page.getByTestId("selected-work-item").first().getAttribute("data-project-slug");
  await page.getByTestId("selected-work-item").first().getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${firstSlug}$`));

  // 4. Navigate to another project.
  await page.goBack();
  const secondSlug = await page.getByTestId("selected-work-item").nth(1).getAttribute("data-project-slug");
  await page.getByTestId("selected-work-item").nth(1).getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${secondSlug}$`));

  // 5. Download the résumé.
  await page.getByTestId("site-nav").getByRole("link", { name: "Résumé" }).click();
  const download = page.waitForEvent("download");
  await page.getByTestId("resume-page-download").click();
  expect((await download).suggestedFilename()).toBe("Zachary Sturman Resume.pdf");

  // 6–7. Open contact and send a message.
  await page.getByTestId("site-nav").getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await page.getByTestId("contact-form-name").fill("Journey Test");
  await page.getByTestId("contact-form-email").fill("visitor@example.com");
  await page.getByTestId("contact-form-message").fill("Synthetic journey test message.");
  await page.getByTestId("contact-form-submit").click();
  await expect(page.getByRole("status")).toContainText("Your message has been saved.");

  await expect.poll(async () => named(await events(page), "contact_submit").length).toBe(1);
  const log = await events(page);

  // Attribution persists on every event in the session.
  expect(log.length).toBeGreaterThan(5);
  for (const event of log) expect(event.params.utm_campaign, event.name).toBe("journey-test");

  // Each action is recorded exactly once.
  expect(named(log, "project_open").map((event) => event.params.project_slug)).toEqual([firstSlug, secondSlug]);
  expect(named(log, "project_open").every((event) => event.params.open_surface === "project_page")).toBe(true);
  expect(named(log, "resume_download")).toHaveLength(1);
  expect(named(log, "resume_download")[0].params.surface).toBe("resume-page");
  expect(named(log, "resume_view")).toHaveLength(0);
  expect(named(log, "contact_click")).toHaveLength(1);
  expect(named(log, "contact_submit")[0].params.status).toBe("success");
  expect(named(log, "contact_submit_failed")).toHaveLength(0);

  // Route views follow navigation without duplicates.
  const routes = named(log, "portfolio_route_view").map((event) => event.params.page_path);
  expect(routes).toEqual(["/", `/projects/${firstSlug}`, "/", `/projects/${secondSlug}`, "/resume", "/contact"]);

  // No personal data leaves in event parameters.
  const serialized = JSON.stringify(log);
  expect(serialized).not.toContain("visitor@example.com");
  expect(serialized).not.toContain("Journey Test");
  expect(serialized).not.toContain("Synthetic journey");
});

test("failed and rate-limited submissions are never recorded as sent", async ({ page }) => {
  let attempt = 0;
  await page.route("https://api.example.test/contact", (r) => {
    attempt += 1;
    return attempt === 1
      ? r.fulfill({ status: 429, json: { ok: false, error: "rate_limited" } })
      : r.fulfill({ status: 503, json: { ok: false, error: "service_unavailable" } });
  });
  await page.goto("/contact");
  await page.getByTestId("contact-form-name").fill("Journey Test");
  await page.getByTestId("contact-form-email").fill("visitor@example.com");
  await page.getByTestId("contact-form-message").fill("Synthetic failure test.");
  for (let i = 0; i < 2; i += 1) {
    await page.getByTestId("contact-form-submit").click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("contact-form-submit")).toBeEnabled();
  }
  await expect.poll(async () => named(await events(page), "contact_submit_failed").length).toBe(2);
  const log = await events(page);
  expect(named(log, "contact_submit")).toHaveLength(0);
  expect(named(log, "contact_submit_failed").map((event) => event.params.status)).toEqual(["rate_limited", "error"]);
});

test("archive filters record one event per change and a settled search keyword", async ({ page }) => {
  await page.goto("/projects");
  await page.getByTestId("project-focus-hardware").click();
  await page.getByTestId("project-evidence-source").click();
  await page.getByPlaceholder("Search projects or use tags:react").fill("esp32 controller");
  await expect.poll(async () => named(await events(page), "portfolio_filter_change").length, { timeout: 8000 }).toBe(3);
  await page.waitForTimeout(1500);
  const filters = named(await events(page), "portfolio_filter_change").map((event) => `${event.params.filter_type}=${event.params.filter_value}`);
  expect(filters).toEqual(["focus=hardware", "evidence=source:on", "search=esp32 controller"]);
});

test("QA sessions are marked as internal traffic", async ({ page }) => {
  await page.goto("/?utm_source=qa&utm_medium=test&utm_campaign=release-verify&zs_qa=journey-1");
  // Wait for the analytics bootstrap (first route view) so the delegated listener is attached.
  await expect.poll(async () => named(await events(page), "portfolio_route_view").length).toBeGreaterThan(0);
  await page.getByTestId("hero-contact").click();
  await expect(page).toHaveURL(/\/contact/);
  await expect.poll(async () => named(await events(page), "contact_click").length).toBe(1);
  const log = await events(page);
  for (const event of log) {
    expect(event.params.traffic_type).toBe("internal");
    expect(event.params.qa_run).toBe("journey-1");
  }
});
