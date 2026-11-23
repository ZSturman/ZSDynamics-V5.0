/**
 * Representative GA4 Data API responses shaped after the November 22, 2026
 * report (49 sessions, 54 views, 25 engaged, 17 project-resource clicks, all
 * direct). Used for deterministic before/after email samples and tests. The
 * values are aggregate counts only; nothing here identifies a visitor.
 */

const row = (dims, mets) => ({
  dimensionValues: dims.map((value) => ({ value: String(value) })),
  metricValues: mets.map((value) => ({ value: String(value) })),
});

const OVERVIEW = {
  "2026-11-22": [49, 49, 49, 25, 0.5102, 54, 16.4, 590],
  "2026-11-21": [39, 38, 39, 3, 0.0769, 40, 7.4, 446],
  "2026-11-15..2026-11-21": [53, 50, 55, 5, 0.0909, 56, 6.1, 550],
};

const EVENTS = [
  ["page_view", 54, 49], ["session_start", 49, 49], ["first_visit", 49, 49], ["portfolio_route_view", 58, 49],
  ["portfolio_section_engaged", 151, 27], ["portfolio_section_view", 134, 41], ["project_open", 35, 33],
  ["portfolio_scroll_depth", 30, 14], ["project_resource_click", 17, 9], ["user_engagement", 6, 4],
  ["article_open", 3, 3], ["work_log_open", 3, 2],
];

const PAGES = [
  ["/projects/content-manager", "Social Posts Content Manager", 12, 9, 0.667, 21],
  ["/projects/production-scheduling-web-app", "Production Scheduling", 11, 10, 0.615, 18],
  ["/projects/arduino-sensor-telemetry", "Arduino Sensor Telemetry", 9, 9, 0.7, 22],
  ["/", "Zachary Sturman", 7, 7, 0.429, 9],
  ["/projects/better-workspace", "Better Workspace", 3, 3, 0.333, 12],
  ["/articles/building-a-desktop-app-around-google-sheets", "Building a Desktop App Around Google Sheets", 2, 2, 0.333, 4],
  ["/projects", "Projects", 2, 2, 0.667, 30],
  ["/work-logs", "Work logs", 2, 2, 0.667, 15],
];

const COUNTRIES = [["United States", 49, 48, 25, 0.521], ["Singapore", 1, 1, 0, 0]];
const REGIONS = [["Iowa", 27, 27, 18, 0.667], ["Virginia", 9, 9, 3, 0.333], ["California", 6, 6, 1, 0.167], ["Illinois", 3, 3, 2, 0.667]];
const CITIES = [["Council Bluffs", "Iowa", 21, 21, 16, 0.762], ["Des Moines", "Iowa", 6, 6, 2, 0.333], ["San Jose", "California", 6, 6, 1, 0.167], ["(not set)", "Virginia", 6, 6, 3, 0.5]];

function eventFilterValues(filter) {
  const expressions = filter?.andGroup?.expressions || [filter];
  for (const expression of expressions) {
    const f = expression?.filter;
    if (f?.fieldName === "eventName") return f.inListFilter?.values || [f.stringFilter?.value];
  }
  return null;
}

function rangeKey(dateRanges = []) {
  const [range] = dateRanges;
  if (!range) return "";
  return range.startDate === range.endDate ? range.startDate : `${range.startDate}..${range.endDate}`;
}

