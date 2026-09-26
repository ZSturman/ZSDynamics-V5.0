#!/usr/bin/env node
/** Render and deliver an idempotent portfolio pipeline report through the existing Worker. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadProjectEnvironment } from "./project-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
// Persisted across runs (unlike pipeline-status.json/change-summary.json,
// which are cleared per run) so repeated, unresolved, non-urgent issues can
// be deduplicated instead of re-alerting on every scheduled or manual run.
const NOTIFICATION_STATE_PATH = path.join(ROOT, "artifacts", "notification-state.json");
// Below this severity, an unchanged issue is suppressed for this long after
// it was last actually sent. True breakage (HIGH/CRITICAL) is never suppressed.
const DEDUP_SEVERITIES = new Set(["ATTENTION", "LOW"]);
const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;
const ESCALATE_AFTER_DAYS = 3;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return args;
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function readJson(target, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(target, "utf8")); } catch { return fallback; }
}

function severityFor(status, stage, productionHealthy) {
  if (status === "success" || status === "no-changes" || status === "check-only") return "SUCCESS";
  // Ordinary local repository state (uncommitted source, an unpushed
  // commit, being behind origin/main) deferring a publish is expected,
  // reversible, developer-caused state — not an incident. Diagnostics
  // (Notion/article sync, generation, validation) already completed
  // successfully by the time this status is reported.
  if (status === "publish-skipped") return "ATTENTION";
  if (["visual_capture", "email_report"].includes(stage) && productionHealthy) return "LOW";
  if (stage === "playwright_qa" && productionHealthy) return "MEDIUM";
  return productionHealthy ? "HIGH" : "CRITICAL";
}

function fingerprintFor(status, stage, error, gitHealth) {
  const basis = JSON.stringify({
    status,
    stage,
    error: error ? String(error).slice(0, 300) : undefined,
    reasons: gitHealth?.reasons,
  });
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 16);
}

function loadNotificationState() {
  try { return JSON.parse(fs.readFileSync(NOTIFICATION_STATE_PATH, "utf8")); } catch { return null; }
}

function saveNotificationState(state) {
  fs.mkdirSync(path.dirname(NOTIFICATION_STATE_PATH), { recursive: true });
  fs.writeFileSync(NOTIFICATION_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Decide whether to actually deliver this report, independent of I/O, so the
 * dedup/escalation/recovery rules are directly testable.
 *
 * - Recovery: the previous report was a real issue (ATTENTION or worse) and
 *   this one is SUCCESS. Always sent, flagged as a recovery.
 * - Suppression: this is the same unresolved low-priority issue reported
 *   less than DEDUP_WINDOW_MS ago. Skipped, but state still advances so the
 *   issue's age keeps accruing toward escalation.
 * - Escalation: an unresolved ATTENTION-level issue has persisted for
 *   ESCALATE_AFTER_DAYS or more. Always sent, with the displayed severity
 *   raised so a stale unresolved condition cannot stay quiet indefinitely.
 */
export function planNotification({ severity, fingerprint, now = Date.now(), prior }) {
  const recovered = Boolean(prior && prior.lastSeverity && prior.lastSeverity !== "SUCCESS" && severity === "SUCCESS");
  const sameIssue = Boolean(prior && prior.lastFingerprint === fingerprint);
  const firstSeenAt = sameIssue && prior.firstSeenAt ? prior.firstSeenAt : new Date(now).toISOString();
  const ageDays = sameIssue ? Math.floor((now - Date.parse(firstSeenAt)) / (24 * 60 * 60 * 1000)) : 0;
  const consecutiveCount = sameIssue ? (prior.consecutiveCount || 1) + 1 : 1;
  const escalated = severity === "ATTENTION" && ageDays >= ESCALATE_AFTER_DAYS;
  const displaySeverity = escalated ? "HIGH" : severity;

  let send = true;
  let reason = "new_or_changed";
  if (!recovered && sameIssue && DEDUP_SEVERITIES.has(severity) && !escalated && prior.lastSentAt) {
    const sinceLastSend = now - Date.parse(prior.lastSentAt);
    if (Number.isFinite(sinceLastSend) && sinceLastSend < DEDUP_WINDOW_MS) {
      send = false;
      reason = "suppressed_unchanged";
    }
  }
  if (recovered) reason = "recovered";
  else if (!sameIssue) reason = "new_issue";
  else if (send) reason = escalated ? "escalated" : "resent_unresolved";

  const nextState = {
    lastFingerprint: fingerprint,
    lastSeverity: severity,
    firstSeenAt,
    consecutiveCount,
    lastSentAt: send ? new Date(now).toISOString() : (prior?.lastSentAt || new Date(now).toISOString()),
    lastCheckedAt: new Date(now).toISOString(),
  };
  return { send, recovered, escalated, displaySeverity, ageDays, consecutiveCount, reason, nextState };
}

