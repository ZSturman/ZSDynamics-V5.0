import assert from "node:assert/strict";
import test from "node:test";

function installBrowser(href, referrer = "") {
  const store = new Map();
  const replaced = [];
  const url = new URL(href);
  globalThis.window = {
    location: { href, search: url.search, origin: url.origin, pathname: url.pathname, hash: url.hash },
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
    history: { replaceState: (...args) => replaced.push(args) },
  };
  globalThis.document = { referrer };
  return { store, replaced };
}

test("campaign parameters are captured for events and left in the URL for GA4's landing page view", async () => {
  const { replaced } = installBrowser(
    "https://zacharysturman.com/?utm_source=email&utm_medium=outreach&utm_campaign=spring-applications",
    "https://mail.example.com/",
  );
  const utm = await import(`../lib/analytics-utm.ts?case=${Date.now()}`);
  utm.captureUtmOnLoad();
  assert.deepEqual(utm.getStoredUtm(), {
    utm_source: "email",
    utm_medium: "outreach",
    utm_campaign: "spring-applications",
    utm_referrer: "mail.example.com",
  });
  assert.equal(replaced.length, 0, "the URL must not be rewritten before GA4 records the landing page view");
  assert.equal(utm.getQaRun(), undefined);
});

test("QA runs are marked with a sanitized identifier", async () => {
  installBrowser("https://zacharysturman.com/?utm_source=qa&zs_qa=Release-2026<script>");
  const utm = await import(`../lib/analytics-utm.ts?case=qa-${Date.now()}`);
  utm.captureUtmOnLoad();
  assert.equal(utm.getQaRun(), "release-2026script");
});
