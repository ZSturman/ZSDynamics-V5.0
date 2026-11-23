/**
 * Canonical portfolio analytics taxonomy.
 *
 * One dependency-free definition shared by the browser (which events are
 * mirrored to the first-party session stream and which parameters they may
 * carry), the Worker (ingestion validation) and the daily report (labels,
 * categories, meaningful-action rules). docs/analytics/event-taxonomy.md is
 * the human-readable form; tests keep the two in sync.
 *
 * Categories
 *   navigation  where a session went (page loads, client route changes, filters)
 *   attention   foreground exposure and measured time; never proof of reading
 *   engagement  deliberate interaction with content on the site
 *   action      leaving to a project resource, store, repository or profile
 *   conversion  contact, résumé and subscription outcomes
 *   diagnostic  instrumentation health and failures; never a visitor action
 *
 * `meaningful` marks events that count as "meaningful actions" in reports:
 * deliberate, high-intent behaviour. Visibility and scroll are never meaningful.
 * `session` marks events mirrored to the first-party session stream.
 */

export const TAXONOMY_VERSION = 2;

export const EVENT_TAXONOMY = {
  // --- first-party session stream only ---------------------------------
  page_view: {
    category: "navigation", label: "Page view", session: true, ga4: false, meaningful: false,
    purpose: "A full page load or client-side route change in the session timeline. GA4 records its own page_view separately.",
    dedupe: "One per page instance (pv id); refreshes and back/forward are new instances labelled by nav type.",
  },
  page_attention: {
    category: "attention", label: "Page attention", session: true, ga4: false, meaningful: false,
    purpose: "Cumulative foreground and active milliseconds plus input-activity counts for one page instance.",
    dedupe: "Cumulative; the latest value per page instance wins, so duplicates and retries cannot inflate time.",
  },
  // --- GA4 + session stream ---------------------------------------------
  project_open: {
    category: "engagement", label: "Project opened", session: true, ga4: true, meaningful: false,
    purpose: "A project detail page or home project modal mounted successfully (not a click on a card).",
    dedupe: "Once per project per route view.",
  },
  article_open: {
    category: "engagement", label: "Article opened", session: true, ga4: true, meaningful: false,
    purpose: "An article page mounted successfully.", dedupe: "Once per article per route view.",
  },
  work_log_open: {
    category: "engagement", label: "Work log opened", session: true, ga4: true, meaningful: false,
    purpose: "A work-log session was expanded by its existing ID.", dedupe: "Per interaction.",
  },
  portfolio_filter_change: {
    category: "navigation", label: "Search / filter", session: true, ga4: true, meaningful: false,
    purpose: "Archive, article or work-log filters. Search text is reduced to keywords for GA4 and omitted from the session stream.",
    dedupe: "Settled changes only.",
  },
  portfolio_scroll_depth: {
    category: "attention", label: "Scroll milestone", session: true, ga4: true, meaningful: false,
    purpose: "First time a route reaches 25/50/75/90/100% depth.", dedupe: "Once per milestone per route view.",
  },
  portfolio_section_view: {
    category: "attention", label: "Section exposed", session: false, ga4: true, meaningful: false,
    purpose: "A tagged section or link first became meaningfully visible. Exposure, not interest.",
    dedupe: "Once per target per route view.",
  },
  portfolio_section_engaged: {
    category: "attention", label: "Section foreground time", session: true, ga4: true, meaningful: false,
    purpose: "A tagged section stayed meaningfully visible in a foreground tab for 5/15/30/60 s. Eligible exposure, not proof of reading.",
    dedupe: "Once per target per bucket per route view.",
  },
  project_item_open: {
    category: "engagement", label: "Project item opened", session: true, ga4: true, meaningful: false,
    purpose: "A collection item or fullscreen artifact was opened or navigated.", dedupe: "Per interaction.",
  },
  project_media_play: {
    category: "engagement", label: "Media interaction", session: true, ga4: true, meaningful: false,
    purpose: "Image, video or 3D model interaction started.", dedupe: "Per interaction.",
  },
  project_media_progress: {
    category: "engagement", label: "Media progress", session: true, ga4: true, meaningful: false,
    purpose: "Video/audio progress milestones and fullscreen media, model, game or text interactions.",
    dedupe: "Once per milestone per media element.",
  },
  product_view: {
    category: "navigation", label: "Product page view", session: false, ga4: true, meaningful: false,
    purpose: "Product landing or demo route visit (GA4 reporting by product_slug). The session stream uses page_view.",
    dedupe: "Once per route view.",
  },
  product_demo_start: {
    category: "engagement", label: "Demo started", session: true, ga4: true, meaningful: false,
    purpose: "First interaction with an in-browser product demo attempt.", dedupe: "Once per attempt.",
  },
  product_demo_complete: {
    category: "conversion", label: "Demo completed", session: true, ga4: true, meaningful: true,
    purpose: "The demo's documented completion step was reached. No entered text is sent.", dedupe: "Once per attempt.",
  },
  project_resource_click: {
    category: "action", label: "Project resource opened", session: true, ga4: true, meaningful: true,
    purpose: "The canonical project/product action: repository, demo, website, App Store, download or internal project link, with action_type, destination_category and the surface it was clicked from.",
    dedupe: "Per click. Repeated clicks are real events; reports also count distinct sessions.",
  },
  article_project_click: {
    category: "engagement", label: "Article → project", session: true, ga4: true, meaningful: false,
    purpose: "An explicit related-project link inside an article.", dedupe: "Per click.",
  },
  article_source_click: {
    category: "action", label: "Article source opened", session: true, ga4: true, meaningful: true,
    purpose: "An article's source or reference link.", dedupe: "Per click.",
  },
  outbound_click: {
    category: "action", label: "Outbound link", session: true, ga4: true, meaningful: true,
    purpose: "Any other external link (delegated listener). Not emitted when a specific tracker handled the click.",
    dedupe: "Per click; skipped for links with data-analytics-skip.",
  },
  social_click: {
    category: "action", label: "Profile link", session: true, ga4: true, meaningful: true,
    purpose: "LinkedIn, GitHub profile or other social link.", dedupe: "Per click.",
  },
  github_click: {
    category: "action", label: "GitHub link (legacy)", session: true, ga4: true, meaningful: true,
    purpose: "Historical generic GitHub event; new repository clicks use project_resource_click with destination_category=repository.",
    dedupe: "Per click.",
  },
  project_demo_click: {
    category: "action", label: "Demo link (legacy)", session: true, ga4: true, meaningful: true,
    purpose: "Historical demo event; new demo clicks use project_resource_click with action_type=demo.", dedupe: "Per click.",
  },
  resume_view: {
    category: "conversion", label: "Résumé viewed", session: true, ga4: true, meaningful: true,
    purpose: "Résumé PDF opened for viewing.", dedupe: "Per click.",
  },
  resume_download: {
    category: "conversion", label: "Résumé download started", session: true, ga4: true, meaningful: true,
    purpose: "Résumé download link activated; completion is not observable.", dedupe: "Per click.",
  },
  contact_click: {
    category: "conversion", label: "Contact intent", session: true, ga4: true, meaningful: true,
    purpose: "A link to /contact or mailto: was activated. Intent only.", dedupe: "Per click.",
  },
  contact_submit: {
    category: "conversion", label: "Contact message sent", session: true, ga4: true, meaningful: true,
    purpose: "Only after the contact API accepted the message. No form content is sent.", dedupe: "Once per accepted request.",
  },
  newsletter_interest: {
    category: "conversion", label: "Subscription requested", session: true, ga4: true, meaningful: true,
    purpose: "Writing-update signup accepted (confirmation follows by email).", dedupe: "Once per accepted request.",
  },
  // --- diagnostics --------------------------------------------------------
  portfolio_route_view: {
    category: "diagnostic", label: "Route view (GA4)", session: false, ga4: true, meaningful: false,
    purpose: "GA4-side route bookkeeping (route_step, previous page). Aggregate transitions only; the session stream holds real paths.",
    dedupe: "Once per pathname/modal key.",
  },
  contact_submit_failed: {
    category: "diagnostic", label: "Contact failed", session: true, ga4: true, meaningful: false,
    purpose: "Rejected contact attempt (status, error_code).", dedupe: "Per attempt.",
  },
  newsletter_interest_failed: {
    category: "diagnostic", label: "Subscription failed", session: true, ga4: true, meaningful: false,
    purpose: "Rejected subscription attempt.", dedupe: "Per attempt.",
  },
  automation_signal: {
    category: "diagnostic", label: "Automation marker (historical)", session: false, ga4: true, meaningful: false,
    purpose: "Historical only. Known automation is now suppressed before analytics initialises.", dedupe: "n/a",
  },
};

