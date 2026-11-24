import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

let mf, db;
const TOKEN = "test-internal-token";
const ORIGIN = "https://zacharysturman.com";
const PASSWORD = "test-portfolio-admin";
const BASIC = "Basic " + Buffer.from(`portfolio-admin:${PASSWORD}`).toString("base64");
const bindings = {
  ANALYTICS_ADMIN_PASSWORD: PASSWORD,
  ALLOWED_ORIGINS: ORIGIN,
  CONTACT_FROM_EMAIL: "contact@example.com",
  CONTACT_TO_EMAIL: "owner@example.com",
  RESEND_API_KEY: "test-key",
  INTERNAL_TOKEN: TOKEN,
  PUBLIC_SITE_URL: "https://site.example",
  SESSION_DAILY_EVENT_CAP: "200",
  SESSION_RETENTION_DAYS: "30",
};
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function loadSql(file) {
  return readFileSync(file, "utf8")
    .split("\n").map((line) => line.replace(/--.*$/, "")).join("\n")
    .split(";").map((s) => s.trim().replace(/\s*\n\s*/g, " ")).filter(Boolean).join(";\n") + ";";
}

function collect(body, { origin = ORIGIN, ua = CHROME_UA, cf } = {}) {
  return mf.dispatchFetch("https://api.example.com/collect", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain;charset=UTF-8", "User-Agent": ua },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...(cf ? { cf } : {}),
  });
}

function batch(events, extra = {}) {
  return { v: 2, sid: SID, tab: "tab001", sent_at: Date.now(), ctx: { viewport: "desktop" }, events, ...extra };
}

let seq = 0;
function ev(name, props = {}, ts = Date.now()) {
  seq += 1;
  return { id: `tab001-${seq}`, seq, ts, name, props };
}

function sign(exp) {
  return createHmac("sha256", TOKEN).update(`analytics-link:v1:${exp}`).digest("hex");
}

before(async () => {
  const bundle = await build({
    stdin: {
      contents: `import worker from './src/index.ts'; export default {async fetch(request,env){if(new URL(request.url).pathname==='/__test/jobs'){await worker.scheduled({cron:'0 * * * *'},env);return new Response('ok');}return worker.fetch(request,env);}};`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, format: "esm", target: "es2022",
  });
  mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2024-11-01",
    d1Databases: ["INTAKE_DB"],
    bindings,
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/projects/projects.json") return Response.json([{ slug: "better-workspace", title: "Better Workspace" }]);
      if (url.pathname === "/articles/articles.json") return Response.json([]);
      return new Response("not found", { status: 404 });
    },
  });
  db = await mf.getD1Database("INTAKE_DB");
  await db.exec(loadSql("migrations/0001_intake.sql"));
  await db.exec(loadSql("migrations/0002_sessions.sql"));
});
after(async () => { await mf?.dispose(); });
beforeEach(async () => {
  for (const table of ["analytics_events", "analytics_sessions", "analytics_daily_counters", "analytics_reports"]) await db.prepare(`DELETE FROM ${table}`).run();
  seq = 0;
});

test("collect accepts an allow-listed batch and stores only coarse, sanitized data", async () => {
  const res = await collect(batch([
    ev("page_view", { path: "/projects/better-workspace?ref=secret", group: "project", slug: "better-workspace", nav: "landing", ref_host: "github.com", pv: "pv0001", project_title: "Should be dropped" }),
    ev("portfolio_filter_change", { filter_type: "search", filter_value: "private words", surface: "projects" }),
    ev("project_resource_click", { project_slug: "better-workspace", destination_category: "repository", destination_url: "https://github.com/x/y?token=1", surface: "project_page" }),
    ev("portfolio_section_view", { section_key: "project_hero" }),
  ]), { cf: { asn: 15169, asOrganization: "Google LLC", country: "US" } });
  assert.equal(res.status, 204);
  const session = await db.prepare("SELECT * FROM analytics_sessions").first();
  assert.equal(session.browser_family, "Chrome");
  assert.equal(session.os_family, "macOS");
  assert.equal(session.device_category, "desktop");
  assert.equal(session.ua_automation, null);
  assert.equal(session.network_class, "datacenter");
  assert.equal(session.network_org, "Google LLC");
  assert.ok(!JSON.stringify(session).includes("Mozilla"), "raw user agent is never stored");
  const events = (await db.prepare("SELECT name, props FROM analytics_events ORDER BY seq").all()).results;
  assert.deepEqual(events.map((e) => e.name), ["page_view", "portfolio_filter_change", "project_resource_click"], "visibility-only events are not part of the session stream");
  const [page, filter, click] = events.map((e) => JSON.parse(e.props));
  assert.equal(page.path, "/projects/better-workspace", "query strings are stripped");
  assert.equal(page.project_title, undefined);
  assert.equal(filter.filter_value, undefined, "search text is not stored");
  assert.equal(click.destination_url, undefined);
  assert.equal(click.destination_category, "repository");
});

