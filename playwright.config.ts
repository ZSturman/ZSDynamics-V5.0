import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  // Production and media matrix suites have their own explicit configs. Keep
  // pre-push browser validation local and independent of a live deployment.
  // contact.spec.ts and analytics-journey.spec.ts need the mocked API from
  // playwright.contact.config.ts; under this config they would submit to production.
  testIgnore: ['media/**', 'production/**', 'contact.spec.ts', 'analytics-journey.spec.ts'],
  // Node unit tests (*.test.mjs) run under `npm run test:unit`, not Playwright.
  testMatch: '**/*.spec.ts',
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
    env: { NEXT_PUBLIC_ANALYTICS_DISABLED: 'true' },
  },
});
