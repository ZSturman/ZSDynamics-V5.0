#!/usr/bin/env node
/** Validate generated portfolio manifests, assets, and static export routes. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".bmp", ".tiff", ".heic", ".mp4", ".mov", ".webm", ".mkv", ".avi", ".ogv", ".wmv", ".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".glb", ".gltf", ".obj", ".fbx", ".stl", ".pdf"]);
const REQUIRED_PROJECT_FIELDS = ["id", "slug", "href", "title", "summary", "domain", "status"];
const REQUIRED_ARTICLE_FIELDS = ["slug", "title", "summary", "updatedAt", "href", "sourceUrl"];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return args;
}

function readJson(target, errors) {
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(ROOT, target)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function allStrings(value, values = []) {
  if (typeof value === "string") values.push(value);
  else if (Array.isArray(value)) for (const item of value) allStrings(item, values);
  else if (value && typeof value === "object") for (const item of Object.values(value)) allStrings(item, values);
  return values;
}

function isExternal(value) {
  return /^(https?:|mailto:|tel:|data:|#)/i.test(value);
}

function mediaPath(value, project) {
  if (!value || isExternal(value) || !MEDIA_EXTENSIONS.has(path.extname(value.split(/[?#]/)[0]).toLowerCase())) return null;
  const clean = value.split(/[?#]/)[0].replace(/^\.\//, "");
  if (clean.startsWith("/")) return clean;
  return `/projects/${project.folderName || project.id}/${clean}`;
}

function exportedFileForRoute(outDir, route) {
  const pathname = decodeURIComponent(route.split(/[?#]/)[0]);
  if (pathname === "/") return path.join(outDir, "index.html");
  return path.join(outDir, `${pathname.replace(/^\//, "")}.html`);
}

function validateInternalLinks(outDir, errors) {
  const broken = new Set();
  const htmlFiles = fs.readdirSync(outDir, { recursive: true })
    .filter((entry) => typeof entry === "string" && entry.endsWith(".html"));
  for (const relativeFile of htmlFiles) {
    const source = path.join(outDir, relativeFile);
    const html = fs.readFileSync(source, "utf8");
    for (const match of html.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["']/gi)) {
      const href = match[1];
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const route = href.split(/[?#]/)[0] || "/";
      const target = path.extname(route)
        ? path.join(outDir, decodeURIComponent(route).replace(/^\//, ""))
        : exportedFileForRoute(outDir, route);
      if (!fs.existsSync(target)) {
        broken.add(`${relativeFile} → ${href}`);
      }
    }
  }
  for (const link of [...broken].slice(0, 100)) errors.push(`Broken internal link in static export: ${link}`);
  if (broken.size > 100) errors.push(`Static export has ${broken.size - 100} additional broken internal link(s).`);
}

function validateUnique(entries, key, label, errors) {
  const seen = new Set();
  for (const entry of entries) {
    const value = String(entry?.[key] || "");
    if (!value) continue;
    if (seen.has(value)) errors.push(`Duplicate ${label} ${key}: ${value}`);
    seen.add(value);
  }
}

function mediaExists(publicDir, localPath) {
  const target = path.join(publicDir, localPath.replace(/^\//, ""));
  if (fs.existsSync(target)) return true;
  const ext = path.extname(target).toLowerCase();
  const stem = target.slice(0, -ext.length);
  const variants = ext === ".svg"
    ? []
    : [
      `${stem}-optimized.webp`,
      `${stem}-thumb.webp`,
      `${stem}-placeholder.jpg`,
      `${stem}-optimized.mp4`,
      `${stem}-thumb.jpg`,
      `${stem}.glb`,
    ];
  return variants.some((variant) => fs.existsSync(variant));
}

export function validatePortfolio({ publicDir, outDir }) {
  const errors = [];
  const warnings = [];
  const projects = readJson(path.join(publicDir, "projects", "projects.json"), errors);
  const articles = readJson(path.join(publicDir, "articles", "articles.json"), errors);
  if (!Array.isArray(projects)) errors.push("public/projects/projects.json must contain an array.");
  if (!Array.isArray(articles)) errors.push("public/articles/articles.json must contain an array.");

  if (Array.isArray(projects)) {
    validateUnique(projects, "id", "project", errors);
    validateUnique(projects, "slug", "project", errors);
    for (const project of projects) {
      const name = project?.title || project?.id || "unknown project";
      for (const field of REQUIRED_PROJECT_FIELDS) {
        if (project?.[field] === undefined || project?.[field] === null || project?.[field] === "") errors.push(`Project ${name} is missing required ${field}.`);
      }
      if (project?.href && !/^\/projects\//.test(project.href)) errors.push(`Project ${name} has invalid href ${project.href}.`);
      if (project?.href && !fs.existsSync(exportedFileForRoute(outDir, project.href))) errors.push(`Project route missing from static export: ${project.href}`);
      // The runtime resolves nested collection media relative to each collection item.
      // Validate primary project imagery here; the existing media matrix validates every
      // rendered collection/asset path in the browser.
      for (const [imageRole, imageValue] of Object.entries(project?.images || {})) {
        for (const value of allStrings(imageValue)) {
          const local = mediaPath(value, project);
          if (!local || mediaExists(publicDir, local)) continue;
          const message = `Project ${name} references missing ${imageRole} asset ${local}.`;
          // An icon has a built-in presentation fallback; it is reported but does not make
          // an otherwise deployable static site invalid.
          if (imageRole === "icon") warnings.push(message);
          else errors.push(message);
        }
      }
    }
  }

  if (Array.isArray(articles)) {
    validateUnique(articles, "slug", "article", errors);
    for (const article of articles) {
      const name = article?.title || article?.slug || "unknown article";
      for (const field of REQUIRED_ARTICLE_FIELDS) {
        if (article?.[field] === undefined || article?.[field] === null || article?.[field] === "") errors.push(`Article ${name} is missing required ${field}.`);
      }
      if (article?.href && !fs.existsSync(exportedFileForRoute(outDir, article.href))) errors.push(`Article route missing from static export: ${article.href}`);
      if (article?.coverImage?.startsWith("/") && !mediaExists(publicDir, article.coverImage)) errors.push(`Article ${name} references missing cover image ${article.coverImage}.`);
    }
  }

  for (const [file, expected] of [["api/projects.json", projects], ["api/articles.json", articles], ["api/site.json", undefined]]) {
    const target = path.join(publicDir, file);
    const api = readJson(target, errors);
    if (!api || typeof api !== "object" || !Object.hasOwn(api, "data")) {
      errors.push(`Generated API envelope is invalid: public/${file}`);
      continue;
    }
    if (Array.isArray(expected) && api.count !== expected.length) errors.push(`Generated API count is inconsistent: public/${file}`);
  }

  if (!fs.existsSync(path.join(outDir, "index.html"))) errors.push("Static export did not produce out/index.html.");
  else validateInternalLinks(outDir, errors);
  return { ok: errors.length === 0, errors, warnings, projectCount: projects?.length || 0, articleCount: articles?.length || 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validatePortfolio({
    publicDir: path.resolve(ROOT, args["public-dir"] || "public"),
    outDir: path.resolve(ROOT, args["out-dir"] || "out"),
  });
  const output = path.resolve(ROOT, args.output || "artifacts/validation.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`Validation error: ${error}`);
    process.exit(1);
  }
  console.log(`Portfolio validation passed: ${result.projectCount} projects, ${result.articleCount} articles.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`Portfolio validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