/**
 * Parameters allowed in the first-party session stream. Everything else is
 * dropped by both the browser and the Worker. No free text, titles, URLs with
 * queries, form contents or identifiers of people.
 */
export const SESSION_EVENT_PARAMS = {
  project_slug: 80, article_slug: 120, product_slug: 80, action_type: 20, resource_type: 30,
  destination_category: 24, destination_domain: 80, surface: 60, source_section: 60,
  section_key: 80, engagement_bucket: 8, visible_time_sec: 0, scroll_percent: 0, item_type: 40,
  collection_key: 60, media_kind: 20, interaction_type: 40, progress_percent: 0, filter_type: 20,
  filter_value: 60, social_network: 30, status: 20, open_surface: 30, log_id: 60,
  // page_view / page_attention
  path: 160, group: 24, slug: 120, nav: 16, ref_host: 80, utm_source: 60, utm_medium: 40, utm_campaign: 80,
  utm_content: 60, utm_term: 60, pv: 24, fg_ms: 0, active_ms: 0, pointer: 0, keys: 0, scrolls: 0, touches: 0,
  max_scroll: 0, hidden_count: 0, viewport: 12, final: 0,
};

/** Destination categories used by reports and GA4 (`destination_category`). */
export const DESTINATION_CATEGORIES = [
  "repository", "app_store", "download", "demo", "website", "email", "social", "resume", "internal_project", "internal", "other",
];

