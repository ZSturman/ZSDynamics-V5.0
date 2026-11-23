/**
 * First-party anonymous session analytics.
 *
 *   POST /collect                         browser batches (allow-listed origin, size and rate caps)
 *   GET  /internal/analytics/sessions     bearer; raw sessions + events for a time window (daily report)
 *   POST /internal/analytics/report       bearer; stores the detailed HTML report for a reporting day
 *   GET  /analytics/explorer              administrator sign-in; session explorer UI
 *   GET  /analytics/explorer/data         administrator sign-in; analysed sessions JSON
 *   GET  /analytics/report                administrator sign-in; stored detailed report
 *
 * Privacy: no IP address, user-agent string, cookie or visitor id is stored.
 * The UA is reduced to browser/OS family, device class and an automation
 * token; Cloudflare's ASN is reduced to "datacenter" (with the hosting
 * organisation name) or "consumer_or_unknown". Rows expire after
 * SESSION_RETENTION_DAYS.
 */

import { hasAnalyticsAccess } from "./analytics-access";
import { SESSION_EVENTS, sanitizeSessionParams } from "../../lib/analytics-taxonomy.mjs";
import { analyzeSessions, navigationFlows, serializeSession, summarizeSessions, zonedDayWindow } from "../../lib/session-journeys.mjs";

export interface SessionEnv {
  INTAKE_DB?: D1Database;
  INTERNAL_TOKEN: string;
  ALLOWED_ORIGINS: string;
  PUBLIC_SITE_URL?: string;
  ANALYTICS_ADMIN_PASSWORD?: string;
  SESSION_RETENTION_DAYS?: string;
  SESSION_DAILY_EVENT_CAP?: string;
  SESSION_DAILY_SESSION_CAP?: string;
}

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS_PER_BATCH = 50;
const MAX_EVENTS_PER_SESSION = 1500;
const CLOCK_TOLERANCE_MS = 2_000;
const MAX_EVENT_AGE_MS = 6 * 60 * 60 * 1000;

// Hosting/cloud ASNs. Privacy relays and CDNs that carry ordinary people
// (iCloud Private Relay via Akamai/Cloudflare/Fastly, Cloudflare WARP) are
// deliberately excluded: they are not evidence of automation.
const DATACENTER_ASNS = new Set([
  15169, 396982, 19527, 16509, 14618, 8987, 8075, 8068, 14061, 16276, 24940, 63949, 20473, 31898, 45102, 132203,
  51167, 12876, 60781, 9009, 212238, 36352, 46606, 32934, 135377, 55286, 62567, 394711, 397423, 54825, 40021,
]);
const RELAY_ASNS = new Set([13335, 209242, 36183, 20940, 16625, 54113]);
const HOSTING_ORG = /(amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai connected cloud|vultr|choopa|oracle|alibaba|tencent|contabo|scaleway|leaseweb|m247|datacamp|colocrossing|hosting|data ?cent(er|re)|server|vps)/i;
const AUTOMATION_UA = /(headlesschrome|headless|bot\b|bot\/|crawler|crawl|spider|slurp|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|python-requests|python-urllib|aiohttp|curl\/|wget\/|httpclient|go-http-client|axios\/|node-fetch|undici|okhttp|scrapy|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|statuscake)/i;

type Batch = { v?: unknown; sid?: unknown; tab?: unknown; sent_at?: unknown; ctx?: Record<string, unknown>; events?: unknown };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers },
  });
}

