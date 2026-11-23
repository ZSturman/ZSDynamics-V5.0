#!/usr/bin/env node
// Read-only GA4 check for release verification. Prints aggregate counts only
// (no user identifiers, no IPs) and sends nothing. Run through the
// "Analytics verification" workflow, which holds the GA4 credentials.
import { pathToFileURL } from "node:url";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const QA_SOURCE = "qa";
// Keep in sync with docs/analytics/event-taxonomy.md ("Register (recommended)").
const RECOMMENDED_DIMENSIONS = ["product_slug", "action_type", "destination_category", "source_section", "filter_type", "filter_value", "project_slug", "viewport_category", "surface", "section_key"];

function rowsToText(rows = []) {
  return rows.map((row) =>
    `  ${row.dimensionValues.map((d) => d.value || "(not set)").join(" | ")} => ${row.metricValues.map((m) => m.value).join(", ")}`,
  );
}

export async function verifyAnalytics({ client, propertyId, days = 7, date, qaRun, log = console.log }) {
  const property = `properties/${propertyId}`;
  const dateRanges = date ? [{ startDate: date, endDate: date }] : [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const sections = [];

  async function report(label, input, run = (req) => client.runReport(req)) {
    try {
      const [response] = await run({ property, limit: 25, ...input });
      sections.push(`\n## ${label}`, ...(rowsToText(response.rows).length ? rowsToText(response.rows) : ["  (no rows)"]));
      return response.rows || [];
    } catch (error) {
      sections.push(`\n## ${label}: unavailable (${String(error.message).slice(0, 160)})`);
      return [];
    }
  }

  const dims = (...names) => names.map((name) => ({ name }));
  const mets = (...names) => names.map((name) => ({ name }));
  const desc = (metricName) => [{ metric: { metricName }, desc: true }];

  await report("Realtime: events, last 30 minutes", { dimensions: dims("eventName"), metrics: mets("eventCount"), orderBys: desc("eventCount") }, (req) => client.runRealtimeReport({ ...req, dateRanges: undefined }));
  await report("Realtime: device category, last 30 minutes", { dimensions: dims("deviceCategory"), metrics: mets("activeUsers") }, (req) => client.runRealtimeReport({ ...req, dateRanges: undefined }));
  await report(date ? `Overview for ${date} (GA4 property time zone)` : `Overview: ${days} days ago through today`, { dateRanges, metrics: mets("sessions", "totalUsers", "newUsers", "screenPageViews", "engagedSessions", "averageSessionDuration") });
  await report("Events", { dateRanges, dimensions: dims("eventName"), metrics: mets("eventCount"), orderBys: desc("eventCount") });
  await report("Sessions by source / medium / campaign", { dateRanges, dimensions: dims("sessionSource", "sessionMedium", "sessionCampaignName"), metrics: mets("sessions", "engagedSessions"), orderBys: desc("sessions") });
  await report("Page views on URLs with a query string (duplicate-page-view check)", {
    dateRanges,
    dimensions: dims("pagePath"),
    metrics: mets("screenPageViews"),
    orderBys: desc("screenPageViews"),
    dimensionFilter: { filter: { fieldName: "pagePathPlusQueryString", stringFilter: { matchType: "CONTAINS", value: "?" } } },
  });
  await report(`QA sessions (sessionSource=${QA_SOURCE}) by event`, {
    dateRanges,
    dimensions: dims("eventName", "sessionCampaignName"),
    metrics: mets("eventCount"),
    orderBys: desc("eventCount"),
    dimensionFilter: { filter: { fieldName: "sessionSource", stringFilter: { matchType: "EXACT", value: QA_SOURCE } } },
  });
  // Query only counts. A raw page referrer can contain sensitive paths or parameters.
  const exact = (fieldName, value) => ({ filter: { fieldName, stringFilter: { matchType: "EXACT", value } } });
  await report("Page-view events with an external document referrer (count only)", {
    dateRanges, metrics: mets("eventCount"),
    dimensionFilter: { andGroup: { expressions: [
      exact("eventName", "page_view"),
      { filter: { fieldName: "pageReferrer", stringFilter: { matchType: "PARTIAL_REGEXP", value: "^https?://" } } },
      { notExpression: { filter: { fieldName: "pageReferrer", stringFilter: {
        matchType: "PARTIAL_REGEXP", value: "^https?://(www[.])?(zacharysturman[.]com|zachary-sturman[.]com)(/|$)",
      } } } },
    ] } },
  });
  // Custom-dimension registration check (read-only metadata).
  try {
    const [metadata] = await client.getMetadata({ name: `${property}/metadata` });
    const registered = (metadata.dimensions || []).map((d) => d.apiName).filter((name) => name?.startsWith("customEvent:")).map((name) => name.slice(12)).sort();
    const missing = RECOMMENDED_DIMENSIONS.filter((param) => !registered.includes(param));
    sections.push("\n## Registered event-scoped custom dimensions", `  ${registered.length} registered (GA4 standard limit: 50): ${registered.join(", ") || "(none)"}`, `  Recommended but missing: ${missing.join(", ") || "(none)"}`);
  } catch (error) {
    sections.push(`\n## Registered event-scoped custom dimensions: unavailable (${String(error.message).slice(0, 160)})`);
  }
  // Anomaly diagnostics: where resource clicks happened and when.
  await report("Resource clicks by project and page", { dateRanges, dimensions: dims("customEvent:project_slug", "pagePath"), metrics: mets("eventCount", "sessions"), orderBys: desc("eventCount"), dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "project_resource_click" } } } });
  await report("Resource clicks by hour, city and project", { dateRanges, dimensions: dims("dateHour", "city", "customEvent:project_slug"), metrics: mets("eventCount", "sessions"), orderBys: desc("eventCount"), dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "project_resource_click" } } } });
  await report("Device category vs measured window width (route views)", { dateRanges, dimensions: dims("deviceCategory", "customEvent:viewport_category"), metrics: mets("sessions", "eventCount"), orderBys: desc("sessions"), dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "portfolio_route_view" } } } });

  if (qaRun) {
    await report(`QA run ${qaRun} by event (needs qa_run custom dimension)`, {
      dateRanges,
      dimensions: dims("eventName", "customEvent:qa_run"),
      metrics: mets("eventCount"),
      dimensionFilter: { filter: { fieldName: "customEvent:qa_run", stringFilter: { matchType: "EXACT", value: qaRun } } },
    });
  }

  for (const line of sections) log(line);
  return sections;
}

