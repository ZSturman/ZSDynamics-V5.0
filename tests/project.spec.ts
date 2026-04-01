import { expect, test } from "@playwright/test";

import { getProjectRoute, loadCanonicalProjects, pickDefaultProject } from "./media/helpers/project-media-fixtures";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);

test.describe("Project Details Page", () => {
  test("should load project details for the canonical slug route", async ({ page }) => {
    await page.goto(getProjectRoute(defaultProject));

    await expect(page.getByRole("heading", { name: defaultProject.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
  });

  test("should normalize a legacy UUID route to the canonical slug route", async ({ page }) => {
    await page.goto(`/projects/${defaultProject.id}`);

    await expect(page).toHaveURL(new RegExp(`${getProjectRoute(defaultProject)}$`));
    await expect(page.getByRole("heading", { name: defaultProject.title })).toBeVisible();
  });

  test("should show error for invalid project ID", async ({ page }) => {
    await page.goto("/projects/invalid-id");

    await expect(page.getByText("Project not found.")).toBeVisible();
    await expect(page.getByRole("link", { name: /←/ })).toBeVisible();
  });
});
