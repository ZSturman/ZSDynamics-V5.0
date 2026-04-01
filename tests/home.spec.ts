import { expect, test, type Page } from "@playwright/test";

import { getProjectSlug, loadCanonicalProjects, pickDefaultProject } from "./media/helpers/project-media-fixtures";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);

async function gotoHomeReady(page: Page): Promise<void> {
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
    await expect(page.getByText(defaultProject.title)).toBeVisible();
  });

  test("should open the project modal when clicking a project", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "All Projects" })).toBeVisible();

    const card = page
      .locator(
        `[data-testid="project-card-root"][data-project-id="${defaultProject.id}"], [data-testid="project-list-item-root"][data-project-id="${defaultProject.id}"]`
      )
      .first();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`\\/?(?:.*&)?project=${getProjectSlug(defaultProject)}(?:&.*)?$`));
    await expect(page.locator('[data-testid="project-modal-content"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to Project Page" })).toBeVisible();
  });
});
