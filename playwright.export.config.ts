import { defineConfig, devices } from "@playwright/test";

/** Exercise the built files with Firebase-style clean URLs, without Next dev. */
export default defineConfig({
  testDir: "tests",
  testMatch: "reliability.spec.ts",
  workers: 2,
  timeout: 30000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3001", headless: true },
  webServer: {
    command: "python3 scripts/serve-export.py",
    port: 3001,
    reuseExistingServer: false,
    timeout: 30000,
    env: { NEXT_PUBLIC_ANALYTICS_DISABLED: "true" },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
