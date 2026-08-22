#!/usr/bin/env node
/** Capture a compact cross-browser set of production previews after QA succeeds. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "@playwright/test";

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

function changedRoutes(summaryPath) {
  if (!summaryPath || !fs.existsSync(summaryPath)) return [];
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    return [...new Set((summary.changedRoutes || []).filter((route) => typeof route === "string" && route.startsWith("/") && route !== "/"))].slice(0, 4);
  } catch {
    return [];
  }
}

function filePart(route) {
  return route.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
}

async function capture(browserType, device, url, output) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...device, colorScheme: "light", locale: "en-US" });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`${url} returned ${response?.status() || 0}`);
    try { await page.waitForLoadState("networkidle", { timeout: 4_000 }); } catch { /* third-party requests may remain open */ }
    await page.screenshot({ path: output, type: "jpeg", quality: 75, fullPage: false, animations: "disabled" });
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args.url || "https://zacharysturman.com").replace(/\/$/, "");
  const outputDir = path.resolve(ROOT, args.output || "artifacts/previews");
  fs.mkdirSync(outputDir, { recursive: true });
  const baselines = [
    [chromium, devices["Desktop Chrome"], "chromium-desktop-home"],
    [webkit, devices["Desktop Safari"], "webkit-desktop-home"],
    [chromium, devices["Pixel 7"], "chromium-mobile-home"],
    [webkit, devices["iPhone 13"], "webkit-mobile-home"],
  ];
  for (const [browserType, device, name] of baselines) {
    await capture(browserType, device, `${baseUrl}/`, path.join(outputDir, `${name}.jpg`));
  }
  for (const route of changedRoutes(args.summary && path.resolve(ROOT, args.summary))) {
    await capture(chromium, devices["Desktop Chrome"], `${baseUrl}${route}`, path.join(outputDir, `changed-${filePart(route)}.jpg`));
  }
  console.log(`Captured ${fs.readdirSync(outputDir).filter((name) => name.endsWith(".jpg")).length} production preview(s).`);
}

main().catch((error) => {
  console.error(`Production preview capture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
