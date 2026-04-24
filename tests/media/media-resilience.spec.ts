import { expect, test } from "@playwright/test";

import {
  enumerateProjectMediaEntries,
  getProjectRoute,
  getProjectSlug,
  getRepresentativeProjects,
  loadCanonicalProjects,
  pickDefaultProject,
} from "./helpers/project-media-fixtures";
import {
  attachMediaContext,
  buildRuntimeContext,
  trackMediaRuntimeIssues,
} from "./helpers/media-diagnostics";
import { gotoHomeReady, gotoProjectReady } from "../helpers/route-readiness";

const canonicalProjects = loadCanonicalProjects();
const mediaEntries = enumerateProjectMediaEntries(canonicalProjects);
const representativeProjects = getRepresentativeProjects(canonicalProjects);
const defaultProject = pickDefaultProject(canonicalProjects);
const standaloneUrlAssetProject = findProjectWithStandaloneUrlAsset(canonicalProjects);
const captureBackedStandaloneUrlAssetProject = findProjectWithStandaloneUrlAsset(canonicalProjects, {
  requireCapturePreview: true,
});
const collectionVideoProject = findProjectWithCollectionVideo(canonicalProjects);

test.describe("@smoke @matrix media resilience", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Fault-injection resilience checks run on Chromium only for deterministic diagnostics."
    );
  });

  test("home remains usable when a card thumbnail request fails", async ({ page }, testInfo) => {
    const project = representativeProjects["thumbnail-only"] || defaultProject;
    const entry = findEntryForProject(project.id, ["thumbnail"]);
    test.skip(!entry, "No thumbnail media entry found for home resilience check.");

    await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "forced-home-thumbnail-failure",
      });
    });

    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "resilience-broken-home-thumbnail-request",
      route: "/",
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: "thumbnail",
      resolvedUrl: entry!.resolvedUrl,
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
      await expect(
        card
          .locator('[data-testid="project-card-media"], [data-testid="project-list-item-media"]')
          .first()
          .locator('[data-media-fallback="true"], [data-media-placeholder="true"]')
          .first()
      ).toBeVisible();

      await page.waitForTimeout(1000);
      const hasFailure =
        tracker.failedResponses.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl)) ||
        tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl));
      expect(hasFailure, "forced broken thumbnail should surface as a media request failure").toBeTruthy();
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
      await expect(
        page
          .locator(
            `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] [data-media-fallback="true"], ` +
              `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] [data-media-placeholder="true"]`
          )
          .first()
      ).toBeVisible();
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
      const unexpectedPageErrors = tracker.pageErrors.filter(
        (pageError) => !isExpectedForcedMediaPageError(pageError.message)
      );
      expect(unexpectedPageErrors, "delayed media should not trigger unexpected page errors").toHaveLength(0);
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

  test("standalone URL asset falls back gracefully on the project detail route", async ({ page }, testInfo) => {
    test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical projects.");

    const { project, asset } = standaloneUrlAssetProject!;
    const expectedState = getExpectedStandaloneAssetState(asset);
    await page.route((url) => standaloneAssetUrlMatches(url.toString(), asset.url), async (route) => {
      await route.fulfill(buildBlockedIframeResponse(503));
    });

    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "standalone-url-asset-fallback-project-route",
      route: getProjectRoute(project),
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: asset.id,
      resolvedUrl: asset.url,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));

      const assetCard = page
        .locator(
          `[data-testid="project-standalone-assets"][data-project-id="${project.id}"] ` +
            `[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`
        )
        .first();
      await expect(assetCard).toBeVisible();
      await expect(assetCard.locator(`[data-link-preview-state="${expectedState}"]`).first()).toBeVisible();
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

  test("collection fullscreen viewer falls back cleanly when the video asset is unreadable", async ({ page }, testInfo) => {
    test.skip(!collectionVideoProject, "No collection-backed video item found in canonical projects.");
    test.skip(
      testInfo.project.name.includes("mobile"),
      "Fullscreen fallback fault injection is covered on Chromium desktop for determinism."
    );

    const { project, item, itemId, videoUrl } = collectionVideoProject!;
    test.skip(!videoUrl, "Collection video item does not expose a predictable source path.");

    await page.route((url) => mediaRequestMatches(url.toString(), videoUrl), async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "forced-collection-video-failure",
      });
    });

    const tracker = trackMediaRuntimeIssues(page);
    const fullscreenRoute = `${getProjectRoute(project)}?collectionItem=${itemId}`;
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "collection-video-fullscreen-fallback",
      route: fullscreenRoute,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: itemId,
      resolvedUrl: videoUrl,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoProjectReady(page, project.id, project.title, fullscreenRoute);
      const fullscreen = page.getByTestId("collection-fullscreen");
      const openedFromRoute = await fullscreen.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!openedFromRoute) {
        const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
        await expect(card).toBeVisible();
        await card.click();
      }

      await expect(fullscreen).toBeVisible();
      await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
      await expect(fullscreen.getByTestId("collection-video-content-fallback")).toBeVisible();
      await expect(fullscreen.locator("video")).toHaveCount(0);

      const hasFailure =
        tracker.failedResponses.some((failure) => mediaRequestMatches(failure.url, videoUrl)) ||
        tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, videoUrl));
      expect(hasFailure, "forced collection video failure should be visible in diagnostics").toBeTruthy();

      const fallbackSource = await fullscreen
        .getByTestId("collection-video-content-fallback")
        .getAttribute("data-fallback-source");
      expect(["poster", "placeholder"]).toContain(fallbackSource);
      expect(item, "collection item should remain available for fallback rendering").toBeTruthy();
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

  test("capture-backed standalone URL previews skip iframe requests and use optimized preview assets", async ({ page }, testInfo) => {
    test.skip(!captureBackedStandaloneUrlAssetProject, "No capture-backed standalone URL asset found in canonical projects.");

    const { project, asset } = captureBackedStandaloneUrlAssetProject!;
    let capturedRequestCount = 0;

    await page.route((url) => standaloneAssetUrlMatches(url.toString(), asset.url), async (route) => {
      capturedRequestCount += 1;
      await route.abort("failed");
    });

    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "standalone-url-asset-capture-preview",
      route: getProjectRoute(project),
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: asset.id,
      resolvedUrl: asset.url,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));

      const assetCard = page
        .locator(
          `[data-testid="project-standalone-assets"][data-project-id="${project.id}"] ` +
            `[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`
        )
        .first();
      await expect(assetCard).toBeVisible();
      await expect(assetCard.locator('[data-link-preview-state="thumbnail"]').first()).toBeVisible();

      const previewImage = assetCard.locator('[data-link-preview-state="thumbnail"] img').last();
      await expect(previewImage).toBeVisible();
      const imageSrc = decodeURIComponent((await previewImage.getAttribute("src")) || "");
      expect(
        imageSrc,
        "capture-backed preview should render the normalized optimized asset path"
      ).toContain("-optimized.webp");

      await page.waitForTimeout(500);
      expect(capturedRequestCount, "capture-backed previews should skip iframe network requests").toBe(0);
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

  test("standalone URL asset falls back gracefully inside the project modal", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Modal validation is desktop-specific.");
    test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical projects.");

    const { project, asset } = standaloneUrlAssetProject!;
    const expectedState = getExpectedStandaloneAssetState(asset);
    const tracker = trackMediaRuntimeIssues(page);
    const context = buildRuntimeContext(page, testInfo, {
      scenario: "standalone-url-asset-fallback-modal",
      route: `/?project=${getProjectSlug(project)}`,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: asset.id,
      resolvedUrl: asset.url,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await gotoHomeReady(page);
      await page.route((url) => standaloneAssetUrlMatches(url.toString(), asset.url), async (route) => {
        await route.fulfill(buildBlockedIframeResponse(503));
      });

      const card = page
        .locator(
          `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
        )
        .first();
      await card.scrollIntoViewIfNeeded();
      await card.click({ position: { x: 40, y: 40 } });

      const modal = page.locator('[data-testid="project-modal-content"]').first();
      try {
        await expect(page).toHaveURL(new RegExp(`\\/?(?:.*&)?project=${getProjectSlug(project)}(?:&.*)?$`));
        await expect(modal).toBeVisible({ timeout: 5_000 });
      } catch {
        await gotoHomeReady(page, `/?project=${project.id}`);
        await expect(modal).toBeVisible({ timeout: 10_000 });
      }

      const assetCard = modal
        .locator(`[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`)
        .first();
      await expect(assetCard).toBeVisible();
      await expect(assetCard.locator("[data-link-preview-state]").first()).toBeVisible();
      if (expectedState === "fallback") {
        await expect(assetCard.getByRole("button", { name: /open (site|link|page)/i }).first()).toBeVisible();
      } else {
        await expect(assetCard.getByRole("button").first()).toBeVisible();
      }
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

function isExpectedForcedMediaPageError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid or unexpected token") ||
    normalized.includes("unexpected end of json input")
  );
}


function mediaRequestMatches(requestUrl: string, assetUrl: string): boolean {
  const normalizedRequestUrl = normalizeUrlForMatch(requestUrl);
  const normalizedAssetUrl = normalizeUrlForMatch(assetUrl);
  return normalizedRequestUrl.includes(normalizedAssetUrl);
}

function normalizeUrlForMatch(value: string): string {
  try {
    const parsed = new URL(value, "http://127.0.0.1");
    return decodeURIComponent(`${parsed.pathname}${parsed.search}`);
  } catch {
    return decodeURIComponent(value);
  }
}

function standaloneAssetUrlMatches(requestUrl: string, assetUrl: string): boolean {
  try {
    const request = new URL(requestUrl);
    const asset = new URL(assetUrl, "http://127.0.0.1");
    return (
      request.origin === asset.origin &&
      normalizePathWithSearch(request.pathname, request.search) === normalizePathWithSearch(asset.pathname, asset.search)
    );
  } catch {
    return normalizeUrlForMatch(requestUrl) === normalizeUrlForMatch(assetUrl);
  }
}

function normalizePathWithSearch(pathname: string, search: string): string {
  const normalizedPath = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return `${normalizedPath}${search}`;
}

function findProjectWithCollectionVideo(projects: Array<Record<string, unknown>>) {
  for (const project of projects) {
    const collections =
      project.collection && typeof project.collection === "object"
        ? (project.collection as Record<string, unknown>)
        : {};
    const folderName =
      typeof project.folderName === "string" && project.folderName.trim()
        ? project.folderName
        : typeof project.id === "string"
        ? project.id
        : undefined;

    if (!folderName || typeof project.id !== "string" || typeof project.title !== "string") {
      continue;
    }

    for (const [collectionName, value] of Object.entries(collections)) {
      const items = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as { items?: unknown[] }).items)
        ? (value as { items: unknown[] }).items
        : [];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const normalizedItem = item as {
          id?: unknown;
          type?: unknown;
          filePath?: unknown;
          path?: unknown;
          relativePath?: unknown;
        };

        if (normalizedItem.type !== "video" || typeof normalizedItem.id !== "string") {
          continue;
        }

        const sourcePath = extractPathValue(normalizedItem.filePath)
          ?? extractPathValue(normalizedItem.path)
          ?? extractPathValue(normalizedItem.relativePath);
        const videoUrl = sourcePath
          ? sourcePath.startsWith("/")
            ? sourcePath.replace(/\.[^.]+$/, "-optimized.mp4")
            : `/projects/${folderName}/${collectionName}/${normalizedItem.id}/${sourcePath.replace(/\.[^.]+$/, "-optimized.mp4")}`
          : null;

        return {
          project: project as {
            id: string;
            title: string;
            slug?: string;
            href?: string;
            folderName?: string;
          },
          item,
          itemId: normalizedItem.id,
          collectionName,
          videoUrl,
        };
      }
    }
  }

  return undefined;
}

function extractPathValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as { path?: unknown }).path;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function buildBlockedIframeResponse(status: number) {
  return {
    status,
    contentType: "text/html; charset=utf-8",
    headers: {
      "X-Frame-Options": "DENY",
    },
    body: "<html><head><title>Denied</title></head><body></body></html>",
  };
}

type StandaloneUrlAsset = {
  id: string;
  url: string;
  thumbnail?: string;
  linkPreview?: { imageSource?: string };
};

type StandaloneUrlAssetProject = {
  project: typeof canonicalProjects[number];
  asset: StandaloneUrlAsset;
};

function findProjectWithStandaloneUrlAsset(
  projects: Array<Record<string, unknown>>,
  options: { preferNoCapturePreview?: boolean; requireCapturePreview?: boolean } = {}
): StandaloneUrlAssetProject | undefined {
  const candidates: StandaloneUrlAssetProject[] = [];

  for (const project of projects) {
    const assets = Array.isArray(project.assets) ? (project.assets as Array<Record<string, unknown>>) : [];
    const matchingAssets = assets.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const type = typeof item.type === "string" ? item.type : "";
      const url = typeof item.url === "string" ? item.url : "";
      return (type === "url-link" || type === "local-link" || type === "folio") && Boolean(url);
    });

    for (const asset of matchingAssets) {
      candidates.push({
        project: project as typeof canonicalProjects[number],
        asset: asset as StandaloneUrlAsset,
      });
    }
  }

  if (options.requireCapturePreview) {
    return candidates.find(({ asset }) => hasCaptureBackedPreview(asset));
  }

  if (options.preferNoCapturePreview) {
    return candidates.find(({ asset }) => !hasCaptureBackedPreview(asset)) || candidates[0];
  }

  return candidates[0];
}

function hasCaptureBackedPreview(asset: { thumbnail?: string; linkPreview?: { imageSource?: string } }): boolean {
  const hasThumbnail = typeof asset.thumbnail === "string" && asset.thumbnail.trim().length > 0;
  return hasThumbnail || asset.linkPreview?.imageSource === "capture";
}

function getExpectedStandaloneAssetState(asset: { thumbnail?: string; linkPreview?: { imageSource?: string } }): "thumbnail" | "fallback" {
  if (hasCaptureBackedPreview(asset)) {
    return "thumbnail";
  }

  return "fallback";
}
