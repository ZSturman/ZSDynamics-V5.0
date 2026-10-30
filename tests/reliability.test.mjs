import test from "node:test";
import assert from "node:assert/strict";
import { AttentionClock, meaningfullyVisible } from "../lib/attention.mjs";
import { annotateHeadings, readingMinutes } from "../lib/article-reading.ts";
import { getApplications, productContexts, productForPath, resourceAction } from "../lib/product-presentation.ts";
import { buildTrafficQuality } from "../scripts/daily-analytics-summary.mjs";

test("long sections qualify relative to the viewport; offscreen and zero-sized sections do not", () => {
  assert.equal(meaningfullyVisible({ top: -400, bottom: 4600, left: 0, right: 800, width: 800, height: 5000 }, 1000, 800), true);
  assert.equal(meaningfullyVisible({ top: 800, bottom: 5800, left: 0, right: 800, width: 800, height: 5000 }, 1000, 800), false);
  assert.equal(meaningfullyVisible({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }, 1000, 800), false);
});
test("attention pauses for background time, deduplicates buckets, and starts a fresh visit clock", () => {
  const clock = new AttentionClock();
  assert.deepEqual(clock.update(0, true), []);
  assert.deepEqual(clock.update(4000, false), []);
  assert.deepEqual(clock.update(64000, false), []);
  assert.deepEqual(clock.update(65000, true), []);
  assert.deepEqual(clock.update(66000, true), [5]);
  assert.deepEqual(clock.update(67000, true), []);
  assert.deepEqual(new AttentionClock().update(67000, true), []);
});
test("contents and rendered headings share deterministic Unicode IDs, including duplicates", () => {
  const tree = { children: [
    { type: "code", value: "## not a heading" },
    ...["Hello!", "Hello!", "Café & 中文"].map(value => ({ type: "heading", depth: 2, children: [{ type: "text", value }] })),
  ] };
  const headings = annotateHeadings(tree);
  assert.deepEqual(headings.map(h => h.id), ["hello", "hello-2", "café-中文"]);
  assert.equal(tree.children[2].data.hProperties.id, headings[1].id);
  assert.deepEqual(annotateHeadings(tree), headings);
  assert.equal(readingMinutes("word ".repeat(441)), 3);
});
test("apps derive from opted-in generated records and respect public visibility", () => {
  const projects = [
    { id: "a", slug: "app", title: "App", application: { landingPath: "/app", platforms: ["Mac"] } },
    { id: "b", title: "Research" },
    { id: "c", title: "Private", application: { landingPath: "/private" }, isPublic: false },
  ];
  assert.equal(getApplications(projects).length, 1);
  const contexts = productContexts(projects);
  assert.equal(productForPath(contexts, "/app/demo").id, "a");
  assert.equal(productForPath(contexts, "/apple"), undefined);
  assert.equal(resourceAction({ url: "https://apps.apple.com/app/id1", label: "Get app" }), "store");
  assert.equal(resourceAction({ url: "https://github.com/a/b/releases/x.zip", label: "Mac" }), "download");
});
test("aggregate traffic cannot create human, suspicious, or multi-route session counts", () => {
  const q = buildTrafficQuality({ sessions: 10, engagedSessions: 2, eventCount: 30 }, {}, { keyActionCount: 1 }, {}, { routeViewEvents: 12, routeViewSessions: 4, knownSyntheticSessions: 0 });
  assert.equal(q.sessionsWithoutObservedEngagement, 8);
  assert.equal(q.extraRouteEvents, 8);
  assert.equal(q.knownSyntheticSessions, 0);
  for (const key of ["likelyHumanSessions", "suspiciousSessions", "likelyAutomatedSessions", "multiRouteSessionEstimate"]) assert.equal(key in q, false);
  assert.equal(q.lowEngagement, false);
  assert.deepEqual(q.reasons, []);
});
test("missing quality queries remain unknown while an observed zero remains zero", () => {
  const q = buildTrafficQuality({ sessions: 0, engagedSessions: null }, {}, {}, {}, { knownSyntheticSessions: null });
  assert.equal(q.rawSessions, 0);
  assert.equal(q.engagedSessions, null);
  assert.equal(q.knownSyntheticSessions, null);
  assert.equal(q.extraRouteEvents, null);
  assert.equal(q.actionsPerSession, null);
});

test("new event diagnostics reject missing context and invalid product identities", async () => {
  const { analyticsEventIssue } = await import("../lib/product-presentation.ts");
  const products = [{ id: "stable-id", slug: "app" }];
  assert.match(analyticsEventIssue("product_demo_complete", {}, products), /product_id.*product_slug.*surface/);
  assert.match(analyticsEventIssue("product_view", { product_id: "wrong", product_slug: "app", surface: "test" }, products), /invalid product identity/);
  assert.equal(analyticsEventIssue("product_view", { product_id: "stable-id", product_slug: "app", surface: "test" }, products), null);
  assert.equal(analyticsEventIssue("resume_download", {}, products), null);
});

test("export metadata validation catches inherited home canonicals and missing descriptions", async () => {
  const { metadataErrors } = await import("../scripts/validate-site-metadata.mjs");
  const html = '<title>Articles</title><meta name="description" content="Writing"><link rel="canonical" href="https://zacharysturman.com/articles"><meta property="og:url" content="https://zacharysturman.com/articles"><meta name="twitter:card" content="summary_large_image">';
  assert.deepEqual(metadataErrors(html, "/articles"), []);
  assert.match(metadataErrors(html.replaceAll('com/articles', 'com/'), "/articles").join(" "), /incorrect canonical/);
  assert.match(metadataErrors(html.replace('<meta name="description" content="Writing">', ''), "/articles").join(" "), /missing description/);
});

test("work-log durations distinguish unavailable, recorded, calculated, and explicit estimates", async () => {
  const { describeWorkLogDuration: duration } = await import("../lib/work-log-duration.mjs");
  assert.deepEqual(duration({}), { minutes: null, source: "Unavailable" });
  assert.deepEqual(duration({ durationMinutes: 0 }), { minutes: null, source: "Unavailable" });
  assert.deepEqual(duration({ durationMinutes: 25 }), { minutes: 25, source: "Recorded" });
  assert.deepEqual(duration({ durationMinutes: 25, durationEstimated: true }), { minutes: 25, source: "Estimated" });
  assert.deepEqual(duration({ sessionStart: "2026-01-01T12:00:00Z", sessionEnd: "2026-01-01T12:25:00Z" }), { minutes: 25, source: "Calculated" });
  assert.deepEqual(duration({ durationMinutes: Infinity, startTime: "bad", endTime: "bad" }), { minutes: null, source: "Unavailable" });
  assert.equal(duration({ sessionStart: "2026-01-01T12:00:00Z", sessionEnd: "2026-01-01T11:00:00Z" }).minutes, null);
});
