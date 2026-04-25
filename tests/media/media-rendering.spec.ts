import { expect, test } from "@playwright/test";

import {
  getProjectRoute,
  getRepresentativeProjects,
  loadCanonicalProjects,
  pickDefaultProject,
  type CanonicalProject,
} from "./helpers/project-media-fixtures";
import { attachMediaContext, buildRuntimeContext } from "./helpers/media-diagnostics";
import { gotoHomeReady, gotoProjectReady } from "../helpers/route-readiness";

const projects = loadCanonicalProjects();
const representativeProjects = getRepresentativeProjects(projects);
const homeVisibleProjects = projects.filter((project) => String(project.domain || "").toLowerCase() === "technology");
const homeRepresentativeProjects = getRepresentativeProjects(homeVisibleProjects);
const defaultHomeProject = pickDefaultProject(homeVisibleProjects);
const standaloneUrlAssetProject = findProjectWithStandaloneUrlAsset(projects);
const headerPreviewProject = findProjectWithHeaderPreview(projects);
const collectionVideoProject = findProjectWithCollectionVideo(projects);

const cardSelectorForProject = (projectId: string) =>
  `[data-testid="project-card-root"][data-project-id="${projectId}"], [data-testid="project-list-item-root"][data-project-id="${projectId}"]`;