async function main(env = process.env) {
  if (!env.GA_PROPERTY_ID || !env.GA_SERVICE_ACCOUNT_JSON) throw new Error("GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON are required.");
  const credentials = JSON.parse(env.GA_SERVICE_ACCOUNT_JSON);
  const client = new BetaAnalyticsDataClient({ credentials });
  const days = Math.min(90, Math.max(1, Number.parseInt(env.ANALYTICS_VERIFY_DAYS || "7", 10) || 7));
  const date = env.ANALYTICS_VERIFY_DATE || undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("ANALYTICS_VERIFY_DATE must be YYYY-MM-DD");
  if (env.ANALYTICS_REGISTER_DIMENSIONS === "true") {
    if (env.GA_PROPERTY_ID !== "453629949") throw new Error("Refusing to modify an unexpected GA4 property");
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/analytics.edit"] });
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}/customDimensions`;
    const approved = [
      ["product_slug", "Product slug", "Stable portfolio product slug attached to product and resource events."],
      ["action_type", "Action type", "Type of tracked action, such as store referral, download, demo or repository click."],
      ["destination_category", "Destination category", "Category of the clicked destination, such as repository, store, download or website."],
      ["source_section", "Source section", "Tagged page section containing the clicked element."],
      ["filter_type", "Filter type", "Type of portfolio filter changed, such as category, tag, year or search."],
      ["filter_value", "Filter value", "Instrumented value of the selected portfolio filter."],
    ];
    try {
      const configured = new Set();
      let pageToken;
      do {
        const { data } = await auth.request({ url, params: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
        for (const dimension of data.customDimensions || []) {
          if (dimension.scope === "EVENT") configured.add(dimension.parameterName);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
      for (const [parameterName, displayName, description] of approved) {
        if (configured.has(parameterName)) {
          console.log(`Already registered: ${parameterName}`);
          continue;
        }
        const response = await auth.request({ url, method: "POST", data: { parameterName, displayName, description, scope: "EVENT" } });
        console.log(`Registered ${parameterName}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`GA4 Admin write stopped: HTTP ${error.response?.status || "unknown"} (${error.response?.data?.error?.status || "unknown"}).`);
      throw new Error("GA4 custom dimension registration did not complete.");
    }
    return;
  }
  await verifyAnalytics({ client, propertyId: env.GA_PROPERTY_ID, days, date, qaRun: env.ANALYTICS_VERIFY_QA_RUN || undefined });
  if (env.ANALYTICS_VERIFY_ADMIN === "true") {
    try {
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/analytics.edit"] });
      const response = await auth.request({
        url: `https://analyticsadmin.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}/customDimensions`,
      });
      console.log(`GA4 Admin API custom dimensions read: HTTP ${response.status}. A read does not verify edit permission.`);
    } catch (error) {
      console.log(`GA4 Admin API custom dimensions read unavailable: HTTP ${error.response?.status || "unknown"} (${error.response?.data?.error?.status || "unknown"}).`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Analytics verification failed:", error.message);
    process.exit(1);
  });
}
