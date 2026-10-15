import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "contact.spec.ts",
  timeout: 30000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3002", headless: true },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3002",
    port: 3002,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      NEXT_PUBLIC_ANALYTICS_DISABLED: "true",
    },
  },
});
