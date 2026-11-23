import assert from "node:assert/strict";
import test from "node:test";

import { buildBrief, compareCount, compareRate, renderBriefHtml, renderBriefText } from "../scripts/analytics-brief.mjs";
import { buildAnalyticsLinks, fromSessions, loadSessionStream } from "../scripts/analytics-session-source.mjs";
import { buildDailyAnalyticsReport, buildEmail, enhanceWithLocalAnalysis } from "../scripts/daily-analytics-summary.mjs";
import { analyzeSessions } from "../lib/session-journeys.mjs";
import { createNov22Ga4Client, NOV22_REGISTERED_PARAMETERS } from "./fixtures/analytics/ga4-nov22-fixture.mjs";
import { representativeDay, titleForPath } from "./fixtures/analytics/synthetic-sessions.mjs";

const NOW = new Date("2026-11-23T14:05:00Z");
const LINKS = buildAnalyticsLinks({ apiBaseUrl: "https://api.example.com", dateIso: "2026-11-22", timeZone: "America/Los_Angeles" });

function stream() {
  const day = representativeDay();
  return fromSessions(analyzeSessions(day.sessions, day.events, { titleForPath, timeZone: "America/Los_Angeles" }), { titleForPath });
}

async function report({ sessionStream = stream(), client = createNov22Ga4Client({ registered: NOV22_REGISTERED_PARAMETERS }) } = {}) {
  return buildDailyAnalyticsReport({ client, propertyId: "0", rootDir: process.cwd(), dateIso: "2026-11-22", now: NOW, retryDelayMs: 0, sessionStream });
}

test("comparisons use absolute changes, percentage points, and no percentages on tiny baselines", () => {
  assert.equal(compareCount(49, 39, "Sat"), "+10 vs Sat (39, +26%)");
  assert.equal(compareCount(5, 2, "Sat"), "+3 vs Sat (2)");
  assert.equal(compareCount(3, 3, "Sat"), "±0 vs Sat (3)");
  assert.equal(compareCount(null, 3, "Sat"), null);
  assert.equal(compareRate(0.51, 0.0769, "Sat"), "+43 pp vs Sat");
});

test("brief with session evidence: separates human, automated and uncertain and keeps raw GA4 totals", async () => {
  const r = await report();
  const brief = buildBrief(r, LINKS);
  assert.ok(brief.summary.length >= 2 && brief.summary.length <= 4);
  assert.match(brief.summary[0], /^GA4 recorded 49 sessions, 10 more than Sat and well above the 7-day average of 8 a day\.$/);
  assert.match(brief.summary[1], /observed \d+ sessions\. \d+ likely human, \d+ known automated, \d+ suspected automated and \d+ unclassified\./);
  const labels = brief.metrics.map((m) => m.label);
  assert.deepEqual(labels, ["Sessions (GA4)", "Users (GA4 estimate)", "Likely human", "Likely automated", "Uncertain", "Engaged sessions (GA4 rule)", "Meaningful actions", "Active time, likely human"]);
  assert.equal(brief.metrics[0].value, "49");
  assert.match(brief.metrics.find((item) => item.label === "Engaged sessions (GA4 rule)").note, /51% · \+43 pp vs Sat/);
  assert.ok(brief.journeys.items.length >= 1 && brief.journeys.items.length <= 3);
  assert.match(brief.journeys.items[0].narrative, /^One likely-human session arrived on Home from a github\.com referral/);
  const actions = brief.did.items.find((item) => item.heading.startsWith("Actions"));
  assert.ok(actions.rows.some((row) => /events? · \d+ sessions?/.test(row)), "events and distinct sessions are shown separately");
});

test("findings explain the click/view mismatch, attribution and location without classifying by location", async () => {
  const brief = buildBrief(await report(), LINKS);
  const kinds = brief.findings.map((f) => f.kind);
  assert.ok(kinds.includes("attribution"));
  const clicks = brief.findings.find((f) => f.kind === "click_anomaly");
  assert.match(clicks.title, /^Better Workspace: 10 resource clicks vs 3 detail-page views$/);
  assert.match(clicks.detail, /7 of the clicks happened outside the detail page — \/projects \(5\), \/better-workspace \(2\)/);
  const geo = brief.findings.find((f) => f.kind === "geography");
  assert.match(geo.detail, /never used to classify a session/);
  assert.ok(brief.findings.length <= 5);
});

