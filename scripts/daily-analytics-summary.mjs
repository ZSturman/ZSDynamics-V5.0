#!/usr/bin/env node
/**
 * Daily GA4 summary mailer.
 *
 * Pulls yesterday's metrics from Google Analytics Data API and POSTs a
 * compact HTML+text summary to the Worker's /internal/daily-summary endpoint.
 *
 * Run by .github/workflows/daily-analytics.yml each morning. Also runnable
 * locally via `npm run daily-analytics` once env vars are set.
 *
 * Required env vars:
 *   GA_PROPERTY_ID            — numeric GA4 property id (e.g. "123456789")
 *   GA_SERVICE_ACCOUNT_JSON   — full service-account JSON (string)
 *   API_BASE_URL              — Worker base, e.g. https://api.zacharysturman.com
 *   INTERNAL_TOKEN            — bearer token shared with the Worker
 *   SITE_NAME (optional)      — display name in the email subject
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const required = ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT_JSON", "API_BASE_URL", "INTERNAL_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SITE_NAME = process.env.SITE_NAME || "zacharysturman.com";
const PROPERTY_ID = process.env.GA_PROPERTY_ID;

let credentials;
try {
  credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON);
} catch (err) {
  console.error("GA_SERVICE_ACCOUNT_JSON is not valid JSON:", err.message);
  process.exit(1);
}

const client = new BetaAnalyticsDataClient({ credentials });

function yesterdayIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const DATE = yesterdayIso();
const DATE_RANGE = [{ startDate: DATE, endDate: DATE }];

async function runReport({ metrics, dimensions, limit, orderBy }) {
  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: DATE_RANGE,
    metrics: metrics.map((name) => ({ name })),
    dimensions: (dimensions || []).map((name) => ({ name })),
    limit,
    orderBys: orderBy
      ? [{ metric: { metricName: orderBy }, desc: true }]
      : undefined,
  });
  return response.rows || [];
}

function rowValue(row, idx) {
  return row.metricValues?.[idx]?.value ?? "0";
}
function rowDim(row, idx) {
  return row.dimensionValues?.[idx]?.value ?? "(not set)";
}

async function gatherMetrics() {
  const [overview, topPages, traffic, campaigns, events] = await Promise.all([
    runReport({ metrics: ["totalUsers", "sessions", "screenPageViews"] }),
    runReport({
      metrics: ["screenPageViews"],
      dimensions: ["pagePath"],
      orderBy: "screenPageViews",
      limit: 10,
    }),
    runReport({
      metrics: ["sessions"],
      dimensions: ["sessionSource", "sessionMedium"],
      orderBy: "sessions",
      limit: 10,
    }),
    runReport({
      metrics: ["sessions"],
      dimensions: ["sessionCampaignName"],
      orderBy: "sessions",
      limit: 10,
    }),
    runReport({
      metrics: ["eventCount"],
      dimensions: ["eventName"],
      orderBy: "eventCount",
      limit: 20,
    }),
  ]);

  const overviewRow = overview[0];
  const totals = {
    users: overviewRow ? rowValue(overviewRow, 0) : "0",
    sessions: overviewRow ? rowValue(overviewRow, 1) : "0",
    pageViews: overviewRow ? rowValue(overviewRow, 2) : "0",
  };

  const trackedEventNames = new Set([
    "project_open",
    "contact_submit",
    "contact_click",
    "social_click",
    "outbound_click",
    "newsletter_interest",
    "resume_download",
    "article_open",
  ]);
  const filteredEvents = events.filter((row) => trackedEventNames.has(rowDim(row, 0)));

  return { totals, topPages, traffic, campaigns, events: filteredEvents };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTable(title, headers, rows) {
  if (rows.length === 0) {
    return `<h3 style="margin:24px 0 8px">${escapeHtml(title)}</h3><p style="margin:0;color:#666">No data.</p>`;
  }
  const head = headers.map((h) => `<th align="left" style="padding:6px 12px;border-bottom:1px solid #ddd">${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map((c) => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<h3 style="margin:24px 0 8px">${escapeHtml(title)}</h3>
<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function renderTextTable(title, headers, rows) {
  const lines = [`\n## ${title}`];
  if (rows.length === 0) {
    lines.push("(no data)");
    return lines.join("\n");
  }
  lines.push(headers.join(" | "));
  for (const r of rows) lines.push(r.join(" | "));
  return lines.join("\n");
}

function buildSummary({ totals, topPages, traffic, campaigns, events }) {
  const overviewRows = [
    ["Users", totals.users],
    ["Sessions", totals.sessions],
    ["Page views", totals.pageViews],
  ];
  const topPageRows = topPages.map((r) => [rowDim(r, 0), rowValue(r, 0)]);
  const trafficRows = traffic.map((r) => [`${rowDim(r, 0)} / ${rowDim(r, 1)}`, rowValue(r, 0)]);
  const campaignRows = campaigns.map((r) => [rowDim(r, 0), rowValue(r, 0)]);
  const eventRows = events.map((r) => [rowDim(r, 0), rowValue(r, 0)]);

  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#222;max-width:680px">
<h2 style="margin:0 0 6px">${escapeHtml(SITE_NAME)} — analytics for ${escapeHtml(DATE)}</h2>
<p style="margin:0 0 12px;color:#666">Source: Google Analytics 4 Data API</p>
${renderTable("Overview", ["Metric", "Count"], overviewRows)}
${renderTable("Top pages", ["Path", "Views"], topPageRows)}
${renderTable("Traffic by source / medium", ["Source / medium", "Sessions"], trafficRows)}
${renderTable("Campaigns", ["Campaign", "Sessions"], campaignRows)}
${renderTable("Tracked events", ["Event", "Count"], eventRows)}
</div>`;

  const text = [
    `${SITE_NAME} — analytics for ${DATE}`,
    renderTextTable("Overview", ["Metric", "Count"], overviewRows),
    renderTextTable("Top pages", ["Path", "Views"], topPageRows),
    renderTextTable("Traffic by source / medium", ["Source / medium", "Sessions"], trafficRows),
    renderTextTable("Campaigns", ["Campaign", "Sessions"], campaignRows),
    renderTextTable("Tracked events", ["Event", "Count"], eventRows),
  ].join("\n");

  return { html, text };
}

async function postToWorker({ subject, html, text }) {
  const url = `${process.env.API_BASE_URL.replace(/\/$/, "")}/internal/daily-summary`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_TOKEN}`,
    },
    body: JSON.stringify({ subject, html, text }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Worker responded ${res.status}: ${body}`);
  }
  return body;
}

async function main() {
  const data = await gatherMetrics();
  const { html, text } = buildSummary(data);
  const subject = `${SITE_NAME} — analytics for ${DATE}`;
  await postToWorker({ subject, html, text });
  console.log(`Sent summary for ${DATE}`);
}

main().catch((err) => {
  console.error("Daily summary failed:", err);
  process.exit(1);
});
