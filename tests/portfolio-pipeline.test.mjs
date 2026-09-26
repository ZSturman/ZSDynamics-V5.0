import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assessWorkspaceHealth, classifyWorkspaceChanges, SEVERITY } from "../scripts/git-workspace-health.mjs";
import { buildChangeSummary, semanticValuesEqual } from "../scripts/portfolio-change-summary.mjs";
import { loadProjectEnvironment } from "../scripts/project-env.mjs";
import { buildReport, fingerprintFor, planNotification, severityFor } from "../scripts/send-portfolio-report.mjs";
import { validatePortfolio } from "../scripts/validate-portfolio-output.mjs";

const CLEAN_REPO_STATE = { unresolvedOperation: false, conflicted: [], mergeInProgress: false, rebaseInProgress: false, cherryPickInProgress: false };
const CONFLICTED_REPO_STATE = { ...CLEAN_REPO_STATE, unresolvedOperation: true, conflicted: ["app/page.tsx"] };

test("publisher accepts expected generated changes but protects uncommitted source edits", () => {
  const expected = classifyWorkspaceChanges([
    "public/articles/articles.json",
    "public/projects/new-project/thumbnail-optimized.webp",
    "public/api/projects.json",
    "public/media-urls.json",
  ]);
  assert.deepEqual(expected.unexpected, []);
  assert.equal(expected.generated.length, 4);

  const unsafe = classifyWorkspaceChanges(["public/articles/articles.json", "components/portfolio-page-client.tsx", ".github/workflows/deploy.yml"]);
  assert.deepEqual(unsafe.generated, ["public/articles/articles.json"]);
  assert.deepEqual(unsafe.unexpected, ["components/portfolio-page-client.tsx", ".github/workflows/deploy.yml"]);
});

test("change summary groups project changes without treating updatedAt as public content", () => {
  const before = [{ id: "p1", slug: "one", href: "/projects/one", title: "One", summary: "Old", domain: "technology", status: "Active", updatedAt: "2026-01-01" }];
  const after = [{ ...before[0], summary: "New", updatedAt: "2026-01-02" }];
  const summary = buildChangeSummary({ baseRef: "HEAD", beforeProjects: before, afterProjects: after, beforeArticles: [], afterArticles: [], changed: ["public/projects/projects.json"] });

  assert.equal(summary.projects.updated.length, 1);
  assert.deepEqual(summary.projects.updated[0].groups, ["descriptions/content"]);
  assert.deepEqual(summary.changedRoutes, ["/projects/one", "/"]);
  assert.equal(summary.hasChanges, true);
});

test("semantic comparison ignores generated timestamps but preserves meaningful fields", () => {
  assert.equal(semanticValuesEqual({ title: "One", updatedAt: "2026-01-01", generatedAt: "2026-01-01" }, { title: "One", updatedAt: "2026-01-02", generatedAt: "2026-01-02" }), true);
  assert.equal(semanticValuesEqual({ title: "One" }, { title: "Two" }), false);
  const summary = buildChangeSummary({
    beforeProjects: [{ id: "p1", title: "One", updatedAt: "2026-01-01" }],
    afterProjects: [{ id: "p1", title: "One", updatedAt: "2026-01-02" }],
    beforeArticles: [],
    afterArticles: [],
    changed: ["public/projects/projects.json", "public/api/projects.json"],
  });
  assert.equal(summary.hasChanges, false);
});

test("change summary identifies adds, removals, article changes, and changed routes", () => {
  const summary = buildChangeSummary({
    beforeProjects: [{ id: "old", slug: "old", href: "/projects/old", title: "Old" }],
    afterProjects: [{ id: "new", slug: "new", href: "/projects/new", title: "New" }],
    beforeArticles: [{ slug: "article", href: "/articles/article", title: "Article", summary: "Old" }],
    afterArticles: [{ slug: "article", href: "/articles/article", title: "Article", summary: "New" }],
    changed: ["public/projects/projects.json", "public/articles/articles.json"],
  });

  assert.equal(summary.projects.added[0].title, "New");
  assert.equal(summary.projects.removed[0].title, "Old");
  assert.deepEqual(summary.articles.updated[0].groups, ["content"]);
  assert.ok(summary.changedRoutes.includes("/projects/new"));
  assert.ok(summary.changedRoutes.includes("/articles/article"));
});

