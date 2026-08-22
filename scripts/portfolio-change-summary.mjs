#!/usr/bin/env node
/**
 * Produces a stable, human-readable summary of generated portfolio changes.
 * It compares the working tree with a git ref, rather than sending a raw diff.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_PATH = "public/projects/projects.json";
const ARTICLES_PATH = "public/articles/articles.json";
const SITE_PATH = "public/api/site.json";
const NOISY_GENERATED_KEYS = new Set(["updatedAt", "generatedAt", "buildTimestamp", "builtAt", "lastGeneratedAt"]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function valuesEqual(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function stableSemantic(value) {
  if (Array.isArray(value)) return value.map(stableSemantic);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !NOISY_GENERATED_KEYS.has(key))
        .sort()
        .map((key) => [key, stableSemantic(value[key])]),
    );
  }
  return value;
}

export function semanticValuesEqual(left, right) {
  return JSON.stringify(stableSemantic(left)) === JSON.stringify(stableSemantic(right));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function displayName(entry, fallback) {
  return String(entry?.title || entry?.name || entry?.slug || entry?.id || fallback);
}

function changedGroups(before, after, groups) {
  const changed = [];
  for (const [label, fields] of Object.entries(groups)) {
    if (fields.some((field) => !valuesEqual(before?.[field], after?.[field]))) changed.push(label);
  }
  return changed;
}

export function summarizeCollection(beforeEntries, afterEntries, options) {
  const before = new Map(asArray(beforeEntries).map((entry) => [String(entry?.[options.key] || ""), entry]));
  const after = new Map(asArray(afterEntries).map((entry) => [String(entry?.[options.key] || ""), entry]));
  const added = [];
  const removed = [];
  const updated = [];

  for (const [key, entry] of after) {
    if (!key) continue;
    if (!before.has(key)) {
      added.push({ key, title: displayName(entry, key), route: options.route(entry) });
      continue;
    }
    const previous = before.get(key);
    const groups = changedGroups(previous, entry, options.groups);
    if (!groups.length && !semanticValuesEqual(previous, entry)) groups.push("other portfolio data");
    if (groups.length) updated.push({ key, title: displayName(entry, key), groups, route: options.route(entry) });
  }
  for (const [key, entry] of before) {
    if (key && !after.has(key)) removed.push({ key, title: displayName(entry, key), route: options.route(entry) });
  }
  return { added, removed, updated };
}

function readWorkingJson(relativePath) {
  const target = path.join(ROOT, relativePath);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function readGitJson(baseRef, relativePath) {
  try {
    const value = execFileSync("git", ["show", `${baseRef}:${relativePath}`], { cwd: ROOT, encoding: "utf8" });
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function changedFiles(baseRef) {
  const tracked = execFileSync("git", ["diff", "--name-only", baseRef, "--"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function articleContentChanged(baseRef, slug) {
  const relative = `public/articles/${slug}/index.md`;
  const working = path.join(ROOT, relative);
  if (!fs.existsSync(working)) return false;
  try {
    const previous = execFileSync("git", ["show", `${baseRef}:${relative}`], { cwd: ROOT, encoding: "utf8" });
    return previous !== fs.readFileSync(working, "utf8");
  } catch {
    return true;
  }
}

function meaningfulChangedFiles(changed, result, siteChanged) {
  const hasProjectChange = result.projects.added.length + result.projects.removed.length + result.projects.updated.length > 0;
  const hasArticleChange = result.articles.added.length + result.articles.removed.length + result.articles.updated.length > 0;
  return changed.filter((file) => {
    if (file === PROJECTS_PATH || file === "public/api/projects.json") return hasProjectChange;
    if (file === ARTICLES_PATH || file === "public/api/articles.json") return hasArticleChange;
    if (file === SITE_PATH) return siteChanged;
    if (/^public\/articles\/[^/]+\/index\.md$/.test(file)) return true;
    if (file.startsWith("public/projects/")) return true;
    if (file.startsWith("public/api/")) return true;
    if (["public/image-hostnames.json", "public/media-urls.json", "public/media-manifest.lock.json"].includes(file)) return true;
    return true;
  });
}

export function buildChangeSummary({ baseRef = "HEAD", beforeProjects, afterProjects, beforeArticles, afterArticles, changed = [] }) {
  const projects = summarizeCollection(beforeProjects, afterProjects, {
    key: "id",
    route: (entry) => entry?.href || (entry?.slug ? `/projects/${entry.slug}` : null),
    groups: {
      "descriptions/content": ["title", "subtitle", "summary", "oneLiner", "description", "story", "readme"],
      "images/media": ["images", "assets", "collections", "collection"],
      metadata: ["domain", "category", "status", "phase", "featured", "featuredOrder", "tags", "mediums", "genres", "topics", "subjects"],
      "other portfolio data": ["resources", "workLogs", "details", "articles"],
    },
  });
  const articles = summarizeCollection(beforeArticles, afterArticles, {
    key: "slug",
    route: (entry) => entry?.href || (entry?.slug ? `/articles/${entry.slug}` : null),
    groups: {
      content: ["title", "summary", "oneLiner", "linkPreviews"],
      metadata: ["tags", "series", "publishedAt", "coverImage", "projectIds", "sourceUrl"],
    },
  });

  const routes = new Set();
  for (const item of [...projects.added, ...projects.updated, ...articles.added, ...articles.updated]) {
    if (item.route) routes.add(item.route);
  }
  if (changed.some((file) => file === SITE_PATH || file.startsWith("public/icons/") || file.startsWith("public/logo"))) routes.add("/");
  if (projects.added.length || projects.removed.length || projects.updated.length) routes.add("/");

  const lines = [];
  if (projects.added.length) lines.push(`Projects added: ${projects.added.map((item) => item.title).join(", ")}`);
  if (projects.removed.length) lines.push(`Projects removed: ${projects.removed.map((item) => item.title).join(", ")}`);
  for (const item of projects.updated) lines.push(`Project updated: ${item.title} (${item.groups.join(", ")})`);
  if (articles.added.length) lines.push(`Articles added: ${articles.added.map((item) => item.title).join(", ")}`);
  if (articles.removed.length) lines.push(`Articles removed: ${articles.removed.map((item) => item.title).join(", ")}`);
  for (const item of articles.updated) lines.push(`Article updated: ${item.title} (${item.groups.join(", ")})`);

  const knownChanged = projects.added.length + projects.removed.length + projects.updated.length + articles.added.length + articles.removed.length + articles.updated.length;
  const derivedManifestFiles = new Set([PROJECTS_PATH, ARTICLES_PATH, "public/api/projects.json", "public/api/articles.json"]);
  const hasChanges = knownChanged > 0 || changed.some((file) => !derivedManifestFiles.has(file));
  if (hasChanges && knownChanged === 0) lines.push("Other meaningful site/generated content changed.");
  if (!hasChanges) lines.push("No public-site changes were required.");

  return {
    schemaVersion: 1,
    baseRef,
    hasChanges,
    changedFiles: changed,
    projects,
    articles,
    changedRoutes: [...routes].slice(0, 12),
    lines,
  };
}

export function createChangeSummary(baseRef = "HEAD") {
  const beforeProjects = readGitJson(baseRef, PROJECTS_PATH) || [];
  const afterProjects = readWorkingJson(PROJECTS_PATH) || [];
  const beforeArticles = readGitJson(baseRef, ARTICLES_PATH) || [];
  const afterArticles = readWorkingJson(ARTICLES_PATH) || [];
  const beforeSite = readGitJson(baseRef, SITE_PATH);
  const afterSite = readWorkingJson(SITE_PATH);
  const changed = changedFiles(baseRef);
  const result = buildChangeSummary({ baseRef, beforeProjects, afterProjects, beforeArticles, afterArticles, changed });

  // Article bodies are intentionally excluded from their generated manifest, so
  // add a content update even when their metadata is unchanged.
  const beforeBySlug = new Map(asArray(beforeArticles).map((article) => [String(article?.slug || ""), article]));
  for (const article of asArray(afterArticles)) {
    const slug = String(article?.slug || "");
    if (!slug || !beforeBySlug.has(slug) || !articleContentChanged(baseRef, slug)) continue;
    const existing = result.articles.updated.find((item) => item.key === slug);
    if (existing) {
      if (!existing.groups.includes("content")) existing.groups.unshift("content");
    } else {
      result.articles.updated.push({
        key: slug,
        title: displayName(article, slug),
        groups: ["content"],
        route: article?.href || `/articles/${slug}`,
      });
    }
    const route = article?.href || `/articles/${slug}`;
    if (route && !result.changedRoutes.includes(route)) result.changedRoutes.push(route);
  }
  result.changedRoutes = result.changedRoutes.slice(0, 12);
  result.lines = result.lines.filter((line) => !line.startsWith("Article updated:"));
  for (const item of result.articles.updated) {
    result.lines.push(`Article updated: ${item.title} (${item.groups.join(", ")})`);
  }
  const siteChanged = !semanticValuesEqual(beforeSite, afterSite);
  const meaningfulFiles = meaningfulChangedFiles(changed, result, siteChanged);
  result.hasChanges = meaningfulFiles.length > 0;
  result.ignoredFiles = changed.filter((file) => !meaningfulFiles.includes(file));
  if (!result.hasChanges) {
    result.lines = ["No public-site changes were required."];
  } else if (result.lines.length === 1 && result.lines[0] === "No public-site changes were required.") {
    result.lines = ["Other meaningful site/generated content changed."];
  }
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = createChangeSummary(args.base || "HEAD");
  const output = path.resolve(ROOT, args.output || "artifacts/change-summary.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(summary.lines.map((line) => `• ${line}`).join("\n"));
  console.log(`Changed files: ${summary.changedFiles.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Unable to produce portfolio change summary: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
