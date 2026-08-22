#!/usr/bin/env node
/** Execute the pre-push portfolio stages with redacted, artifact-friendly logs. */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadProjectEnvironment } from "./project-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = path.join(ROOT, "artifacts");
const REQUIRED_NOTION = ["NOTION_API_KEY", "NOTION_PROJECTS_DB_ID", "NOTION_COLLECTIONS_DB_ID", "NOTION_ASSETS_DB_ID", "NOTION_RESOURCES_DB_ID", "NOTION_CONFIG_DB_ID", "NOTION_WORK_LOGS_DB_ID"];
const REQUIRED_REPORTING = ["API_BASE_URL", "INTERNAL_TOKEN"];
const SECRET_KEYS = ["NOTION_API_KEY", "INTERNAL_TOKEN", "R2_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "GITHUB_TOKEN", "GH_TOKEN"];

function redact(value) {
  let result = String(value || "");
  for (const key of SECRET_KEYS) {
    const secret = process.env[key];
    if (secret) result = result.replaceAll(secret, "[REDACTED]");
  }
  return result;
}

function writeStatus(payload) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, "pipeline-status.json"), `${JSON.stringify(payload, null, 2)}\n`);
}

function assertEnvironment() {
  const missing = [...REQUIRED_NOTION, ...REQUIRED_REPORTING].filter((key) => !process.env[key]);
  if (process.env.NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED === "true") {
    missing.push(...[
      "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
    ].filter((key) => !process.env[key]));
  }
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

function run(stage, command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, env: process.env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const output = redact(`${result.stdout || ""}${result.stderr || ""}`);
  fs.writeFileSync(path.join(ARTIFACTS, `${stage}.log`), output);
  process.stdout.write(output);
  if (result.error || result.status !== 0) throw new Error(`${stage} failed${result.error ? `: ${result.error.message}` : ""}`);
}

function main() {
  // GitHub Actions supplies its own environment. Loading locally makes the
  // same pipeline callable from Hammerspoon without putting credentials in Lua.
  loadProjectEnvironment(ROOT);
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  let stage = "environment";
  try {
    assertEnvironment();
    fs.writeFileSync(path.join(ARTIFACTS, "environment.log"), "Required environment variable names are present.\n");
    stage = "sync_articles";
    run(stage, "npm", ["run", "generate-articles"]);
    stage = "sync_notion";
    run(stage, "npm", ["run", "generate-projects"]);
    stage = "optimize_media";
    run(stage, "npm", ["run", "optimize"]);
    stage = "postprocess";
    run(stage, "npm", ["run", "postprocess"]);
    stage = "detect_changes";
    run(stage, "node", ["scripts/portfolio-change-summary.mjs", "--base", process.env.PORTFOLIO_BASE_SHA || "HEAD", "--output", "artifacts/change-summary.json"]);
    stage = "build";
    run(stage, "npm", ["run", "build"]);
    stage = "validate_generated_output";
    run(stage, "node", ["scripts/validate-portfolio-output.mjs", "--output", "artifacts/validation.json"]);
    stage = "lint";
    run(stage, "npm", ["run", "lint"]);
    stage = "unit_tests";
    run(stage, "npm", ["run", "test:unit"]);
    stage = "python_tests";
    run(stage, "npm", ["run", "test:python"]);
    stage = "browser_tests";
    run(stage, "npm", ["run", "test:e2e"]);
    stage = "media_tests";
    run(stage, "npm", ["run", "test:media:matrix"]);
    writeStatus({ ok: true, stage: "complete", completedAt: new Date().toISOString() });
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    writeStatus({ ok: false, stage, error: message, completedAt: new Date().toISOString() });
    console.error(`Portfolio pipeline failed at ${stage}: ${message}`);
    process.exit(1);
  }
}

main();