function allowedOrigins(env: SessionEnv): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsFor(origin: string | null, env: SessionEnv): Record<string, string> {
  return origin && allowedOrigins(env).includes(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {};
}

export function describeUserAgent(ua: string): { browser: string; os: string; device: string; automation: string | null } {
  const automation = ua ? (AUTOMATION_UA.exec(ua)?.[1] || null) : "empty_user_agent";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS|Chromium/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|iPod/.test(ua) ? "mobile" : "desktop";
  return { browser, os, device, automation: automation ? automation.toLowerCase().slice(0, 40) : null };
}

export function describeNetwork(cf: { asn?: unknown; asOrganization?: unknown } | undefined): { networkClass: string; org: string | null } {
  const asn = Number(cf?.asn);
  const org = typeof cf?.asOrganization === "string" ? cf.asOrganization.slice(0, 80) : "";
  if (RELAY_ASNS.has(asn)) return { networkClass: "consumer_or_unknown", org: null };
  if (DATACENTER_ASNS.has(asn) || (org && HOSTING_ORG.test(org))) return { networkClass: "datacenter", org: org || `AS${asn}` };
  return { networkClass: "consumer_or_unknown", org: null };
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** POST /collect */
export async function handleCollect(request: Request, env: SessionEnv, now = Date.now()): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsFor(origin, env);
  if (!origin || !allowedOrigins(env).includes(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (!env.INTAKE_DB) return json({ ok: false, error: "storage_unavailable" }, 503, cors);
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: "too_large" }, 413, cors);
  if (request.headers.get("Sec-GPC") === "1") return new Response(null, { status: 204, headers: cors });
  const reader = request.body?.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let length = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.byteLength > bytes.length) {
          void reader.cancel().catch(() => undefined);
          return json({ ok: false, error: "too_large" }, 413, cors);
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
    } catch { return json({ ok: false, error: "invalid_body" }, 400, cors); }
  }
  let batch: Batch;
  try {
    batch = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))) as Batch;
    if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("Invalid batch");
  } catch { return json({ ok: false, error: "invalid_json" }, 400, cors); }

  const sid = typeof batch.sid === "string" ? batch.sid : "";
  const tab = typeof batch.tab === "string" ? batch.tab : "";
  if (batch.v !== 2 || !/^[a-z0-9]{16,40}$/i.test(sid) || !/^[a-z0-9]{6,24}$/i.test(tab) || !Array.isArray(batch.events) || !batch.events.length || batch.events.length > MAX_EVENTS_PER_BATCH) {
    return json({ ok: false, error: "invalid_batch" }, 400, cors);
  }
  const sentAt = Number(batch.sent_at);
  const rawOffset = Number.isFinite(sentAt) ? now - sentAt : 0;
  const offset = Math.abs(rawOffset) <= CLOCK_TOLERANCE_MS ? 0 : rawOffset;

  const events: Array<{ id: string; seq: number; ts: number; clientTs: number; name: string; props: string }> = [];
  const seen = new Set<string>();
  for (const raw of batch.events as Array<Record<string, unknown>>) {
    const name = typeof raw?.name === "string" ? raw.name : "";
    const seq = Number(raw?.seq);
    const clientTs = Number(raw?.ts);
    const id = typeof raw?.id === "string" ? raw.id : "";
    if (!SESSION_EVENTS.has(name) || !Number.isSafeInteger(seq) || seq < 1 || !Number.isFinite(clientTs) || id !== `${tab}-${seq}` || seen.has(id)) continue;
    seen.add(id);
    const ts = Math.min(now, Math.max(now - MAX_EVENT_AGE_MS, Math.round(clientTs + offset)));
    const props = sanitizeSessionParams(name, (raw.props && typeof raw.props === "object" ? raw.props : {}) as Record<string, unknown>);
    events.push({ id, seq, ts, clientTs: Math.round(clientTs), name, props: JSON.stringify(props) });
  }
  if (!events.length) return json({ ok: false, error: "no_valid_events" }, 400, cors);

  const db = env.INTAKE_DB;
  const day = utcDay(now);
  const eventCap = Number(env.SESSION_DAILY_EVENT_CAP || 20_000);
  const sessionCap = Number(env.SESSION_DAILY_SESSION_CAP || 3_000);
  const ua = describeUserAgent(request.headers.get("User-Agent") || "");
  const net = describeNetwork((request as Request & { cf?: { asn?: unknown; asOrganization?: unknown; country?: unknown } }).cf);
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  const ctx = batch.ctx && typeof batch.ctx === "object" ? batch.ctx : {};
  const qa = typeof ctx.qa === "string" ? ctx.qa.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || null : null;
  const batchId = crypto.randomUUID();
  const input = JSON.stringify(events.map((event) => [event.id, event.seq, event.ts, event.clientTs, event.name, event.props]));
  // D1 executes the batch as a transaction. Reserve capacity for distinct new
  // event IDs and require the same reservation for both writes that follow.
  const result = await db.batch([
    db.prepare("INSERT OR IGNORE INTO analytics_daily_counters(day) VALUES (?)").bind(day),
    db.prepare(
      `WITH usage AS (
         SELECT (SELECT COUNT(*) FROM json_each(?1) AS entry
                 WHERE NOT EXISTS (SELECT 1 FROM analytics_events WHERE session_id = ?2 AND event_id = entry.value ->> 0)) AS new_events,
                (SELECT received_events FROM analytics_sessions WHERE session_id = ?2) AS existing_events
       )
       UPDATE analytics_daily_counters
       SET events = events + new_events, sessions = sessions + (existing_events IS NULL), last_batch = ?3
       FROM usage
       WHERE day = ?4 AND events + new_events <= ?5 AND sessions + (existing_events IS NULL) <= ?6
         AND COALESCE(existing_events, 0) + new_events <= ?7`,
    ).bind(input, sid, batchId, day, eventCap, sessionCap, MAX_EVENTS_PER_SESSION),
    db.prepare(
      `INSERT OR IGNORE INTO analytics_events (session_id, event_id, tab_id, seq, ts, client_ts, received_at, name, props)
       SELECT ?1, entry.value ->> 0, ?2, entry.value ->> 1, entry.value ->> 2, entry.value ->> 3, ?3, entry.value ->> 4, entry.value ->> 5
       FROM json_each(?4) AS entry
       WHERE EXISTS (SELECT 1 FROM analytics_daily_counters WHERE day = ?5 AND last_batch = ?6)`,
    ).bind(sid, tab, now, input, day, batchId),
    db.prepare(
      `INSERT INTO analytics_sessions (session_id, started_at, last_seen_at, received_events, batches, device_category, browser_family, os_family,
         network_class, network_org, country, ua_automation, qa_run, default_automation_viewport, no_window_chrome, created_at)
       SELECT ?1, MIN(ts), MAX(ts), COUNT(*), 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
       FROM analytics_events
       WHERE session_id = ?1 AND EXISTS (SELECT 1 FROM analytics_daily_counters WHERE day = ?13 AND last_batch = ?14)
       HAVING COUNT(*) > 0
       ON CONFLICT(session_id) DO UPDATE SET
         started_at = MIN(started_at, excluded.started_at), last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
         received_events = excluded.received_events, batches = batches + 1,
         ua_automation = COALESCE(ua_automation, excluded.ua_automation), qa_run = COALESCE(qa_run, excluded.qa_run),
         default_automation_viewport = MAX(default_automation_viewport, excluded.default_automation_viewport),
         no_window_chrome = MAX(no_window_chrome, excluded.no_window_chrome)`,
    ).bind(sid, ua.device, ua.browser, ua.os, net.networkClass, net.org, typeof country === "string" ? country.slice(0, 2) : null,
      ua.automation, qa, ctx.dav === 1 ? 1 : 0, ctx.nwc === 1 ? 1 : 0, now, day, batchId),
  ]);
  if (result[1].meta.changes === 0) return json({ ok: false, error: "rate_limited" }, 429, cors);
  return new Response(null, { status: 204, headers: { ...cors, "Cache-Control": "no-store" } });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