const SOCIAL_HOSTS = /(^|\.)(linkedin\.com|x\.com|twitter\.com|bsky\.app|threads\.net|instagram\.com|youtube\.com|mastodon\.social)$/i;

/** Classifies a destination without storing the URL itself. */
export function destinationCategory(url, { label = "", type = "", origin = "https://zacharysturman.com" } = {}) {
  const raw = String(url || "");
  if (raw.startsWith("mailto:")) return "email";
  let parsed;
  try { parsed = new URL(raw, origin); } catch { return "other"; }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const pathName = parsed.pathname.toLowerCase();
  const sameSite = parsed.origin === new URL(origin).origin;
  if (/resume|cv/.test(pathName) && /\.pdf$/.test(pathName)) return "resume";
  if (/^apps\.apple\.com$|^play\.google\.com$/.test(host)) return "app_store";
  if (/\.(zip|dmg|pkg|exe|apk|msi)$/.test(pathName) || /\/releases\/download\//.test(pathName) || /download/i.test(type)) return "download";
  if (/\/demo(\/|$)/.test(pathName) || /\bdemo\b/i.test(label)) return "demo";
  if (/^github\.com$|^gitlab\.com$|^bitbucket\.org$/.test(host)) {
    const segments = pathName.split("/").filter(Boolean);
    return segments.length >= 2 ? "repository" : "social";
  }
  if (SOCIAL_HOSTS.test(host)) return "social";
  if (sameSite) return pathName.startsWith("/projects/") ? "internal_project" : "internal";
  return "website";
}

/** Events that count as meaningful actions in reports. */
export const MEANINGFUL_EVENTS = new Set(Object.entries(EVENT_TAXONOMY).filter(([, d]) => d.meaningful).map(([name]) => name));

/** Events mirrored to the first-party session stream. */
export const SESSION_EVENTS = new Set(Object.entries(EVENT_TAXONOMY).filter(([, d]) => d.session).map(([name]) => name));

export function eventDefinition(name) {
  return EVENT_TAXONOMY[name] || { category: "other", label: String(name || "event").replace(/_/g, " "), session: false, ga4: true, meaningful: false, purpose: "Unclassified event." };
}

/**
 * Reduces arbitrary params to the session-stream allow-list. Strings are
 * trimmed and truncated, numbers clamped, URLs and free text never pass.
 * @param {string} name
 * @param {Record<string, unknown>} [params]
 * @returns {Record<string, string | number>}
 */
export function sanitizeSessionParams(name, params = {}) {
  /** @type {Record<string, string | number>} */
  const out = {};
  for (const [key, limit] of Object.entries(SESSION_EVENT_PARAMS)) {
    const value = params[key];
    if (value === undefined || value === null || value === "") continue;
    if (limit === 0) {
      const number = Number(value);
      if (Number.isFinite(number)) out[key] = Math.max(0, Math.min(Math.round(number), 86_400_000));
      continue;
    }
    const text = String(value).replace(/\s+/g, " ").trim();
    if (!text || /^https?:\/\//i.test(text) && key !== "path") continue;
    if (key === "path") {
      const path = text.split(/[?#]/)[0];
      if (/^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*\/?)?$/i.test(path) && path.length <= limit) out[key] = path;
      continue;
    }
    if (key === "ref_host" || key === "destination_domain") {
      if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(text) && text.length <= limit) out[key] = text.toLowerCase();
      continue;
    }
    if (key.startsWith("utm_") && !/^[a-z0-9][a-z0-9 _-]*$/i.test(text)) continue;
    out[key] = text.slice(0, limit);
  }
  // Search terms are user free text; the session stream keeps only that a search happened.
  if (name === "portfolio_filter_change" && (params.filter_type === "search" || params.filter_type === "q")) delete out.filter_value;
  return out;
}
