#!/usr/bin/env node
/**
 * Classifies repository/worktree state for the portfolio publisher.
 *
 * The publisher previously treated "safe to read source and run Notion/
 * article sync, analytics, and validation" and "safe to commit and push
 * generated output" as the same condition: any uncommitted file outside the
 * publisher-managed public/ output aborted the entire run before generation
 * even started, and was reported at HIGH/CRITICAL severity regardless of
 * what the file actually was. Normal local development (an edited component,
 * a documentation note, a work-in-progress script) triggered the same alarm
 * as an actual broken repository.
 *
 * This module separates those concerns:
 *  - diagnosticsSafe: can Notion/article sync, generation, validation, and
 *    other locally-scoped checks run at all? Only a genuinely broken
 *    repository (mid-merge/rebase, unresolved conflicts) should make this
 *    false.
 *  - publishSafe: can generated output be safely committed and pushed on top
 *    of the current tree? Ordinary uncommitted source, an unpushed local
 *    commit, or being behind origin/main all make this false without making
 *    diagnostics unsafe.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const SEVERITY = {
  INFORMATIONAL: "informational",
  ATTENTION: "attention",
  HIGH: "high",
  BLOCKING: "blocking",
};

const GENERATED_FILE = /^(?:public\/(?:projects|articles|api)\/|public\/(?:image-hostnames\.json|media-urls\.json)$|lib\/media-manifest\.lock\.json$)/;

// Common, low-risk day-to-day development state: documentation/notes and the
// project's own scratch directories. Worth surfacing, never worth alarming on.
const LOW_RISK_SOURCE = [/^docs\//, /^README\.md$/, /^AGENTS\.md$/, /^tmp\//, /^logs\//, /^\.env\.local\.example$/];

export function classifyWorkspaceChanges(files) {
  const generated = files.filter((file) => GENERATED_FILE.test(file));
  const unexpected = files.filter((file) => !GENERATED_FILE.test(file));
  const lowRisk = unexpected.filter((file) => LOW_RISK_SOURCE.some((pattern) => pattern.test(file)));
  const source = unexpected.filter((file) => !LOW_RISK_SOURCE.some((pattern) => pattern.test(file)));
  return { generated, unexpected, lowRisk, source };
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { ok: result.status === 0, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
}

/** Detects merge/rebase/cherry-pick in progress and unresolved conflicts. */
export function repositoryState(root) {
  const gitDirResult = git(root, ["rev-parse", "--git-dir"]);
  const gitDir = gitDirResult.ok ? path.resolve(root, gitDirResult.stdout) : path.join(root, ".git");
  const mergeInProgress = fs.existsSync(path.join(gitDir, "MERGE_HEAD"));
  const rebaseInProgress = fs.existsSync(path.join(gitDir, "rebase-merge")) || fs.existsSync(path.join(gitDir, "rebase-apply"));
  const cherryPickInProgress = fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"));
  const status = git(root, ["status", "--porcelain=v2"]);
  const conflicted = status.ok
    ? status.stdout.split("\n").filter((line) => line.startsWith("u ")).map((line) => line.trim().split(/\s+/).pop()).filter(Boolean)
    : [];
  return {
    mergeInProgress,
    rebaseInProgress,
    cherryPickInProgress,
    conflicted,
    unresolvedOperation: mergeInProgress || rebaseInProgress || cherryPickInProgress,
  };
}

/**
 * Assess workspace health for two independent questions: is it safe to run
 * diagnostics (Notion sync, article sync, generation, validation), and is it
 * safe to publish (commit + push)? A dirty tree is diagnostic information,
 * not automatically a high-severity incident.
 */
export function assessWorkspaceHealth({ branch, aheadOfOrigin = 0, behindOrigin = 0, changedFiles = [], repoState }) {
  const classification = classifyWorkspaceChanges(changedFiles);
  const reasons = [];

  if (repoState.unresolvedOperation || repoState.conflicted.length) {
    if (repoState.conflicted.length) reasons.push(`Unresolved merge conflict in ${repoState.conflicted.length} file(s): ${repoState.conflicted.slice(0, 5).join(", ")}.`);
    if (repoState.rebaseInProgress) reasons.push("A rebase is in progress.");
    if (repoState.mergeInProgress) reasons.push("A merge is in progress.");
    if (repoState.cherryPickInProgress) reasons.push("A cherry-pick is in progress.");
    return { severity: SEVERITY.BLOCKING, diagnosticsSafe: false, publishSafe: false, reasons, classification, branch, aheadOfOrigin, behindOrigin };
  }

  let severity = SEVERITY.INFORMATIONAL;
  let publishSafe = true;
  const escalate = (level) => {
    const order = [SEVERITY.INFORMATIONAL, SEVERITY.ATTENTION, SEVERITY.HIGH, SEVERITY.BLOCKING];
    if (order.indexOf(level) > order.indexOf(severity)) severity = level;
  };

  if (branch !== "main") {
    escalate(SEVERITY.HIGH);
    publishSafe = false;
    reasons.push(`Checked out ${branch || "a detached HEAD"} instead of main.`);
  }
  if (behindOrigin > 0) {
    escalate(SEVERITY.ATTENTION);
    publishSafe = false;
    reasons.push(`Local main is ${behindOrigin} commit(s) behind origin/main.`);
  }
  if (aheadOfOrigin > 0) {
    escalate(SEVERITY.ATTENTION);
    publishSafe = false;
    reasons.push(`Local main is ${aheadOfOrigin} commit(s) ahead of origin/main and has not been pushed.`);
  }
  if (classification.source.length) {
    escalate(SEVERITY.ATTENTION);
    publishSafe = false;
    reasons.push(`${classification.source.length} tracked/untracked source file(s) are uncommitted: ${classification.source.slice(0, 8).join(", ")}${classification.source.length > 8 ? ", …" : ""}.`);
  }
  if (classification.lowRisk.length) {
    reasons.push(`${classification.lowRisk.length} documentation/notes file(s) are uncommitted; portfolio generation and analytics are unaffected.`);
  }
  if (classification.generated.length) {
    reasons.push(`${classification.generated.length} publisher-managed generated file(s) differ locally; they will be regenerated and committed if meaningful.`);
  }
  if (!reasons.length) reasons.push("Working tree matches origin/main.");

  return { severity, diagnosticsSafe: true, publishSafe, reasons, classification, branch, aheadOfOrigin, behindOrigin };
}