test.describe("@smoke @matrix media rendering", () => {
  test.describe.configure({ timeout: 60_000 });

  test("home route renders representative card media", async ({ page }, testInfo) => {
    await gotoHomeReady(page);

    const candidates = uniqueProjects([
      homeRepresentativeProjects.hero,
      homeRepresentativeProjects.poster,
      homeRepresentativeProjects["thumbnail-only"],
      defaultHomeProject,
    ]).slice(0, 3);

    for (const project of candidates) {
      const context = buildRuntimeContext(page, testInfo, {
        scenario: "home-card-media",
        route: "/",
        projectId: project.id,
        projectTitle: project.title,
        environment: process.env.NODE_ENV || "test",
      });

      try {
        const card = page.locator(cardSelectorForProject(project.id)).first();
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();

        const media = card.locator('[data-testid="project-card-media"], [data-testid="project-list-item-media"]').first();
        await expect(media).toBeVisible();
        await expect(media.locator("img, video, [data-media-placeholder], [data-media-fallback]").first()).toBeVisible();
      } catch (error) {
        await attachMediaContext(testInfo, "media-context", context);
        throw error;
      }
    }
  });

  test("featured carousel media renders and can navigate slides", async ({ page }, testInfo) => {
    await gotoHomeReady(page);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "featured-carousel-media",
      route: "/",
      environment: process.env.NODE_ENV || "test",
    });

    try {
      const carousel = page.locator('[data-testid="featured-carousel"]').first();
      await expect(carousel).toBeVisible();

      const firstSlide = carousel.locator('[data-testid="featured-carousel-slide"]').first();
      await expect(firstSlide).toBeVisible();
      await expect(firstSlide.locator("img:visible, video:visible").first()).toBeVisible();

      const dots = carousel.locator('[data-testid="featured-carousel-dot"]');
      const dotCount = await dots.count();
      if (dotCount > 1) {
        if (testInfo.project.name.includes("mobile")) {
          await expect(dots.nth(1)).toBeVisible();
        } else {
          const secondDot = dots.nth(1);
          await expect(secondDot).toBeVisible();
          await secondDot.click();
          await expect(firstSlide.locator("img:visible, video:visible").first()).toBeVisible();
        }
      }
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("modal route renders project banner/fallback media", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Modal validation is desktop-specific.");

    const project =
      homeRepresentativeProjects.hero ||
      homeRepresentativeProjects.poster ||
      homeRepresentativeProjects["thumbnail-only"] ||
      defaultHomeProject;

    await gotoHomeReady(page);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "project-modal-media",
      route: `/?project=${project.id}`,
      projectId: project.id,
      projectTitle: project.title,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      const card = page.locator(cardSelectorForProject(project.id)).first();
      await card.scrollIntoViewIfNeeded();
      await card.click();

      const modal = page.locator('[data-testid="project-modal-content"]').first();
      try {
        await expect(modal).toBeVisible({ timeout: 5_000 });
      } catch {
        await gotoHomeReady(page, `/?project=${project.id}`);
        await expect(modal).toBeVisible({ timeout: 10_000 });
      }

      if (hasAnyMedia(project, ["banner", "poster", "posterLandscape", "thumbnail"])) {
        const banner = modal.locator('[data-testid="project-modal-banner"]').first();
        await expect(banner).toBeVisible();
        await expect(banner.locator("img, video").first()).toBeVisible();
      }

      await expect(modal.getByTestId("project-modal-open-project-button")).toBeVisible();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("project detail route renders expected media roles", async ({ page }, testInfo) => {
    const candidates = uniqueProjects([
      representativeProjects.hero,
      representativeProjects.poster,
      representativeProjects.banner,
      representativeProjects.icon,
      representativeProjects["thumbnail-only"],
    ]);

    for (const project of candidates) {
      const route = `/projects/${project.id}`;
      await gotoProjectReady(page, project.id, project.title);

      const requiredRoles = getRequiredRoles(project);
      for (const mediaKey of requiredRoles) {
        const context = buildRuntimeContext(page, testInfo, {
          scenario: "project-detail-media-role",
          route,
          projectId: project.id,
          projectTitle: project.title,
          mediaKey,
          environment: process.env.NODE_ENV || "test",
        });

        try {
          const media = page.locator(
            `[data-project-id=\"${project.id}\"][data-media-role=\"${mediaKey}\"] img, [data-project-id=\"${project.id}\"][data-media-role=\"${mediaKey}\"] video`
          );
          const count = await media.count();
          expect(count, `project media role not rendered on detail page: ${mediaKey}`).toBeGreaterThan(0);
        } catch (error) {
          await attachMediaContext(testInfo, "media-context", context);
          throw error;
        }
      }
    }
  });

  test("project header preview media opens in a fullscreen lightbox", async ({ page }, testInfo) => {
    test.skip(!headerPreviewProject, "No project with hero or poster preview media found in canonical dataset.");

    const project = headerPreviewProject!;
    const route = getProjectRoute(project);
    await gotoProjectReady(page, project.id, project.title, route);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "project-header-preview-lightbox",
      route,
      projectId: project.id,
      projectTitle: project.title,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      const trigger = page
        .locator(`[data-testid="project-header-media-trigger"][data-project-id="${project.id}"]`)
        .first();

      await expect(trigger).toBeVisible();
      const headerMediaRoute = `${route}?headerMedia=${getHeaderPreviewQueryValue(project)}`;
      await gotoProjectReady(page, project.id, project.title, headerMediaRoute);
      const lightbox = page.getByTestId("project-header-media-lightbox");
      await expect(lightbox).toBeVisible();
      await expect(lightbox.locator("img, video").first()).toBeVisible();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("collection video cards stay static and open in the fullscreen viewer", async ({ page }, testInfo) => {
    test.skip(!collectionVideoProject, "No project with collection-backed video items found in canonical dataset.");

    const { project, itemId, collectionName } = collectionVideoProject!;
    const route = getProjectRoute(project);
    await gotoProjectReady(page, project.id, project.title, route);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "collection-video-card-fullscreen",
      route,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: itemId,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      if (collectionName) {
        const tab = page.getByRole("tab", { name: collectionName }).first();
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
        }
      }

      const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
      await expect(card).toBeVisible();
      await expect(card.locator("video")).toHaveCount(0);

      const preview = card.getByTestId("collection-video-card-media");
      await expect(preview).toBeVisible();
      await expect(preview).toHaveAttribute("data-preview-state", "poster");
      const previewImage = preview.locator("img").first();
      await expect(previewImage).toHaveAttribute("src", /-thumb\.jpg/i);

      if (!testInfo.project.name.includes("mobile")) {
        await preview.hover();
        await expect(preview).toHaveAttribute("data-preview-state", "frames");
        await expect(previewImage).toHaveAttribute("src", /-preview-\d+\.jpg/i);
        const frameSrc = decodeURIComponent((await previewImage.getAttribute("src")) || "");
        expect(frameSrc).not.toContain("-optimized.webp");
      }

      await gotoProjectReady(page, project.id, project.title, `${route}?collectionItem=${itemId}`);

      const fullscreen = page.getByTestId("collection-fullscreen");
      await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
      await expect(fullscreen.locator("video").first()).toBeVisible();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("collection video cards remain static on narrow viewports", async ({ page }, testInfo) => {
    test.skip(!collectionVideoProject, "No project with collection-backed video items found in canonical dataset.");

    await page.setViewportSize({ width: 390, height: 844 });

    const { project, itemId, collectionName } = collectionVideoProject!;
    const route = getProjectRoute(project);
    await gotoProjectReady(page, project.id, project.title, route);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "collection-video-card-mobile-like",
      route,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: itemId,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      if (collectionName) {
        const tab = page.getByRole("tab", { name: collectionName }).first();
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
        }
      }

      const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
      await expect(card).toBeVisible();
      await expect(card.locator("video")).toHaveCount(0);

      const preview = card.getByTestId("collection-video-card-media");
      await expect(preview).toBeVisible();

      await gotoProjectReady(page, project.id, project.title, `${route}?collectionItem=${itemId}`);

      const fullscreen = page.getByTestId("collection-fullscreen");
      await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
      await expect(fullscreen.locator("video").first()).toBeVisible();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("project without images still renders without media crashes", async ({ page }, testInfo) => {
    const project = representativeProjects["no-images"];
    test.skip(!project, "No project without images found in canonical dataset.");

    const route = `/projects/${project!.id}`;
    await gotoProjectReady(page, project!.id, project!.title);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "project-no-image-route",
      route,
      projectId: project!.id,
      projectTitle: project!.title,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      await expect(page.getByRole("heading", { name: project!.title }).first()).toBeVisible();

      const renderedMedia = page.locator(`[data-project-id="${project!.id}"][data-media-role] img, [data-project-id="${project!.id}"][data-media-role] video`);
      await expect(renderedMedia).toHaveCount(0);
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("project detail route renders standalone URL asset preview state", async ({ page }, testInfo) => {
    test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical dataset.");

    const { project, asset } = standaloneUrlAssetProject!;
    const route = getProjectRoute(project);
    await gotoProjectReady(page, project.id, project.title, route);

    const context = buildRuntimeContext(page, testInfo, {
      scenario: "project-standalone-url-asset-preview",
      route,
      projectId: project.id,
      projectTitle: project.title,
      mediaKey: asset.id,
      environment: process.env.NODE_ENV || "test",
    });

    try {
      const assetCard = page
        .locator(
          `[data-testid="project-standalone-assets"][data-project-id="${project.id}"] ` +
            `[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`
        )
        .first();

      await expect(assetCard).toBeVisible();
      await expect(assetCard.locator("[data-link-preview-state]").first()).toBeVisible();
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });
});

function uniqueProjects(items: Array<CanonicalProject | undefined>): CanonicalProject[] {
  const map = new Map<string, CanonicalProject>();
  for (const item of items) {
    if (!item) continue;
    map.set(item.id, item);
  }
  return [...map.values()];
}

function hasAnyMedia(project: CanonicalProject, keys: string[]): boolean {
  return keys.some((key) => Boolean(project.images?.[key]));
}

function getRequiredRoles(project: CanonicalProject): string[] {
  const required = new Set<string>();

  if (project.images?.hero) required.add("hero");
  if (project.images?.banner) required.add("banner");
  if (project.images?.icon) required.add("icon");
  if (project.images?.poster && !project.images?.banner) required.add("poster");

  if (required.size === 0 && project.images?.thumbnail) {
    required.add("thumbnail");
  }

  return [...required];
}

function findProjectWithStandaloneUrlAsset(projects: CanonicalProject[]) {
  for (const project of projects) {
    const assets = Array.isArray(project.assets) ? (project.assets as Array<Record<string, unknown>>) : [];
    const asset = assets.find((item) => {
      if (!item || typeof item !== "object") return false;
      const type = typeof item.type === "string" ? item.type : "";
      const url = typeof item.url === "string" ? item.url : "";
      return (type === "url-link" || type === "local-link" || type === "folio") && Boolean(url);
    });

    if (asset) {
      return {
        project,
        asset: asset as { id: string },
      };
    }
  }

  return undefined;
}

function findProjectWithHeaderPreview(projects: CanonicalProject[]) {
  return projects.find((project) => {
    return Boolean(project.images?.hero || project.images?.posterPortrait || project.images?.poster);
  });
}

function findProjectWithCollectionVideo(projects: CanonicalProject[]) {
  for (const project of projects) {
    const collections = (project.collection as Record<string, unknown> | undefined) || {};

    for (const [collectionName, value] of Object.entries(collections)) {
      const items = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as { items?: unknown[] }).items)
        ? ((value as { items: unknown[] }).items)
        : [];

      const videoItem = items.find((item) => {
        if (!item || typeof item !== "object") return false;
        return (item as { type?: string }).type === "video" && typeof (item as { id?: string }).id === "string";
      }) as { id: string } | undefined;

      if (videoItem) {
        return {
          project,
          itemId: videoItem.id,
          collectionName,
        };
      }
    }
  }

  return undefined;
}

function getHeaderPreviewQueryValue(project: CanonicalProject): string {
  if (project.images?.hero) {
    return "hero";
  }

  if (project.images?.posterPortrait) {
    return "posterPortrait";
  }

  return "poster";
}
