import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/production",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/playwright-production.json" }],
    ["html", { outputFolder: "artifacts/playwright-production-html", open: "never" }],
  ],
  outputDir: "test-results/production",
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
