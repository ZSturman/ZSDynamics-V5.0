"use client";

/**
 * First-party anonymous session stream.
 *
 * GA4's Data API only returns aggregates, so individual session journeys are
 * reconstructed from this small, separate stream sent to the portfolio API
 * Worker (`POST /collect`). Design constraints:
 *
 *  - Same fail-closed gate as GA4 (production hostname, no automation, build
 *    flag) plus its own build flag. Global Privacy Control disables it.
 *  - A random session id in localStorage that rotates after 30 minutes of
 *    inactivity. No visitor id, no cookies, no fingerprinting, no IP use.
 *  - Only allow-listed, structured parameters (lib/analytics-taxonomy.mjs).
 *    No titles, free text, form contents, search terms or full URLs.
 *  - Batched: one request per ~5 s while events are pending, and a beacon when
 *    the page is hidden or unloaded. Never blocks navigation; all failures are
 *    swallowed.
 */

import { SESSION_EVENTS, sanitizeSessionParams } from "./analytics-taxonomy.mjs";
import { PageActivityClock, nextSessionState } from "./session-timing.mjs";

type Params = Record<string, string | number | undefined>;
type QueuedEvent = { id: string; seq: number; ts: number; name: string; props: Record<string, string | number> };
type PageInput = { path: string; group: string; slug?: string; modal?: string };

const SESSION_KEY = "zs_sess_v1";
const FLUSH_DELAY_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const MAX_EVENTS_PER_PAGE_LOAD = 400;
const MAX_HEARTBEATS_PER_PAGE = 40;
const MAX_QUEUE = 60;

import contactConfig from "./contact-config.json";

// Same API base as the contact form (env override, else the versioned default).
const endpointBase = process.env.NEXT_PUBLIC_API_BASE_URL || contactConfig.apiBaseUrl || "";
const sessionStreamEnabled = process.env.NEXT_PUBLIC_SESSION_ANALYTICS_ENABLED === "true";

let gate: () => string | null = () => "not_configured";
let qaRunProvider: () => string | undefined = () => undefined;
let started = false;
let disabled = false;
const queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let sentThisLoad = 0;
let tab = { id: "", seq: 0 };
let memorySession: { id: string; startedAt: number; lastAt: number } | null = null;
let page: null | { pv: string; input: PageInput; clock: PageActivityClock; heartbeats: number; lastSnapshot: string; maxScroll: number; startedAt: number } = null;
let pendingNav: string | null = null;
// Test-only observer (mirrors __ZS_ANALYTICS_LOG__): when a test defines
// window.__ZS_SESSION_LOG__ as an array, batches are appended there and
// nothing is sent over the network. Absent in production.
let observer: unknown[] | null = null;
// Page components' effects can run before the layout starts the stream (a
// deep-link landing fires project_open first). Early calls are buffered and
// replayed in order once the stream starts, or dropped if it is disabled.
let earlyPage: PageInput | null = null;
let earlyEvents: Array<{ name: string; params: Params }> = [];

