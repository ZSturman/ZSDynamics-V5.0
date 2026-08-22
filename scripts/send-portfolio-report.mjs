#!/usr/bin/env node
/** Render and deliver an idempotent portfolio pipeline report through the existing Worker. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadProjectEnvironment } from "./project-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

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
  if (["visual_capture", "email_report"].includes(stage) && productionHealthy) return "LOW";
  if (stage === "playwright_qa" && productionHealthy) return "MEDIUM";
  return productionHealthy ? "HIGH" : "CRITICAL";
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

function buildReport(args) {
  const status = args.status || "failure";
  const stage = args.stage || "unknown";
  const summary = args.summary ? readJson(path.resolve(ROOT, args.summary), {}) : {};
  const metadata = args.metadata ? readJson(path.resolve(ROOT, args.metadata), {}) : {};
  const productionHealthy = args["production-healthy"] === "true";
  const severity = severityFor(status, stage, productionHealthy);
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" });
  const commit = metadata.commitSha || process.env.DEPLOY_COMMIT_SHA || process.env.GITHUB_SHA || "not committed";
  const actionUrl = metadata.actionUrl || `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || "ZSturman/ZSDynamics-V5.0"}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
  const subject = status === "success"
    ? "Portfolio Daily Update — Success"
    : status === "no-changes"
      ? "Portfolio Daily Update — No public-site changes"
      : status === "check-only"
        ? "Portfolio Daily Check — Validated (not published)"
      : `[${severity}] Portfolio automation — ${stage.replaceAll("_", " ")} failed`;
  const lines = status === "no-changes"
    ? ["Daily check completed successfully; no public-site changes were required."]
    : (summary.lines || []).slice(0, 20);
  const error = args.error ? String(args.error).slice(0, 1800) : metadata.error;
  const bodyLines = [
    `Date/time: ${timestamp}`,
    `Stage: ${stage.replaceAll("_", " ")}`,
    `Commit: ${commit}`,
    `Production: ${productionHealthy ? "reachable" : "not confirmed"}`,
    `Workflow: ${actionUrl}`,
    ...(status === "success" ? [
      "Deployment: GitHub workflow and Firebase Hosting deployment succeeded.",
      "Production validation: passed in Chromium desktop, WebKit desktop, Chromium mobile, and WebKit iPhone.",
      `Pages tested: ${["/", "/articles", "/work-logs", ...(summary.changedRoutes || [])].filter((value, index, values) => values.indexOf(value) === index).slice(0, 8).join(", ")}`,
    ] : status === "check-only" ? [
      "Publishing: check-only mode; no commit, Firebase deployment, or live QA was requested.",
      "Local generation and validation completed successfully.",
    ] : []),
    ...lines.map((line) => `• ${line}`),
    ...(summary.changedFiles?.length ? [`Changed files: ${summary.changedFiles.slice(0, 12).join(", ")}${summary.changedFiles.length > 12 ? " …" : ""}`] : []),
    ...(error ? [`Error: ${error}`, `Recommended next action: Review the workflow artifact and rerun after resolving the reported stage.`] : []),
  ];
  const html = `<h2>${escapeHtml(subject)}</h2><ul>${bodyLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  return { subject, html, text: bodyLines.join("\n"), idempotencyKey: `${process.env.GITHUB_RUN_ID || process.env.PORTFOLIO_RUN_ID || `local-${Date.now()}`}-${process.env.GITHUB_RUN_ATTEMPT || "1"}-${stage}`, attachments: attachmentPayload(args["attachments-dir"] && path.resolve(ROOT, args["attachments-dir"])) };
}

async function main() {
  loadProjectEnvironment(ROOT);
  const args = parseArgs(process.argv.slice(2));
  const apiBase = (process.env.API_BASE_URL || "").replace(/\/$/, "");
  if (!apiBase || !process.env.INTERNAL_TOKEN) throw new Error("API_BASE_URL and INTERNAL_TOKEN must be configured for report delivery.");
  const payload = buildReport(args);
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

export { buildReport, severityFor };
