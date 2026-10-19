import { defineConfig, devices } from "@playwright/test";

const live = process.env.PORTFOLIO_RELEASE_BASE_URL;
export default defineConfig({
  testDir: "tests",
  testMatch: "3d-models-release.spec.ts",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: { baseURL: live || "http://127.0.0.1:3001", headless: true, screenshot: "only-on-failure" },
  webServer: live ? undefined : {
    command: "python3 scripts/serve-export.py", port: 3001,
    reuseExistingServer: false, timeout: 15_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