test("privacy relays are not treated as datacenter traffic", async () => {
  await collect(batch([ev("page_view", { path: "/", group: "home", pv: "pv0001" })]), { cf: { asn: 36183, asOrganization: "Akamai Technologies", country: "US" } });
  assert.equal((await db.prepare("SELECT network_class, network_org FROM analytics_sessions").first()).network_class, "consumer_or_unknown");
});

test("collect rejects foreign origins, malformed batches and mismatched ids", async () => {
  assert.equal((await collect(batch([ev("page_view")]), { origin: "https://evil.example" })).status, 403);
  assert.equal((await collect("{not json")).status, 400);
  assert.equal((await collect("null")).status, 400);
  assert.equal((await collect(batch([ev("page_view")], { sid: "short" }))).status, 400);
  assert.equal((await collect(batch(Array.from({ length: 51 }, () => ev("page_view"))))).status, 400);
  assert.equal((await collect(batch([{ id: "other-1", seq: 1, ts: Date.now(), name: "page_view", props: {} }]))).status, 400);
  assert.equal((await collect(batch([ev("made_up_event")]))).status, 400);
  assert.equal((await db.prepare("SELECT count(*) n FROM analytics_events").first()).n, 0);
});

test("duplicate deliveries are ignored and clock skew is corrected", async () => {
  const skew = 10 * 60 * 1000; // client clock ten minutes fast
  const clientNow = Date.now() + skew;
  const first = ev("page_view", { path: "/", group: "home", pv: "pv0001" }, clientNow - 5_000);
  const body = batch([first], { sent_at: clientNow });
  assert.equal((await collect(body)).status, 204);
  assert.equal((await collect(body)).status, 204, "a retried beacon is accepted");
  const rows = (await db.prepare("SELECT ts, client_ts FROM analytics_events").all()).results;
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].ts - (Date.now() - 5_000)) < 3_000, "server-corrected timestamp");
  assert.equal(rows[0].client_ts, clientNow - 5_000);
  const session = await db.prepare("SELECT batches, received_events FROM analytics_sessions").first();
  assert.equal(session.batches, 2);
  assert.equal(session.received_events, 1);
  assert.equal((await db.prepare("SELECT events FROM analytics_daily_counters").first()).events, 1);
});

test("declared automation is recorded without storing the user agent", async () => {
  await collect(batch([ev("page_view", { path: "/", group: "home", pv: "pv0001" })], { ctx: { dav: 1, nwc: 1, qa: "Release-42!" } }), { ua: "Mozilla/5.0 HeadlessChrome/120.0" });
  const session = await db.prepare("SELECT * FROM analytics_sessions").first();
  assert.equal(session.ua_automation, "headlesschrome");
  assert.equal(session.default_automation_viewport, 1);
  assert.equal(session.no_window_chrome, 1);
  assert.equal(session.qa_run, "release-42");
});

test("daily event cap protects the free tier", async () => {
  for (let i = 0; i < 4; i += 1) {
    assert.equal((await collect(batch(Array.from({ length: 50 }, () => ev("portfolio_scroll_depth", { scroll_percent: 25 }))))).status, 204);
  }
  const res = await collect(batch([ev("page_view", { path: "/" })]));
  assert.equal(res.status, 429);
  const counters = await db.prepare("SELECT events FROM analytics_daily_counters").first();
  assert.equal(counters.events, 200);
});

test("concurrent ingestion reserves capacity exactly once", async () => {
  const one = batch(Array.from({ length: 50 }, () => ev("page_view")));
  const results = await Promise.all([collect(one), collect(one), collect(one), collect(one)]);
  assert.ok(results.every((result) => result.status === 204));
  const remaining = await Promise.all(Array.from({ length: 4 }, () => collect(batch(Array.from({ length: 50 }, () => ev("page_view"))))));
  assert.equal(remaining.filter((result) => result.status === 204).length, 3);
  assert.equal(remaining.filter((result) => result.status === 429).length, 1);
  assert.equal((await db.prepare("SELECT events, sessions FROM analytics_daily_counters").first()).events, 200);
  assert.equal((await db.prepare("SELECT received_events FROM analytics_sessions").first()).received_events, 200);
});

