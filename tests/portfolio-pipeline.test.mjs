import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildChangeSummary, semanticValuesEqual } from "../scripts/portfolio-change-summary.mjs";
import { loadProjectEnvironment } from "../scripts/project-env.mjs";
import { buildReport, severityFor } from "../scripts/send-portfolio-report.mjs";
import { validatePortfolio } from "../scripts/validate-portfolio-output.mjs";

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