function randomId(bytes = 12): string {
  try {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return Array.from(values, (v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`.padEnd(24, "0").slice(0, 24);
  }
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try { const raw = storage?.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}
function local(): Storage | undefined { try { return window.localStorage; } catch { return undefined; } }

function active(): boolean {
  if (disabled || typeof window === "undefined") return false;
  return started;
}

function currentSession(now: number): string {
  const stored = readJson<{ id: string; startedAt: number; lastAt: number }>(local(), SESSION_KEY) ?? memorySession;
  const next = nextSessionState(stored, now, () => randomId(16));
  memorySession = { id: next.id, startedAt: next.startedAt, lastAt: next.lastAt };
  writeJson(local(), SESSION_KEY, memorySession);
  return next.id;
}

let sessionId = "";

function resumeIfExpired(now: number): void {
  const id = currentSession(now);
  if (id === sessionId) return;
  flush(true);
  sessionId = id;
  if (page) {
    const input = page.input;
    openPage(input, "resume", now, id, false);
  }
}

function enqueue(name: string, props: Record<string, string | number>, ts = Date.now()): void {
  if (!active() || sentThisLoad >= MAX_EVENTS_PER_PAGE_LOAD) return;
  resumeIfExpired(ts);
  pushEvent(name, props, ts);
}

function pushEvent(name: string, props: Record<string, string | number>, ts: number): void {
  tab.seq += 1;
  if (sentThisLoad >= MAX_EVENTS_PER_PAGE_LOAD) return;
  sentThisLoad += 1;
  queue.push({ id: `${tab.id}-${tab.seq}`, seq: tab.seq, ts, name, props });
  if (queue.length > MAX_QUEUE) {
    const index = queue.findIndex((e) => e.name === "page_attention");
    queue.splice(index >= 0 ? index : 0, 1);
  }
  if (queue.length >= 20) flush(false);
  else scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => { flushTimer = null; flush(false); }, FLUSH_DELAY_MS);
}

function context(): Record<string, string | number> {
  const ctx: Record<string, string | number> = { viewport: viewportCategory() };
  // Single-bit automation hints that are legitimately observable; neither is
  // stored as a dimension of the device.
  if (window.innerWidth === 800 && window.innerHeight === 600) ctx.dav = 1;
  if (window.outerWidth === 0 || window.outerHeight === 0) ctx.nwc = 1;
  const qa = qaRunProvider();
  if (qa) ctx.qa = qa;
  return ctx;
}

function flush(useBeacon: boolean): void {
  if (flushTimer !== null) { window.clearTimeout(flushTimer); flushTimer = null; }
  if (!queue.length || !sessionId || (!endpointBase && !observer)) return;
  const events = queue.splice(0, 50);
  const batch = { v: 2, sid: sessionId, tab: tab.id, ctx: context(), events };
  if (observer) observer.push({ ...batch, sent_at: Date.now() });
  else sendBatch(batch, useBeacon);
  if (queue.length) scheduleFlush();
}

function sendBatch(batch: object, useBeacon: boolean, attempt = 0): void {
  const url = `${endpointBase.replace(/\/$/, "")}/collect`;
  const blob = new Blob([JSON.stringify({ ...batch, sent_at: Date.now() })], { type: "text/plain;charset=UTF-8" });
  const retry = () => {
    if (attempt < 2) window.setTimeout(() => sendBatch(batch, false, attempt + 1), 2_000 * (attempt + 1));
  };
  try {
    if (useBeacon && navigator.sendBeacon?.(url, blob)) return;
    void fetch(url, { method: "POST", body: blob, keepalive: true, mode: "cors", credentials: "omit" })
      .then((response) => { if (response.status >= 500) retry(); })
      .catch(retry);
  } catch { retry(); }
}

function viewportCategory(): string {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function pageProps(input: PageInput, nav: string): Record<string, string | number> {
  return sanitizeSessionParams("page_view", {
    path: input.path, group: input.modal ? "home_modal" : input.group, slug: input.modal || input.slug, nav, viewport: viewportCategory(),
  }) as Record<string, string | number>;
}

function snapshot(final: boolean): void {
  if (!page || !sessionId) return;
  const now = performance.now();
  const snap = page.clock.snapshot(now) as Record<string, number>;
  const props: Record<string, string | number> = { pv: page.pv, ...snap, max_scroll: page.maxScroll };
  if (page.clock.firstInputAt !== null) props.first_input_ms = Math.round(page.clock.firstInputAt - page.startedAt);
  if (final) props.final = 1;
  const key = JSON.stringify(snap);
  if (!final && key === page.lastSnapshot) return;
  page.lastSnapshot = key;
  pushEvent("page_attention", props, Date.now());
}

function navigationType(): string {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type === "reload") return "reload";
    if (entry?.type === "back_forward") return "back_forward";
  } catch { /* unsupported */ }
  return "landing";
}

function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const ref = new URL(document.referrer);
    const host = ref.hostname.replace(/^www\./, "");
    return ["zacharysturman.com", "zachary-sturman.com"].includes(host) || ref.origin === window.location.origin ? undefined : host;
  } catch { return undefined; }
}

/** Called once from AnalyticsBootstrap. */
export function startSessionStream(options: { gate: () => string | null; qaRun: () => string | undefined }): void {
  if (started || typeof window === "undefined") return;
  gate = options.gate; qaRunProvider = options.qaRun;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  const testLog = (window as Window & { __ZS_SESSION_LOG__?: unknown[] }).__ZS_SESSION_LOG__;
  observer = Array.isArray(testLog) ? testLog : null;
  const suppression = gate();
  // Explicit Playwright acceptance runs can send tagged first-party traffic.
  // Firebase still sees webdriver and remains suppressed.
  const controlledRun = suppression === "webdriver" && qaRunProvider()?.startsWith("session-qa-") &&
    ["zacharysturman.com", "www.zacharysturman.com"].includes(location.hostname);
  if (!observer && (!sessionStreamEnabled || !endpointBase || gpc || (suppression && !controlledRun))) { disabled = true; return; }
  started = true;
  // Opening a tab through an opener can clone sessionStorage. Each document
  // needs its own event namespace, even across a full reload in the same tab.
  tab = { id: randomId(6), seq: 0 };
  pendingNav = navigationType();

  let lastInputTouch = 0;
  const input = (kind: "pointer" | "key" | "scroll" | "touch") => (event: Event) => {
    if (!page || !event.isTrusted || document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastInputTouch >= HEARTBEAT_MS) {
      resumeIfExpired(now);
      lastInputTouch = now;
    }
    if (!page) return;
    page.clock.input(performance.now(), kind);
    if (kind === "scroll") {
      const height = Math.max(document.documentElement.scrollHeight, 1);
      page.maxScroll = Math.max(page.maxScroll, Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100)));
    }
  };
  const passive = { passive: true, capture: true } as AddEventListenerOptions;
  window.addEventListener("pointerdown", input("pointer"), passive);
  window.addEventListener("pointermove", input("pointer"), passive);
  window.addEventListener("keydown", input("key"), passive);
  window.addEventListener("wheel", input("scroll"), passive);
  window.addEventListener("scroll", input("scroll"), passive);
  window.addEventListener("touchstart", input("touch"), passive);
  window.addEventListener("popstate", () => { pendingNav = "back_forward"; });
  document.addEventListener("visibilitychange", () => {
    if (!page) return;
    const visible = document.visibilityState === "visible";
    if (visible) resumeIfExpired(Date.now());
    page.clock.setVisible(performance.now(), visible);
    if (!visible) { snapshot(false); flush(true); }
  });
  window.addEventListener("pagehide", () => { snapshot(true); flush(true); });
  if (earlyPage) {
    const first = earlyPage;
    earlyPage = null;
    sessionPageView(first);
  }
  const buffered = earlyEvents;
  earlyEvents = [];
  for (const event of buffered) enqueue(event.name, sanitizeSessionParams(event.name, event.params) as Record<string, string | number>);
  window.setInterval(() => {
    if (!page || document.visibilityState !== "visible" || page.heartbeats >= MAX_HEARTBEATS_PER_PAGE) return;
    page.heartbeats += 1;
    snapshot(false);
  }, HEARTBEAT_MS);
}

/** A page load or client-side route change. */
export function sessionPageView(input: PageInput): void {
  if (!started && !disabled && typeof window !== "undefined") { earlyPage = earlyPage ?? input; return; }
  if (!active()) return;
  if (page) snapshot(true);
  const now = Date.now();
  const nav = pendingNav ?? "route";
  pendingNav = null;
  const id = currentSession(now);
  openPage(input, nav, now, id, id !== sessionId && nav === "landing");
}

function openPage(input: PageInput, nav: string, now: number, id: string, attribute: boolean): void {
  if (id !== sessionId) flush(true);
  sessionId = id;
  const startedAt = performance.now();
  page = { pv: randomId(6), input, clock: new PageActivityClock(startedAt, document.visibilityState === "visible"), heartbeats: 0, lastSnapshot: "", maxScroll: 0, startedAt };
  const props = { ...pageProps(input, nav), pv: page.pv };
  if (attribute) {
    const query = new URLSearchParams(location.search);
    Object.assign(props, sanitizeSessionParams("page_view", {
      ref_host: referrerHost(),
      utm_source: query.get("utm_source"),
      utm_medium: query.get("utm_medium"),
      utm_campaign: query.get("utm_campaign"),
    }));
  }
  pushEvent("page_view", props, now);
}

/** Mirrors an allow-listed GA4 event into the session stream. */
export function sessionEvent(name: string, params: Params): void {
  if (!SESSION_EVENTS.has(name)) return;
  if (!started && !disabled && typeof window !== "undefined") {
    if (earlyEvents.length < 20) earlyEvents.push({ name, params });
    return;
  }
  if (!active()) return;
  enqueue(name, sanitizeSessionParams(name, params) as Record<string, string | number>);
}

/** Flush pending events now (used by tests and before deliberate navigation). */
export function flushSessionStream(): void {
  if (!active()) return;
  snapshot(false);
  flush(false);
}

if (typeof window !== "undefined") {
  (window as Window & { __ZS_FLUSH_SESSION__?: () => void }).__ZS_FLUSH_SESSION__ = () => { if (observer) flushSessionStream(); };
}
