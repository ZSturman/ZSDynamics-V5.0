#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const out = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token || !token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "true";
      continue;
    }

    out[key] = value;
    index += 1;
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  const output = args.output;
  const timeoutMs = Number.parseInt(args["timeout-ms"] || "12000", 10);

  if (!url || !output) {
    console.error(JSON.stringify({ ok: false, message: "Missing required --url or --output argument." }));
    process.exit(2);
  }

  const screenshotType = output.toLowerCase().endsWith(".jpeg") || output.toLowerCase().endsWith(".jpg")
    ? "jpeg"
    : "png";

  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "en-US",
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (compatible; portfolio-prebuild/1.0; +https://zachary-sturman.com)",
    });
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`Navigation failed with status ${status}`);
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 3000) });
    } catch {
      // Ignore slow third-party resources and capture the current viewport instead.
    }

    await page.waitForTimeout(900);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await page.screenshot({
      path: output,
      type: screenshotType,
      fullPage: false,
      animations: "disabled",
    });

    console.log(JSON.stringify({ ok: true, status, title: await page.title() }));
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

await main();