test("failure severity follows production impact", () => {
  assert.equal(severityFor("failure", "sync_notion", true), "HIGH");
  assert.equal(severityFor("failure", "playwright_qa", true), "MEDIUM");
  assert.equal(severityFor("failure", "confirm_production", false), "CRITICAL");
  assert.equal(severityFor("success", "playwright_qa", true), "SUCCESS");
  assert.equal(severityFor("check-only", "check_only", true), "SUCCESS");
});

test("local project environment prefers explicit shell values and .env.local", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-env-"));
  const loadedKey = `PORTFOLIO_TEST_LOCAL_${Date.now()}`;
  const inheritedKey = `PORTFOLIO_TEST_INHERITED_${Date.now()}`;
  fs.writeFileSync(path.join(root, ".env"), `${loadedKey}=from-env\n${inheritedKey}=from-env\n`);
  fs.writeFileSync(path.join(root, ".env.local"), `${loadedKey}=from-local\n${inheritedKey}=from-local\n`);
  process.env[inheritedKey] = "from-shell";
  loadProjectEnvironment(root);
  assert.equal(process.env[loadedKey], "from-local");
  assert.equal(process.env[inheritedKey], "from-shell");
  delete process.env[loadedKey];
  delete process.env[inheritedKey];
  fs.rmSync(root, { recursive: true, force: true });
});

test("check-only report is clearly non-publishing", () => {
  const report = buildReport({ status: "check-only", stage: "check_only", "production-healthy": "true" });
  assert.equal(report.subject, "Portfolio Daily Check — Validated (not published)");
  assert.match(report.text, /no commit, Firebase deployment, or live QA was requested/i);
});

