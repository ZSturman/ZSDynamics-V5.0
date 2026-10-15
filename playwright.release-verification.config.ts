import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the production export without development compilation/HMR races.
export default defineConfig({
  ...base,
  workers: 1,
  webServer: {
    command: "python3 scripts/serve-export.py",
    port: 3001,
    reuseExistingServer: false,
    timeout: 15000,
  },
});
