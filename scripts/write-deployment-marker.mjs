#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const payload = {
  schemaVersion: 1,
  commitSha: process.env.DEPLOY_COMMIT_SHA || process.env.GITHUB_SHA || gitSha(),
  builtAt: new Date().toISOString(),
  workflowRunId: process.env.GITHUB_RUN_ID || null,
};
const output = path.join(ROOT, "public", "deployment.json");
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote deployment marker for ${payload.commitSha.slice(0, 12)}.`);
