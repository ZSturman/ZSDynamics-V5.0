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
  test("overview opens the latest session, recent sessions, and project activity", async ({ page }) => {
    await page.goto("/work-logs");
    const latest = page.getByRole("button", { name: /Most recent session/ });
    await expect(latest).toBeVisible();
    await latest.click();
    const details = page.getByRole("dialog");
    await expect(details).toBeVisible();
    await expect(details.getByRole("button", { name: "Hide details" })).toHaveAttribute("aria-expanded", "true");
    await expect(details.getByRole("heading", { level: 2 })).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(details).not.toBeVisible();
    await expect(latest).toBeFocused();
    await page.getByTestId("recent-work-log-sessions").getByRole("button").nth(1).click();
    await expect(details).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await latest.click();
    await expect(details).toBeVisible();
    expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /View activity for/ }).first().click();
    await expect(page.getByRole("tab", { name: "Activity", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/project=/);
    await expect(page.getByTestId("work-log-activity-list")).toBeVisible();
  });

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
