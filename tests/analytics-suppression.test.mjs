import test from "node:test";
import assert from "node:assert/strict";

import { getAnalyticsSuppressionReason, shouldCollectAnalytics } from "../lib/analytics-suppression.mjs";

const productionBrowser = {
  enabled: true,
  hostname: "zacharysturman.com",
  userAgent: "Mozilla/5.0 Chrome/130 Safari/537.36",
  webdriver: false,
};

test("allows analytics only for a normal production browser", () => {
  assert.equal(getAnalyticsSuppressionReason(productionBrowser), null);
  assert.equal(shouldCollectAnalytics(productionBrowser), true);
});

test("suppresses local, preview, explicit, and automated browsers before GA4 initializes", () => {
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, hostname: "127.0.0.1" }), "non_production_hostname");
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, hostname: "portfolio--pr-12.web.app" }), "non_production_hostname");
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, automationFlag: true }), "explicit_automation_or_disable_flag");
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, webdriver: true }), "webdriver");
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, userAgent: "Mozilla/5.0 HeadlessChrome Playwright" }), "automation_user_agent");
  assert.equal(getAnalyticsSuppressionReason({ ...productionBrowser, enabled: false }), "analytics_disabled_by_build");
});
