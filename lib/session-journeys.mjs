/**
 * Session reconstruction, traffic-quality classification and journey
 * summaries for the first-party session stream.
 *
 * Inputs are anonymous session rows and their events exactly as stored by the
 * Worker (see worker/src/sessions.ts). Everything here is deterministic:
 * the daily report, the session explorer and the tests share this module.
 *
 * Nothing in this file can identify a person. Sessions carry a random id that
 * rotates after 30 minutes of inactivity; there is no visitor id.
 */

import { eventDefinition, MEANINGFUL_EVENTS } from "./analytics-taxonomy.mjs";

export const CLASSIFICATIONS = {
  likely_human: { label: "Likely human", short: "Human-likely" },
  likely_automated: { label: "Likely automated", short: "Automated-likely" },
  uncertain: { label: "Uncertain", short: "Uncertain" },
  known_automated: { label: "Known automated", short: "Known automated" },
  known_internal: { label: "Internal test", short: "Internal test" },
};

const AUTOMATED_THRESHOLD = 3;
const HUMAN_THRESHOLD = -2;

const DESTINATION_LABELS = {
  repository: "the GitHub repository", app_store: "the App Store listing", download: "a download", demo: "the demo",
  website: "the external website", email: "an email link", social: "a profile link", resume: "the résumé", internal_project: "a related project",
  internal: "an internal page", other: "an external link",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseProps(props) {
  if (!props) return {};
  if (typeof props === "object") return props;
  try { return JSON.parse(props); } catch { return {}; }
}

export function formatSeconds(ms) {
  const seconds = Math.round(num(ms) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function approxDuration(ms) {
  const seconds = num(ms) / 1000;
  if (seconds < 1) return "under a second";
  if (seconds < 60) return `about ${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "about one minute" : `about ${minutes} minutes`;
}

export function formatClock(ts, timeZone = "America/Los_Angeles") {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ts));
}

function defaultTitle(path) {
  if (!path || path === "/") return "Home";
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || path;
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pageName(page, titleForPath) {
  if (!page) return "an unknown page";
  if (page.modal) return `${titleForPath(`/projects/${page.modal}`) || defaultTitle(page.modal)} (home modal)`;
  return titleForPath(page.path) || defaultTitle(page.path);
}

function projectName(slug, titleForPath) {
  return titleForPath(`/projects/${slug}`) || defaultTitle(slug);
}

// ---------------------------------------------------------------------------
// Reconstruction
// ---------------------------------------------------------------------------

/**
 * Orders and de-duplicates events, joins page attention to page instances and
 * derives timings. `titleForPath(path)` maps paths to display titles.
 */
export function reconstructSession(meta, rawEvents, options = {}) {
  const { titleForPath = () => "", timeZone = "America/Los_Angeles" } = options;
  const seen = new Set();
  const events = [];
  for (const raw of rawEvents || []) {
    const id = raw.event_id || `${raw.tab_id}:${raw.seq}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({ ...raw, ts: num(raw.ts), seq: num(raw.seq), props: parseProps(raw.props) });
  }
  // Event timestamps are server-corrected; seq breaks ties within a tab.
  events.sort((a, b) => a.ts - b.ts || String(a.tab_id).localeCompare(String(b.tab_id)) || a.seq - b.seq);

  const pages = [];
  const pageByPv = new Map();
  const attentionByPv = new Map();
  for (const event of events) {
    const p = event.props;
    if (event.name === "page_view") {
      const page = {
        pv: p.pv || event.event_id, path: p.path || "/", group: p.group || "other", slug: p.slug || "",
        modal: p.group === "home_modal" ? p.slug : "", nav: p.nav || "route", at: event.ts, tab: event.tab_id,
        refHost: p.ref_host || "", utm: { source: p.utm_source, medium: p.utm_medium, campaign: p.utm_campaign },
        viewport: p.viewport || "",
      };
      pages.push(page);
      pageByPv.set(page.pv, page);
    } else if (event.name === "page_attention") {
      const current = attentionByPv.get(p.pv) || { fg_ms: 0, active_ms: 0, pointer: 0, keys: 0, scrolls: 0, touches: 0, max_scroll: 0, hidden_count: 0, first_input_ms: null, at: 0 };
      // Cumulative snapshots: keep the maximum of each counter so retries,
      // duplicates and out-of-order delivery cannot inflate time.
      for (const key of ["fg_ms", "active_ms", "pointer", "keys", "scrolls", "touches", "max_scroll", "hidden_count"]) current[key] = Math.max(current[key], num(p[key]));
      if (p.first_input_ms !== undefined && (current.first_input_ms === null || num(p.first_input_ms) < current.first_input_ms)) current.first_input_ms = num(p.first_input_ms);
      current.at = Math.max(current.at, event.ts);
      attentionByPv.set(p.pv, current);
    }
  }

  for (const page of pages) page.attention = attentionByPv.get(page.pv) || null;
  const startedAt = events.length ? events[0].ts : num(meta?.started_at);
  const lastAt = events.length ? events[events.length - 1].ts : num(meta?.last_seen_at);
  const totals = { fg_ms: 0, active_ms: 0, pointer: 0, keys: 0, scrolls: 0, touches: 0 };
  const activeByPath = new Map();
  for (const page of pages) {
    if (!page.attention) continue;
    for (const key of Object.keys(totals)) totals[key] += page.attention[key];
    const label = pageName(page, titleForPath);
    activeByPath.set(label, (activeByPath.get(label) || 0) + page.attention.active_ms);
  }
  // Attention snapshots that arrived for a page_view we never received still count.
  for (const [pv, attention] of attentionByPv) {
    if (pageByPv.has(pv)) continue;
    for (const key of Object.keys(totals)) totals[key] += attention[key];
  }

  const actions = events.filter((e) => MEANINGFUL_EVENTS.has(e.name));
  const inputTimes = pages.flatMap((page) => {
    const offset = page.attention?.first_input_ms;
    return offset == null ? [] : [Math.max(0, page.at - startedAt + offset)];
  });
  const timeToFirstInputMs = inputTimes.length ? Math.min(...inputTimes) : null;
  const timeToFirstActionMs = actions.length ? actions[0].ts - startedAt : null;

  // Time between opening a project and acting on it.
  const openToAction = [];
  for (const action of actions) {
    const slug = action.props.project_slug || action.props.product_slug;
    if (!slug) continue;
    const opened = [...pages].reverse().find((page) => page.tab === action.tab_id && page.at <= action.ts && (page.slug === slug || page.modal === slug));
    if (opened) openToAction.push({ slug, ms: action.ts - opened.at, destination: action.props.destination_category });
  }

  const gaps = [];
  for (let i = 1; i < pages.length; i += 1) gaps.push(pages[i].at - pages[i - 1].at);
  const landing = pages[0] || null;
  const exit = pages[pages.length - 1] || null;
  // Project detail pages and home modals only; the /projects index is not a project.
  const projects = [...new Set(pages.filter((p) => p.modal || p.path.startsWith("/projects/")).map((p) => p.modal || p.slug).filter(Boolean))];

  const session = {
    id: meta?.session_id || events[0]?.session_id || "",
    meta: meta || {},
    startedAt, lastAt,
    elapsedMs: Math.max(0, lastAt - startedAt),
    foregroundMs: totals.fg_ms,
    activeMs: totals.active_ms,
    inputs: { pointer: totals.pointer, keys: totals.keys, scrolls: totals.scrolls, touches: totals.touches },
    hasAttentionData: attentionByPv.size > 0,
    pages, events, actions,
    pageCount: pages.length,
    uniquePaths: new Set(pages.map((p) => `${p.path}:${p.modal}`)).size,
    navigationGapsMs: gaps,
    medianNavigationGapMs: median(gaps),
    landing, exit, projects,
    activeByPage: [...activeByPath.entries()].map(([page, ms]) => ({ page, ms })).sort((a, b) => b.ms - a.ms),
    timeToFirstInputMs, timeToFirstActionMs, openToAction,
    referrer: landing?.refHost || "",
    utm: landing?.utm || {},
    duplicateEventsDropped: (rawEvents?.length || 0) - events.length,
  };
  session.engagement = engagementTier(session);
  session.timeline = buildTimeline(session, { titleForPath, timeZone });
  return session;
}

export function engagementTier(session) {
  if (!session.hasAttentionData) return "no_attention_data";
  if (session.activeMs >= 60_000 || (session.activeMs >= 30_000 && session.uniquePaths >= 2)) return "sustained";
  if (session.activeMs >= 10_000) return "short";
  return "glance";
}

function acquisitionPhrase(session) {
  const utm = session.utm || {};
  if (utm.source) return `from a ${utm.source}${utm.medium ? ` ${utm.medium}` : ""} link${utm.campaign ? ` (campaign ${utm.campaign})` : ""}`;
  if (session.referrer) return `from a ${session.referrer} referral`;
  return "with no referrer (direct or unattributed)";
}

function describeAction(event, titleForPath) {
  const p = event.props;
  const subject = p.project_slug || p.product_slug ? ` for ${projectName(p.project_slug || p.product_slug, titleForPath)}` : "";
  const where = p.surface && !/^project_resource$|^unknown$/.test(p.surface) ? ` (from ${String(p.surface).replace(/_/g, " ")})` : "";
  switch (event.name) {
    case "project_resource_click":
      if (p.destination_category === "download" || p.action_type === "download") return `Started a download${subject}${where}`;
      return `Opened ${DESTINATION_LABELS[p.destination_category] || (p.action_type ? `a ${p.action_type} link` : "a resource")}${subject}${where}`;
    case "outbound_click": return `Followed an outbound link to ${p.destination_domain || "another site"}${where}`;
    case "social_click": return `Opened ${p.social_network || "a"} profile link`;
    case "article_source_click": return `Opened an article source (${p.destination_domain || "external"})`;
    case "resume_view": return "Opened the résumé PDF";
    case "resume_download": return "Started a résumé download";
    case "contact_click": return `Clicked a contact link${where}`;
    case "contact_submit": return "Sent a contact message";
    case "newsletter_interest": return "Requested writing updates";
    case "product_demo_complete": return `Completed the ${projectName(p.product_slug, titleForPath)} demo`;
    default: return eventDefinition(event.name).label;
  }
}

function describeEvent(event, page, titleForPath) {
  const p = event.props;
  if (MEANINGFUL_EVENTS.has(event.name)) return { text: describeAction(event, titleForPath), kind: "action" };
  switch (event.name) {
    case "portfolio_section_engaged":
      if (num(p.visible_time_sec) < 15) return null;
      return { text: `Kept ${String(p.section_key || "a section").replace(/^project_(modal_)?/, "").replace(/_/g, " ")} in view for ${p.visible_time_sec} s+`, kind: "attention" };
    case "portfolio_scroll_depth":
      if (num(p.scroll_percent) < 75) return null;
      return { text: `Scrolled to ${p.scroll_percent}% of ${pageName(page, titleForPath)}`, kind: "attention" };
    case "portfolio_filter_change": return { text: `Filtered by ${p.filter_type || "a filter"}${p.filter_value ? `: ${p.filter_value}` : ""}`, kind: "engagement" };
    case "project_item_open": {
      const type = String(p.item_type || "project");
      return { text: `Opened ${/^[aeiou]/i.test(type) ? "an" : "a"} ${type} item${p.collection_key ? ` in ${p.collection_key}` : ""}`, kind: "engagement" };
    }
    case "project_media_play": return { text: `Interacted with ${p.media_kind || "media"}`, kind: "engagement" };
    case "project_media_progress": return { text: `${p.media_kind || "Media"} ${p.interaction_type || "progress"}${p.progress_percent ? ` (${p.progress_percent}%)` : ""}`, kind: "engagement" };
    case "product_demo_start": return { text: `Started the ${projectName(p.product_slug, titleForPath)} demo`, kind: "engagement" };
    case "article_project_click": return { text: `Followed an article link to ${projectName(p.project_slug, titleForPath)}`, kind: "engagement" };
    case "work_log_open": return { text: "Expanded a work-log entry", kind: "engagement" };
    case "contact_submit_failed": case "newsletter_interest_failed": return { text: `${eventDefinition(event.name).label} (${p.status || "error"})`, kind: "diagnostic" };
    default: return null;
  }
}

function buildTimeline(session, { titleForPath, timeZone }) {
  const items = [];
  const currentPages = new Map();
  for (const event of session.events) {
    if (event.name === "page_view") {
      const page = session.pages.find((p) => p.pv === (event.props.pv || event.event_id));
      currentPages.set(event.tab_id, page);
      const first = items.length === 0;
      const verb = first ? `Arrived on ${pageName(page, titleForPath)} ${acquisitionPhrase(session)}`
        : page.nav === "reload" ? `Reloaded ${pageName(page, titleForPath)}`
          : page.nav === "back_forward" ? `Went back/forward to ${pageName(page, titleForPath)}`
            : `Opened ${pageName(page, titleForPath)}`;
      const attention = page?.attention;
      items.push({
        ts: event.ts, time: formatClock(event.ts, timeZone), kind: "navigation", text: verb,
        detail: attention ? `${formatSeconds(attention.active_ms)} active · ${formatSeconds(attention.fg_ms)} in foreground${attention.hidden_count ? ` · backgrounded ${attention.hidden_count}×` : ""}` : "no attention report received",
      });
      continue;
    }
    const described = describeEvent(event, currentPages.get(event.tab_id), titleForPath);
    if (!described) continue;
    const previous = items[items.length - 1];
    if (previous && previous.document === event.tab_id && previous.text === described.text && event.ts - previous.lastTs < 120_000) {
      previous.repeat = (previous.repeat || 1) + 1;
      previous.lastTs = event.ts;
      continue;
    }
    items.push({ ts: event.ts, lastTs: event.ts, time: formatClock(event.ts, timeZone), document: event.tab_id, ...described });
  }
  if (items.length) {
    items.push({ ts: session.lastAt, time: formatClock(session.lastAt, timeZone), kind: "end", text: "Last observed activity", detail: "Not proof of when reading stopped." });
  }
  for (let i = 0; i < items.length - 1; i += 1) items[i].sinceStart = items[i].ts - session.startedAt;
  return items;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function journeySignature(session) {
  return session.pages.slice(0, 6).map((p) => `${p.path}${p.modal ? `?${p.modal}` : ""}`).join(">") || "(no pages)";
}

/**
 * Explainable traffic-quality classification. Returns a category, a
 * confidence word and the evidence (each with its weight). Positive weights
 * point towards automation, negative towards a person. Evidence supports a
 * classification; it never proves identity.
 */
export function classifySession(session, context = {}) {
  const meta = session.meta || {};
  const evidence = [];
  const add = (weight, code, text) => evidence.push({ weight, code, text });

  if (meta.qa_run) {
    add(0, "qa_run", `Tagged as a controlled QA run (${meta.qa_run}).`);
    return finish("known_internal", evidence, "explicit");
  }
  if (meta.ua_automation && meta.ua_automation !== "empty_user_agent") {
    add(0, "ua_automation", `Browser identified itself as automation (${meta.ua_automation}).`);
    return finish("known_automated", evidence, "explicit");
  }

  const inputs = session.inputs;
  const directInputs = inputs.pointer + inputs.keys + inputs.touches;
  const anyInput = directInputs + inputs.scrolls;

  if (!session.hasAttentionData) add(1, "no_attention", "No attention report arrived (the browser may have been terminated without leaving the page).");
  else if (anyInput === 0 && session.foregroundMs >= 5_000) add(2, "no_input", `No scroll, pointer, key or touch activity during ${formatSeconds(session.foregroundMs)} in the foreground.`);
  else if (anyInput === 0) add(0, "no_input_short", "Very short visit with no input activity.");

  const clicks = session.actions.filter((a) => /click|resume_/.test(a.name));
  if (clicks.length && session.hasAttentionData && directInputs === 0) add(2, "click_without_input", `${clicks.length} click event${clicks.length === 1 ? "" : "s"} with no pointer, touch or keyboard input recorded (a synthetic-click pattern).`);

  if (session.pageCount >= 8 && session.elapsedMs < 60_000) add(3, "high_frequency", `${session.pageCount} page loads within ${formatSeconds(session.elapsedMs)}.`);
  else if (session.pageCount >= 3 && session.medianNavigationGapMs !== null && session.medianNavigationGapMs < 2_000) add(2, "rapid_navigation", `Navigated ${session.pageCount} pages with a median of ${formatSeconds(session.medianNavigationGapMs)} between them.`);

  const signatureCount = context.signatureCounts?.get(journeySignature(session)) || 0;
  if (signatureCount >= 3 && anyInput === 0) add(2, "repeated_journey", `Same page sequence as ${signatureCount - 1} other session${signatureCount === 2 ? "" : "s"} today, none with input activity.`);

  if (meta.default_automation_viewport) add(2, "automation_viewport", "Window exactly 800×600, the default of common browser-automation tools.");
  if (meta.no_window_chrome) add(2, "no_window_chrome", "Browser reported no window frame (outer size 0), typical of headless browsers.");
  if (meta.network_class === "datacenter") add(1, "datacenter", `Connected from a hosting/cloud network${meta.network_org ? ` (${meta.network_org})` : ""}. Weak signal: VPNs and cloud desktops are used by people too.`);

  if (directInputs >= 3) add(-2, "direct_input", `Pointer, touch or keyboard activity in ${directInputs} separate moments.`);
  else if (inputs.scrolls >= 2) add(-1, "scroll_input", "Scrolled in several separate moments.");
  if (anyInput > 0 && session.activeMs >= 60_000) add(-2, "sustained_active", `${formatSeconds(session.activeMs)} of active foreground time.`);
  else if (anyInput > 0 && session.activeMs >= 20_000) add(-1, "active", `${formatSeconds(session.activeMs)} of active foreground time.`);
  if (session.uniquePaths >= 2 && session.medianNavigationGapMs !== null && session.medianNavigationGapMs >= 3_000) add(-1, "realistic_navigation", `${session.uniquePaths} pages with realistic gaps (median ${formatSeconds(session.medianNavigationGapMs)}).`);
  if (session.actions.length && session.timeToFirstActionMs >= 3_000 && directInputs > 0) add(-1, "considered_action", `Acted after ${formatSeconds(session.timeToFirstActionMs)} with preceding input.`);
  if (session.hasAttentionData && session.inputs && session.pages.some((p) => p.attention?.hidden_count)) add(0, "backgrounded", "Tab was backgrounded at least once (time while hidden is excluded).");

  const score = evidence.reduce((sum, item) => sum + item.weight, 0);
  const hasAutomatedPattern = evidence.some(({ code }) =>
    ["click_without_input", "high_frequency", "rapid_navigation", "repeated_journey", "no_window_chrome"].includes(code));
  const category = score >= AUTOMATED_THRESHOLD && hasAutomatedPattern ? "likely_automated" : score <= HUMAN_THRESHOLD ? "likely_human" : "uncertain";
  const magnitude = Math.abs(score);
  return finish(category, evidence, category === "uncertain" ? "low" : magnitude >= 5 ? "high" : magnitude >= 3 ? "medium" : "low", score);
}

function finish(category, evidence, confidence, score = 0) {
  const relevant = evidence
    .filter((e) => category === "likely_human" ? e.weight < 0 : category === "likely_automated" ? e.weight > 0 : e.weight !== 0 || category.startsWith("known"))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const reasons = (relevant.length ? relevant : evidence).slice(0, 3).map((e) => e.text);
  const label = CLASSIFICATIONS[category].label;
  const clause = (text) => lowerFirst(String(text).replace(/\.$/, ""));
  const summary = category === "uncertain"
    ? `Uncertain — ${evidence.length ? `mixed or insufficient evidence: ${clause(reasons[0])}.` : "too little evidence."}`
    : `${label} — ${reasons.map(clause).join("; ")}.`;
  return { category, label, confidence, score, evidence, reasons, summary };
}

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

// ---------------------------------------------------------------------------
// Day summaries
// ---------------------------------------------------------------------------

/** Reconstructs and classifies every session for a reporting window. */
export function analyzeSessions(sessionRows, eventRows, options = {}) {
  const eventsBySession = new Map();
  for (const event of eventRows || []) {
    if (!eventsBySession.has(event.session_id)) eventsBySession.set(event.session_id, []);
    eventsBySession.get(event.session_id).push(event);
  }
  const sessions = (sessionRows || []).map((meta) => reconstructSession(meta, eventsBySession.get(meta.session_id) || [], options));
  const signatureCounts = new Map();
  for (const session of sessions) signatureCounts.set(journeySignature(session), (signatureCounts.get(journeySignature(session)) || 0) + 1);
  for (const session of sessions) session.classification = classifySession(session, { signatureCounts });
  return sessions.sort((a, b) => a.startedAt - b.startedAt);
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeSessions(sessions, options = {}) {
  const { titleForPath = () => "" } = options;
  const byClass = Object.fromEntries(Object.keys(CLASSIFICATIONS).map((key) => [key, sessions.filter((s) => s.classification?.category === key)]));
  const people = [...byClass.likely_human, ...byClass.uncertain];
  const actionEvents = sessions.flatMap((s) => s.actions.map((a) => ({ session: s, event: a })));

  const actionRows = new Map();
  for (const { session, event } of actionEvents) {
    const p = event.props;
    const key = `${event.name}|${p.project_slug || p.product_slug || ""}|${p.destination_category || p.action_type || ""}`;
    const row = actionRows.get(key) || {
      label: describeAction(event, titleForPath).replace(/ \(from .*\)$/, ""), events: 0, sessions: new Set(), humanSessions: new Set(), automatedSessions: new Set(), surfaces: new Map(),
    };
    row.events += 1;
    row.sessions.add(session.id);
    if (session.classification.category === "likely_human") row.humanSessions.add(session.id);
    if (/automated/.test(session.classification.category)) row.automatedSessions.add(session.id);
    if (p.surface) row.surfaces.set(p.surface, (row.surfaces.get(p.surface) || 0) + 1);
    actionRows.set(key, row);
  }
  const actions = [...actionRows.values()].map((row) => ({
    label: row.label, events: row.events, sessions: row.sessions.size, humanSessions: row.humanSessions.size, automatedSessions: row.automatedSessions.size,
    surfaces: [...row.surfaces.entries()].sort((a, b) => b[1] - a[1]).map(([surface, count]) => ({ surface, count })),
  })).sort((a, b) => b.sessions - a.sessions || b.events - a.events);

  const projectInterest = new Map();
  for (const session of sessions) {
    for (const slug of new Set([...session.projects, ...session.actions.map((a) => a.props.project_slug).filter(Boolean)])) {
      const row = projectInterest.get(slug) || { slug, title: projectName(slug, titleForPath), sessions: 0, humanSessions: 0, activeMs: 0, actionSessions: 0 };
      row.sessions += 1;
      if (session.classification.category === "likely_human") row.humanSessions += 1;
      row.activeMs += session.pages.filter((p) => p.slug === slug || p.modal === slug).reduce((sum, p) => sum + (p.attention?.active_ms || 0), 0);
      if (session.actions.some((a) => a.props.project_slug === slug || a.props.product_slug === slug)) row.actionSessions += 1;
      projectInterest.set(slug, row);
    }
  }

  const repeatedClicks = [];
  for (const session of sessions) {
    const counts = countBy(session.actions, (a) => `${a.name}|${a.props.project_slug || ""}|${a.props.destination_category || ""}`);
    for (const row of counts) if (row.count >= 3) repeatedClicks.push({ session, count: row.count, action: describeAction(session.actions.find((a) => `${a.name}|${a.props.project_slug || ""}|${a.props.destination_category || ""}` === row.label), titleForPath) });
  }

  const activeValues = people.filter((s) => s.hasAttentionData).map((s) => s.activeMs);
  return {
    total: sessions.length,
    counts: Object.fromEntries(Object.entries(byClass).map(([key, list]) => [key, list.length])),
    engagement: countBy(sessions, (s) => s.engagement),
    sustainedHuman: byClass.likely_human.filter((s) => s.engagement === "sustained").length,
    multiPage: sessions.filter((s) => s.uniquePaths >= 2).length,
    multiPageHuman: byClass.likely_human.filter((s) => s.uniquePaths >= 2).length,
    actionSessions: sessions.filter((s) => s.actions.length).length,
    actionSessionsHuman: byClass.likely_human.filter((s) => s.actions.length).length,
    actionEvents: actionEvents.length,
    actions,
    activeMsTotal: sessions.reduce((sum, s) => sum + s.activeMs, 0),
    activeMsHuman: byClass.likely_human.reduce((sum, s) => sum + s.activeMs, 0),
    medianActiveMsPeople: median(activeValues),
    landings: countBy(sessions, (s) => s.landing ? pageName(s.landing, titleForPath) : null),
    exits: countBy(sessions, (s) => s.exit ? pageName(s.exit, titleForPath) : null),
    referrers: countBy(sessions, (s) => s.utm?.source ? `${s.utm.source} / ${s.utm.medium || "(none)"}` : s.referrer || "(no referrer)"),
    projects: [...projectInterest.values()].sort((a, b) => b.humanSessions - a.humanSessions || b.sessions - a.sessions || b.activeMs - a.activeMs),
    repeatedClicks,
    networks: countBy(sessions, (s) => s.meta.network_class || "unknown"),
    devices: countBy(sessions, (s) => s.meta.device_category || "unknown"),
    duplicateEventsDropped: sessions.reduce((sum, s) => sum + s.duplicateEventsDropped, 0),
    // Strongest first: weight × sessions, so a weak signal seen often does not lead.
    topEvidence: (() => {
      const rows = new Map();
      for (const s of sessions.filter((x) => x.classification.category === "likely_automated")) {
        for (const e of s.classification.evidence.filter((x) => x.weight > 0)) {
          const row = rows.get(e.code) || { label: e.code, count: 0, weight: e.weight };
          row.count += 1;
          rows.set(e.code, row);
        }
      }
      return [...rows.values()].sort((a, b) => b.weight * b.count - a.weight * a.count || b.count - a.count);
    })(),
  };
}

/** One qualified sentence describing what a session did. Observed facts only. */
export function narrateSession(session, options = {}) {
  const { titleForPath = () => "" } = options;
  const c = session.classification;
  const who = c.category === "likely_human" ? "One likely-human session" : c.category === "uncertain" ? "One session of uncertain origin" : `One ${c.label.toLowerCase()} session`;
  const landing = session.landing ? pageName(session.landing, titleForPath) : "the site";
  const parts = [`${who} arrived on ${landing} ${acquisitionPhrase(session)}`];
  const others = session.pages.slice(1).map((p) => pageName(p, titleForPath)).filter((name, i, all) => name !== landing && all.indexOf(name) === i);
  if (others.length) parts.push(`went on to ${others.slice(0, 3).join(", ")}${others.length > 3 ? ` and ${others.length - 3} more` : ""}`);
  const focus = session.activeByPage[0];
  if (focus && focus.ms >= 10_000) parts.push(`spent ${approxDuration(focus.ms)} active on ${focus.page}`);
  const engaged = session.events.find((e) => e.name === "portfolio_section_engaged" && num(e.props.visible_time_sec) >= 30);
  if (engaged) parts.push(`kept its ${String(engaged.props.section_key).replace(/^project_(modal_)?/, "").replace(/_/g, " ")} section in view for ${engaged.props.visible_time_sec}+ seconds`);
  if (session.actions.length) {
    const descriptions = [...new Set(session.actions.map((a) => lowerFirst(describeAction(a, titleForPath).replace(/ \(from .*\)$/, ""))))];
    parts.push(descriptions.slice(0, 2).join(" and "));
  }
  const sentence = parts.length > 2 ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}` : parts.join(" and ");
  return `${sentence}.`;
}

/** Picks up to `limit` sessions that say something useful about engagement. */
export function pickNotableSessions(sessions, limit = 3) {
  const score = (s) => {
    const c = s.classification.category;
    let value = c === "likely_human" ? 30 : c === "uncertain" ? 10 : -100;
    value += s.actions.length ? 20 : 0;
    value += Math.min(20, s.uniquePaths * 5);
    value += Math.min(20, s.activeMs / 6_000);
    return value;
  };
  const candidates = sessions.filter((s) => !/automated|internal/.test(s.classification.category) && s.pageCount > 0 && (s.actions.length || s.uniquePaths >= 2 || s.activeMs >= 30_000));
  return candidates.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** Compact, display-ready form used by the session explorer and the report. */
export function serializeSession(session, options = {}) {
  const { titleForPath = () => "" } = options;
  const meta = session.meta || {};
  return {
    id: session.id,
    shortId: String(session.id).slice(0, 8),
    startedAt: session.startedAt,
    lastAt: session.lastAt,
    elapsedMs: session.elapsedMs,
    foregroundMs: session.foregroundMs,
    activeMs: session.activeMs,
    pageCount: session.pageCount,
    uniquePaths: session.uniquePaths,
    landing: session.landing ? pageName(session.landing, titleForPath) : null,
    landingPath: session.landing?.path || null,
    exit: session.exit ? pageName(session.exit, titleForPath) : null,
    referrer: session.utm?.source ? `${session.utm.source} / ${session.utm.medium || "(none)"}` : session.referrer || "(no referrer)",
    campaign: session.utm?.campaign || null,
    device: meta.device_category || "unknown",
    browser: meta.browser_family || "unknown",
    os: meta.os_family || "unknown",
    network: meta.network_class || "unknown",
    country: meta.country || null,
    projects: session.projects,
    projectTitles: session.projects.map((slug) => projectName(slug, titleForPath)),
    actions: session.actions.map((a) => describeAction(a, titleForPath)),
    actionCount: session.actions.length,
    engagement: session.engagement,
    inputs: session.inputs,
    timeToFirstInputMs: session.timeToFirstInputMs,
    timeToFirstActionMs: session.timeToFirstActionMs,
    openToAction: session.openToAction,
    activeByPage: session.activeByPage,
    path: session.pages.map((p) => pageName(p, titleForPath)),
    classification: {
      category: session.classification?.category, label: session.classification?.label, confidence: session.classification?.confidence,
      summary: session.classification?.summary, reasons: session.classification?.reasons, evidence: session.classification?.evidence,
    },
    timeline: session.timeline.map(({ time, kind, text, detail, repeat, sinceStart }) => ({ time, kind, text, detail, repeat, sinceStart })),
    narrative: narrateSession(session, { titleForPath }),
  };
}

/** Aggregate observed route transitions within a document. */
export function navigationFlows(sessions, options = {}) {
  const { titleForPath = () => "", limit = 15 } = options;
  const counts = new Map();
  for (const session of sessions) {
    const latestByDocument = new Map();
    const entry = session.pages[0];
    if (entry) {
      const key = `(entry) → ${pageName(entry, titleForPath)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const page of session.pages) {
      const name = pageName(page, titleForPath);
      const previous = latestByDocument.get(page.tab);
      if (previous && previous !== name) {
        const key = `${previous} → ${name}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      latestByDocument.set(page.tab, name);
    }
  }
  return [...counts.entries()].map(([flow, count]) => ({ flow, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

function zoneOffsetMs(ms, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function localMidnightUtc(isoDate, timeZone) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - zoneOffsetMs(guess, timeZone);
  result = guess - zoneOffsetMs(result, timeZone);
  return result;
}

/**
 * [from, to) in UTC ms for a calendar day in the reporting time zone. A
 * session belongs to the day it started in, even if it continues past
 * midnight, so it is never counted twice.
 */
export function zonedDayWindow(isoDate, timeZone = "America/Los_Angeles") {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { from: localMidnightUtc(isoDate, timeZone), to: localMidnightUtc(next, timeZone) };
}