type SessionRow = Record<string, unknown> & { session_id: string };

export async function loadSessionWindow(db: D1Database, from: number, to: number, limit = 3_000): Promise<{ sessions: SessionRow[]; events: Array<Record<string, unknown>>; truncated: boolean }> {
  const sessions = (await db.prepare(
    "SELECT * FROM analytics_sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at LIMIT ?",
  ).bind(from, to, limit + 1).all<SessionRow>()).results;
  let truncated = sessions.length > limit;
  if (truncated) sessions.pop();
  const events: Array<Record<string, unknown>> = [];
  for (let i = 0; i < sessions.length; i += 90) {
    const ids = sessions.slice(i, i + 90).map((s) => s.session_id);
    const rows = await db.prepare(
      `SELECT session_id, event_id, tab_id, seq, ts, name, props FROM analytics_events WHERE session_id IN (${ids.map(() => "?").join(",")}) ORDER BY ts, seq LIMIT 20001`,
    ).bind(...ids).all();
    if (rows.results.length > 20_000) { truncated = true; rows.results.pop(); }
    events.push(...rows.results);
  }
  return { sessions, events, truncated };
}

function windowFromQuery(url: URL, now: number): { from: number; to: number } | null {
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 32 * 24 * 60 * 60 * 1000 || from > now) return null;
  return { from, to };
}

