import { test } from "@playwright/test";

// Suppress production analytics explicitly before any page script runs.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__ = true; });
});

import "../better-workspace.spec";
