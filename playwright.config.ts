import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: 'list',
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:3001',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    port: 3001,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