let titleCache: { at: number; map: Map<string, string> } | null = null;
async function titleLookup(env: SessionEnv, now: number): Promise<(path: string) => string> {
  if (!titleCache || now - titleCache.at > 60 * 60 * 1000) {
    const map = new Map<string, string>();
    try {
      const base = (env.PUBLIC_SITE_URL || "https://zacharysturman.com").replace(/\/$/, "");
      for (const [file, prefix] of [["projects/projects.json", "/projects/"], ["articles/articles.json", "/articles/"]] as const) {
        const response = await fetch(`${base}/${file}`, { cf: { cacheTtl: 3600 } } as RequestInit);
        if (!response.ok) continue;
        const data = (await response.json()) as unknown;
        const list = Array.isArray(data) ? data : ((data as { projects?: unknown[]; articles?: unknown[] }).projects || (data as { articles?: unknown[] }).articles || []);
        for (const item of list as Array<{ slug?: string; title?: string; href?: string }>) {
          if (item?.slug && item.title) map.set(item.href || `${prefix}${item.slug}`, item.title);
        }
      }
    } catch { /* titles are cosmetic */ }
    titleCache = { at: now, map };
  }
  const map = titleCache.map;
  return (path: string) => map.get(path) || ({ "/": "Home", "/projects": "Projects", "/articles": "Articles", "/work-logs": "Work logs", "/contact": "Contact", "/about": "About", "/resume": "Résumé", "/experience": "Experience" } as Record<string, string>)[path] || "";
}