function attachmentPayload(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { recursive: true })
    .filter((name) => typeof name === "string" && /\.(jpe?g|png)$/i.test(name))
    .map((name) => path.join(directory, name))
    .filter((target) => fs.statSync(target).isFile())
    .sort((left, right) => fs.statSync(left).size - fs.statSync(right).size);
  const attachments = [];
  let total = 0;
  for (const target of entries) {
    const size = fs.statSync(target).size;
    if (attachments.length >= MAX_ATTACHMENTS || size > MAX_ATTACHMENT_BYTES || total + size > MAX_TOTAL_BYTES) continue;
    total += size;
    const basename = path.basename(target);
    const filename = attachments.some((attachment) => attachment.filename === basename)
      ? `${attachments.length + 1}-${basename}`
      : basename;
    attachments.push({
      filename,
      content: fs.readFileSync(target).toString("base64"),
      contentType: /\.png$/i.test(filename) ? "image/png" : "image/jpeg",
    });
  }
  return attachments;
}

function reportStatusLabel(status, severity) {
  if (status === "success") return "Release verified";
  if (status === "no-changes") return "No public changes";
  if (status === "check-only") return "Check completed";
  if (status === "publish-skipped") return "Publish deferred · local changes present";
  return `${severity} · attention needed`;
}

function reportStatusColor(status) {
  if (status === "failure") return "#dc2626";
  if (status === "success") return "#16a34a";
  if (status === "publish-skipped") return "#d97706";
  return "#2563eb";
}

function developerStateLines(gitHealth) {
  if (!gitHealth) return [];
  const reasons = gitHealth.reasons || [];
  const header = gitHealth.publishSafe
    ? "Developer state: working tree differs from a clean publish target, but this does not block generation or diagnostics."
    : "Developer state: publish is deferred until local repository state is resolved. This does not block Notion/article sync, generation, validation, or analytics.";
  return [header, ...reasons.map((reason) => `  - ${reason}`)];
}

