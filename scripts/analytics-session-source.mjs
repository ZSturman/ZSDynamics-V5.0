/**
 * Reads the first-party session stream from the API Worker for the daily
 * report, builds authenticated explorer/report links, and stores the detailed report.
 *
 * Every call is optional: a missing token, an unreachable Worker or an empty
 * stream yields `{ available: false, reason }` and the email says so instead
 * of failing.
 */

import { analyzeSessions, navigationFlows, pickNotableSessions, serializeSession, summarizeSessions, zonedDayWindow } from "../lib/session-journeys.mjs";

export function buildAnalyticsLinks({ apiBaseUrl, dateIso, timeZone }) {
  if (!apiBaseUrl) return null;
  const base = apiBaseUrl.replace(/\/$/, "");
  return {
    report: `${base}/analytics/report?date=${dateIso}`,
    explorer: `${base}/analytics/explorer?date=${dateIso}&tz=${encodeURIComponent(timeZone)}`,
  };
}

async function getWindow({ apiBaseUrl, internalToken, from, to, fetchImpl }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/internal/analytics/sessions?from=${from}&to=${to}`;
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${internalToken}` }, signal: AbortSignal.timeout(20_000) });
  if (response.status === 404) throw Object.assign(new Error("session endpoint not deployed"), { code: "not_deployed" });
  if (!response.ok) throw new Error(`session endpoint returned ${response.status}`);
  const body = await response.json();
  if (!body?.ok || !Array.isArray(body.sessions) || !Array.isArray(body.events)) throw new Error("session endpoint returned an unexpected body");
  return body;
}

/**
 * Loads, reconstructs and classifies the reporting day's sessions (by start
 * time in the reporting zone) and the previous day's for comparison.
 */
export async function loadSessionStream({ apiBaseUrl, internalToken, dateIso, previousDateIso, timeZone, titleForPath, startedAt, now = Date.now(), fetchImpl = globalThis.fetch }) {
  if (!apiBaseUrl || !internalToken) return { available: false, reason: "API_BASE_URL or INTERNAL_TOKEN is not configured for the report." };
  try {
    const day = zonedDayWindow(dateIso, timeZone);
    const start = Date.parse(startedAt);
    if (startedAt !== undefined && (!Number.isFinite(start) || day.to <= start)) {
      return { available: false, reason: "First-party collection had not started for this reporting day." };
    }
    const current = await getWindow({ apiBaseUrl, internalToken, ...day, fetchImpl });
    if (current.retentionDays && day.from < now - current.retentionDays * 864e5 && startedAt !== undefined) {
      return { available: false, reason: "This reporting day is outside the first-party retention window." };
    }
    const options = { titleForPath, timeZone };
    const reconstruct = (data) => {
      const production = data.sessions.filter((session) => !session.qa_run);
      const ids = new Set(production.map((session) => session.session_id));
      return analyzeSessions(production, data.events.filter((event) => ids.has(event.session_id)), options);
    };
    const sessions = reconstruct(current);
    let previous = null;
    if (previousDateIso && !current.truncated && !(start > day.from)) {
      try {
        const window = zonedDayWindow(previousDateIso, timeZone);
        if (!(start > window.from)) {
          const prior = await getWindow({ apiBaseUrl, internalToken, ...window, fetchImpl });
          if (!prior.truncated) previous = summarizeSessions(reconstruct(prior), { titleForPath });
        }
      } catch { previous = null; }
    }
    return {
      ...fromSessions(sessions, { titleForPath, previous, retentionDays: current.retentionDays }),
      partial: current.truncated || start > day.from || now < day.to,
      internalCount: current.sessions.length - sessions.length,
    };
  } catch (error) {
    return {
      available: false,
      reason: error.code === "not_deployed"
        ? "The session collector is not deployed yet, so individual journeys are unavailable."
        : `Session data unavailable: ${error.message}.`,
    };
  }
}

export function fromSessions(sessions, { titleForPath, previous = null, retentionDays = null } = {}) {
  return {
    available: true,
    empty: sessions.length === 0,
    summary: summarizeSessions(sessions, { titleForPath }),
    previous,
    flows: navigationFlows(sessions, { titleForPath }),
    notable: pickNotableSessions(sessions).map((s) => serializeSession(s, { titleForPath })),
    sessions: sessions.map((s) => serializeSession(s, { titleForPath })),
    retentionDays,
  };
}

/** Stores the detailed report so the email can link to it. Idempotent per day. */
export async function uploadDetailedReport({ apiBaseUrl, internalToken, dateIso, html, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, "")}/internal/analytics/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalToken}` },
    body: JSON.stringify({ date: dateIso, html }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`report storage returned ${response.status}`);
}
