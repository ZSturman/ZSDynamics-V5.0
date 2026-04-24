import { expect, test } from "@playwright/test";

import { getProjectSlug, loadCanonicalProjects } from "./media/helpers/project-media-fixtures";
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

  test("defaults to technology projects and shows the active discovery state on load", async ({ page }) => {
    test.skip(!defaultTechnologyProject, "A technology project fixture is required for this regression.");

    const currentState = page.getByTestId("project-current-state");
    await expect(currentState).toBeVisible();
    await expect(currentState).toContainText("Domain: Technology");
    await expect(currentState).toContainText("Group: Status");
    await expect(currentState).toContainText("Sort: Last updated");

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

  test("project resource icons stay interactive and sit above the title in list view", async ({ page }) => {
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

    const resourceBox = await resourceIcons.boundingBox();
    const titleBox = await title.boundingBox();
    expect(resourceBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(resourceBox!.y).toBeLessThan(titleBox!.y);

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

  test("status and domain dropdown filters can stack without getting stuck", async ({ page }) => {
    const statusTrigger = page.getByTestId("project-filter-status-trigger");
    await statusTrigger.focus();
    await statusTrigger.press("Enter");
    await expect(page.getByRole("menuitemcheckbox", { name: "Complete" }).first()).toBeVisible();
    await page.getByRole("menuitemcheckbox", { name: "Complete" }).first().click();
    await page.keyboard.press("Escape");

    const domainTrigger = page.getByTestId("project-filter-domain-trigger");
    await domainTrigger.focus();
    await domainTrigger.press("Enter");
    await expect(page.getByRole("menuitemcheckbox", { name: "Artistic" }).first()).toBeVisible();
    await page.getByRole("menuitemcheckbox", { name: "Artistic" }).first().click();
    await page.keyboard.press("Escape");

    const currentState = page.getByTestId("project-current-state");
    await expect(currentState).toContainText("Domain: Technology +1");

    const activeFilters = page.getByTestId("project-active-filters");
    await expect(activeFilters).toContainText("Status: Complete");
    await expect(activeFilters).toContainText("Domain: Artistic");
  });
});
