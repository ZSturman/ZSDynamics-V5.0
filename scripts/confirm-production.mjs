#!/usr/bin/env node
/** Poll both Firebase's default domain and the custom production domain for the exact build marker. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    args[token.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return args;
}

async function fetchMarker(baseUrl, expectedSha) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/deployment.json?sha=${encodeURIComponent(expectedSha)}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    const text = await response.text();
    let marker = null;
    try { marker = JSON.parse(text); } catch { /* Invalid marker is a failed confirmation. */ }
    return { url: baseUrl, status: response.status, marker, matches: response.ok && marker?.commitSha === expectedSha };
  } catch (error) {
    return { url: baseUrl, status: 0, marker: null, matches: false, error: error instanceof Error ? error.name : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedSha = args.commit || process.env.DEPLOY_COMMIT_SHA || process.env.GITHUB_SHA;
  if (!expectedSha) throw new Error("Expected commit SHA is required via --commit or DEPLOY_COMMIT_SHA.");
  const domains = String(args.domains || "https://zachary-sturman-portfolio.web.app,https://zacharysturman.com").split(",").map((value) => value.trim()).filter(Boolean);
  const attempts = Math.min(Math.max(Number(args.attempts || 30), 1), 60);
  const intervalMs = Math.min(Math.max(Number(args["interval-ms"] || 10_000), 1_000), 60_000);
  let results = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    results = await Promise.all(domains.map((domain) => fetchMarker(domain, expectedSha)));
    if (results.every((result) => result.matches)) break;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const payload = { expectedSha, confirmedAt: new Date().toISOString(), domains: results, ok: results.every((result) => result.matches) };
  const output = path.resolve(ROOT, args.output || "artifacts/deployment-metadata.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.ok) throw new Error(`Production did not expose deployment marker ${expectedSha.slice(0, 12)} before timeout.`);
  console.log(`Confirmed production marker ${expectedSha.slice(0, 12)} on ${domains.length} domain(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
