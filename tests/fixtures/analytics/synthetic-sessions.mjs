/**
 * Deterministic synthetic session-stream scenarios. Each builder returns the
 * rows the Worker would store (session row + events). Timestamps are fixed so
 * timelines and classifications are reproducible.
 */

// 2026-11-22 09:14:02 America/Los_Angeles
export const BASE_TS = Date.UTC(2026, 10, 22, 17, 14, 2);

export const TITLES = {
  "/": "Home",
  "/projects": "Projects",
  "/projects/better-workspace": "Better Workspace",
  "/projects/content-manager": "Social Posts Content Manager",
  "/projects/production-scheduling-web-app": "Production Scheduling",
  "/projects/arduino-sensor-telemetry": "Arduino Sensor Telemetry",
  "/articles": "Articles",
};
export const titleForPath = (path) => TITLES[path] || "";

function builder(sessionId, meta = {}) {
  let seq = 0;
  let pv = 0;
  const events = [];
  const session = {
    session_id: sessionId, device_category: "desktop", browser_family: "Chrome", os_family: "macOS",
    network_class: "consumer_or_unknown", network_org: null, country: "US", ua_automation: null, qa_run: null,
    default_automation_viewport: 0, no_window_chrome: 0, ...meta,
  };
  const api = {
    session, events,
    event(name, props, ts, tab = "tab001") {
      seq += 1;
      events.push({ session_id: sessionId, event_id: `${tab}-${seq}`, tab_id: tab, seq, ts, name, props: JSON.stringify(props) });
      return api;
    },
    page(path, ts, { group = "project", slug, nav = "route", ref_host, utm_source, utm_medium, utm_campaign, tab } = {}) {
      pv += 1;
      const id = `pv${sessionId.slice(0, 4)}${pv}`;
      api.lastPv = id;
      return api.event("page_view", { pv: id, path, group, slug: slug ?? path.split("/").pop(), nav, ref_host, utm_source, utm_medium, utm_campaign }, ts, tab);
    },
    attention(ts, values, pvId = api.lastPv, tab) {
      return api.event("page_attention", { pv: pvId, keys: 0, touches: 0, hidden_count: 0, ...values }, ts, tab);
    },
    done() {
      session.started_at = Math.min(...events.map((e) => e.ts));
      session.last_seen_at = Math.max(...events.map((e) => e.ts));
      return { session, events };
    },
  };
  return api;
}

const s = (seconds) => BASE_TS + seconds * 1000;

/** 1. A single-page short visit from LinkedIn. */
export function shortSinglePage() {
  return builder("short000000000001")
    .page("/projects/content-manager", s(0), { nav: "landing", ref_host: "linkedin.com" })
    .attention(s(8), { fg_ms: 8_000, active_ms: 7_000, pointer: 1, scrolls: 1, first_input_ms: 3_000, final: 1 })
    .done();
}

/** 2. Explores several projects and clicks through to GitHub. */
export function explorerClicksGithub() {
  const b = builder("explore0000000002")
    .page("/", s(0), { group: "home", slug: "home", nav: "landing", ref_host: "github.com" });
  const home = b.lastPv;
  b.attention(s(6), { fg_ms: 6_000, active_ms: 6_000, pointer: 3, scrolls: 2, first_input_ms: 1_500, final: 1 }, home)
    .page("/projects", s(6), { slug: "projects" });
  const projects = b.lastPv;
  b.event("portfolio_filter_change", { filter_type: "domain", filter_value: "Apps", surface: "projects" }, s(11))
    .attention(s(15), { fg_ms: 9_000, active_ms: 9_000, pointer: 5, scrolls: 3, first_input_ms: 1_000, final: 1 }, projects)
    .page("/projects/better-workspace", s(15), { slug: "better-workspace" })
    .event("project_open", { project_slug: "better-workspace", open_surface: "project_page" }, s(15))
    .event("portfolio_scroll_depth", { scroll_percent: 75 }, s(23))
    .event("portfolio_section_engaged", { section_key: "project_description_story", engagement_bucket: "30s", visible_time_sec: 30, project_slug: "better-workspace" }, s(53))
    .event("project_item_open", { item_type: "image", collection_key: "screenshots", project_slug: "better-workspace" }, s(60))
    .event("project_resource_click", { project_slug: "better-workspace", destination_category: "repository", action_type: "source", surface: "project_page", source_section: "project_resources" }, s(68))
    .attention(s(69), { fg_ms: 54_000, active_ms: 52_000, pointer: 14, scrolls: 10, first_input_ms: 2_000, final: 1 });
  return b.done();
}

/** 3. Opens a page, leaves it in a background tab for ten minutes, comes back. */
export function backgroundTab() {
  return builder("backgr0000000003")
    .page("/projects/arduino-sensor-telemetry", s(0), { nav: "landing", ref_host: "google.com" })
    .attention(s(20), { fg_ms: 20_000, active_ms: 18_000, pointer: 2, scrolls: 3, first_input_ms: 4_000, hidden_count: 1 })
    // hidden from s(20) to s(620): no foreground time accrues
    .attention(s(640), { fg_ms: 40_000, active_ms: 33_000, pointer: 4, scrolls: 6, first_input_ms: 4_000, hidden_count: 1, final: 1 })
    .done();
}

/** 4. Repeated resource clicks within one session. */
export function repeatedClicks() {
  const b = builder("repeat0000000004")
    .page("/projects/better-workspace", s(0), { nav: "landing" })
    .event("project_open", { project_slug: "better-workspace", open_surface: "project_page" }, s(0));
  for (let i = 0; i < 4; i += 1) {
    b.event("project_resource_click", { project_slug: "better-workspace", destination_category: "repository", action_type: "source", surface: "project_page" }, s(20 + i * 6));
  }
  return b.attention(s(45), { fg_ms: 45_000, active_ms: 40_000, pointer: 9, scrolls: 4, first_input_ms: 3_000, final: 1 }).done();
}