function htmlList(lines) {
  if (!lines.length) return '<div style="color:#64748b;font-size:14px;line-height:21px">No content changes were included.</div>';
  return `<ul style="margin:0;padding:0 0 0 19px;color:#334155;font-size:14px;line-height:22px">${lines.map((line) => `<li style="margin:0 0 5px">${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function buildReport(args) {
  const status = args.status || "failure";
  const stage = args.stage || "unknown";
  const summary = args.summary ? readJson(path.resolve(ROOT, args.summary), {}) : {};
  const metadata = args.metadata ? readJson(path.resolve(ROOT, args.metadata), {}) : {};
  const productionHealthy = args["production-healthy"] === "true";
  const severity = severityFor(status, stage, productionHealthy);
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" });
  const commit = metadata.commitSha || process.env.DEPLOY_COMMIT_SHA || process.env.GITHUB_SHA || "not committed";
  const publication = metadata.publication || {};
  const publishing = publication.pushed
    ? `Committed and pushed to ${publication.target || "origin/main"}.`
    : publication.committed
      ? `Committed locally, but not pushed to ${publication.target || "origin/main"}.`
      : "No commit was created.";
  const actionUrl = metadata.actionUrl || `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || "ZSturman/ZSDynamics-V5.0"}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
  const displaySeverity = args["display-severity"] || severity;
  const recovered = args.recovered === "true";
  const escalatedNote = args["age-days"] && Number(args["age-days"]) > 0
    ? `Unresolved for ${args["age-days"]} day(s) across ${args["consecutive-count"] || "multiple"} report(s).`
    : null;
  const subject = recovered
    ? `Portfolio — Resolved: ${stage.replaceAll("_", " ")}`
    : status === "success"
      ? "Portfolio Release Dashboard — Verified"
      : status === "no-changes"
        ? "Portfolio Daily Update — No public-site changes"
        : status === "check-only"
          ? "Portfolio Daily Check — Validated (not published)"
        : status === "publish-skipped"
          ? `Portfolio Daily Check — Publish deferred (${escalatedNote ? "unresolved" : "local changes"})`
        : `[${displaySeverity}] Portfolio automation — ${stage.replaceAll("_", " ")} failed`;
  const lines = status === "no-changes"
    ? ["Daily check completed successfully; no public-site changes were required."]
    : (summary.lines || []).slice(0, 20);
  const error = args.error ? String(args.error).slice(0, 1800) : metadata.error;
  const needsAttention = Array.isArray(metadata.validationWarnings) ? metadata.validationWarnings.slice(0, 10) : [];
  const bodyLines = [
    `Date/time: ${timestamp}`,
    `Stage: ${stage.replaceAll("_", " ")}`,
    `Commit: ${commit}`,
    `Publishing: ${publishing}`,
    `Production: ${productionHealthy ? "reachable" : "not confirmed"}`,
    `Workflow: ${actionUrl}`,
    ...(status === "success" ? [
      "Deployment: GitHub workflow and Firebase Hosting deployment succeeded.",
      "Local production validation: passed in Chromium desktop, WebKit desktop, Chromium mobile, and WebKit iPhone.",
      `Pages tested: ${["/", "/articles", "/work-logs", ...(summary.changedRoutes || [])].filter((value, index, values) => values.indexOf(value) === index).slice(0, 8).join(", ")}`,
    ] : status === "check-only" ? [
      "Publishing: check-only mode; no commit, Firebase deployment, or live QA was requested.",
      "Local generation and validation completed successfully.",
    ] : status === "publish-skipped" ? [
      "Diagnostics: Notion sync, article sync, generation, and validation all completed successfully.",
      "Publishing: deferred; see Developer state below for why.",
    ] : []),
    ...(recovered ? [`Resolved: the previously reported ${args["previous-severity"] || "issue"} condition is no longer present.`] : []),
    ...(escalatedNote ? [`Escalation: ${escalatedNote}`] : []),
    ...developerStateLines(metadata.gitHealth),
    ...(needsAttention.length ? ["Needs attention:", ...needsAttention.map((item) => `  - ${item}`)] : []),
    ...lines.map((line) => `• ${line}`),
    ...(summary.changedFiles?.length ? [`Changed files: ${summary.changedFiles.slice(0, 12).join(", ")}${summary.changedFiles.length > 12 ? " …" : ""}`] : []),
    ...(error ? [`Error: ${error}`, `Recommended next action: Review the workflow artifact and rerun after resolving the reported stage.`] : []),
  ];
  const attachments = attachmentPayload(args["attachments-dir"] && path.resolve(ROOT, args["attachments-dir"]));
  const statusLabel = recovered ? "Resolved" : reportStatusLabel(status, displaySeverity);
  const statusColor = recovered ? "#16a34a" : reportStatusColor(status);
  const developerState = developerStateLines(metadata.gitHealth);
  const verification = status === "success"
    ? "Firebase release marker confirmed · Playwright completed locally · visual previews captured locally"
    : productionHealthy ? "The public site is reachable; see the stage details below." : "The public site could not be confirmed reachable.";
  const changeLines = [
    ...lines,
    ...(summary.changedFiles?.length ? [`Changed files: ${summary.changedFiles.slice(0, 12).join(", ")}${summary.changedFiles.length > 12 ? " …" : ""}`] : []),
  ];
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden">
      <tr><td style="padding:30px 32px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff">
        <div style="font-size:12px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#93c5fd">Portfolio release dashboard</div>
        <div style="margin-top:10px;font-size:28px;font-weight:750;line-height:34px">${escapeHtml(statusLabel)}</div>
        <div style="margin-top:8px;color:#cbd5e1;font-size:14px;line-height:21px">${escapeHtml(timestamp)}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 4px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td width="50%" style="padding:0 8px 16px 0"><div style="padding:16px;border:1px solid #dbe3ee;border-radius:12px"><div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#64748b">Release status</div><div style="margin-top:7px;color:${statusColor};font-size:18px;font-weight:750">${escapeHtml(statusLabel)}</div></div></td>
          <td width="50%" style="padding:0 0 16px 8px"><div style="padding:16px;border:1px solid #dbe3ee;border-radius:12px"><div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#64748b">Production</div><div style="margin-top:7px;font-size:18px;font-weight:750;color:${productionHealthy ? "#15803d" : "#dc2626"}">${productionHealthy ? "Reachable" : "Not confirmed"}</div></div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:4px 32px 24px"><div style="padding:16px 18px;background:#f8fafc;border-left:4px solid ${statusColor};border-radius:8px;font-size:14px;line-height:21px;color:#334155">${escapeHtml(verification)}</div></td></tr>
      <tr><td style="padding:0 32px 24px"><div style="font-size:16px;font-weight:750;margin-bottom:10px">Release details</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dbe3ee;border-radius:10px;overflow:hidden"><tr><td style="width:126px;padding:11px 14px;background:#f8fafc;color:#64748b;font-size:13px">Stage</td><td style="padding:11px 14px;font-size:13px;font-weight:600">${escapeHtml(stage.replaceAll("_", " "))}</td></tr><tr><td style="width:126px;padding:11px 14px;background:#f8fafc;color:#64748b;font-size:13px">Commit</td><td style="padding:11px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all">${escapeHtml(commit)}</td></tr><tr><td style="width:126px;padding:11px 14px;background:#f8fafc;color:#64748b;font-size:13px">Publishing</td><td style="padding:11px 14px;font-size:13px">${escapeHtml(publishing)}</td></tr><tr><td style="width:126px;padding:11px 14px;background:#f8fafc;color:#64748b;font-size:13px">Evidence</td><td style="padding:11px 14px;font-size:13px">${attachments.length ? `${attachments.length} local screenshot${attachments.length === 1 ? "" : "s"} attached` : "No screenshot attachments"}</td></tr></table></td></tr>
      <tr><td style="padding:0 32px 24px"><div style="font-size:16px;font-weight:750;margin-bottom:10px">What changed</div>${htmlList(changeLines)}</td></tr>
      ${developerState.length ? `<tr><td style="padding:0 32px 24px"><div style="font-size:16px;font-weight:750;margin-bottom:10px">Developer state</div>${htmlList(developerState)}</td></tr>` : ""}
      ${needsAttention.length ? `<tr><td style="padding:0 32px 24px"><div style="font-size:16px;font-weight:750;margin-bottom:10px">Needs attention</div>${htmlList(needsAttention)}</td></tr>` : ""}
      ${escalatedNote ? `<tr><td style="padding:0 32px 24px"><div style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;color:#92400e;font-size:13px">${escapeHtml(escalatedNote)}</div></td></tr>` : ""}
      ${error ? `<tr><td style="padding:0 32px 24px"><div style="padding:16px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:13px;line-height:20px"><strong>Action needed</strong><br>${escapeHtml(error)}</div></td></tr>` : ""}
      <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:18px">Workflow: <a href="${escapeHtml(actionUrl)}" style="color:#2563eb">open deployment activity</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, html, text: bodyLines.join("\n"), idempotencyKey: `${process.env.GITHUB_RUN_ID || process.env.PORTFOLIO_RUN_ID || `local-${Date.now()}`}-${process.env.GITHUB_RUN_ATTEMPT || "1"}-${stage}`, attachments };
}

async function main() {
  loadProjectEnvironment(ROOT);
  const args = parseArgs(process.argv.slice(2));
  const apiBase = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  if (!apiBase || !process.env.INTERNAL_TOKEN) throw new Error("API_BASE_URL and INTERNAL_TOKEN must be configured for report delivery.");

  const status = args.status || "failure";
  const stage = args.stage || "unknown";
  const productionHealthy = args["production-healthy"] === "true";
  const severity = severityFor(status, stage, productionHealthy);
  const metadata = args.metadata ? readJson(path.resolve(ROOT, args.metadata), {}) : {};
  const fingerprint = fingerprintFor(status, stage, args.error || metadata.error, metadata.gitHealth);
  const prior = loadNotificationState();
  const plan = planNotification({ severity, fingerprint, prior });
  saveNotificationState(plan.nextState);

  if (!plan.send) {
    console.log(`Portfolio report suppressed: unchanged ${severity} issue (${plan.reason}); last sent ${prior?.lastSentAt || "unknown"}.`);
    return;
  }
  if (plan.escalated) console.log(`Portfolio report escalated: unresolved ${severity} issue for ${plan.ageDays} day(s).`);
  if (plan.recovered) console.log("Portfolio report: previously reported issue has resolved.");

  const payload = buildReport({
    ...args,
    "display-severity": plan.displaySeverity,
    recovered: String(plan.recovered),
    "previous-severity": prior?.lastSeverity,
    "age-days": String(plan.ageDays),
    "consecutive-count": String(plan.consecutiveCount),
  });
  let lastError = "unknown delivery error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/internal/daily-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INTERNAL_TOKEN}` },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        console.log(`Portfolio report delivered (${payload.attachments.length} attachment(s)).`);
        return;
      }
      lastError = `Worker returned HTTP ${response.status}`;
      if (response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  throw new Error(`Portfolio report delivery failed: ${lastError}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

export { buildReport, fingerprintFor, severityFor };
