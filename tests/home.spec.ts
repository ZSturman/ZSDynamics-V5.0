import { expect, test, type Page } from "@playwright/test";

import { getProjectRoute, getProjectSlug, loadCanonicalProjects } from "./media/helpers/project-media-fixtures";
import { gotoHomeReady } from "./helpers/route-readiness";

const canonicalProjects = loadCanonicalProjects();
const technologyProjects = canonicalProjects.filter(
  (project) => String(project.domain || "").toLowerCase() === "technology"
);
const defaultTechnologyProject =
  technologyProjects.find((project) => Boolean(project.images?.thumbnail)) || technologyProjects[0];
const hiddenNonTechnologyProject = canonicalProjects.find(
  (project) => String(project.domain || "").toLowerCase() !== "technology"
);
const featuredHeroProject = canonicalProjects.find(
  (project) => Boolean(project.featured) && Boolean(project.images?.hero)
);
const featuredProjects = canonicalProjects
  .filter((project) => Boolean(project.featured))
  .sort((left, right) => {
    const leftOrder = typeof left.featuredOrder === "number" ? left.featuredOrder : Number.POSITIVE_INFINITY;
    const rightOrder = typeof right.featuredOrder === "number" ? right.featuredOrder : Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder;
  });
const firstFeaturedProject = featuredProjects[0];
const technologyProjectWithResources = technologyProjects.find(
  (project) => Array.isArray(project.resources) && project.resources.length > 0
);
const technologyProjectWithResourcesAndTags = technologyProjects.find(
  (project) =>
    Array.isArray(project.resources) &&
    project.resources.length > 0 &&
    Array.isArray(project.tags) &&
    project.tags.length > 0
);

