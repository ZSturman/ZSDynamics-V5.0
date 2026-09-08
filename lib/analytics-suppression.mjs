/**
 * Decides whether this browser may initialize the production GA4 property.
 * This is deliberately dependency-free so browser tools and Node tests use the
 * exact same policy.
 */
const DEFAULT_PRODUCTION_HOSTS = ["zacharysturman.com", "www.zacharysturman.com"];

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function hosts(value) {
  const configured = String(value || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_PRODUCTION_HOSTS;
}

export function getAnalyticsSuppressionReason({
  enabled,
  disabled,
  hostname,
  userAgent,
  webdriver,
  automationFlag,
  allowedHosts,
} = {}) {
  if (!truthy(enabled)) return "analytics_disabled_by_build";
  if (truthy(disabled) || truthy(automationFlag)) return "explicit_automation_or_disable_flag";
  if (webdriver) return "webdriver";

  const ua = String(userAgent || "").toLowerCase();
  if (/(headless|playwright|puppeteer|phantomjs|lighthouse|pagespeed)/.test(ua)) {
    return "automation_user_agent";
  }

  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!hosts(allowedHosts).includes(host)) return "non_production_hostname";
  return null;
}

export function shouldCollectAnalytics(context) {
  return getAnalyticsSuppressionReason(context) === null;
}
