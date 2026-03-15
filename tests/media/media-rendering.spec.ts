import { expect, test, type Page } from "@playwright/test";

import {
  getRepresentativeProjects,
  loadCanonicalProjects,
  pickDefaultProject,
  type CanonicalProject,
} from "./helpers/project-media-fixtures";
import { attachMediaContext, buildRuntimeContext } from "./helpers/media-diagnostics";

const projects = loadCanonicalProjects();
const representativeProjects = getRepresentativeProjects(projects);
const defaultProject = pickDefaultProject(projects);

const cardSelectorForProject = (projectId: string) =>
  `[data-testid="project-card-root"][data-project-id="${projectId}"], [data-testid="project-list-item-root"][data-project-id="${projectId}"]`;

test.describe("@smoke @matrix media rendering", () => {
  test("home route renders representative card media", async ({ page }, testInfo) => {
    await gotoHomeReady(page);

    const candidates = uniqueProjects([
      representativeProjects.banner,
      representativeProjects.poster,
      representativeProjects["thumbnail-only"],
      defaultProject,
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
        await expect(media.locator("img, video").first()).toBeVisible();
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
        await dots.nth(1).click();
        await expect(dots.nth(1)).toHaveAttribute("data-selected", "true");
      }
    } catch (error) {
      await attachMediaContext(testInfo, "media-context", context);
      throw error;
    }
  });

  test("modal route renders project banner/fallback media", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Modal validation is desktop-specific.");

    const project =
      representativeProjects.banner || representativeProjects.poster || representativeProjects["thumbnail-only"] || defaultProject;

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
        await page.goto(`/?project=${project.id}`);
        await expect(page.getByRole("heading", { name: "All Projects" })).toBeVisible({ timeout: 45_000 });
        await expect(modal).toBeVisible({ timeout: 10_000 });
      }

      if (hasAnyMedia(project, ["banner", "poster", "posterLandscape", "thumbnail"])) {
        const banner = modal.locator('[data-testid="project-modal-banner"]').first();
        await expect(banner).toBeVisible();
        await expect(banner.locator("img, video").first()).toBeVisible();
      }

      await expect(modal.getByRole("button", { name: "Go to Project Page" })).toBeVisible();
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
      await page.goto(route);

      const heading = page.getByRole("heading", { name: project.title }).first();
      await expect(heading).toBeVisible();

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

  test("project without images still renders without media crashes", async ({ page }, testInfo) => {
    const project = representativeProjects["no-images"];
    test.skip(!project, "No project without images found in canonical dataset.");

    const route = `/projects/${project!.id}`;
    await page.goto(route);

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

async function gotoHomeReady(page: Page): Promise<void> {
  const allProjectsHeading = page.getByRole("heading", { name: "All Projects" });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const projectsResponse = page.waitForResponse(
      (response) => response.url().includes("/projects/projects.json") && response.status() === 200,
      { timeout: 30_000 }
    );

    await page.goto("/");
    await projectsResponse;

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
