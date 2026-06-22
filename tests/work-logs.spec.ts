import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { gotoHomeReady } from "./helpers/route-readiness";

async function getFrameBox(page: Page, route: string, heading: RegExp | string) {
  await page.goto(route);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();

  const frame = page.getByTestId("site-page-frame");
  await expect(frame).toBeVisible();

  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test.describe("Work Logs Page", () => {
  test("home, articles, and work logs share the same outer page frame", async ({ page }) => {
    await gotoHomeReady(page);

    const homeFrame = await page.getByTestId("site-page-frame").boundingBox();
    expect(homeFrame).not.toBeNull();

    const articlesFrame = await getFrameBox(page, "/articles", "Articles");
    const workLogsFrame = await getFrameBox(page, "/work-logs", /Work Logs/);

    expect(Math.abs(homeFrame!.x - articlesFrame.x)).toBeLessThan(3);
    expect(Math.abs(homeFrame!.width - articlesFrame.width)).toBeLessThan(3);

    expect(Math.abs(homeFrame!.x - workLogsFrame.x)).toBeLessThan(3);
    expect(Math.abs(homeFrame!.width - workLogsFrame.width)).toBeLessThan(3);
  });

  test("work logs route renders inside the shared page frame", async ({ page }) => {
    await page.goto("/work-logs");

    await expect(page.getByRole("heading", { name: /Work Logs/ })).toBeVisible();
    await expect(page.getByTestId("site-page-frame")).toBeVisible();
  });
});
