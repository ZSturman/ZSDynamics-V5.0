import { expect, test } from "@playwright/test";

import {
  enumerateProjectMediaEntries,
  getRepresentativeProjects,
  loadCanonicalProjects,
  pickDefaultProject,
} from "./helpers/project-media-fixtures";
import {
  attachMediaContext,
  buildRuntimeContext,
  trackMediaRuntimeIssues,
} from "./helpers/media-diagnostics";

const canonicalProjects = loadCanonicalProjects();
const mediaEntries = enumerateProjectMediaEntries(canonicalProjects);
const representativeProjects = getRepresentativeProjects(canonicalProjects);
const defaultProject = pickDefaultProject(canonicalProjects);

test.describe("@smoke @matrix media resilience", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Fault-injection resilience checks run on Chromium only for deterministic diagnostics."
    );
  });

  test("home remains usable when projects.json contains a broken thumbnail", async ({ page }, testInfo) => {
    const project = representativeProjects["thumbnail-only"] || defaultProject;
    const brokenRelativePath = "missing-media-asset-for-resilience-check.png";

    await page.route("**/projects/projects.json", async (route) => {
      const mutated = canonicalProjects.map((item) => ({ ...item }));
      const target = mutated.find((item) => item.id === project.id);
      if (target) {
        target.images = {
          ...(target.images || {}),
          thumbnail: brokenRelativePath,
        };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mutated),
      });
    });

    const tracker = trackMediaRuntimeIssues(page);
    const folderName = typeof project.folderName === "string" && project.folderName.trim() ? project.folderName : project.id;
    const expectedBrokenUrl = `/projects/${folderName}/${toOptimizedImagePath(brokenRelativePath)}`;
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "resilience-broken-thumbnail-from-projects-json",
      route: "/",
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: "thumbnail",
      resolvedUrl: expectedBrokenUrl,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoHomeReady(page);

      const card = page
        .locator(
          `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
        )
        .first();
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      await page.waitForTimeout(1000);
      const probe = await page.request.get(expectedBrokenUrl);
      const hasFailure =
        probe.status() >= 400 ||
        tracker.failedResponses.some((failure) => failure.url.includes(expectedBrokenUrl)) ||
        tracker.failedRequests.some((failure) => failure.url.includes(expectedBrokenUrl));
      expect(hasFailure, "broken thumbnail should surface as a media request failure").toBeTruthy();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", {
        ...context,
        failedResponses: tracker.failedResponses,
        failedRequests: tracker.failedRequests,
        consoleErrors: tracker.consoleErrors,
        pageErrors: tracker.pageErrors,
      });
      throw error;
    } finally {
      tracker.stop();
    }
  });

  test("project route stays usable when a media request returns 500", async ({ page }, testInfo) => {
    const project = representativeProjects.banner || representativeProjects.poster || defaultProject;
    const entry = findEntryForProject(project.id, ["banner", "poster", "thumbnail"]);
    test.skip(!entry, "No renderable media entry found for resilience 500 check.");

    await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "forced-media-failure",
      });
    });

    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "resilience-forced-500",
      route: `/projects/${project.id}`,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: entry!.mediaKey,
      resolvedUrl: entry!.resolvedUrl,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoProjectReady(page, project.id, project.title);

      await page.waitForTimeout(500);
      expect(
        tracker.failedResponses.some((failure) => failure.status === 500 && mediaRequestMatches(failure.url, entry!.resolvedUrl)) ||
          tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl)),
        "forced 500 media response should be captured in diagnostics"
      ).toBeTruthy();
      const unexpectedPageErrors = tracker.pageErrors.filter(
        (pageError) => !isExpectedForcedMediaPageError(pageError.message)
      );
      expect(unexpectedPageErrors, "media failures should not trigger page-level crashes").toHaveLength(0);
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", {
        ...context,
        failedResponses: tracker.failedResponses,
        failedRequests: tracker.failedRequests,
        consoleErrors: tracker.consoleErrors,
        pageErrors: tracker.pageErrors,
      });
      throw error;
    } finally {
      tracker.stop();
    }
  });

  test("project route tolerates delayed media responses", async ({ page }, testInfo) => {
    const project = representativeProjects.hero || representativeProjects.banner || representativeProjects.poster || defaultProject;
    const entry = findEntryForProject(project.id, ["hero", "banner", "poster", "thumbnail"]);
    test.skip(!entry, "No renderable media entry found for delayed media check.");

    await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "resilience-delayed-media",
      route: `/projects/${project.id}`,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: entry!.mediaKey,
      resolvedUrl: entry!.resolvedUrl,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoProjectReady(page, project.id, project.title);

      const media = page
        .locator(
          `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] img, [data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] video`
        )
        .first();
      await expect(media).toBeVisible();
      expect(tracker.pageErrors, "delayed media should not trigger page errors").toHaveLength(0);
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", {
        ...context,
        failedResponses: tracker.failedResponses,
        failedRequests: tracker.failedRequests,
        consoleErrors: tracker.consoleErrors,
        pageErrors: tracker.pageErrors,
      });
      throw error;
    } finally {
      tracker.stop();
    }
  });
});

function findEntryForProject(projectId: string, keys: string[]) {
  for (const key of keys) {
    const entry = mediaEntries.find((item) => item.projectId === projectId && item.mediaKey === key);
    if (entry) return entry;
  }
  return undefined;
}

function toOptimizedImagePath(value: string): string {
  if (!value.includes(".")) return `${value}-optimized.webp`;
  if (value.match(/\.svg$/i)) return value.replace(/\.[^.]+$/, "-optimized.svg");
  return value.replace(/\.[^.]+$/, "-optimized.webp");
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExpectedForcedMediaPageError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid or unexpected token") ||
    normalized.includes("unexpected end of json input")
  );
}

async function gotoHomeReady(page: import("@playwright/test").Page): Promise<void> {
  const allProjectsHeading = page.getByRole("heading", { name: "All Projects" });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto("/");

    try {
      await expect(allProjectsHeading).toBeVisible({ timeout: 45_000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error("Home route did not become ready: 'All Projects' heading was not visible after retry.");
      }

      await page.reload();
    }
  }
}

async function gotoProjectReady(page: import("@playwright/test").Page, projectId: string, projectTitle: string): Promise<void> {
  const route = `/projects/${projectId}`;
  const heading = page.getByRole("heading", { name: projectTitle }).first();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(route);

    try {
      await expect(heading).toBeVisible({ timeout: 15_000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error(`Project route did not become ready for '${projectTitle}' after retry.`);
      }

      await page.reload();
    }
  }
}

function mediaRequestMatches(requestUrl: string, assetUrl: string): boolean {
  return requestUrl.includes(assetUrl) || requestUrl.includes(encodeURIComponent(assetUrl));
}