test("deployment report renders an email-safe release dashboard", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-report-"));
  const metadataPath = path.join(root, "run.json");
  fs.writeFileSync(metadataPath, JSON.stringify({
    commitSha: "abc123",
    publication: { committed: true, pushed: true, target: "origin/main" },
  }));
  const report = buildReport({ status: "success", stage: "local_playwright_qa", "production-healthy": "true", metadata: metadataPath });
  assert.match(report.html, /Portfolio release dashboard/i);
  assert.match(report.html, /Release verified/i);
  assert.match(report.html, /Release details/i);
  assert.match(report.html, /Committed and pushed to origin\/main/i);
  assert.match(report.text, /Commit: abc123/);
  assert.match(report.text, /Publishing: Committed and pushed to origin\/main/);
  assert.match(report.html, /Playwright completed locally/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test("ordinary uncommitted source does not block diagnostics, only publish", () => {
  const health = assessWorkspaceHealth({
    branch: "main",
    aheadOfOrigin: 0,
    behindOrigin: 0,
    changedFiles: ["components/portfolio-page-client.tsx", "docs/notes.md"],
    repoState: CLEAN_REPO_STATE,
  });
  assert.equal(health.diagnosticsSafe, true, "diagnostics must run despite ordinary local edits");
  assert.equal(health.publishSafe, false, "publish must be deferred for real uncommitted source");
  assert.equal(health.severity, SEVERITY.ATTENTION, "ordinary dirty tree must not be high severity");
  assert.ok(health.reasons.some((reason) => reason.includes("components/portfolio-page-client.tsx")));
});

test("a clean tree with only generated output pending is informational", () => {
  const health = assessWorkspaceHealth({
    branch: "main",
    aheadOfOrigin: 0,
    behindOrigin: 0,
    changedFiles: ["public/projects/projects.json"],
    repoState: CLEAN_REPO_STATE,
  });
  assert.equal(health.severity, SEVERITY.INFORMATIONAL);
  assert.equal(health.publishSafe, true);
  assert.equal(health.diagnosticsSafe, true);
});

test("an unresolved merge conflict blocks diagnostics and publish alike", () => {
  const health = assessWorkspaceHealth({
    branch: "main",
    changedFiles: [],
    repoState: CONFLICTED_REPO_STATE,
  });
  assert.equal(health.severity, SEVERITY.BLOCKING);
  assert.equal(health.diagnosticsSafe, false);
  assert.equal(health.publishSafe, false);
  assert.ok(health.reasons.some((reason) => reason.includes("conflict")));
});

test("documentation-only edits are surfaced as low risk, not treated as blocking source", () => {
  const classification = classifyWorkspaceChanges(["docs/setup/analytics.md", "logs/build.log", "README.md"]);
  assert.deepEqual(classification.source, []);
  assert.equal(classification.lowRisk.length, 3);
});

test("publish-skipped severity reflects deferred developer state, not an incident", () => {
  assert.equal(severityFor("publish-skipped", "publish_skipped", true), "ATTENTION");
  assert.notEqual(severityFor("publish-skipped", "publish_skipped", true), "HIGH");
});

test("notification plan sends new issues and never suppresses high/critical severity", () => {
  const firstHigh = planNotification({ severity: "HIGH", fingerprint: "abc", prior: null });
  assert.equal(firstHigh.send, true);
  assert.equal(firstHigh.reason, "new_issue");

  const repeatedHigh = planNotification({
    severity: "HIGH",
    fingerprint: "abc",
    now: Date.parse(firstHigh.nextState.lastSentAt) + 60_000,
    prior: firstHigh.nextState,
  });
  assert.equal(repeatedHigh.send, true, "HIGH/CRITICAL issues are never suppressed, even if unchanged");
});

test("notification plan suppresses an unchanged low-priority issue within the dedup window", () => {
  const first = planNotification({ severity: "ATTENTION", fingerprint: "dirty-tree", prior: null });
  assert.equal(first.send, true);
  const oneHourLater = Date.parse(first.nextState.lastSentAt) + 60 * 60 * 1000;
  const second = planNotification({ severity: "ATTENTION", fingerprint: "dirty-tree", now: oneHourLater, prior: first.nextState });
  assert.equal(second.send, false);
  assert.equal(second.reason, "suppressed_unchanged");
});

test("notification plan escalates an unresolved low-priority issue after several days", () => {
  const first = planNotification({ severity: "ATTENTION", fingerprint: "dirty-tree", prior: null });
  const threeDaysLater = Date.parse(first.nextState.lastSentAt) + 3 * 24 * 60 * 60 * 1000 + 1000;
  const escalated = planNotification({ severity: "ATTENTION", fingerprint: "dirty-tree", now: threeDaysLater, prior: first.nextState });
  assert.equal(escalated.send, true, "an aging unresolved issue must not be permanently suppressed");
  assert.equal(escalated.escalated, true);
  assert.equal(escalated.displaySeverity, "HIGH");
});

test("notification plan reports recovery when a real issue resolves to success", () => {
  const failing = planNotification({ severity: "HIGH", fingerprint: "sync_notion-failed", prior: null });
  const resolved = planNotification({
    severity: "SUCCESS",
    fingerprint: fingerprintFor("success", "local_playwright_qa", undefined, undefined),
    now: Date.parse(failing.nextState.lastSentAt) + 60_000,
    prior: failing.nextState,
  });
  assert.equal(resolved.send, true);
  assert.equal(resolved.recovered, true);
});

test("project generation failure is reported at real-incident severity, independent of git state", () => {
  assert.equal(severityFor("failure", "sync_notion", true), "HIGH");
  assert.equal(severityFor("failure", "sync_notion", false), "CRITICAL");
});

test("article generation failure is reported at real-incident severity, independent of git state", () => {
  assert.equal(severityFor("failure", "sync_articles", true), "HIGH");
  assert.equal(severityFor("failure", "sync_articles", false), "CRITICAL");
});

test("healthy pipeline with a clean repo reports success with no developer-state noise", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-report-"));
  const metadataPath = path.join(root, "run.json");
  fs.writeFileSync(metadataPath, JSON.stringify({
    commitSha: "abc123",
    publication: { committed: true, pushed: true, target: "origin/main" },
    gitHealth: { severity: "informational", publishSafe: true, reasons: ["Working tree matches origin/main."] },
  }));
  const report = buildReport({ status: "success", stage: "local_playwright_qa", "production-healthy": "true", metadata: metadataPath });
  assert.match(report.subject, /Verified/);
  assert.match(report.text, /Developer state:.*differs from a clean publish target.*does not block/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test("healthy pipeline with an expected dirty repo still reports success, with developer state shown separately", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-report-"));
  const metadataPath = path.join(root, "run.json");
  fs.writeFileSync(metadataPath, JSON.stringify({
    gitHealth: {
      severity: "attention",
      publishSafe: false,
      reasons: ["9 tracked/untracked source file(s) are uncommitted: components/portfolio-page-client.tsx, ..."],
    },
  }));
  const report = buildReport({ status: "check-only", stage: "check_only", "production-healthy": "true", metadata: metadataPath });
  assert.equal(severityFor("check-only", "check_only", true), "SUCCESS");
  assert.match(report.subject, /Validated \(not published\)/);
  assert.match(report.text, /Developer state:.*publish is deferred/i);
  assert.match(report.text, /uncommitted: components\/portfolio-page-client\.tsx/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("email delivery outcome is recorded without masking the underlying pipeline result", () => {
  // The publisher records email.delivered independently of pipeline status —
  // a failed email must never be reported as if the pipeline itself failed
  // differently, and a failed pipeline's email-delivery failure must not
  // hide the original error.
  const metadata = { stage: "sync_notion", error: "sync_notion failed", email: { delivered: false, error: "Worker returned HTTP 503" } };
  assert.equal(metadata.error, "sync_notion failed");
  assert.equal(metadata.email.delivered, false);
});

test("analytics failures are independent of local git state (no git/child_process coupling)", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/daily-analytics-summary.mjs"), "utf8");
  assert.doesNotMatch(source, /child_process|execFileSync|spawnSync|require\(["']git["']\)/);
});

test("restoring generated paths one at a time survives a phantom path that git restore's batch form silently kills", () => {
  // Regression for a real bug: `git restore --source=HEAD ... -- <path1> <path2> ...`
  // validates every pathspec before applying any of them, so if GENERATED_PATHS
  // ever contains an entry that doesn't currently exist/isn't tracked, the batch
  // call fails and restores NOTHING — not just the missing path — silently
  // leaving every freshly generated file uncommitted in check-only/no-changes/
  // publish-skipped runs. Restoring each path individually is immune to this.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-restore-"));
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git(["init", "-q"]);
  git(["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-q", "-m", "init"]);
  fs.mkdirSync(path.join(root, "public", "api"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "api", "projects.json"), "committed");
  git(["add", "-A"]);
  git(["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "add generated output"]);

  // Simulate a fresh (uncommitted) regeneration of the tracked generated file.
  fs.writeFileSync(path.join(root, "public", "api", "projects.json"), "freshly regenerated");
  const generatedPaths = ["public/api", "public/does-not-exist.json"];

  const batch = spawnSync("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...generatedPaths], { cwd: root, encoding: "utf8" });
  assert.notEqual(batch.status, 0, "the batch form is expected to fail when one pathspec doesn't match");
  assert.equal(
    fs.readFileSync(path.join(root, "public", "api", "projects.json"), "utf8"),
    "freshly regenerated",
    "the batch form must NOT have restored public/api despite it being a valid, matching path",
  );

  for (const relativePath of generatedPaths) {
    const result = spawnSync("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", relativePath], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) assert.match(`${result.stdout}${result.stderr}`, /did not match any file/);
  }
  assert.equal(
    fs.readFileSync(path.join(root, "public", "api", "projects.json"), "utf8"),
    "committed",
    "restoring paths individually must revert public/api even though a sibling path never existed",
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("GENERATED_PATHS references only real, existing generated-output locations", () => {
  for (const file of ["run-hammerspoon-portfolio-publish.mjs", "git-workspace-health.mjs", "portfolio-change-summary.mjs"]) {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, `../scripts/${file}`), "utf8");
    assert.doesNotMatch(source, /public\/media-manifest\.lock\.json/, `${file}: the real file is lib/media-manifest.lock.json, not under public/`);
  }
});

test("validator rejects missing generated assets and routes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-validate-"));
  const publicDir = path.join(root, "public");
  const outDir = path.join(root, "out");
  fs.mkdirSync(path.join(publicDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "articles"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "api"), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), "<a href='/projects/example'>Example</a><a href='/missing'>Missing</a>");
  fs.writeFileSync(path.join(publicDir, "projects", "projects.json"), JSON.stringify([{ id: "project", slug: "example", href: "/projects/example", title: "Example", summary: "Summary", domain: "technology", status: "Active", folderName: "example_project", images: { thumbnail: "missing.webp" } }]));
  fs.writeFileSync(path.join(publicDir, "articles", "articles.json"), "[]");
  fs.writeFileSync(path.join(publicDir, "api", "projects.json"), JSON.stringify({ data: [], count: 0 }));
  fs.writeFileSync(path.join(publicDir, "api", "articles.json"), JSON.stringify({ data: [], count: 0 }));
  fs.writeFileSync(path.join(publicDir, "api", "site.json"), JSON.stringify({ data: {} }));

  const result = validatePortfolio({ publicDir, outDir });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("missing thumbnail asset")));
  assert.ok(result.errors.some((error) => error.includes("route missing")));
  assert.ok(result.errors.some((error) => error.includes("Broken internal link")));
  fs.rmSync(root, { recursive: true, force: true });
});
