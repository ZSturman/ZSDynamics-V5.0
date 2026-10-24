import { defineConfig } from "@playwright/test";

const liveURL = process.env.PORTFOLIO_ACCESS_BASE_URL;
export default defineConfig({
  testDir: "tests",
  testMatch: "project-access.spec.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: { headless: true, baseURL: liveURL || "http://127.0.0.1:3001" },
  webServer: liveURL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    port: 3001,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
