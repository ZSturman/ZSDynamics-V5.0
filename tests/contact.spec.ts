import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __ZS_DISABLE_ANALYTICS__: true });
  });
  await page.route(
    /google-analytics\.com|googletagmanager\.com|firebaseinstallations\.googleapis\.com/,
    (r) => r.abort(),
  );
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: `const callbacks={};window.turnstile={render(el,options){el.textContent='Verification complete';callbacks[options.action]=options.callback;setTimeout(()=>options.callback('test-token'),0);return options.action;},reset(id){setTimeout(()=>callbacks[id]?.('fresh-token'),0);},remove(id){delete callbacks[id];}};`,
      }),
  );
  await page.goto("/contact");
});
test("forms have unique labels, native validation, and clear mobile layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Good work starts/,
  );
  await expect(
    page.getByRole("textbox", { name: "Email address", exact: true }),
  ).toHaveCount(2);
  const ids = await page
    .locator("input[id],textarea[id],select[id]")
    .evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByTestId("contact-form-submit").click();
  expect(
    await page
      .getByTestId("contact-form-name")
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("contact errors preserve the draft; retry saves once and supports another message", async ({
  page,
}) => {
  let attempts = 0;
  const ids: string[] = [];
  await page.route("https://api.example.test/contact", async (r) => {
    attempts++;
    ids.push(r.request().postDataJSON().requestId);
    await r.fulfill({
      status: attempts === 1 ? 503 : 200,
      json:
        attempts === 1
          ? { ok: false, error: "service_unavailable" }
          : { ok: true, status: "received", reference: ids.at(-1) },
    });
  });
  await page.getByTestId("contact-form-name").fill("Test Visitor");
  await page.getByTestId("contact-form-email").fill("visitor@example.com");
  await page
    .getByTestId("contact-form-message")
    .fill("Hello, a project question.");
  await page.getByTestId("contact-form-submit").click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByTestId("contact-form-message")).toHaveValue(
    "Hello, a project question.",
  );
  await expect(page.getByTestId("contact-form-submit")).toBeEnabled();
  await page.getByTestId("contact-form-submit").click();
  await expect(page.getByRole("status")).toContainText(
    "Your message has been saved.",
  );
  expect(ids[0]).toBe(ids[1]);
  await page.getByRole("button", { name: "Send another message" }).click();
  await expect(page.getByTestId("contact-form-submit")).toBeEnabled();
});
test("confirmed-writing flow gives accurate success copy and can be used again", async ({
  page,
}) => {
  await page.route(
    "https://api.example.test/newsletter-interest",
    async (r) => {
      expect(r.request().postDataJSON().consent).toBe(true);
      await r.fulfill({ json: { ok: true, status: "pending" } });
    },
  );
  await page.getByTestId("newsletter-form-email").fill("reader@example.com");
  await page.getByRole("checkbox").check();
  await page.getByTestId("newsletter-form-submit").click();
  await expect(page.getByRole("status")).toContainText("Check your inbox.");
  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(page.getByTestId("newsletter-form-submit")).toBeEnabled();
});
