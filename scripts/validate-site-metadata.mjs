#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function metadataErrors(html, route) {
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  const ogUrl = html.match(/<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/)?.[1];
  const errors = [];
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${route}: missing title`);
  if (!/<meta\b[^>]*name="description"[^>]*content="[^"]+"/.test(html)) errors.push(`${route}: missing description`);
  if (canonical !== `https://zacharysturman.com${route === "/" ? "" : route}` && canonical !== `https://zacharysturman.com${route}`) errors.push(`${route}: incorrect canonical ${canonical}`);
  if (ogUrl !== canonical) errors.push(`${route}: social URL differs from canonical`);
  if (!/<meta\b[^>]*name="twitter:card"/.test(html)) errors.push(`${route}: missing social card`);
  return errors;
}
export function validateSiteMetadata(root = process.cwd()) {
  const routes = fs.readdirSync(path.join(root, "app"), { recursive: true }).filter((file) => String(file).endsWith("page.tsx") && !String(file).includes("["))
    .map((file) => "/" + String(file).replace(/\/?page\.tsx$/, ""));
  const articles = JSON.parse(fs.readFileSync(path.join(root, "public/articles/articles.json"), "utf8"));
  const projects = JSON.parse(fs.readFileSync(path.join(root, "public/projects/projects.json"), "utf8"));
  routes.push(...articles.map((a) => a.href), ...projects.map((p) => p.href));
  const focusDir = path.join(root, "out/explore");
  if (fs.existsSync(focusDir)) routes.push(...fs.readdirSync(focusDir).filter((f) => f.endsWith(".html")).map((f) => `/explore/${f.slice(0, -5)}`));
  const errors = [];
  const titles = new Map();
  for (const route of new Set(routes)) {
    const file = path.join(root, "out", route === "/" ? "index.html" : `${route.slice(1)}.html`);
    if (!fs.existsSync(file)) { errors.push(`${route}: missing export`); continue; }
    const html = fs.readFileSync(file, "utf8");
    errors.push(...metadataErrors(html, route));
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    if (title && titles.has(title)) errors.push(`${route}: duplicates ${titles.get(title)} title`);
    if (title) titles.set(title, route);
  }
  return { routes: new Set(routes).size, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateSiteMetadata();
  if (result.errors.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
  else console.log(`Metadata validation passed: ${result.routes} canonical routes.`);
}
