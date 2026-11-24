/**
 * The daily analytics brief: a short, plain-language email built from the
 * full report object. Every number comes from a deterministic calculation on
 * GA4 aggregates or the first-party session stream; each sentence says which.
 *
 * Leads with the daily summary, estimated visitor locations and activity.
 */

const COLORS = {
  page: "#f4f5f7", card: "#ffffff", ink: "#1f2328", muted: "#59636e", faint: "#8c959f", line: "#e4e7eb",
  accent: "#0b57d0", human: "#1a7f37", auto: "#b42318", uncertain: "#9a6700", warnBg: "#fff8e6", warnLine: "#e3b341", goodBg: "#eef8f1",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Cities that host large public-cloud regions. Used only to describe a
// geographic concentration; never to classify a session.
const CLOUD_REGION_CITIES = new Set(["Council Bluffs", "Ashburn", "Boardman", "The Dalles", "Moses Lake", "Quincy", "Santa Clara", "San Antonio", "Des Moines", "West Des Moines", "Columbus", "Dublin", "Mayes County", "Lenoir", "Pryor"]);

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const n = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const int = (value) => (n(value) === null ? "—" : Math.round(value).toLocaleString("en-US"));
const plural = (count, word, pluralWord = `${word}s`) => `${int(count)} ${count === 1 ? word : pluralWord}`;
const pct = (value) => (n(value) === null ? "—" : `${Math.round(value * 100)}%`);

export function formatActive(ms) {
  const seconds = Math.round((ms || 0) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 >= 30 && minutes < 10 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "+10 vs Sat (39)" — absolute change; percentages only for solid baselines. */
export function compareCount(current, previous, label) {
  if (n(current) === null || n(previous) === null) return null;
  const diff = current - previous;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const abs = Math.abs(diff);
  if (previous < 5 || abs === 0) return `${sign}${int(abs)} vs ${label} (${int(previous)})`;
  return `${sign}${int(abs)} vs ${label} (${int(previous)}, ${sign}${Math.round((abs / previous) * 100)}%)`;
}

/** Rate change in percentage points. */
export function compareRate(current, previous, label) {
  if (n(current) === null || n(previous) === null) return null;
  const diff = Math.round((current - previous) * 100);
  return `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff)} pp vs ${label}`;
}

function weekdayShort(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

const EVIDENCE_TEXT = {
  no_input: "no scroll, pointer, key or touch activity",
  no_input_short: "very short visits with no input",
  no_attention: "no attention report (browser closed abruptly)",
  click_without_input: "clicks with no preceding pointer or keyboard input",
  high_frequency: "many page loads within a minute",
  rapid_navigation: "page changes faster than a person reads",
  repeated_journey: "identical page sequences repeated across sessions",
  automation_viewport: "an 800×600 automation-default window",
  no_window_chrome: "a browser with no window frame",
  datacenter: "hosting-network origin (weak on its own)",
};

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

function projectTitleFromSlug(report, slug) {
  const page = (report.content?.pages || []).find((p) => p.slug === slug && p.type === "Project");
  return page?.title || String(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildFindings(report) {
  const findings = [];
  const stream = report.sessionStream;
  const sessions = sessionsOf(report);
  const sourceRows = report.traffic?.sourceMedium || [];
  const directSessions = sourceRows.filter((row) => /\(direct\)|^direct/i.test(row.label)).reduce((sum, row) => sum + (row.metrics?.sessions || 0), 0);

  // Attribution
  if (sessions && sessions >= 10 && directSessions / sessions >= 0.9) {
    const streamReferred = stream?.available ? stream.sessions.filter((s) => s.referrer !== "(no referrer)").length : null;
    findings.push({
      severity: "warning", kind: "attribution",
      title: directSessions === sessions ? `All ${int(sessions)} GA4 sessions had no source` : `${int(directSessions)} of ${int(sessions)} GA4 sessions had no source`,
      detail: streamReferred
        ? `The session stream saw a referrer or campaign for ${plural(streamReferred, "session")}, while GA4 reported mostly direct traffic. The two systems observe different sets of sessions.`
        : "GA4 had no attributable source for those sessions. Private shares, absent campaign tags and other referrer loss can all produce this result.",
    });
  }

  // Geographic concentration in cloud-region cities (observation only)
  const cities = report.audience?.cities || [];
  const cloud = cities.filter((row) => CLOUD_REGION_CITIES.has(String(row.label).split(" / ")[0]));
  const cloudSessions = cloud.reduce((sum, row) => sum + (row.metrics?.sessions || 0), 0);
  if (sessions && cloudSessions >= 5 && cloudSessions / sessions >= 0.3) {
    const top = cloud[0];
    findings.push({
      severity: "info", kind: "geography",
      title: `${int(cloudSessions)} sessions came from cities that host large cloud data centres`,
      detail: `${String(top.label).replace(" / ", ", ")} alone had ${plural(top.metrics.sessions, "session")}. Location is never used to classify a session — people live there too — but it is worth comparing with the traffic-quality evidence.`,
    });
  }

  // Clicks far above detail-page views for one project (historical anomaly pattern)
  const clicksByPage = report.actionDiagnostics?.clicksByPage || [];
  const clicksByProject = new Map();
  for (const row of clicksByPage) {
    const entry = clicksByProject.get(row.projectSlug) || { clicks: 0, sessions: 0, offPage: 0, pages: [] };
    entry.clicks += row.events;
    entry.sessions += row.sessions;
    if (!row.pagePath.startsWith(`/projects/${row.projectSlug}`)) entry.offPage += row.events;
    entry.pages.push(row);
    clicksByProject.set(row.projectSlug, entry);
  }
  for (const [slug, entry] of clicksByProject) {
    const views = (report.content?.pages || []).find((p) => p.path === `/projects/${slug}`)?.views || 0;
    if (entry.clicks >= 5 && entry.clicks >= 2 * Math.max(views, 1)) {
      const elsewhere = entry.pages.filter((p) => !p.pagePath.startsWith(`/projects/${slug}`)).map((p) => `${p.pagePath} (${p.events})`).slice(0, 3);
      findings.push({
        severity: "info", kind: "click_anomaly",
        title: `${projectTitleFromSlug(report, slug)}: ${plural(entry.clicks, "resource click")} vs ${plural(views, "detail-page view")}`,
        detail: elsewhere.length
          ? `${int(entry.offPage)} of the clicks happened outside the detail page — ${elsewhere.join(", ")} — on project cards and product pages, so the counts are not contradictory.`
          : `GA4 recorded all clicks on the detail page, across ${plural(entry.sessions, "session")}. Each session can contain multiple clicks.`,
      });
    }
  }

  // Desktop sessions reporting a tablet-sized window
  const mismatch = (report.actionDiagnostics?.deviceViewport || []).find((row) => row.device === "desktop" && row.viewport === "tablet");
  if (mismatch && mismatch.sessions >= 5) {
    findings.push({
      severity: "info", kind: "viewport",
      title: `${plural(mismatch.sessions, "desktop session")} used a 768–1023 px window`,
      detail: "Common browser-automation tools open 800×600 windows by default. Supporting evidence only; a narrow desktop window is also normal.",
    });
  }

  // Session-stream findings
  if (stream?.available && !stream.empty) {
    for (const repeat of stream.summary.repeatedClicks.slice(0, 1)) {
      findings.push({
        severity: "info", kind: "repeated_clicks",
        title: `One ${repeat.session.classification.label.toLowerCase()} session repeated an action ${repeat.count} times`,
        detail: `${repeat.action}. Shown as ${repeat.count} events but one session; it may be a retry after a slow load or an automated loop.`,
      });
    }
    const weak = stream.summary.projects.find((p) => p.humanSessions >= 2 && p.activeMs / p.sessions < 5_000 && p.actionSessions === 0);
    if (weak) {
      findings.push({
        severity: "opportunity", kind: "low_engagement",
        title: `${weak.title} drew ${plural(weak.sessions, "session")} but little attention`,
        detail: `Average active time was ${formatActive(weak.activeMs / weak.sessions)} and nobody took an action. Check what visitors see first on that page.`,
      });
    }
    const sources = new Map();
    for (const session of stream.sessions.filter((s) => s.classification.category === "likely_human" && s.actionCount && s.referrer !== "(no referrer)")) {
      sources.set(session.referrer, (sources.get(session.referrer) || 0) + 1);
    }
    const [bestSource] = [...sources.entries()].sort((a, b) => b[1] - a[1]);
    if (bestSource && bestSource[1] >= 2) {
      findings.push({ severity: "opportunity", kind: "source", title: `${bestSource[0]} sent ${bestSource[1]} likely-human visitors who took action`, detail: "This source is worth more links." });
    }
  } else if (!stream?.available) {
    findings.push({ severity: "info", kind: "stream", title: "Individual journeys are unavailable", detail: stream?.reason || "The session stream did not return data." });
  }

  // Unusual spike
  const avg = report.scorecards?.find((card) => card.key === "sessions")?.prior7Value;
  if (sessions && n(avg) !== null && sessions >= 15 && sessions >= avg * 2 + 10) {
    findings.unshift({ severity: "warning", kind: "spike", title: `Traffic spike: ${int(sessions)} sessions vs a 7-day average of ${int(avg)} a day`, detail: "Compare with the traffic-quality split before treating it as new interest." });
  }

  const order = { warning: 0, opportunity: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Brief model
// ---------------------------------------------------------------------------

function trafficLocations(audience = {}) {
  const locationName = (value) => value && !/^(?:unattributed|\(not set\)|\(other\)|unknown)$/i.test(value) ? value : "";
  const countries = (audience.countries || [])
    .filter((row) => n(row.metrics?.sessions) > 0)
    .slice(0, 4)
    .map((row) => `${locationName(row.dimensions?.country || row.label) || "Unknown country"} · ${plural(row.metrics.sessions, "session")}`);
  const regions = (audience.regions || []).flatMap((row) => {
    const region = locationName(row.dimensions?.region || row.label);
    const country = locationName(row.dimensions?.country);
    if (!region || !(n(row.metrics?.sessions) > 0)) return [];
    return [`${[region, country === region ? "" : country].filter(Boolean).join(", ")} · ${plural(row.metrics.sessions, "session")}`];
  }).slice(0, 5);

  return {
    rows: [
      { heading: "Top countries", rows: countries, empty: audience.countryDataAvailable ? "No countries reported." : "Country breakdown unavailable." },
      { heading: "Top states and regions", rows: regions, empty: audience.regionDataAvailable ? "No states or regions reported." : "State and region breakdown unavailable." },
    ],
    note: "Approximate locations from GA4. Counts are sessions and may include automated traffic.",
  };
}

export function buildBrief(report, links = null) {
  const meta = report.meta;
  const stream = report.sessionStream || { available: false };
  const hasStream = stream.available;
  const summary = hasStream ? stream.summary : null;
  const observedSessions = Boolean(summary?.total);
  const current = report.current || {};
  const previous = report.previous || {};
  const prevLabel = weekdayShort(meta.previousDate);
  const avg7 = report.scorecards?.find((card) => card.key === "sessions")?.prior7Value;
  const sessions = sessionsOf(report);
  const events = report.events || {};
  const resourceEvent = (events.rows || []).find((row) => row.name === "project_resource_click");

  // A. Executive summary --------------------------------------------------
  const sentences = [];
  if (sessions === null) sentences.push("GA4 totals were unavailable for this day, so traffic volume can't be stated.");
  else if (sessions === 0) sentences.push(`GA4 recorded no sessions on ${meta.dateLabel}.`);
  else {
    const vsPrev = n(previous.sessions) === null ? "" : sessions === previous.sessions ? `, the same as ${prevLabel}` : `, ${int(Math.abs(sessions - previous.sessions))} ${sessions > previous.sessions ? "more" : "fewer"} than ${prevLabel}`;
    const vsAvg = n(avg7) !== null && avg7 > 0 && (sessions >= avg7 * 2 || sessions <= avg7 / 2) ? ` and ${sessions > avg7 ? "well above" : "well below"} the 7-day average of ${int(avg7)} a day` : "";
    sentences.push(`GA4 recorded ${plural(sessions, "session")}${vsPrev}${vsAvg}.`);
  }
  if (hasStream) {
    const c = summary.counts;
    if (summary.total) {
      sentences.push(`First-party analytics observed ${plural(summary.total, "session")}. ${int(c.likely_human)} likely human, ${int(c.known_automated)} known automated, ${int(c.likely_automated)} suspected automated and ${int(c.uncertain)} unclassified.`);
    } else sentences.push("First-party analytics recorded zero sessions in the available window.");
    if (stream.partial) sentences.push("First-party coverage is partial for this reporting day.");
    if (summary.actionSessionsHuman) {
      const top = summary.actions.find((a) => a.humanSessions) || summary.actions[0];
      sentences.push(`${plural(summary.actionSessionsHuman, "likely-human session")} took a meaningful action${top ? `, most often: ${lowerFirst(top.label)}` : ""}.`);
    } else if (summary.actionSessions) {
      sentences.push(`${plural(summary.actionSessions, "session")} took an action, but none of them were clearly human, so this is weak evidence of interest.`);
    } else if (observedSessions) sentences.push("The first-party stream recorded no meaningful actions.");
    if (!observedSessions && resourceEvent) sentences.push(`GA4 recorded ${plural(resourceEvent.count, "project-resource click")}${n(resourceEvent.sessions) !== null ? ` across ${plural(resourceEvent.sessions, "session")}` : ""}.`);
  } else if (sessions) {
    sentences.push(`${plural(n(current.engagedSessions) ?? 0, "session")} met GA4's engagement rule (10 s, two pages or a key event). That rule doesn't show a person was present, and there's no session-level evidence for this day to tell people from automation.`);
    if (resourceEvent) sentences.push(`GA4 logged ${plural(resourceEvent.count, "project-resource click")} from ${plural(resourceEvent.sessions ?? 0, "session")}; treat them as possible, not confirmed, interest.`);
  }
  const findings = buildFindings(report);
  const headline = findings.find((f) => f.severity === "warning");
  if (headline && sentences.length < 4) sentences.push(`Worth a look: ${lowerFirst(headline.title)}.`);

  // B. Key metrics ---------------------------------------------------------
  const metrics = [];
  metrics.push({ label: "Sessions (GA4)", value: int(sessions), note: [compareCount(sessions, n(previous.sessions), prevLabel), n(avg7) !== null ? `7-day avg ${int(avg7)}/day` : null].filter(Boolean).join(" · ") || "No comparison" });
  if (n(current.totalUsers) !== null) {
    const returning = n(report.audience?.returningUsers);
    metrics.push({ label: "Users (GA4 estimate)", value: int(current.totalUsers),
      note: `${int(current.newUsers)} new · ${returning === null ? "returning unavailable" : `${int(returning)} returning`}` });
  }
  if (hasStream) {
    const c = summary.counts;
    const prev = stream.previous?.counts;
    metrics.push({ label: "Likely human", value: int(c.likely_human), tone: "human", note: prev ? compareCount(c.likely_human, prev.likely_human, prevLabel) : "Session stream" });
    metrics.push({ label: "Likely automated", value: int(c.likely_automated + c.known_automated), tone: "auto", note: c.known_automated ? `incl. ${int(c.known_automated)} self-declared` : prev ? compareCount(c.likely_automated + c.known_automated, prev.likely_automated + prev.known_automated, prevLabel) : "Session stream" });
    metrics.push({ label: "Uncertain", value: int(c.uncertain), tone: "uncertain", note: `of ${int(summary.total)} observed sessions` });
  }
  metrics.push({ label: "Engaged sessions (GA4 rule)", value: int(current.engagedSessions), note: [n(current.engagementRate) !== null ? pct(current.engagementRate) : null, compareRate(current.engagementRate, previous.engagementRate, prevLabel)].filter(Boolean).join(" · ") || "—" });
  if (hasStream) {
    metrics.push({ label: "Meaningful actions", value: int(summary.actionEvents), note: `from ${plural(summary.actionSessions, "session")}, ${int(summary.actionSessionsHuman)} likely human` });
    metrics.push({ label: "Active time, likely human", value: formatActive(summary.activeMsHuman), note: summary.medianActiveMsPeople === null ? "—" : `median ${formatActive(summary.medianActiveMsPeople)} per non-automated session` });
  } else {
    metrics.push({ label: "Key action events (GA4)", value: int(events.keyActionCount), note: "events, not people" });
    metrics.push({ label: "Avg. session (GA4)", value: n(current.averageSessionDuration) === null ? "—" : formatActive(current.averageSessionDuration * 1000), note: "includes inactive time" });
  }

  // C. What visitors did -----------------------------------------------------
  const did = { source: observedSessions ? "session" : "ga4", items: [] };
  const channels = (report.traffic?.channelGroups || []).slice(0, 4);
  const sources = (report.traffic?.sourceMedium || []).slice(0, 3);
  const campaigns = (report.traffic?.campaigns || []).filter((row) => row.label && !row.label.startsWith("(")).slice(0, 3);
  const acquisition = sources.length ? sources : channels.slice(0, 3);
  if (acquisition.length) {
    did.items.push({ heading: "How visits arrived (GA4)", rows: acquisition.map((row) => {
      const label = row.dimensions?.sessionSource === "(direct)" ? "Direct or unattributed" : row.label;
      return `${label} · ${plural(row.metrics.sessions, "session")}`;
    }) });
  }
  if (campaigns.length) did.items.push({ heading: "GA4 campaigns", rows: campaigns.map((row) => `${row.label} · ${plural(row.metrics.sessions, "session")}`) });
  if (observedSessions) {
    if (summary.referrers.length) did.items.push({ heading: "First-party referrers and tagged sources", rows: summary.referrers.slice(0, 4).map((row) => `${row.label} · ${plural(row.count, "session")}`) });
    const projects = summary.projects.filter((p) => p.sessions > 0).slice(0, 3);
    if (projects.length) did.items.push({ heading: "Projects that drew attention", rows: projects.map((p) => `${p.title} — ${plural(p.sessions, "session")} (${int(p.humanSessions)} likely human), ${formatActive(p.activeMs)} active${p.actionSessions ? `, ${plural(p.actionSessions, "session")} took action` : ""}`) });
    if (summary.landings.length) did.items.push({ heading: "Where sessions started", rows: summary.landings.slice(0, 3).map((l) => `${l.label} · ${int(l.count)}`) });
    if (summary.exits.length) did.items.push({ heading: "Last pages observed", rows: summary.exits.slice(0, 3).map((l) => `${l.label} · ${int(l.count)}`) });
    did.items.push({ heading: "Exploration", rows: [`${plural(summary.multiPage, "session")} viewed more than one page (${int(summary.multiPageHuman)} likely human); ${plural(summary.engagement.find((e) => e.label === "sustained")?.count || 0, "session")} had sustained active time (≥ 1 min, or ≥ 30 s across pages).`] });
    if (summary.actions.length) did.items.push({ heading: "Actions (events · distinct sessions)", rows: summary.actions.slice(0, 3).map((a) => `${a.label} — ${plural(a.events, "event")} · ${plural(a.sessions, "session")}${a.automatedSessions ? ` (${int(a.automatedSessions)} automated-likely)` : ""}${a.surfaces.length ? ` · from ${a.surfaces.slice(0, 2).map((s) => s.surface.replace(/_/g, " ")).join(", ")}` : ""}`) });
    const timed = stream.sessions.flatMap((s) => s.openToAction).filter((t) => t.ms >= 0);
    if (timed.length) {
      const sorted = timed.map((t) => t.ms).sort((a, b) => a - b);
      did.items.push({ heading: "From opening to acting", rows: [`Median ${formatActive(sorted[Math.floor(sorted.length / 2)])} between opening a project and opening one of its resources (${plural(timed.length, "action")}).`] });
    }
  }
  if (!observedSessions || stream.partial || !summary.projects.length) {
    const pages = (report.content?.pages || []).slice(0, 3);
    if (pages.length) did.items.push({ heading: "Most-viewed pages (GA4)", rows: pages.map((p) => `${p.title} — ${plural(p.views, "view")}${n(p.engagementRate) !== null ? `, ${pct(p.engagementRate)} engaged` : ""}`) });
    const actionRows = (events.highIntentActions || []).slice(0, 3);
    if (actionRows.length) did.items.push({ heading: "Actions (GA4 events · sessions containing them)", rows: actionRows.map((a) => `${a.label} — ${plural(a.count, "event")} · ${a.sessions == null ? "sessions unknown" : plural(a.sessions, "session")}`) });
    const views = n(current.screenPageViews);
    if (views !== null && sessions) did.items.push({ heading: "Exploration", rows: [`${int(views)} page views across ${plural(sessions, "session")} (${(views / sessions).toFixed(1)} per session). Individual paths need the session stream.`] });
  }

  // D. Journeys ---------------------------------------------------------------
  const journeys = hasStream
    ? { available: true, items: stream.notable.slice(0, 1).map((s) => ({ narrative: s.narrative, label: s.classification.label, category: s.classification.category, steps: journeySteps(s.timeline, 4) })) }
    : { available: false, items: [] };
  if (hasStream && stream.empty) journeys.note = "The session stream recorded no sessions for this day.";
  else if (hasStream && !journeys.items.length) journeys.note = "No session today combined human-like activity with several pages, sustained attention or an action.";
  if (!hasStream) journeys.note = stream.available ? "The session stream recorded no sessions for this day." : (stream.reason || "Session-level data is unavailable.");

  // E. Traffic quality --------------------------------------------------------
  const quality = { available: hasStream, sentences: stream.available && !summary.total ? ["No sessions to classify in the available window."] : [] };
  if (hasStream && summary.total) {
    const c = summary.counts;
    const total = summary.total || 1;
    const auto = c.likely_automated + c.known_automated;
    const majority = c.likely_human / total > 0.5 ? "mostly likely human" : auto / total > 0.5 ? "mostly likely automated" : "mixed";
    quality.sentences.push(`Traffic was ${majority}: ${int(c.likely_human)} likely human, ${int(auto)} automated, ${int(c.uncertain)} uncertain.`);
    const strong = summary.topEvidence.filter((e) => e.weight >= 2);
    const signals = (strong.length ? strong : summary.topEvidence).slice(0, 3).map((e) => `${EVIDENCE_TEXT[e.label] || e.label} (${plural(e.count, "session")})`);
    if (signals.length) quality.sentences.push(`Strongest automation signals: ${signals.join("; ")}.`);
    quality.sentences.push("Likely-human sessions showed scrolling, pointer or touch input, realistic page timing or sustained active time. That supports, but does not prove, a person was present.");
    if (sessions !== null && Math.abs(summary.total - sessions) >= Math.max(3, sessions * 0.2)) {
      quality.sentences.push(`GA4 (${int(sessions)}) and the session stream (${int(summary.total)}) count differently: blockers and Global Privacy Control affect them differently, and they define sessions differently.`);
    }
  } else if (!hasStream) {
    quality.sentences.push("Human, automated and uncertain counts need session-level evidence, which wasn't available for this day.");
    const tq = report.trafficQuality || {};
    if (n(tq.sessionsWithEngagementEvent) !== null && n(tq.engagedSessions) !== null && tq.engagedSessions - tq.sessionsWithEngagementEvent >= 10) {
      quality.sentences.push(`${int(tq.engagedSessions)} sessions met GA4's engagement rule, but only ${int(tq.sessionsWithEngagementEvent)} sent GA4's end-of-page engagement event — consistent with browsers left open or shut down abruptly, which is common for automation.`);
    }
  }

  return {
    meta, headline: subjectFor(report, summary), summary: sentences.slice(0, 4), geography: trafficLocations(report.audience), metrics, did, journeys, quality, findings, links,
    dataNotes: (report.warnings || []).length ? [`${plural(report.warnings.length, "data source")} partly unavailable.`] : [],
    analysisSource: report.analysisSource,
  };
}

/** Prioritize navigation and actions in the email excerpt. */
function journeySteps(timeline, limit) {
  const steps = timeline.filter((item) => item.kind !== "end");
  const keep = new Set(steps.filter((item) => item.kind === "navigation" || item.kind === "action").slice(0, limit));
  for (const item of steps) { if (keep.size >= limit) break; keep.add(item); }
  const end = timeline.find((item) => item.kind === "end");
  const lines = steps.filter((item) => keep.has(item)).map((item) => `${item.time} ${item.text}${item.repeat ? ` ×${item.repeat}` : ""}`);
  if (end && lines.length) lines.push(`${end.time} Last observed activity`);
  return lines;
}

function sessionsOf(report) {
  return n(report.current?.sessions ?? report.scorecards?.find((card) => card.key === "sessions")?.value ?? null);
}

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

function subjectFor(report, summary) {
  const sessions = sessionsOf(report);
  const date = new Date(`${report.meta.dateIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const parts = [`${report.meta.siteName} · ${date}`];
  if (sessions !== null) parts.push(plural(sessions, "session"));
  if (summary) {
    parts.push(`${int(summary.counts.likely_human)} likely human`);
    parts.push(plural(summary.actionEvents, "action"));
  } else if (n(report.events?.keyActionCount) !== null) parts.push(plural(report.events.keyActionCount, "action event"));
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function section(title, body, { first = false } = {}) {
  return `<tr><td style="padding:${first ? "4px" : "22px"} 24px 0">
  <h2 style="margin:0 0 8px;font:600 15px/20px ${FONT};color:${COLORS.ink}">${esc(title)}</h2>${body}</td></tr>`;
}

function paragraph(text, style = "") {
  return `<p style="margin:0 0 8px;font:400 14px/21px ${FONT};color:${COLORS.ink};${style}">${esc(text)}</p>`;
}

function list(rows) {
  return `<ul style="margin:0 0 6px;padding:0 0 0 18px">${rows.map((row) => `<li style="margin:0 0 4px;font:400 14px/20px ${FONT};color:${COLORS.ink}">${esc(row)}</li>`).join("")}</ul>`;
}

function locationBlock(geography) {
  const groups = geography.rows.map(({ heading, rows, empty }) =>
    `<div style="margin:0 0 4px;font:600 13px/18px ${FONT};color:${COLORS.muted}">${esc(heading)}</div>${rows.length ? list(rows) : paragraph(empty)}`);
  return groups.join("") + paragraph(geography.note, `font-size:12px;color:${COLORS.muted}`);
}

function metricCells(metrics) {
  const toneColor = { human: COLORS.human, auto: COLORS.auto, uncertain: COLORS.uncertain };
  const rows = [];
  for (let i = 0; i < metrics.length; i += 2) {
    const pair = metrics.slice(i, i + 2);
    rows.push(`<tr>${pair.map((m) => `<td valign="top" width="50%" style="padding:10px 12px;border:1px solid ${COLORS.line};border-radius:8px;background:${COLORS.card}">
      <div style="font:600 11px/14px ${FONT};letter-spacing:.04em;text-transform:uppercase;color:${COLORS.muted}">${esc(m.label)}</div>
      <div style="font:600 22px/28px ${FONT};color:${toneColor[m.tone] || COLORS.ink}">${esc(m.value)}</div>
      <div style="font:400 12px/16px ${FONT};color:${COLORS.muted}">${esc(m.note || "")}</div></td>`).join(`<td width="8" style="width:8px"></td>`)}${pair.length === 1 ? `<td width="8"></td><td width="50%"></td>` : ""}</tr><tr><td colspan="3" height="8" style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate">${rows.join("")}</table>`;
}

function findingBlock(finding) {
  const style = finding.severity === "warning"
    ? `background:${COLORS.warnBg};border-left:3px solid ${COLORS.warnLine}`
    : finding.severity === "opportunity" ? `background:${COLORS.goodBg};border-left:3px solid ${COLORS.human}` : `border-left:3px solid ${COLORS.line}`;
  return `<div style="margin:0 0 8px;padding:8px 12px;${style}">
    <div style="font:600 14px/20px ${FONT};color:${COLORS.ink}">${esc(finding.title)}</div>
    <div style="font:400 13px/19px ${FONT};color:${COLORS.muted}">${esc(finding.detail)}</div></div>`;
}

function journeyBlock(item) {
  const color = item.category === "likely_human" ? COLORS.human : COLORS.uncertain;
  return `<div style="margin:0 0 12px;padding:10px 12px;border:1px solid ${COLORS.line};border-radius:8px">
    <div style="font:600 11px/14px ${FONT};letter-spacing:.04em;text-transform:uppercase;color:${color}">${esc(item.label)}</div>
    ${paragraph(item.narrative, "margin:4px 0 6px")}
    <div style="font:400 12px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${COLORS.muted}">${item.steps.map(esc).join("<br>")}</div></div>`;
}

function button(href, label) {
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 14px;border-radius:6px;background:${COLORS.accent};color:#ffffff;text-decoration:none;font:600 13px/16px ${FONT}">${esc(label)}</a>`;
}

export function renderBriefHtml(brief) {
  const preheader = brief.summary[0] || "";
  const linksBlock = brief.links
    ? `${brief.links.report ? button(brief.links.report, "Open the full report") : ""}${button(brief.links.explorer, "Explore sessions")}
       <p style="margin:4px 0 0;font:400 12px/17px ${FONT};color:${COLORS.faint}">Opening these pages requires the portfolio administrator sign-in.</p>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(brief.headline)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${COLORS.page}"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:10px">
<tr><td style="padding:22px 24px 6px">
  <div style="font:600 12px/16px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${COLORS.accent}">Daily portfolio brief</div>
  <h1 style="margin:4px 0 0;font:600 22px/28px ${FONT};color:${COLORS.ink}">${esc(brief.meta.dateLabel)}</h1>
  <div style="font:400 13px/18px ${FONT};color:${COLORS.muted}">${esc(brief.meta.siteName)} · times in ${esc(brief.meta.timeZone)}</div>
</td></tr>
${section("Summary", brief.summary.map((s) => paragraph(s)).join(""), { first: false })}
${section("Where visits came from", locationBlock(brief.geography))}
${section("Key metrics", metricCells(brief.metrics))}
${section("What visitors did", `${brief.did.items.map((item) => `<div style="margin:0 0 6px;font:600 13px/18px ${FONT};color:${COLORS.muted}">${esc(item.heading)}</div>${list(item.rows)}`).join("") || paragraph("No activity to describe.")}${brief.did.source === "ga4" ? paragraph("From GA4 aggregates: these are counts, not individual journeys.", `font-size:12px;color:${COLORS.muted}`) : ""}`)}
${section("Notable journeys", brief.journeys.items.length ? `${brief.journeys.items.map(journeyBlock).join("")}${paragraph("Observed events in order; time is measured, interest is inferred.", `font-size:12px;color:${COLORS.muted}`)}` : paragraph(brief.journeys.note, `color:${COLORS.muted}`))}
${section("Traffic quality", brief.quality.sentences.map((s) => paragraph(s)).join(""))}
${brief.findings.length ? section("Problems and opportunities", brief.findings.map(findingBlock).join("")) : ""}
${brief.links ? section("Optional details", linksBlock) : ""}
<tr><td style="padding:16px 24px 22px">
  <p style="margin:0;font:400 12px/17px ${FONT};color:${COLORS.faint}">${esc([...brief.dataNotes, "Numbers come from GA4 aggregates and the site's anonymous session stream. Classifications are evidence-based estimates, not identities."].join(" "))}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderBriefText(brief) {
  const lines = [`DAILY PORTFOLIO BRIEF — ${brief.meta.dateLabel}`, `${brief.meta.siteName} · times in ${brief.meta.timeZone}`, "", "SUMMARY", ...brief.summary, "", "WHERE VISITS CAME FROM"];
  for (const { heading, rows, empty } of brief.geography.rows) {
    lines.push(heading, ...(rows.length ? rows.map((row) => `- ${row}`) : [empty]));
  }
  lines.push(brief.geography.note, "", "KEY METRICS");
  for (const m of brief.metrics) lines.push(`- ${m.label}: ${m.value}${m.note ? ` — ${m.note}` : ""}`);
  lines.push("", "WHAT VISITORS DID");
  for (const item of brief.did.items) { lines.push(`${item.heading}:`); for (const row of item.rows) lines.push(`  - ${row}`); }
  if (brief.did.source === "ga4") lines.push("(GA4 aggregates: counts, not individual journeys.)");
  lines.push("", "NOTABLE JOURNEYS");
  if (brief.journeys.items.length) {
    for (const item of brief.journeys.items) { lines.push(`[${item.label}] ${item.narrative}`); for (const step of item.steps) lines.push(`    ${step}`); lines.push(""); }
  } else lines.push(brief.journeys.note, "");
  lines.push("TRAFFIC QUALITY", ...brief.quality.sentences, "");
  if (brief.findings.length) {
    lines.push("PROBLEMS AND OPPORTUNITIES");
    for (const f of brief.findings) lines.push(`- ${f.severity === "warning" ? "[!] " : ""}${f.title}. ${f.detail}`);
    lines.push("");
  }
  if (brief.links) lines.push("OPTIONAL DETAILS", ...(brief.links.report ? [`Full report: ${brief.links.report}`] : []), `Session explorer: ${brief.links.explorer}`, "Portfolio administrator sign-in required.");
  lines.push("", ...brief.dataNotes, "Numbers come from GA4 aggregates and the site's anonymous session stream. Classifications are evidence-based estimates, not identities.");
  return lines.join("\n");
}
