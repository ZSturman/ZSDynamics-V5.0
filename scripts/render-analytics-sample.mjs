#!/usr/bin/env node
/**
 * Renders the daily brief and detailed report from representative fixture
 * data (no network, no credentials) for design review:
 *
 *   node scripts/render-analytics-sample.mjs [outputDir]
 *
 * Writes after-daily-email{,-ga4-only}.{html,txt} and after-detailed-report.html.
 * GA4 numbers mirror the Nov 22, 2026 report; the session stream is synthetic.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { buildAnalyticsLinks, fromSessions } from "./analytics-session-source.mjs";
import { buildDailyAnalyticsReport, buildDetailedReport, buildEmail } from "./daily-analytics-summary.mjs";
import { analyzeSessions } from "../lib/session-journeys.mjs";
import { createNov22Ga4Client, NOV22_REGISTERED_PARAMETERS } from "../tests/fixtures/analytics/ga4-nov22-fixture.mjs";
import { representativeDay, titleForPath } from "../tests/fixtures/analytics/synthetic-sessions.mjs";

const outDir = process.argv[2] || "docs/analytics/samples";
const now = new Date("2026-11-23T14:05:00Z");
const links = buildAnalyticsLinks({ apiBaseUrl: "https://portfolio.example", dateIso: "2026-11-22", timeZone: "America/Los_Angeles" });

async function render(name, sessionStream, withLinks) {
  const report = await buildDailyAnalyticsReport({
    client: createNov22Ga4Client({ registered: NOV22_REGISTERED_PARAMETERS }), propertyId: "0", rootDir: process.cwd(),
    dateIso: "2026-11-22", now, retryDelayMs: 0, sessionStream,
  });
  const email = buildEmail(report, { links: withLinks ? links : null });
  await fs.writeFile(path.join(outDir, `${name}.html`), email.html);
  await fs.writeFile(path.join(outDir, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
  return { report, email };
}

await fs.mkdir(outDir, { recursive: true });
const day = representativeDay();
const stream = fromSessions(analyzeSessions(day.sessions, day.events, { titleForPath, timeZone: "America/Los_Angeles" }), { titleForPath });
const full = await render("after-daily-email", stream, true);
await render("after-daily-email-ga4-only", { available: false, reason: "The session collector is not deployed yet, so individual journeys are unavailable." }, true);
await fs.writeFile(path.join(outDir, "after-detailed-report.html"), buildDetailedReport(full.report).html);
console.log(`${full.email.subject}\nWrote samples to ${outDir}`);