export async function handleSessionRead(request: Request, env: SessionEnv, now = Date.now()): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isRead = request.method === "GET" && ["/internal/analytics/sessions", "/analytics/explorer", "/analytics/explorer/data", "/analytics/report"].includes(path);
  const isReportWrite = request.method === "POST" && path === "/internal/analytics/report";
  if (!isRead && !isReportWrite) return null;
  if (path.startsWith("/internal/") ? request.headers.get("Authorization") !== `Bearer ${env.INTERNAL_TOKEN}` || !env.INTERNAL_TOKEN : !(await hasAnalyticsAccess(request, env.ANALYTICS_ADMIN_PASSWORD))) {
    if (path.startsWith("/internal/")) return json({ ok: false, error: "unauthorized" }, 401);
    const headers: Record<string, string> = env.ANALYTICS_ADMIN_PASSWORD
      ? { "WWW-Authenticate": 'Basic realm="Portfolio analytics", charset="UTF-8"' }
      : {};
    return json({ ok: false, error: "analytics_sign_in_required" }, 401, headers);
  }
  if (!env.INTAKE_DB) return json({ ok: false, error: "storage_unavailable" }, 503);
  const db = env.INTAKE_DB;

  if (isReportWrite) {
    let body: { date?: unknown; html?: unknown };
    try { body = (await request.json()) as typeof body; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
    const html = typeof body.html === "string" ? body.html : "";
    if (!date || !html || html.length > 900_000) return json({ ok: false, error: "invalid_report" }, 400);
    await db.prepare("INSERT INTO analytics_reports (report_date, html, created_at) VALUES (?, ?, ?) ON CONFLICT(report_date) DO UPDATE SET html = excluded.html, created_at = excluded.created_at").bind(date, html, now).run();
    return json({ ok: true, stored: date });
  }

  if (path === "/analytics/report") {
    const date = url.searchParams.get("date") || "";
    const row = /^\d{4}-\d{2}-\d{2}$/.test(date) ? await db.prepare("SELECT html FROM analytics_reports WHERE report_date = ?").bind(date).first<{ html: string }>() : null;
    if (!row) return new Response("No detailed report is stored for that date.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response(row.html, { headers: htmlHeaders("default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'") });
  }

  if (path === "/analytics/explorer") {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return new Response(explorerHtml(nonce), {
      headers: htmlHeaders(`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`),
    });
  }

  let timeZone = "America/Los_Angeles";
  let range;
  if (path === "/analytics/explorer/data") {
    const from = url.searchParams.get("from_date");
    const to = url.searchParams.get("to_date");
    try {
      timeZone = new Intl.DateTimeFormat("en-US", { timeZone: url.searchParams.get("tz") || timeZone }).resolvedOptions().timeZone;
      if (/^\d{4}-\d{2}-\d{2}$/.test(from || "") && /^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
        const start = zonedDayWindow(from, timeZone).from;
        const end = zonedDayWindow(to, timeZone).to;
        if (start < end && start <= now && end - start <= 32 * 864e5) range = { from: start, to: end };
      }
    } catch { /* invalid time zone or date */ }
  } else {
    range = windowFromQuery(url, now);
  }
  if (!range) return json({ ok: false, error: "invalid_window" }, 400);
  const data = await loadSessionWindow(db, range.from, range.to);
  if (path === "/internal/analytics/sessions") return json({ ok: true, ...data, retentionDays: retentionDays(env) });

  const titleForPath = await titleLookup(env, now);
  const sessions = analyzeSessions(data.sessions, data.events, { titleForPath, timeZone });
  return json({
    ok: true,
    window: range,
    truncated: data.truncated,
    timeZone,
    summary: summarizeSessions(sessions, { titleForPath }),
    flows: navigationFlows(sessions, { titleForPath }),
    sessions: sessions.map((s: Parameters<typeof serializeSession>[0]) => serializeSession(s, { titleForPath })),
  });
}

function htmlHeaders(csp: string): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer", "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff",
  };
}

function retentionDays(env: SessionEnv): number {
  const days = Number(env.SESSION_RETENTION_DAYS || 30);
  return Number.isFinite(days) && days >= 1 && days <= 400 ? days : 30;
}

/** Hourly cron: enforce retention for session rows, counters and stored reports. */
export async function pruneSessionData(env: SessionEnv, now = Date.now()): Promise<void> {
  if (!env.INTAKE_DB) return;
  const cutoff = now - retentionDays(env) * 24 * 60 * 60 * 1000;
  // Never let analytics retention break the intake cron (for example if the
  // Worker is deployed before migration 0002 is applied).
  try {
    await pruneBatch(env.INTAKE_DB, cutoff, now);
  } catch (error) {
    console.error("sessions: retention prune failed", error instanceof Error ? error.message : "unknown");
  }
}

async function pruneBatch(db: D1Database, cutoff: number, now: number): Promise<void> {
  const env = { INTAKE_DB: db };
  await env.INTAKE_DB.batch([
    env.INTAKE_DB.prepare("DELETE FROM analytics_events WHERE received_at < ?").bind(cutoff),
    env.INTAKE_DB.prepare("DELETE FROM analytics_sessions WHERE last_seen_at < ? AND created_at < ?").bind(cutoff, cutoff),
    env.INTAKE_DB.prepare("DELETE FROM analytics_daily_counters WHERE day < ?").bind(utcDay(cutoff)),
    env.INTAKE_DB.prepare("DELETE FROM analytics_reports WHERE created_at < ?").bind(now - 90 * 24 * 60 * 60 * 1000),
  ]);
}