test.describe("Homepage", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await gotoHomeReady(page);
  });

  test("uses the shared site page frame", async ({ page }) => {
    const frame = page.getByTestId("site-page-frame");
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });

  test("should display the portfolio header", async ({ page }) => {
    const header = page.locator("header").first();
    await expect(header.getByRole("heading", { name: "Zachary Sturman" })).toBeVisible();
    await expect(
      header.getByRole("heading", { name: /I think a lot about how design influences trust/i })
    ).toBeVisible();
  });

  test("defaults to technology projects without grouping", async ({ page }) => {
    test.skip(!defaultTechnologyProject, "A technology project fixture is required for this regression.");

    await expect(
      page
        .locator(
          `[data-testid="project-card-root"][data-project-id="${defaultTechnologyProject!.id}"], [data-testid="project-list-item-root"][data-project-id="${defaultTechnologyProject!.id}"]`
        )
        .first()
    ).toBeVisible();

    if (hiddenNonTechnologyProject) {
      await expect(
        page.locator(
          `[data-testid="project-card-root"][data-project-id="${hiddenNonTechnologyProject.id}"], [data-testid="project-list-item-root"][data-project-id="${hiddenNonTechnologyProject.id}"]`
        )
      ).toHaveCount(0);
    }

    await expect(page.getByTestId("project-group-list")).toHaveCount(0);
    await expect(page.getByTestId("project-list-group-heading")).toHaveCount(0);
  });

  test("can still group projects by status manually", async ({ page }) => {
    await openGroupOptions(page);
    await page.getByRole("menuitemradio", { name: "Status" }).click();

    await expect(page).toHaveURL(/(?:\?|&)group=status(?:&|$)/);
    await expect(page.getByTestId("project-group-list")).toBeVisible();

    const groupHeadings = await page.getByTestId("project-list-group-heading").allTextContents();
    expect(groupHeadings[0]).toBe("Complete");
    expect(groupHeadings).toContain("Active");
  });

  test("featured carousel prefers hero media when it is available", async ({ page }) => {
    test.skip(!featuredHeroProject, "A featured project with hero media is required for this regression.");

    await expect(
      page
        .locator(`[data-testid="featured-carousel-media"][data-project-id="${featuredHeroProject!.id}"]`)
        .first()
    ).toHaveAttribute("data-media-role", "hero");
  });

  test("should open the project modal when clicking a project", async ({ page }) => {
    test.skip(!technologyProjectWithResources, "A visible technology project with resources is required for this regression.");

    const modalProject = technologyProjectWithResources!;
    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${modalProject.id}"], [data-testid="project-list-item-root"][data-project-id="${modalProject.id}"]`
      )
      .first();
    await card.getByRole("heading", { name: modalProject.title }).first().click();

    await expect(page).toHaveURL(new RegExp(`\\/?(?:.*&)?project=${getProjectSlug(modalProject)}(?:&.*)?$`));
    await expect(page.locator('[data-testid="project-modal-content"]').first()).toBeVisible();
    await expect(page.getByTestId("project-modal-open-project-button")).toBeVisible();
    await expect(
      page.locator('[data-testid="project-modal-content"]').getByTestId("project-header-resource-row")
    ).toHaveCount(1);
  });

  test("mobile project list taps navigate directly to the project page", async ({ page }) => {
    test.skip(!defaultTechnologyProject, "A technology project fixture is required for this regression.");

    const project = defaultTechnologyProject!;
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHomeReady(page);

    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
      )
      .first();
    await card.getByRole("heading", { name: project.title }).first().click();

    await expect(page).toHaveURL(new RegExp(`${getProjectRoute(project)}$`));
    await expect(page.locator('[data-testid="project-modal-content"]')).toHaveCount(0);
  });

  test("mobile featured carousel taps navigate directly to the project page", async ({ page }) => {
    test.skip(!firstFeaturedProject, "A featured project fixture is required for this regression.");

    const project = firstFeaturedProject!;
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHomeReady(page);

    await page
      .locator(`[data-testid="featured-carousel-slide"][data-project-id="${project.id}"]`)
      .first()
      .click();

    await expect(page).toHaveURL(new RegExp(`${getProjectRoute(project)}$`));
    await expect(page.locator('[data-testid="project-modal-content"]')).toHaveCount(0);
  });

  test("project resource icons stay interactive in list view", async ({ page }) => {
    test.skip(
      !technologyProjectWithResourcesAndTags,
      "A visible technology project with both resources and tags is required for this regression."
    );

    const project = technologyProjectWithResourcesAndTags!;
    const tags = project.tags as string[];
    const resources = project.resources as Array<{ label: string }>;
    const firstTag = tags[0]!;
    const firstResource = resources[0]!;
    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
      )
      .first();

    const resourceIcons = card.getByTestId("project-list-item-resource-icons");
    const title = card.getByRole("heading", { name: project.title }).first();
    await expect(resourceIcons).toBeVisible();
    await expect(title).toBeVisible();

    await expect(
      card
        .locator('[data-slot="passive-chip"], [data-slot="metadata-tag"]')
        .filter({ hasText: firstTag })
    ).toHaveCount(1);
    await expect(card.getByRole("button", { name: firstTag })).toHaveCount(0);
    await expect(card.getByRole("link", { name: firstTag })).toHaveCount(0);

    const resourceButton = resourceIcons.getByRole("button").first();
    await expect(resourceButton).toBeVisible();
    await expect(resourceIcons.getByRole("button", { name: firstResource.label }).first()).toBeVisible();
    await resourceButton.focus();
    await expect(resourceButton).toBeFocused();
  });

  test("status and domain filters can stack without getting stuck", async ({ page }) => {
    await openFilterOptions(page);
    await expect(page.getByRole("menuitemcheckbox", { name: "Complete" }).first()).toBeVisible();
    await page.getByRole("menuitemcheckbox", { name: "Complete" }).first().click();

    await openFilterOptions(page);
    await expect(page.getByRole("menuitemcheckbox", { name: "Artistic" }).first()).toBeVisible();
    await page.getByRole("menuitemcheckbox", { name: "Artistic" }).first().click();

    const activeFilters = page.getByTestId("project-active-filters");
    await expect(activeFilters).toContainText("Status: Complete");
    await expect(activeFilters).toContainText("Domain: Artistic");
  });
});

async function openFilterOptions(page: Page): Promise<void> {
  await page.getByTestId("project-view-options-trigger").click();
  const allStatuses = page.getByRole("menuitemcheckbox", { name: "All statuses" }).first();
  if (!(await allStatuses.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Filters" }).click();
  }
}

async function openGroupOptions(page: Page): Promise<void> {
  await page.getByTestId("project-view-options-trigger").click();
  const statusGroup = page.getByRole("menuitemradio", { name: "Status" }).first();
  if (!(await statusGroup.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Group by" }).click();
  }
}
