// Opt-in browser verification for the live portfolio. Every collector session
// is marked as QA, and all production GA4 requests are blocked and counted.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";
import { analyzeSessions } from "../lib/session-journeys.mjs";
import { loadSessionStream } from "../scripts/analytics-session-source.mjs";

const site = "https://zacharysturman.com";
const api = "https://api.zacharysturman.com";
const qa = "session-qa-" + Date.now().toString(36);
const tagged = (path) => new URL(path + (path.includes("?") ? "&" : "?") + "zs_qa=" + qa, site).href;
const from = Date.now() - 30_000;
const password = (await readFile(process.env.HOME + "/.config/portfolio-analytics/admin-password", "utf8")).trim();
const admin = "Basic " + Buffer.from("portfolio-admin:" + password).toString("base64");
const bearer = "Bearer " + process.env.INTERNAL_TOKEN;
const browser = await chromium.launch();
const batches = [];
const edges = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checkpoint = (message) => console.log(message);
const collectPattern = api + "/collect";
let gaRequests = 0;

async function setup(context) {
  await context.route(/google-analytics\.com|analytics\.google\.com|googletagmanager\.com|firebaseinstallations\.googleapis\.com/, (route) => { gaRequests += 1; return route.abort(); });
  context.on("request", (request) => {
    if (request.url() === collectPattern) batches.push(request.postDataJSON());
  });
  context.on("response", (result) => {
    if (result.url() === collectPattern) edges.push(result.status());
  });
}

async function waitFor(test, message, timeout = 20_000) {
  const end = Date.now() + timeout;
  do {
    if (await test()) return;
    await wait(250);
  } while (Date.now() < end);
  throw new Error(message);
}

async function sessionData() {
  const response = await fetch(`${api}/internal/analytics/sessions?from=${from}&to=${Date.now() + 60_000}`, { headers: { Authorization: bearer } });
  assert.equal(response.status, 200);
  const data = await response.json();
  const sessions = data.sessions.filter((row) => row.qa_run === qa);
  const ids = new Set(sessions.map((row) => row.session_id));
  return { sessions, events: data.events.filter((row) => ids.has(row.session_id)) };
}