test("internal session window requires the bearer token", async () => {
  await collect(batch([ev("page_view", { path: "/", group: "home", pv: "pv0001" })]));
  const from = Date.now() - 3_600_000, to = Date.now() + 60_000;
  assert.equal((await mf.dispatchFetch(`https://api.example.com/internal/analytics/sessions?from=${from}&to=${to}`)).status, 401);
  const res = await mf.dispatchFetch(`https://api.example.com/internal/analytics/sessions?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.sessions.length, 1);
  assert.equal(body.events.length, 1);
  assert.equal(body.retentionDays, 30);
});

test("the explorer requires separate sign-in and rejects forwarded or forged credentials", async () => {
  const now = Date.now();
  await collect(batch([
    ev("page_view", { path: "/projects/better-workspace", group: "project", slug: "better-workspace", nav: "landing", ref_host: "github.com", pv: "pv0001" }, now - 90_000),
    ev("page_attention", { pv: "pv0001", fg_ms: 85_000, active_ms: 70_000, pointer: 12, scrolls: 9, keys: 0, touches: 0, first_input_ms: 2_000 }, now - 5_000),
    ev("project_resource_click", { project_slug: "better-workspace", destination_category: "repository", surface: "project_page" }, now - 4_000),
  ]));
  const exp = now + 7 * 864e5;
  const page = await mf.dispatchFetch("https://api.example.com/analytics/explorer", { headers: { Authorization: BASIC } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get("Content-Security-Policy"), /script-src 'nonce-/);
  assert.equal(page.headers.get("Referrer-Policy"), "no-referrer");
  assert.match(await page.text(), /Session explorer/);

  const fromDay = new Date(now - 90_000).toISOString().slice(0, 10);
  const toDay = new Date(now).toISOString().slice(0, 10);
  const data = await (await mf.dispatchFetch(`https://api.example.com/analytics/explorer/data?from_date=${fromDay}&to_date=${toDay}&tz=UTC`, { headers: { Authorization: BASIC } })).json();
  assert.equal(data.sessions.length, 1);
  const [session] = data.sessions;
  assert.equal(session.classification.category, "likely_human");
  assert.equal(session.landing, "Better Workspace");
  assert.match(session.timeline[0].text, /Arrived on Better Workspace from a github\.com referral/);
  assert.equal(data.summary.counts.likely_human, 1);

  assert.equal((await mf.dispatchFetch(`https://api.example.com/analytics/explorer?exp=${now - 1}&sig=${sign(now - 1)}`)).status, 401);
  assert.equal((await mf.dispatchFetch(`https://api.example.com/analytics/explorer?exp=${exp}&sig=${"0".repeat(64)}`)).status, 401);
  assert.equal((await mf.dispatchFetch(`https://api.example.com/analytics/explorer?exp=${exp}&sig=${sign(exp)}`)).status, 401);
  assert.equal((await mf.dispatchFetch("https://api.example.com/analytics/explorer", { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 401);
  const wrong = await mf.dispatchFetch("https://api.example.com/analytics/explorer", { headers: { Authorization: "Basic " + Buffer.from("portfolio-admin:wrong").toString("base64") } });
  assert.equal(wrong.status, 401);
  assert.match(wrong.headers.get("WWW-Authenticate"), /^Basic/);
});

test("detailed reports are stored by bearer and served after separate administrator sign-in", async () => {
  const store = await mf.dispatchFetch("https://api.example.com/internal/analytics/report", {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date: "2026-11-22", html: "<html><body>Detailed</body></html>" }),
  });
  assert.equal(store.status, 200);
  const res = await mf.dispatchFetch("https://api.example.com/analytics/report?date=2026-11-22", { headers: { Authorization: BASIC } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "<html><body>Detailed</body></html>");
  assert.match(res.headers.get("Content-Security-Policy"), /default-src 'none'/);
  assert.equal((await mf.dispatchFetch("https://api.example.com/analytics/report?date=2026-11-21", { headers: { Authorization: BASIC } })).status, 404);
});

test("hourly cron enforces retention", async () => {
  const old = Date.now() - 40 * 864e5;
  await db.prepare("INSERT INTO analytics_sessions (session_id, started_at, last_seen_at, created_at) VALUES ('old0000000000000', ?, ?, ?)").bind(old, old, old).run();
  await db.prepare("INSERT INTO analytics_events (session_id, event_id, tab_id, seq, ts, client_ts, received_at, name, props) VALUES ('old0000000000000','t-1','t',1,?,?,?,'page_view','{}')").bind(old, old, old).run();
  await collect(batch([ev("page_view", { path: "/", pv: "pv0001" })]));
  assert.equal((await mf.dispatchFetch("http://localhost/__test/jobs")).status, 200);
  assert.equal((await db.prepare("SELECT count(*) n FROM analytics_sessions").first()).n, 1);
  assert.equal((await db.prepare("SELECT count(*) n FROM analytics_events").first()).n, 1);
});
