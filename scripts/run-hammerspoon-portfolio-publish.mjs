#!/usr/bin/env node
/**
 * Local, Hammerspoon-owned portfolio publisher.
 *
 * Hammerspoon schedules this command. It performs the Notion/content work and
 * pre-push validation on this Mac, then uses a normal git push so the existing
 * GitHub Firebase deploy workflow can confirm production, run live QA, retain
 * CI artifacts, and deliver the final deployment email.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadProjectEnvironment } from "./project-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = path.join(ROOT, "artifacts");
const RUNS_DIRECTORY = path.join(ARTIFACTS, "hammerspoon-runs");
const LOCK_DIRECTORY = path.join(ARTIFACTS, "hammerspoon-publish.lock");
const GENERATED_PATHS = [
  "public/projects",
  "public/articles",
  "public/api",
  "public/image-hostnames.json",
  "public/media-urls.json",
  "public/media-manifest.lock.json",
];
const GENERATED_FILE = /^(?:public\/(?:projects|articles|api)\/|public\/(?:image-hostnames\.json|media-urls\.json|media-manifest\.lock\.json)$)/;
const SECRET_KEYS = ["NOTION_API_KEY", "INTERNAL_TOKEN", "R2_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "GITHUB_TOKEN", "GH_TOKEN"];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return args;
}

function redact(value) {
  let text = String(value || "");
  for (const key of SECRET_KEYS) {
    const secret = process.env[key];
    if (secret) text = text.replaceAll(secret, "[REDACTED]");
  }
  return text;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  const output = redact(`${result.stdout || ""}${result.stderr || ""}`);
  if (output) process.stdout.write(output);
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed${result.error ? `: ${result.error.message}` : ""}`);
  }
  return output;
}

function git(args, options) {
  return run("git", args, options).trim();
}

function gitQuiet(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: result.status === 0, output: redact(`${result.stdout || ""}${result.stderr || ""}`).trim() };
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(target, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(target, "utf8")); } catch { return fallback; }
}

function artifactPath(runDirectory, name) {
  return path.join(runDirectory, name);
}

function copyIfPresent(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true });
}

function prepareRunArtifacts() {
  for (const name of ["pipeline-status.json", "change-summary.json", "validation.json"]) {
    fs.rmSync(path.join(ARTIFACTS, name), { force: true });
  }
}

function acquireLock(runId) {
  try {
    fs.mkdirSync(LOCK_DIRECTORY, { recursive: false });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const owner = readJson(path.join(LOCK_DIRECTORY, "owner.json"), {});
    const age = Date.now() - Date.parse(owner.startedAt || "");
    const ownerIsStale = !Number.isFinite(age) || age > 8 * 60 * 60 * 1000;
    if (!ownerIsStale) throw new Error("Another Hammerspoon portfolio publish run is already active; refusing a concurrent run.");
    // The lock is owned exclusively by this ignored artifacts directory. An
    // eight-hour-old owner cannot still be a supported publisher invocation.
    fs.rmSync(LOCK_DIRECTORY, { recursive: true, force: true });
    fs.mkdirSync(LOCK_DIRECTORY, { recursive: false });
  }
  writeJson(path.join(LOCK_DIRECTORY, "owner.json"), { runId, pid: process.pid, startedAt: new Date().toISOString() });
  process.once("exit", () => fs.rmSync(LOCK_DIRECTORY, { recursive: true, force: true }));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      fs.rmSync(LOCK_DIRECTORY, { recursive: true, force: true });
      process.exit(signal === "SIGTERM" ? 143 : 130);
    });
  }
}

function archiveEvidence(runDirectory) {
  fs.mkdirSync(runDirectory, { recursive: true });
  for (const name of ["pipeline-status.json", "change-summary.json", "validation.json"]) {
    copyIfPresent(path.join(ARTIFACTS, name), artifactPath(runDirectory, name));
  }
  for (const entry of fs.existsSync(ARTIFACTS) ? fs.readdirSync(ARTIFACTS) : []) {
    if (!entry.endsWith(".log")) continue;
    copyIfPresent(path.join(ARTIFACTS, entry), artifactPath(runDirectory, entry));
  }
}

function pruneEvidence(retentionDays) {
  if (!fs.existsSync(RUNS_DIRECTORY)) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(RUNS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(RUNS_DIRECTORY, entry.name);
    if (fs.statSync(target).mtimeMs >= cutoff) continue;
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function assertCleanMain() {
  const dirty = gitQuiet(["status", "--porcelain", "--untracked-files=all"]);
  if (dirty.output) throw new Error("Refusing to run in a dirty worktree. Commit, stash, or remove local changes first.");
  const branch = git(["branch", "--show-current"]);
  if (branch !== "main") throw new Error(`Refusing to publish from ${branch || "a detached HEAD"}; switch to main first.`);
  git(["fetch", "origin", "main"]);
  const head = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", "origin/main"]);
  if (head !== remote) throw new Error("Local main is not identical to origin/main. Fast-forward it before running the publisher.");
  return head;
}

function changedFiles(baseSha) {
  const tracked = git(["diff", "--name-only", baseSha, "--"]).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function assertGeneratedPaths(baseSha) {
  const unexpected = changedFiles(baseSha).filter((file) => !GENERATED_FILE.test(file));
  if (unexpected.length) throw new Error(`Generation changed an unapproved path: ${unexpected.join(", ")}`);
}

function restoreGeneratedPaths() {
  // This is only called after this command established a clean worktree and
  // only targets the explicitly approved generated output paths.
  const restore = gitQuiet(["restore", "--source=HEAD", "--staged", "--worktree", "--", ...GENERATED_PATHS]);
  if (!restore.ok && !restore.output.includes("did not match any file")) {
    throw new Error(`Could not restore generated output: ${restore.output}`);
  }
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", ...GENERATED_PATHS]).split("\n").filter(Boolean);
  if (untracked.length) run("git", ["clean", "-f", "--", ...untracked]);
}

function advanceToRemote(baseSha) {
  git(["fetch", "origin", "main"]);
  const remote = git(["rev-parse", "origin/main"]);
  if (remote === baseSha) return { advanced: false, sha: baseSha };
  const ancestor = gitQuiet(["merge-base", "--is-ancestor", "HEAD", "origin/main"]);
  if (!ancestor.ok) throw new Error("origin/main changed to a non-fast-forward history; refusing to alter the local checkout.");
  restoreGeneratedPaths();
  git(["merge", "--ff-only", "origin/main"]);
  return { advanced: true, sha: git(["rev-parse", "HEAD"]) };
}

async function productionHealthy() {
  try {
    const response = await fetch("https://zacharysturman.com/", { signal: AbortSignal.timeout(15_000), redirect: "follow" });
    return response.ok;
  } catch {
    return false;
  }
}

function errorExcerpt(error) {
  return redact(error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1800);
}

function sendReport({ status, stage, summaryPath, metadataPath, healthy, error, attachmentsDirectory }) {
  const args = ["scripts/send-portfolio-report.mjs", "--status", status, "--stage", stage, "--metadata", metadataPath, "--production-healthy", String(healthy)];
  if (summaryPath && fs.existsSync(summaryPath)) args.push("--summary", summaryPath);
  if (error) args.push("--error", error);
  if (attachmentsDirectory && fs.existsSync(attachmentsDirectory)) args.push("--attachments-dir", attachmentsDirectory);
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env: process.env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const output = redact(`${result.stdout || ""}${result.stderr || ""}`);
  if (output) process.stdout.write(output);
  return { delivered: result.status === 0, error: result.status === 0 ? undefined : output.slice(-1800) || "email command failed" };
}

function pipelineStage() {
  return readJson(path.join(ARTIFACTS, "pipeline-status.json"), {}).stage || "unknown";
}

function runPipeline(baseSha) {
  process.env.PORTFOLIO_BASE_SHA = baseSha;
  run(process.execPath, ["scripts/run-portfolio-pipeline.mjs"]);
}

function commitAndPush(baseSha) {
  assertGeneratedPaths(baseSha);
  run("git", ["add", "-A", "--", ...GENERATED_PATHS]);
  const staged = gitQuiet(["diff", "--cached", "--quiet"]);
  if (staged.ok) return null;
  const currentRemote = git(["rev-parse", "origin/main"]);
  if (currentRemote !== baseSha) throw new Error("origin/main advanced before commit; refusing to push a stale generated result.");
  git(["-c", "user.name=Portfolio Publisher", "-c", "user.email=portfolio-publisher@zacharysturman.com", "commit", "-m", "chore(portfolio): daily content sync"]);
  const commitSha = git(["rev-parse", "HEAD"]);
  git(["push", "origin", "HEAD:main"]);
  return commitSha;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode && !["publish", "check-only"].includes(args.mode)) {
    throw new Error("--mode must be publish or check-only.");
  }
  const mode = args.mode === "check-only" ? "check-only" : "publish";
  const retentionDays = Number.parseInt(args["retention-days"] || "30", 10);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error("--retention-days must be an integer from 1 to 365.");
  loadProjectEnvironment(ROOT);
  const runId = process.env.PORTFOLIO_RUN_ID || `hammerspoon-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  process.env.PORTFOLIO_RUN_ID = runId;
  const runDirectory = path.join(RUNS_DIRECTORY, runId);
  const metadataPath = artifactPath(runDirectory, "run.json");
  const metadata = {
    runId,
    startedAt: new Date().toISOString(),
    scheduler: "hammerspoon",
    mode,
    actionUrl: "https://github.com/ZSturman/ZSDynamics-V5.0/actions/workflows/firebase-hosting-merge.yml",
  };
  fs.mkdirSync(runDirectory, { recursive: true });
  pruneEvidence(retentionDays);
  prepareRunArtifacts();

  let baseSha;
  let published = false;
  let cleanWorkspaceEstablished = false;
  let currentStage = "preflight";
  try {
    acquireLock(runId);
    baseSha = assertCleanMain();
    cleanWorkspaceEstablished = true;
    metadata.baseSha = baseSha;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      currentStage = "sync_validate";
      runPipeline(baseSha);
      currentStage = "confirm_base";
      const advanced = advanceToRemote(baseSha);
      if (!advanced.advanced) break;
      if (attempt === 2) throw new Error("main advanced twice during generation; refusing to publish a stale result.");
      baseSha = advanced.sha;
      metadata.baseSha = baseSha;
    }

    const summaryPath = path.join(ARTIFACTS, "change-summary.json");
    const summary = readJson(summaryPath);
    currentStage = "detect_changes";
    metadata.changed = Boolean(summary.hasChanges);
    if (!summary.hasChanges) {
      restoreGeneratedPaths();
      const healthy = await productionHealthy();
      metadata.productionHealthy = healthy;
      metadata.stage = "detect_changes";
      metadata.completedAt = new Date().toISOString();
      writeJson(metadataPath, metadata);
      const email = sendReport({ status: "no-changes", stage: "detect_changes", summaryPath, metadataPath, healthy });
      metadata.email = email;
      writeJson(metadataPath, metadata);
      archiveEvidence(runDirectory);
      console.log("No meaningful public-site changes; no commit or deployment was created.");
      return;
    }

    if (mode === "check-only") {
      restoreGeneratedPaths();
      const healthy = await productionHealthy();
      metadata.productionHealthy = healthy;
      metadata.stage = "check_only";
      metadata.completedAt = new Date().toISOString();
      writeJson(metadataPath, metadata);
      const email = sendReport({ status: "check-only", stage: "check_only", summaryPath, metadataPath, healthy });
      metadata.email = email;
      writeJson(metadataPath, metadata);
      archiveEvidence(runDirectory);
      console.log("Check-only validation completed; generated output was restored and nothing was published.");
      return;
    }

    currentStage = "commit_and_push";
    const commitSha = commitAndPush(baseSha);
    if (!commitSha) throw new Error("Semantic changes were reported, but no approved generated files were staged.");
    published = true;
    metadata.commitSha = commitSha;
    metadata.stage = "commit_and_push";
    metadata.completedAt = new Date().toISOString();
    metadata.productionWorkflow = "GitHub's main push workflow now owns Firebase deployment, marker confirmation, live Playwright QA, previews, and the final email.";
    writeJson(metadataPath, metadata);
    archiveEvidence(runDirectory);
    console.log(`Published ${commitSha}. The existing GitHub Firebase workflow will send the final production report after live QA.`);
  } catch (error) {
    const reportedPipelineStage = currentStage === "sync_validate" ? pipelineStage() : currentStage;
    const message = errorExcerpt(error);
    if (!published && cleanWorkspaceEstablished) {
      try { restoreGeneratedPaths(); } catch (restoreError) { console.error(`Could not restore generated output: ${errorExcerpt(restoreError)}`); }
    }
    const healthy = await productionHealthy();
    metadata.stage = reportedPipelineStage === "complete" ? "commit_and_push" : reportedPipelineStage;
    metadata.error = message;
    metadata.productionHealthy = healthy;
    metadata.completedAt = new Date().toISOString();
    writeJson(metadataPath, metadata);
    archiveEvidence(runDirectory);
    const email = sendReport({
      status: "failure",
      stage: metadata.stage,
      summaryPath: path.join(ARTIFACTS, "change-summary.json"),
      metadataPath,
      healthy,
      error: message,
      attachmentsDirectory: path.join(ROOT, "test-results"),
    });
    metadata.email = email;
    writeJson(metadataPath, metadata);
    console.error(`Hammerspoon portfolio publisher failed at ${metadata.stage}: ${message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Hammerspoon portfolio publisher failed before startup: ${errorExcerpt(error)}`);
  process.exit(1);
});