// ---------------------------------------------------------------------------
// Session explorer UI (vanilla JS, no external assets, CSP nonce)
// ---------------------------------------------------------------------------

function explorerHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Session explorer</title>
<style>
:root{--bg:#f6f7f9;--panel:#fff;--ink:#16181d;--muted:#5b6270;--line:#e3e6eb;--accent:#1f5fbf;--human:#1d7a46;--auto:#a33b2b;--unc:#8a6a12;--int:#5b6270}
@media (prefers-color-scheme:dark){:root{--bg:#121418;--panel:#1a1d23;--ink:#e8eaee;--muted:#a1a8b5;--line:#2b3039;--accent:#7aa7ff;--human:#5fca8e;--auto:#f08c7a;--unc:#e0c063;--int:#a1a8b5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
header{padding:16px 20px;border-bottom:1px solid var(--line);background:var(--panel)}h1{margin:0;font-size:18px}header p{margin:4px 0 0;color:var(--muted);font-size:12px}
.filters{display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
.filters label{display:flex;flex-direction:column;font-size:11px;color:var(--muted);gap:2px}.filters input,.filters select{font:inherit;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);min-width:120px}
.summary{display:flex;flex-wrap:wrap;gap:16px;padding:12px 20px;color:var(--muted);font-size:13px}.summary b{color:var(--ink)}
main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;padding:0 20px 24px}@media (max-width:900px){main{grid-template-columns:1fr}}
.list,.detail,.flows{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}th{font-size:11px;color:var(--muted);font-weight:600}
tr.row{cursor:pointer}tr.row:hover,tr.row.sel{background:color-mix(in srgb,var(--accent) 9%,transparent)}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid currentColor;white-space:nowrap}
.likely_human{color:var(--human)}.likely_automated,.known_automated{color:var(--auto)}.uncertain{color:var(--unc)}.known_internal{color:var(--int)}
.detail{padding:14px 16px}.detail h2{margin:0 0 4px;font-size:16px}.muted{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:12px 0}
.metric{border:1px solid var(--line);border-radius:8px;padding:6px 8px}.metric b{display:block;font-size:15px}.metric span{font-size:11px;color:var(--muted)}
ol.timeline{list-style:none;margin:8px 0 0;padding:0}ol.timeline li{display:grid;grid-template-columns:70px 1fr;gap:8px;padding:6px 0;border-top:1px dashed var(--line)}
ol.timeline time{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px}.k-action{font-weight:600}.k-end{color:var(--muted)}.sub{display:block;font-size:12px;color:var(--muted)}
ul.evidence{margin:6px 0 0;padding-left:18px}.flows{margin:0 20px 24px;padding:12px 16px}.flows li{font-size:13px}.empty{padding:24px;color:var(--muted)}
</style></head><body>
<header><h1>Session explorer</h1><p>Anonymous first-party sessions. Classifications are evidence, not proof of identity. Active time excludes background tabs and idle periods. Data is retained for a limited period.</p></header>
<div class="filters">
<label>From<input type="date" id="from"></label><label>To<input type="date" id="to"></label>
<label>Classification<select id="cls"><option value="">All</option><option value="likely_human">Likely human</option><option value="uncertain">Uncertain</option><option value="likely_automated">Likely automated</option><option value="known_automated">Known automated</option><option value="known_internal">Internal test</option></select></label>
<label>Engagement<select id="eng"><option value="">All</option><option value="sustained">Sustained</option><option value="short">Short</option><option value="glance">Glance</option><option value="no_attention_data">No attention data</option></select></label>
<label>Landing page<select id="landing"><option value="">All</option></select></label><label>Project<select id="project"><option value="">All</option></select></label>
<label>Source<select id="source"><option value="">All</option></select></label>
<label>Actions<select id="act"><option value="">All</option><option value="yes">With meaningful action</option><option value="no">Without</option></select></label>
</div>
<div class="summary" id="summary"></div>
<main><div class="list" id="list"><div class="empty">Loading…</div></div><div class="detail" id="detail"><p class="muted">Select a session to see its timeline.</p></div></main>
<div class="flows" id="flows"></div>
<script nonce="${nonce}">
(function(){
var qs=new URLSearchParams(location.search);
var tz=qs.get("tz")||"America/Los_Angeles";try{new Intl.DateTimeFormat("en-US",{timeZone:tz})}catch(e){tz="America/Los_Angeles"}var data=null;var selected=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function sec(ms){var s=Math.round((ms||0)/1000);if(s<60)return s+" s";var m=Math.floor(s/60);return m+" min"+(s%60?" "+(s%60)+" s":"")}
function fmtTime(ms){return new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(ms))}
var parts=new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());var day={};parts.forEach(function(p){day[p.type]=p.value});var def=qs.get("date")||new Date(Date.UTC(+day.year,+day.month-1,+day.day-1)).toISOString().slice(0,10);
document.getElementById("from").value=qs.get("from_date")||def;document.getElementById("to").value=qs.get("to_date")||def;
function load(){var f=document.getElementById("from").value,t=document.getElementById("to").value;
document.getElementById("list").innerHTML='<div class="empty">Loading…</div>';
fetch("/analytics/explorer/data?from_date="+encodeURIComponent(f)+"&to_date="+encodeURIComponent(t)+"&tz="+encodeURIComponent(tz)).then(function(r){return r.json()}).then(function(j){if(!j.ok){document.getElementById("list").innerHTML='<div class="empty">'+esc(j.error||"Unavailable")+'</div>';return}data=j;fillOptions();render()}).catch(function(){document.getElementById("list").innerHTML='<div class="empty">Could not load sessions.</div>'})}
function fillOptions(){function opts(id,values){var el=document.getElementById(id);var cur=el.value;el.innerHTML='<option value="">All</option>'+values.map(function(v){return '<option'+(v===cur?' selected':'')+'>'+esc(v)+'</option>'}).join("")}
function uniq(a){return Array.from(new Set(a.filter(Boolean))).sort()}
opts("landing",uniq(data.sessions.map(function(s){return s.landing})));opts("project",uniq([].concat.apply([],data.sessions.map(function(s){return s.projectTitles}))));opts("source",uniq(data.sessions.map(function(s){return s.referrer})))}
function filtered(){var v=function(id){return document.getElementById(id).value};return data.sessions.filter(function(s){
return(!v("cls")||s.classification.category===v("cls"))&&(!v("eng")||s.engagement===v("eng"))&&(!v("landing")||s.landing===v("landing"))&&(!v("project")||s.projectTitles.indexOf(v("project"))>=0)&&(!v("source")||s.referrer===v("source"))&&(!v("act")||(v("act")==="yes")===(s.actionCount>0))})}
function render(){var rows=filtered();var c=data.summary.counts;
document.getElementById("summary").innerHTML="<span><b>"+data.summary.total+"</b> sessions</span><span class='likely_human'><b>"+c.likely_human+"</b> likely human</span><span class='uncertain'><b>"+c.uncertain+"</b> uncertain</span><span class='likely_automated'><b>"+(c.likely_automated+c.known_automated)+"</b> automated</span><span><b>"+c.known_internal+"</b> internal</span><span>Showing <b>"+rows.length+"</b></span>"+(data.truncated?"<span>Partial data. Select a shorter range.</span>":"");
if(!rows.length){document.getElementById("list").innerHTML='<div class="empty">No sessions match these filters.</div>'}else{
document.getElementById("list").innerHTML="<table><thead><tr><th>Start</th><th>Class</th><th>Landing → exit</th><th>Pages</th><th>Active</th><th>Actions</th><th>Source</th></tr></thead><tbody>"+rows.map(function(s){
return "<tr class='row"+(selected===s.id?" sel":"")+"' data-id='"+esc(s.id)+"'><td>"+esc(fmtTime(s.startedAt))+"</td><td><span class='pill "+esc(s.classification.category)+"'>"+esc(s.classification.label)+"</span></td><td>"+esc(s.landing)+(s.exit&&s.exit!==s.landing?" → "+esc(s.exit):"")+"</td><td>"+s.pageCount+"</td><td>"+sec(s.activeMs)+"</td><td>"+s.actionCount+"</td><td>"+esc(s.referrer)+"</td></tr>"}).join("")+"</tbody></table>";
Array.prototype.forEach.call(document.querySelectorAll("tr.row"),function(tr){tr.addEventListener("click",function(){selected=tr.getAttribute("data-id");render()})})}
var s=data.sessions.find(function(x){return x.id===selected});document.getElementById("detail").innerHTML=s?detail(s):'<p class="muted">Select a session to see its timeline.</p>';
document.getElementById("flows").innerHTML="<h2 style='font-size:15px;margin:0 0 6px'>Observed navigation flows</h2><p class='muted' style='margin:0 0 6px;font-size:12px'>Page-to-page transitions inside real sessions for the selected dates.</p><ol>"+data.flows.map(function(f){return "<li>"+esc(f.flow)+" <span class='muted'>· "+f.count+"</span></li>"}).join("")+"</ol>"}
function detail(s){var c=s.classification;return "<h2>Session "+esc(s.shortId)+"</h2><div class='muted'>"+esc(fmtTime(s.startedAt))+" · "+esc(s.device)+" · "+esc(s.browser)+" on "+esc(s.os)+(s.country?" · "+esc(s.country):"")+" · network: "+esc(s.network)+"</div>"+
"<p><span class='pill "+esc(c.category)+"'>"+esc(c.label)+"</span> <span class='muted'>confidence: "+esc(c.confidence)+"</span></p><p>"+esc(s.narrative)+"</p>"+
"<div class='metrics'><div class='metric'><b>"+sec(s.elapsedMs)+"</b><span>Elapsed</span></div><div class='metric'><b>"+sec(s.foregroundMs)+"</b><span>Foreground</span></div><div class='metric'><b>"+sec(s.activeMs)+"</b><span>Active</span></div><div class='metric'><b>"+(s.timeToFirstInputMs==null?"—":sec(s.timeToFirstInputMs))+"</b><span>To first input</span></div><div class='metric'><b>"+(s.timeToFirstActionMs==null?"—":sec(s.timeToFirstActionMs))+"</b><span>To first action</span></div><div class='metric'><b>"+s.uniquePaths+"</b><span>Distinct pages</span></div></div>"+
"<h3 style='font-size:13px;margin:12px 0 0'>Timeline</h3><ol class='timeline'>"+s.timeline.map(function(i){return "<li><time>"+esc(i.time)+"</time><div class='k-"+esc(i.kind)+"'>"+esc(i.text)+(i.repeat?" ×"+i.repeat:"")+(i.detail?"<span class='sub'>"+esc(i.detail)+"</span>":"")+"</div></li>"}).join("")+"</ol>"+
"<h3 style='font-size:13px;margin:14px 0 0'>Classification evidence</h3><ul class='evidence'>"+(c.evidence||[]).map(function(e){return "<li>"+esc(e.text)+" <span class='muted'>("+(e.weight>0?"+":"")+e.weight+")</span></li>"}).join("")+"</ul>"+
"<p class='muted' style='font-size:12px'>Positive weights point towards automation, negative towards a person. The last observed activity is not proof of when someone stopped reading.</p>"}
["cls","eng","landing","project","source","act"].forEach(function(id){document.getElementById(id).addEventListener("change",render)});
["from","to"].forEach(function(id){document.getElementById(id).addEventListener("change",load)});load();
})();
</script></body></html>`;
}
