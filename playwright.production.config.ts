import { defineConfig, devices } from "@playwright/test";

const artifactDirectory = process.env.PORTFOLIO_QA_ARTIFACTS_DIR || "artifacts";

export default defineConfig({
  testDir: "tests/production",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: `${artifactDirectory}/playwright-production.json` }],
    ["html", { outputFolder: `${artifactDirectory}/playwright-production-html`, open: "never" }],
  ],
  outputDir: `${artifactDirectory}/test-results`,
  use: {
    baseURL: process.env.PORTFOLIO_QA_BASE_URL || "https://zacharysturman.com",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