test("email wording never overclaims", async () => {
  const email = buildEmail(await report(), { links: LINKS });
  const text = email.text.toLowerCase();
  for (const banned of ["conversion", "installed", "installation", "confirmed human", "real people", "proves"]) assert.ok(!text.includes(banned), `no "${banned}"`);
  assert.match(email.text, /GA4 rule/);
  assert.doesNotMatch(email.html, /<script/i);
  const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.deepEqual(hrefs, [LINKS.report, LINKS.explorer]);
  for (const heading of ["SUMMARY", "KEY METRICS", "WHAT VISITORS DID", "NOTABLE JOURNEYS", "TRAFFIC QUALITY", "PROBLEMS AND OPPORTUNITIES", "DETAILS"]) assert.match(email.text, new RegExp(`^${heading}$`, "m"));
  assert.match(email.subject, /^zacharysturman\.com · Nov 22 · 49 sessions · \d+ likely human · \d+ actions$/);
  assert.match(email.html, /<html lang="en">/);
  assert.match(email.html, /max-width:640px/);
});

test("without session data the brief says so instead of inferring humans or journeys", async () => {
  const r = await report({ sessionStream: { available: false, reason: "The session collector is not deployed yet, so individual journeys are unavailable." } });
  const brief = buildBrief(r, null);
  assert.ok(!brief.metrics.some((m) => /human|automated/i.test(m.label)));
  assert.match(brief.summary.join(" "), /doesn't show a person was present/);
  assert.match(brief.summary.join(" "), /17 project-resource clicks from 9 sessions/);
  assert.equal(brief.journeys.items.length, 0);
  assert.match(brief.journeys.note, /not deployed/);
  assert.match(brief.quality.sentences.join(" "), /25 sessions met GA4's engagement rule, but only 4 sent GA4's end-of-page engagement event/);
  assert.match(renderBriefText(brief), /Report links are unavailable/);
  assert.equal(brief.did.source, "ga4");
});

test("zero-traffic days and failed GA4 queries are shown honestly", async () => {
  const empty = { async getMetadata() { return [{ dimensions: [], metrics: [] }]; }, async runReport() { return [{ rows: [] }]; } };
  const zero = buildBrief(await report({ client: empty, sessionStream: fromSessions([], { titleForPath }) }), null);
  assert.match(zero.summary[0], /recorded no sessions/);
  assert.match(zero.journeys.note, /recorded no sessions/);
  const failing = { async getMetadata() { throw new Error("metadata down"); }, async runReport() { throw new Error("quota exhausted"); } };
  const failed = buildBrief(await report({ client: failing, sessionStream: { available: false, reason: "Session data unavailable." } }), null);
  assert.match(failed.summary[0], /unavailable/);
  assert.equal(failed.metrics[0].value, "—");
  assert.match(failed.dataNotes[0], /partly unavailable/);
  assert.ok(renderBriefHtml(failed).includes("partly unavailable"));
});

test("email links contain dates and no authentication credentials", () => {
  const url = new URL(LINKS.explorer);
  assert.equal(url.pathname, "/analytics/explorer");
  assert.deepEqual([...url.searchParams.keys()], ["date", "tz"]);
  assert.equal(buildAnalyticsLinks({ apiBaseUrl: "", dateIso: "2026-11-22", timeZone: "UTC" }), null);
});

test("session source degrades gracefully and requests the reporting-day window", async () => {
  const notDeployed = await loadSessionStream({ apiBaseUrl: "https://api.example.com", internalToken: "t", dateIso: "2026-11-22", timeZone: "America/Los_Angeles", titleForPath, fetchImpl: async () => new Response("{}", { status: 404 }) });
  assert.equal(notDeployed.available, false);
  assert.match(notDeployed.reason, /not deployed/);
  const urls = [];
  const day = representativeDay();
  const ok = await loadSessionStream({
    apiBaseUrl: "https://api.example.com", internalToken: "t", dateIso: "2026-11-22", previousDateIso: "2026-11-21", timeZone: "America/Los_Angeles", titleForPath,
    fetchImpl: async (url, init) => { urls.push(url); assert.equal(init.headers.Authorization, "Bearer t"); return Response.json({ ok: true, sessions: urls.length === 1 ? day.sessions : [], events: urls.length === 1 ? day.events : [] }); },
  });
  assert.equal(ok.available, true);
  assert.equal(ok.summary.total, 13);
  assert.equal(ok.internalCount, 1);
  assert.equal(ok.previous.total, 0);
  assert.match(urls[0], /from=1795334400000&to=1795420800000$/);
});

test("a local narrative with numbers that are not in the facts is rejected", async () => {
  const r = await report();
  const fetchImpl = async () => Response.json({ choices: [{ message: { content: "Traffic hit 4,812 sessions, mostly human." } }] });
  const enhanced = await enhanceWithLocalAnalysis(r, { endpoint: "http://127.0.0.1:1234", fetchImpl });
  assert.equal(enhanced.analysisSource, "Deterministic local analysis");
  assert.ok(enhanced.warnings.some((w) => /numbers not in the supplied facts \(4812\)/.test(w)));
});
