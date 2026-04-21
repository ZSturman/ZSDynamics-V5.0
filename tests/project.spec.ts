import { expect, test } from "@playwright/test";

import { getProjectRoute, loadCanonicalProjects, pickDefaultProject } from "./media/helpers/project-media-fixtures";
import { gotoProjectReady } from "./helpers/route-readiness";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);

test.describe("Project Details Page", () => {
  test("should load project details for the canonical slug route", async ({ page }) => {
    await gotoProjectReady(page, defaultProject.id, defaultProject.title, getProjectRoute(defaultProject));
    await expect(page).toHaveURL(new RegExp(`${getProjectRoute(defaultProject)}$`));
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(breadcrumb.getByText(defaultProject.title, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Home" })).toHaveCount(0);
  });

  test("should normalize a legacy UUID route to the canonical slug route", async ({ page }) => {
    await gotoProjectReady(page, defaultProject.id, defaultProject.title);
    await expect(page).toHaveURL(new RegExp(`${getProjectRoute(defaultProject)}$`));
    await expect(page.getByRole("heading", { name: defaultProject.title })).toBeVisible();
  });

  test("should show error for invalid project ID", async () => {
    test.skip(
      true,
      "Static export on Firebase only ships generated project routes; unknown project paths are a hosting-level 404 rather than a stable in-app E2E contract."
    );
  });
});
