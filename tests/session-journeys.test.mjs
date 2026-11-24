import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  analyzeSessions, classifySession, navigationFlows, narrateSession, pickNotableSessions, reconstructSession,
  serializeSession, summarizeSessions, zonedDayWindow,
} from "../lib/session-journeys.mjs";
import { ACTIVE_AFTER_INPUT_MS, ACTIVE_AFTER_SHOW_MS, PageActivityClock, nextSessionState, SESSION_INACTIVITY_MS } from "../lib/session-timing.mjs";
import { destinationCategory, EVENT_TAXONOMY, MEANINGFUL_EVENTS, sanitizeSessionParams, SESSION_EVENTS } from "../lib/analytics-taxonomy.mjs";
import * as scenarios from "./fixtures/analytics/synthetic-sessions.mjs";

const { titleForPath } = scenarios;
const opts = { titleForPath, timeZone: "America/Los_Angeles" };

function analyze(...parts) {
  return analyzeSessions(parts.map((p) => p.session), parts.flatMap((p) => p.events), opts);
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

test("foreground time excludes hidden periods and active time stops when idle", () => {
  const clock = new PageActivityClock(0, true);
  clock.input(2_000, "scroll");
  clock.setVisible(20_000, false); // background tab
  clock.setVisible(620_000, true); // back ten minutes later
  const snap = clock.snapshot(640_000);
  assert.equal(snap.fg_ms, 40_000, "20 s before + 20 s after; the 600 s hidden are excluded");
  assert.equal(snap.active_ms, 20_000 + ACTIVE_AFTER_SHOW_MS, "active until idle, then 10 s after returning");
  assert.equal(snap.hidden_count, 1);
});

test("a foreground tab without input stops accruing active time", () => {
  const clock = new PageActivityClock(0, true);
  clock.input(5_000, "pointer");
  const snap = clock.snapshot(300_000);
  assert.equal(snap.fg_ms, 300_000);
  assert.equal(snap.active_ms, 5_000 + ACTIVE_AFTER_INPUT_MS);
  assert.equal(clock.firstInputAt, 5_000);
});

test("pointer and scroll activity are tallied in coarse windows, not per event", () => {
  const clock = new PageActivityClock(0, true);
  for (let t = 0; t < 1_000; t += 16) clock.input(t, "pointer");
  for (let t = 1_000; t < 2_000; t += 16) clock.input(t, "scroll");
  clock.input(2_100, "key");
  const snap = clock.snapshot(3_000);
  assert.equal(snap.pointer, 1);
  assert.equal(snap.scrolls, 2);
  assert.equal(snap.keys, 1);
  clock.setVisible(3_000, false);
  clock.input(3_500, "key");
  assert.equal(clock.snapshot(4_000).keys, 1, "input while hidden is ignored");
});

test("session ids persist across navigation and rotate after inactivity", () => {
  let n = 0;
  const create = () => `session${String(++n).padStart(12, "0")}`;
  const first = nextSessionState(null, 1_000, create);
  assert.equal(first.isNew, true);
  const same = nextSessionState(first, 1_000 + 29 * 60_000, create);
  assert.equal(same.id, first.id);
  assert.equal(same.isNew, false);
  const rotated = nextSessionState(same, same.lastAt + SESSION_INACTIVITY_MS, create);
  assert.notEqual(rotated.id, first.id);
  assert.equal(nextSessionState({ id: "bad id!", lastAt: 1 }, 2, create).isNew, true);
});

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

test("taxonomy documents every event and marks visibility as non-meaningful", () => {
  const doc = fs.readFileSync(new URL("../docs/analytics/event-taxonomy.md", import.meta.url), "utf8");
  for (const name of Object.keys(EVENT_TAXONOMY)) assert.match(doc, new RegExp("`" + name + "`"), `${name} is documented`);
  for (const name of ["portfolio_section_view", "portfolio_section_engaged", "portfolio_scroll_depth", "project_open", "page_view"]) assert.ok(!MEANINGFUL_EVENTS.has(name));
  assert.ok(MEANINGFUL_EVENTS.has("project_resource_click"));
  assert.ok(!SESSION_EVENTS.has("portfolio_section_view"));
});

test("destination categories distinguish repositories, stores, downloads, demos and profiles", () => {
  assert.equal(destinationCategory("https://github.com/ZSturman/Better-Workspace-Public"), "repository");
  assert.equal(destinationCategory("https://github.com/ZSturman"), "social");
  assert.equal(destinationCategory("https://github.com/ZSturman/x/releases/download/v1/app.zip"), "download");
  assert.equal(destinationCategory("https://apps.apple.com/us/app/better-workspace/id1"), "app_store");
  assert.equal(destinationCategory("/better-workspace/demo"), "demo");
  assert.equal(destinationCategory("/projects/home-page"), "internal_project");
  assert.equal(destinationCategory("mailto:someone@example.com"), "email");
  assert.equal(destinationCategory("https://www.linkedin.com/in/someone"), "social");
  assert.equal(destinationCategory("https://yourdogcanstay.com"), "website");
});

test("session params are allow-listed: no titles, URLs, search text or unknown keys", () => {
  const out = sanitizeSessionParams("portfolio_filter_change", { filter_type: "search", filter_value: "my private query", project_title: "X", email: "a@b.c", surface: "projects" });
  assert.deepEqual(out, { filter_type: "search", surface: "projects" });
  const page = sanitizeSessionParams("page_view", { path: "/projects/x?token=abc#frag", destination_domain: "https://evil", fg_ms: "1200.6", pointer: -4 });
  assert.deepEqual(page, { path: "/projects/x", fg_ms: 1201, pointer: 0 });
  assert.deepEqual(sanitizeSessionParams("page_attention", { first_input_ms: 123 }), { first_input_ms: 123 });
});

// ---------------------------------------------------------------------------
// The ten required scenarios
// ---------------------------------------------------------------------------

test("1. single-page short visit stays uncertain and is not called engaged", () => {
  const [session] = analyze(scenarios.shortSinglePage());
  assert.equal(session.pageCount, 1);
  assert.equal(session.engagement, "glance");
  assert.equal(session.classification.category, "uncertain");
  assert.equal(session.referrer, "linkedin.com");
  assert.equal(session.timeline.at(-1).text, "Last observed activity");
});

test("2. multi-project exploration with a GitHub click is a likely-human journey in real order", () => {
  const [session] = analyze(scenarios.explorerClicksGithub());
  assert.equal(session.classification.category, "likely_human");
  assert.equal(session.engagement, "sustained");
  assert.deepEqual(session.pages.map((p) => p.path), ["/", "/projects", "/projects/better-workspace"]);
  const texts = session.timeline.map((i) => `${i.time} ${i.text}`);
  assert.deepEqual(texts, [
    "09:14:02 Arrived on Home from a github.com referral",
    "09:14:08 Opened Projects",
    "09:14:13 Filtered by domain: Apps",
    "09:14:17 Opened Better Workspace",
    "09:14:25 Scrolled to 75% of Better Workspace",
    "09:14:55 Kept description story in view for 30 s+",
    "09:15:02 Opened an image item in screenshots",
    "09:15:10 Opened the GitHub repository for Better Workspace (from project page)",
    "09:15:11 Last observed activity",
  ]);
  assert.equal(session.activeMs, 67_000);
  assert.equal(session.elapsedMs, 69_000);
  assert.deepEqual(session.openToAction, [{ slug: "better-workspace", ms: 53_000, destination: "repository" }]);
  assert.equal(session.timeToFirstInputMs, 1_500);
  assert.equal(session.timeToFirstActionMs, 68_000);
  assert.match(narrateSession(session, { titleForPath }), /^One likely-human session arrived on Home from a github\.com referral, went on to Projects, Better Workspace, spent about 52 seconds active on Better Workspace, kept its description story section in view for 30\+ seconds, and opened the GitHub repository for Better Workspace\.$/);
});

test("interleaved documents keep scroll depth and route changes on the correct page", () => {
  const base = Date.UTC(2026, 10, 22, 12);
  const session = reconstructSession({ session_id: "multi-document" }, [
    { event_id: "a-1", tab_id: "a", seq: 1, ts: base, name: "page_view", props: { path: "/", nav: "landing", pv: "home" } },
    { event_id: "b-1", tab_id: "b", seq: 1, ts: base + 2, name: "page_view", props: { path: "/projects", nav: "landing", pv: "projects" } },
    { event_id: "a-2", tab_id: "a", seq: 2, ts: base + 3, name: "portfolio_scroll_depth", props: { scroll_percent: 75 } },
    { event_id: "a-3", tab_id: "a", seq: 3, ts: base + 4, name: "page_view", props: { path: "/resume", nav: "route", pv: "resume" } },
  ], opts);
  assert.equal(session.timeline[1].text, "Opened Projects");
  assert.equal(session.timeline[2].text, "Scrolled to 75% of Home");
  assert.deepEqual(navigationFlows([session], opts).map((entry) => entry.flow).sort(), ["(entry) → Home", "Home → Resume"]);
});

test("3. background-tab time is excluded from active and foreground time", () => {
  const [session] = analyze(scenarios.backgroundTab());
  assert.equal(session.elapsedMs, 640_000);
  assert.equal(session.foregroundMs, 40_000, "latest cumulative snapshot, not elapsed time");
  assert.equal(session.activeMs, 33_000);
  assert.match(session.timeline[0].detail, /backgrounded 1×/);
  assert.ok(session.activeMs < session.elapsedMs);
});

test("4. repeated clicks are counted as events and as one session", () => {
  const sessions = analyze(scenarios.repeatedClicks());
  const summary = summarizeSessions(sessions, { titleForPath });
  assert.equal(summary.actions[0].events, 4);
  assert.equal(summary.actions[0].sessions, 1);
  assert.equal(summary.actionEvents, 4);
  assert.equal(summary.actionSessions, 1);
  assert.equal(summary.repeatedClicks.length, 1);
  assert.equal(summary.repeatedClicks[0].count, 4);
  const repeated = sessions[0].timeline.find((item) => item.repeat);
  assert.equal(repeated.repeat, 4, "the timeline collapses identical consecutive clicks");
});

test("5. rapid-fire navigation from a hosting network is likely automated with explicit evidence", () => {
  const [session] = analyze(scenarios.rapidFireAutomation());
  assert.equal(session.classification.category, "likely_automated");
  assert.equal(session.classification.confidence, "high");
  const codes = session.classification.evidence.map((e) => e.code);
  assert.ok(codes.includes("high_frequency"));
  assert.ok(codes.includes("no_input") || codes.includes("no_input_short"));
  assert.ok(codes.includes("automation_viewport"));
  assert.match(session.classification.summary, /^Likely automated — 10 page loads within/);
});

test("6. declared crawlers and QA runs are known categories, not inferences", () => {
  const sessions = analyze(scenarios.declaredCrawler(), scenarios.internalQa());
  assert.deepEqual(sessions.map((s) => s.classification.category).sort(), ["known_automated", "known_internal"]);
  assert.ok(sessions.every((s) => s.classification.confidence === "explicit"));
});

test("7. missing referral information is reported as unattributed, not as typed-in traffic", () => {
  const [session] = analyze(scenarios.missingReferral());
  assert.equal(session.referrer, "");
  assert.match(session.timeline[0].text, /with no referrer \(direct or unattributed\)/);
  assert.equal(serializeSession(session, { titleForPath }).referrer, "(no referrer)");
});

test("8. duplicate and delayed events are de-duplicated and cumulative attention keeps the maximum", () => {
  const [session] = analyze(scenarios.duplicateAndDelayed());
  assert.equal(session.duplicateEventsDropped, 1);
  assert.equal(session.actions.length, 1);
  assert.equal(session.foregroundMs, 60_000);
  assert.equal(session.activeMs, 50_000);
  const order = session.timeline.map((i) => i.text);
  assert.equal(order[0], "Arrived on Social Posts Content Manager from a bsky.app referral");
  assert.match(order[1], /^Opened the demo for Social Posts Content Manager/);
});

test("9. a session spanning midnight belongs to the day it started", () => {
  const part = scenarios.spansMidnight();
  const day = zonedDayWindow("2026-11-22", "America/Los_Angeles");
  const next = zonedDayWindow("2026-11-23", "America/Los_Angeles");
  assert.ok(part.session.started_at >= day.from && part.session.started_at < day.to);
  assert.ok(part.session.last_seen_at >= next.from, "its last activity is after midnight");
  assert.ok(!(part.session.started_at >= next.from && part.session.started_at < next.to), "not counted again the next day");
  const [session] = analyze(part);
  assert.deepEqual(session.timeline.map((i) => i.time), ["23:58:00", "23:59:00", "00:05:00"]);
  assert.equal(session.classification.category, "likely_human");
});

test("10. zero traffic and missing data produce empty, honest summaries", () => {
  const summary = summarizeSessions(analyzeSessions([], [], opts), { titleForPath });
  assert.equal(summary.total, 0);
  assert.equal(summary.counts.likely_human, 0);
  assert.equal(summary.medianActiveMsPeople, null);
  assert.deepEqual(pickNotableSessions([]), []);
  // A session row whose events never arrived.
  const [orphan] = analyzeSessions([{ session_id: "orphan0000000000", started_at: scenarios.BASE_TS, last_seen_at: scenarios.BASE_TS }], [], opts);
  assert.equal(orphan.engagement, "no_attention_data");
  assert.equal(orphan.pageCount, 0);
  assert.equal(orphan.classification.category, "uncertain");
});

// ---------------------------------------------------------------------------
// Cross-session evidence and summaries
// ---------------------------------------------------------------------------

test("repeated identical deep-link arrivals without input are likely automated; GA-style engagement does not rescue them", () => {
  const sessions = analyzeSessions(scenarios.repeatedDeepLinks().map((p) => p.session), scenarios.repeatedDeepLinks().flatMap((p) => p.events), opts);
  for (const session of sessions) {
    assert.equal(session.classification.category, "likely_automated");
    assert.ok(session.classification.evidence.some((e) => e.code === "repeated_journey"));
    assert.ok(session.foregroundMs > 10_000, "would satisfy GA4's 10-second engaged-session rule");
  }
});

test("a click with no pointer, touch or keyboard input is flagged as a synthetic-click pattern", () => {
  const [session] = analyze(scenarios.syntheticClick());
  assert.equal(session.classification.category, "likely_automated");
  assert.ok(session.classification.evidence.some((e) => e.code === "click_without_input"));
});

test("datacenter origin alone never makes a session automated", () => {
  const part = scenarios.explorerClicksGithub();
  part.session.network_class = "datacenter";
  part.session.network_org = "Google LLC";
  const [session] = analyze(part);
  assert.equal(session.classification.category, "likely_human");
  const quiet = scenarios.missingReferral();
  quiet.session.network_class = "datacenter";
  assert.notEqual(analyze(quiet)[0].classification.category, "likely_automated");
});

test("day summary keeps classifications separate and picks informative journeys", () => {
  const day = scenarios.representativeDay();
  const sessions = analyzeSessions(day.sessions, day.events, opts);
  const summary = summarizeSessions(sessions, { titleForPath });
  assert.equal(summary.total, 14);
  assert.equal(Object.values(summary.counts).reduce((a, b) => a + b, 0), summary.total, "categories partition the raw total");
  assert.equal(summary.counts.known_internal, 1);
  assert.equal(summary.counts.known_automated, 1);
  assert.ok(summary.counts.likely_automated >= 5);
  const notable = pickNotableSessions(sessions);
  assert.ok(notable.length >= 1 && notable.length <= 3);
  assert.ok(notable.every((s) => !/automated|internal/.test(s.classification.category)));
  assert.equal(notable[0].id, "explore0000000002");
  const flows = navigationFlows(sessions, { titleForPath });
  assert.ok(flows.some((f) => f.flow === "Projects → Better Workspace"));
  const bw = summary.projects.find((p) => p.slug === "better-workspace");
  assert.ok(bw.sessions > bw.humanSessions, "automated visits are not counted as human interest");
});

test("reconstruction never invents pages from aggregate data", () => {
  const session = reconstructSession({ session_id: "x".repeat(16) }, [], opts);
  assert.equal(session.pages.length, 0);
  assert.equal(session.timeline.length, 0);
  assert.equal(classifySession(session).category, "uncertain");
});