/** 5. Automated rapid-fire navigation from a hosting network. */
export function rapidFireAutomation(id = "rapid00000000005") {
  const b = builder(id, { network_class: "datacenter", network_org: "Google LLC", default_automation_viewport: 1 });
  const paths = ["/", "/projects", "/projects/better-workspace", "/projects/content-manager", "/projects/production-scheduling-web-app", "/projects/arduino-sensor-telemetry", "/articles", "/projects", "/", "/projects/better-workspace"];
  paths.forEach((path, i) => {
    b.page(path, s(i * 1.5), { nav: i === 0 ? "landing" : "route", group: path === "/" ? "home" : "project" });
    b.attention(s(i * 1.5 + 1.4), { fg_ms: 1_400, active_ms: 1_400, pointer: 0, scrolls: 0, final: 1 });
  });
  return b.done();
}

/** 6a. A crawler that declares itself; 6b. a controlled QA run. */
export function declaredCrawler() {
  return builder("crawl000000000006", { ua_automation: "headlesschrome" })
    .page("/projects/better-workspace", s(0), { nav: "landing" })
    .attention(s(3), { fg_ms: 3_000, active_ms: 3_000, pointer: 0, scrolls: 0, final: 1 })
    .done();
}
export function internalQa() {
  return builder("qa000000000000006", { qa_run: "release-verify-42" })
    .page("/", s(0), { group: "home", slug: "home", nav: "landing", utm_source: "qa", utm_medium: "test", utm_campaign: "release-verify" })
    .attention(s(12), { fg_ms: 12_000, active_ms: 12_000, pointer: 6, scrolls: 2, final: 1 })
    .done();
}

/** 7. No referral information at all. */
export function missingReferral() {
  return builder("noref00000000007")
    .page("/projects/production-scheduling-web-app", s(0), { nav: "landing" })
    .attention(s(25), { fg_ms: 25_000, active_ms: 22_000, pointer: 4, scrolls: 5, first_input_ms: 2_500, final: 1 })
    .done();
}

/** 8. Duplicate and delayed (out-of-order) events. */
export function duplicateAndDelayed() {
  const { session, events } = builder("dupe000000000008")
    .page("/projects/content-manager", s(0), { nav: "landing", ref_host: "bsky.app" })
    .attention(s(30), { fg_ms: 30_000, active_ms: 28_000, pointer: 6, scrolls: 4, first_input_ms: 1_000 })
    .attention(s(60), { fg_ms: 60_000, active_ms: 50_000, pointer: 11, scrolls: 7, first_input_ms: 1_000, final: 1 })
    .event("project_resource_click", { project_slug: "content-manager", destination_category: "demo", action_type: "demo", surface: "project_page" }, s(45))
    .done();
  // Retried beacon duplicates the click; the earlier snapshot arrives last.
  const duplicate = { ...events[3] };
  const delayed = events.splice(1, 1)[0];
  return { session, events: [...events, duplicate, delayed] };
}

/** 9. A session that starts before midnight and continues after it (reporting zone). */
export function spansMidnight() {
  const start = Date.UTC(2026, 10, 23, 7, 58, 0); // 23:58 PST on Nov 22
  return builder("midnt00000000009")
    .page("/", start, { group: "home", slug: "home", nav: "landing" })
    .attention(start + 60_000, { fg_ms: 60_000, active_ms: 40_000, pointer: 5, scrolls: 6, first_input_ms: 2_000, final: 1 })
    .page("/projects/better-workspace", start + 60_000)
    .attention(start + 420_000, { fg_ms: 360_000, active_ms: 90_000, pointer: 12, scrolls: 20, first_input_ms: 3_000, final: 1 })
    .done();
}

/** Repeated identical deep-link arrivals with no input (three sessions). */
export function repeatedDeepLinks() {
  return ["deep0000000000a1", "deep0000000000a2", "deep0000000000a3"].map((id, i) => builder(id, { network_class: "datacenter", network_org: "Google LLC" })
    .page("/projects/content-manager", s(3600 + i * 600), { nav: "landing" })
    .attention(s(3600 + i * 600 + 31), { fg_ms: 31_000, active_ms: 10_000, pointer: 0, scrolls: 0, final: 1 })
    .event("portfolio_section_engaged", { section_key: "project_hero", engagement_bucket: "30s", visible_time_sec: 30, project_slug: "content-manager" }, s(3600 + i * 600 + 30))
    .done());
}

/** Clicked a resource without any pointer/keyboard input (synthetic click). */
export function syntheticClick() {
  return builder("synth0000000000b", { network_class: "datacenter", network_org: "Amazon.com, Inc." })
    .page("/projects/better-workspace", s(7200), { nav: "landing" })
    .event("project_resource_click", { project_slug: "better-workspace", destination_category: "repository", action_type: "source", surface: "project_grid" }, s(7202))
    .attention(s(7204), { fg_ms: 4_000, active_ms: 4_000, pointer: 0, scrolls: 0, final: 1 })
    .done();
}

/** A representative day used for the sample email. */
export function representativeDay() {
  const parts = [
    explorerClicksGithub(), shortSinglePage(), backgroundTab(), repeatedClicks(), missingReferral(), duplicateAndDelayed(),
    rapidFireAutomation(), rapidFireAutomation("rapid00000000015"), declaredCrawler(), internalQa(), syntheticClick(), ...repeatedDeepLinks(),
  ];
  return { sessions: parts.map((p) => p.session), events: parts.flatMap((p) => p.events) };
}
