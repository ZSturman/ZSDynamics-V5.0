import { expect, test } from "@playwright/test";

import { getProjectSlug, loadCanonicalProjects, pickDefaultProject } from "./media/helpers/project-media-fixtures";
import { gotoHomeReady } from "./helpers/route-readiness";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);
const projectWithResources = canonicalProjects.find(
  (project) => Array.isArray(project.resources) && project.resources.length > 0
);
const projectWithResourcesAndTags = canonicalProjects.find(
  (project) =>
    Array.isArray(project.resources) &&
    project.resources.length > 0 &&
    Array.isArray(project.tags) &&
    project.tags.length > 0
);

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHomeReady(page);
  });

  test("should display the portfolio header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Zachary Sturman" })).toBeVisible();
    await expect(page.getByText("I think a lot about how design influences trust")).toBeVisible();
  });

  test("should load and display projects", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "All Projects" })).toBeVisible();
    await expect(
      page
        .locator(
          `[data-testid="project-card-root"][data-project-id="${defaultProject.id}"], [data-testid="project-list-item-root"][data-project-id="${defaultProject.id}"]`
        )
        .first()
    ).toBeVisible();
  });

  test("should open the project modal when clicking a project", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "All Projects" })).toBeVisible();

    const modalProject = projectWithResources ?? defaultProject;
    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${modalProject.id}"], [data-testid="project-list-item-root"][data-project-id="${modalProject.id}"]`
      )
      .first();
    await card.click({ position: { x: 40, y: 40 } });

    await expect(page).toHaveURL(new RegExp(`\\/?(?:.*&)?project=${getProjectSlug(modalProject)}(?:&.*)?$`));
    await expect(page.locator('[data-testid="project-modal-content"]').first()).toBeVisible();
    await expect(page.getByTestId("project-modal-open-project-button")).toBeVisible();

    if (projectWithResources) {
      await expect(
        page.locator('[data-testid="project-modal-content"]').getByTestId("project-header-resource-row")
      ).toHaveCount(1);
    }
  });

  test("project cards keep tags passive while resource icons remain interactive", async ({ page }) => {
    test.skip(!projectWithResourcesAndTags, "A project with both tags and resources is required for this regression.");

    const project = projectWithResourcesAndTags!;
    const tags = project.tags as string[];
    const resources = project.resources as Array<{ label: string }>;
    const firstTag = tags[0]!;
    const firstResource = resources[0]!;
    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
      )
      .first();

    await expect(
      card
        .locator('[data-slot="passive-chip"], [data-slot="metadata-tag"]')
        .filter({ hasText: firstTag })
    ).toHaveCount(1);
    await expect(card.getByRole("button", { name: firstTag })).toHaveCount(0);
    await expect(card.getByRole("link", { name: firstTag })).toHaveCount(0);

    const resourceButton = card.getByRole("button", { name: firstResource.label }).first();
    await expect(resourceButton).toBeVisible();
    await resourceButton.focus();
    await expect(resourceButton).toBeFocused();
  });
});