try {
  checkpoint("QA run " + qa);
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setup(desktop);
  await desktop.route("https://qa.example.org/landing", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><a href="${tagged("/?utm_source=controlled&utm_medium=referral&utm_campaign=acceptance")}">Visit portfolio</a>`,
  }));
  const page = await desktop.newPage();
  await page.addInitScript(() => { window.open = () => null; });
  let interrupted;
  await page.route(collectPattern, async (route) => {
    if (interrupted) return route.continue();
    interrupted = route.request().postDataJSON();
    const real = await route.fetch();
    assert.equal(real.status(), 204);
    await route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": site }, body: "Controlled retry after Worker accepted the first request" });
  });
  await page.goto("https://qa.example.org/landing");
  await page.getByRole("link", { name: "Visit portfolio" }).click();
  await page.waitForURL(new RegExp(site));
  await waitFor(() => edges.includes(503) && edges.includes(204), "No accepted browser retry");
  assert.ok(batches.slice(1).some((batch) => batch.events.map((event) => event.id).join() === interrupted.events.map((event) => event.id).join()));
  const desktopId = interrupted.sid;
  const firstCard = page.getByTestId("selected-work-item").first();
  const project = await firstCard.getAttribute("data-project-slug");
  await page.mouse.move(200, 250);
  await page.mouse.wheel(0, 1400);
  await firstCard.getByRole("link").first().click();
  await page.waitForURL(new RegExp(`/projects/${project}$`));
  const resource = page.locator('[data-analytics-item="project_resource"]').filter({ hasText: /view source|github/i }).first();
  const resourceButton = await resource.count() ? resource : page.locator('[data-analytics-item="project_resource"]').first();
  const resourceLabel = await resourceButton.textContent();
  await resourceButton.click();
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(750);
  checkpoint(`Desktop navigated to ${project} and clicked ${resourceLabel?.trim() || "a resource"}`);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(4_500);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const sibling = await desktop.newPage();
  await sibling.goto(tagged("/resume"));
  const download = sibling.getByRole("link", { name: /download (résumé|resume|pdf)/i }).first();
  const downloadEvent = sibling.waitForEvent("download", { timeout: 8_000 }).catch(() => null);
  await download.click();
  const actualDownload = await downloadEvent;
  checkpoint("Résumé download " + (actualDownload ? "observed by Chromium" : "click observed; no file event"));
  await waitFor(() => batches.some((batch) => batch.sid === desktopId && batch.events.some((event) => event.name === "resume_download")), "No résumé download event in collection batch");
  await wait(34_000);
  await page.goto(tagged("/about"));
  await sibling.close();
  await waitFor(async () => {
    const data = await sessionData();
    return data.events.some((event) => event.session_id === desktopId && event.name === "page_view" && JSON.parse(event.props).path === "/about");
  }, "Same-session navigation or final attention was unavailable");

  const mobileContext = await browser.newContext(devices["iPhone 13"]);
  await setup(mobileContext);
  const mobile = await mobileContext.newPage();
  await mobile.goto(tagged("/projects"));
  await waitFor(() => batches.some((batch) => batch.ctx.viewport === "mobile"), "Mobile viewport batch not sent");
  await waitFor(async () => (await sessionData()).sessions.some((session) => session.device_category === "mobile"), "Mobile session not persisted");
  await mobileContext.close();
  const mobileId = batches.find((batch) => batch.ctx.viewport === "mobile").sid;
  assert.notEqual(mobileId, desktopId);
  checkpoint("Independent mobile context recorded and then closed");

  await page.evaluate(() => {
    const key = "zs_sess_v1";
    const value = JSON.parse(localStorage.getItem(key));
    value.lastAt -= 31 * 60_000;
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.goto(tagged("/contact"));
  await waitFor(async () => (await sessionData()).events.some((row) => row.name === "page_view" && JSON.parse(row.props).path === "/contact"), "Expired session did not record a new page");
  const { sessions, events } = await sessionData();
  const reconstructed = analyzeSessions(sessions, events, { timeZone: "America/Los_Angeles" });
  const journey = reconstructed.find((session) => session.id === desktopId);
  assert.ok(journey);
  assert.deepEqual(journey.utm, { source: "controlled", medium: "referral", campaign: "acceptance" });
  assert.equal(journey.referrer, "qa.example.org");
  assert.equal(journey.classification.category, "known_internal");
  assert.ok(Number.isFinite(journey.timeToFirstInputMs), "first-input timing survives ingestion");
  const untaggedReplay = analyzeSessions([{ ...journey.meta, qa_run: null }], events.filter((event) => event.session_id === desktopId));
  assert.equal(untaggedReplay[0].classification.category, "known_automated", "declared Chromium automation detected when QA takes no precedence");
  assert.equal(journey.pages[0].path, "/");
  assert.ok(journey.pages.some((item) => item.path === `/projects/${project}`));
  assert.ok(journey.pages.some((item) => item.path === "/resume"));
  assert.ok(new Set(journey.pages.map((item) => item.tab)).size >= 2);
  assert.ok(journey.events.every((item, index) => index === 0 || item.ts >= journey.events[index - 1].ts));
  assert.ok(journey.actions.some((event) => event.name === "project_resource_click"));
  assert.ok(journey.actions.some((event) => event.name === "resume_download"));
  const attention = journey.pages.find((item) => item.path === `/projects/${project}`).attention;
  assert.ok(attention.hidden_count >= 1 && attention.max_scroll > 0);
  assert.ok(attention.fg_ms - attention.active_ms >= 3_000, `idle gap ${attention.fg_ms - attention.active_ms} ms`);
  const desktopEvents = events.filter((event) => event.session_id === desktopId);
  assert.equal(new Set(desktopEvents.map((event) => event.event_id)).size, desktopEvents.length);
  assert.equal(journey.meta.received_events, desktopEvents.length);
  assert.ok(reconstructed.some((session) => session.id !== desktopId && session.landing?.path === "/contact"));
  assert.equal(gaRequests, 0, "application attempted a production GA4 request");
  const pacific = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const endpoint = `${api}/analytics/explorer/data?from_date=${pacific}&to_date=${pacific}&tz=America%2FLos_Angeles`;
  assert.equal((await fetch(endpoint)).status, 401);
  const explorerData = await fetch(endpoint, { headers: { Authorization: admin } });
  assert.equal(explorerData.status, 200);
  const stream = await loadSessionStream({ apiBaseUrl: api, internalToken: process.env.INTERNAL_TOKEN, dateIso: pacific, timeZone: "America/Los_Angeles" });
  assert.ok(stream.available && stream.internalCount >= sessions.length);
  assert.ok(stream.sessions.every((session) => !sessions.some((row) => row.session_id === session.id)));
  const privateData = await explorerData.json();
  const explorerJourney = privateData.sessions.find((session) => session.id === desktopId);
  assert.ok(explorerJourney);
  assert.ok(explorerJourney.timeline.every((event) => !event.text.includes("in another tab")));
  const adminBrowser = await browser.newContext({ httpCredentials: { username: "portfolio-admin", password }, viewport: { width: 1280, height: 900 } });
  const adminPage = await adminBrowser.newPage();
  const adminResponse = await adminPage.goto(`${api}/analytics/explorer?date=${pacific}`);
  assert.equal(adminResponse.status(), 200);
  await adminPage.locator("tr.row").filter({ hasText: "Internal test" }).first().waitFor();
  await adminPage.locator(`tr[data-id="${desktopId}"]`).click();
  await adminPage.getByRole("heading", { name: "Classification evidence" }).waitFor();
  const directory = process.env.PORTFOLIO_ACCEPTANCE_OUTPUT || "tmp";
  await mkdir(directory, { recursive: true });
  await adminPage.locator("#detail").screenshot({ path: directory + "/portfolio-session-journey.png" });
  const result = { qa, project, desktopEvents: desktopEvents.length, controlledSessions: sessions.length, classification: journey.classification.label,
    documentCount: new Set(journey.pages.map((item) => item.tab)).size, timeToFirstInputMs: journey.timeToFirstInputMs, activeMs: attention.active_ms, foregroundMs: attention.fg_ms,
    elapsedMs: journey.elapsedMs, maxScroll: attention.max_scroll, hiddenCount: attention.hidden_count, retryHttp: [503, 204],
    referrer: journey.referrer, utm: journey.utm, gaRequests, actualDownload: Boolean(actualDownload),
    timeline: explorerJourney.timeline.map(({ time, text }) => ({ time, text })) };
  await writeFile(directory + "/portfolio-session-journey.json", JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