export function createNov22Ga4Client({ registered = [] } = {}) {
  const registeredSet = new Set(registered.map((param) => `customEvent:${param}`));
  return {
    async getMetadata() {
      return [{
        dimensions: [
          "eventName", "pagePath", "pageTitle", "country", "region", "city", "deviceCategory", "sessionSource",
          "sessionMedium", "sessionDefaultChannelGroup", "sessionCampaignName", "landingPagePlusQueryString",
          ...registeredSet,
        ].map((apiName) => ({ apiName })),
        metrics: [],
      }];
    },
    async runReport(request) {
      const dims = (request.dimensions || []).map((d) => d.name).join(",");
      const mets = (request.metrics || []).map((m) => m.name);
      const events = eventFilterValues(request.dimensionFilter);
      const rangeRows = OVERVIEW[rangeKey(request.dateRanges)];
      let rows = [];
      if (!dims && rangeRows) rows = [row([], rangeRows)];
      else if (dims === "eventName" && !events) rows = EVENTS.map(([name, count, sessions]) => row([name], [count, sessions]));
      else if (dims === "eventName" && events) {
        rows = EVENTS.filter(([name]) => events.includes(name)).map(([name, count, sessions]) => row([name], mets[0] === "sessions" ? [sessions, count] : [count, sessions]));
      } else if (dims === "sessionSource,sessionMedium" && events) rows = [row(["(direct)", "(none)"], [17])];
      else if (dims === "sessionSource,sessionMedium") rows = [row(["(direct)", "(none)"], [49, 49, 25, 0.51])];
      else if (dims === "sessionDefaultChannelGroup") rows = [row(["Direct"], [49, 49, 25, 0.51])];
      else if (dims === "landingPagePlusQueryString,sessionSource,sessionMedium") {
        rows = PAGES.slice(0, 6).map(([page, , views]) => row([page, "(direct)", "(none)"], [Math.max(1, views - 2), Math.round(views / 2)]));
      } else if (dims === "pagePath,pageTitle") rows = PAGES.map(([p, t, ...m]) => row([p, t], m));
      else if (dims === "country" && events) rows = [row(["United States"], [17])];
      else if (dims === "country") rows = COUNTRIES.map(([c, ...m]) => row([c], m));
      else if (dims === "region" && events) rows = [row(["California"], [11]), row(["Iowa"], [3]), row(["Virginia"], [2]), row(["Washington"], [1])];
      else if (dims === "region") rows = REGIONS.map(([r, ...m]) => row([r], m));
      else if (dims === "city,region" && events) rows = [row(["San Jose", "California"], [11]), row(["Council Bluffs", "Iowa"], [2])];
      else if (dims === "city,region") rows = CITIES.map(([c, r, ...m]) => row([c, r], m));
      // Illustrative only: the live click-by-page split for Nov 22 has not been queried yet.
      else if (dims === "customEvent:project_slug,pagePath") rows = [
        row(["better-workspace", "/projects"], [5, 2]), row(["better-workspace", "/projects/better-workspace"], [3, 2]),
        row(["better-workspace", "/better-workspace"], [2, 1]), row(["production-scheduling-web-app", "/projects/production-scheduling-web-app"], [3, 3]),
        row(["arduino-sensor-telemetry", "/projects/arduino-sensor-telemetry"], [3, 2]), row(["the-wolf-project", "/projects/the-wolf-project"], [1, 1]),
      ];
      else if (dims === "deviceCategory,customEvent:viewport_category") rows = [row(["desktop", "desktop"], [28, 31]), row(["desktop", "tablet"], [13, 13]), row(["mobile", "mobile"], [8, 9])];
      else if (dims === "deviceCategory") rows = [row(["desktop"], [44, 44, 22, 0.5]), row(["mobile"], [5, 5, 3, 0.6])];
      return [{ rows }];
    },
  };
}

/** Parameters registered in the live property on November 23, 2026 (from the dry-run warning). */
export const NOV22_REGISTERED_PARAMETERS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_referrer", "page_group", "page_slug",
  "project_slug", "article_slug", "resource_type", "social_network", "destination_domain", "surface", "status",
  "media_kind", "open_surface", "previous_page_group", "previous_page_slug", "route_step", "viewport_category",
  "route_surface", "modal_context", "section_key", "section_label", "item_id", "item_type", "item_label",
  "collection_key", "media_role", "scroll_percent", "engagement_bucket", "visible_time_sec", "progress_percent",
  "interaction_type",
];
