#!/usr/bin/env node
// Read-only GA4 check for release verification. Prints aggregate counts only
// (no user identifiers, no IPs) and sends nothing. Run through the
// "Analytics verification" workflow, which holds the GA4 credentials.
import { pathToFileURL } from "node:url";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const QA_SOURCE = "qa";

function rowsToText(rows = []) {
  return rows.map((row) =>
    `  ${row.dimensionValues.map((d) => d.value || "(not set)").join(" | ")} => ${row.metricValues.map((m) => m.value).join(", ")}`,
  );
}

export async function verifyAnalytics({ client, propertyId, days = 7, qaRun, log = console.log }) {
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
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
  await report(`Overview, last ${days} days`, { dateRanges, metrics: mets("sessions", "totalUsers", "newUsers", "screenPageViews", "engagedSessions", "averageSessionDuration") });
  await report("Events", { dateRanges, dimensions: dims("eventName"), metrics: mets("eventCount"), orderBys: desc("eventCount") });
  await report("Sessions by source / medium / campaign", { dateRanges, dimensions: dims("sessionSource", "sessionMedium", "sessionCampaignName"), metrics: mets("sessions", "engagedSessions"), orderBys: desc("sessions") });
  await report("Page views on URLs with a query string (duplicate-page-view check)", {
    dateRanges,
    dimensions: dims("pagePathPlusQueryString"),
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
  const client = new BetaAnalyticsDataClient({ credentials: JSON.parse(env.GA_SERVICE_ACCOUNT_JSON) });
  const days = Math.min(90, Math.max(1, Number.parseInt(env.ANALYTICS_VERIFY_DAYS || "7", 10) || 7));
  await verifyAnalytics({ client, propertyId: env.GA_PROPERTY_ID, days, qaRun: env.ANALYTICS_VERIFY_QA_RUN || undefined });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Analytics verification failed:", error.message);
    process.exit(1);
  });
}
