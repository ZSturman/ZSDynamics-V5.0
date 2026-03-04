import { expect, test } from "@playwright/test";

import { loadCanonicalProjects, pickDefaultProject } from "./media/helpers/project-media-fixtures";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the portfolio header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Zachary Sturman" })).toBeVisible();
    await expect(page.getByText("I think a lot about how design influences trust")).toBeVisible();
  });

  test("should load and display projects", async ({ page }) => {
    await expect(page.getByText("Loading projects…")).not.toBeVisible();
    await expect(page.getByText(defaultProject.title)).toBeVisible();
  });

  test("should open project modal when clicking a project", async ({ page }) => {
    await expect(page.getByText("Loading projects…")).not.toBeVisible();

    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${defaultProject.id}"], [data-testid="project-list-item-root"][data-project-id="${defaultProject.id}"]`
      )
      .first();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`project=${defaultProject.id}`));

    const modal = page.locator('[data-testid="project-modal-content"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { name: defaultProject.title })).toBeVisible();
  });
});
