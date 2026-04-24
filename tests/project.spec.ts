import { expect, test } from "@playwright/test";

import {
  getProjectRoute,
  loadCanonicalProjects,
  pickDefaultProject,
  type CanonicalProject,
} from "./media/helpers/project-media-fixtures";
import { gotoProjectReady } from "./helpers/route-readiness";

const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);
const projectWithHeroResources = canonicalProjects.find(
  (project) => getProjectResources(project).length > 0 && Boolean(project.images?.hero)
);
const projectWithOverflowWorkLogs = canonicalProjects.find(
  (project) => getRenderableWorkLogs(project).length > 4
);
const projectWithStandaloneAssets = canonicalProjects.find(
  (project) => getStandaloneAssets(project).length > 0
);
const projectWithStandaloneLinkAsset = findProjectWithStandaloneLinkAsset(canonicalProjects);
const projectWithCompactFallbackLinkAsset = findProjectWithStandaloneLinkAsset(canonicalProjects, (asset) => {
  const preview = asset.linkPreview;
  return Boolean(
    preview &&
      typeof preview === "object" &&
      !Array.isArray(preview) &&
      typeof (preview as { image?: unknown }).image !== "string"
  );
});
const projectWithReadme = canonicalProjects.find((project) => {
  const readme = project.readme;
  return Boolean(
    readme &&
      typeof readme === "object" &&
      typeof (readme as { content?: unknown }).content === "string" &&
      (readme as { content: string }).content.trim()
  );
});

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

  test("project resource buttons stay labeled above the hero and title actions stay clean", async ({ page }) => {
    test.skip(!projectWithHeroResources, "A project with both header resources and hero media is required for this regression.");

    const project = projectWithHeroResources!;
    const firstResourceLabel = getProjectResources(project)[0]?.label;
    await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));

    const header = page.getByTestId("project-header");
    const titleRow = header.getByTestId("project-header-title-row");
    const resourceRow = header.getByTestId("project-header-resource-row");
    const hero = header.getByTestId("project-header-hero");

    await expect(titleRow).toBeVisible();
    await expect(titleRow.getByRole("button")).toHaveCount(0);
    await expect(resourceRow).toBeVisible();
    await expect(hero).toBeVisible();

    if (firstResourceLabel) {
      await expect(resourceRow.getByText(firstResourceLabel, { exact: true }).first()).toBeVisible();
    }

    const resourceBox = await resourceRow.boundingBox();
    const heroBox = await hero.boundingBox();
    expect(resourceBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(resourceBox!.y).toBeLessThan(heroBox!.y);
  });

  test("project metadata removes category/domain and work logs collapse behind view more", async ({ page }) => {
    test.skip(!projectWithOverflowWorkLogs, "A project with more than four work logs is required for this regression.");

    const project = projectWithOverflowWorkLogs!;
    const expectedLogCount = getRenderableWorkLogs(project).length;
    await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));

    const metadata = page.getByTestId("project-metadata");
    await expect(metadata).toBeVisible();
    await expect(metadata.getByText("Category", { exact: true })).toHaveCount(0);
    await expect(metadata.getByText("Domain", { exact: true })).toHaveCount(0);

    const logCards = page.getByTestId("project-work-log-card");
    await expect(logCards).toHaveCount(4);

    const viewMore = page.getByTestId("project-work-logs-view-more");
    await expect(viewMore).toBeVisible();
    await viewMore.click();
    await expect(logCards).toHaveCount(expectedLogCount);
    await expect(viewMore).toHaveText("Show fewer logs");
  });

  test("project assets remove the section heading and link assets drop the globe marker", async ({ page }) => {
    const project =
      projectWithCompactFallbackLinkAsset?.project ??
      projectWithStandaloneLinkAsset?.project ??
      projectWithStandaloneAssets;
    test.skip(!project, "A project with standalone assets is required for this regression.");

    await gotoProjectReady(page, project!.id, project!.title, getProjectRoute(project!));

    const assetsSection = page.getByTestId("project-standalone-assets");
    await expect(assetsSection).toBeVisible();
    await expect(assetsSection.getByText("Project Assets", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Assets", exact: true })
    ).toHaveCount(0);

    if (projectWithStandaloneLinkAsset?.project.id === project!.id) {
      const titleRow = page
        .locator(
          `[data-testid="project-standalone-asset"][data-asset-id="${projectWithStandaloneLinkAsset.asset.id}"] [data-testid="project-asset-title-row"]`
        )
        .first();

      await expect(titleRow).toBeVisible();
      await expect(titleRow.locator("svg")).toHaveCount(0);
    }

    if (projectWithCompactFallbackLinkAsset?.project.id === project!.id) {
      const asset = page
        .locator(`[data-testid="project-standalone-asset"][data-asset-id="${projectWithCompactFallbackLinkAsset.asset.id}"]`)
        .first();
      const fallbackPreview = asset.locator('[data-link-preview-state="fallback"]').first();

      await expect(fallbackPreview).toBeVisible();
      const fallbackBox = await fallbackPreview.boundingBox();
      expect(fallbackBox).not.toBeNull();
      expect(fallbackBox!.height).toBeLessThan(260);
      await expect(asset.getByRole("button", { name: "Expand" })).toHaveCount(0);
    }
  });

  test("repo-backed project pages render the fetched README content", async ({ page }) => {
    test.skip(!projectWithReadme, "A repo-backed project with fetched README content is required for this regression.");

    const project = projectWithReadme!;
    const readme = project.readme as { content: string; sourceUrl?: string };
    await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));

    const readmeSection = page.getByTestId("project-readme");
    await expect(readmeSection).toBeVisible();
    await expect(readmeSection.getByRole("heading", { name: "README", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "README" })
    ).toHaveAttribute("href", "#readme");

    const firstLine = readme.content
      .split(/\r?\n/)
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find((line) => line.length > 0);

    if (firstLine) {
      await expect(readmeSection).toContainText(firstLine);
    }

    if (typeof readme.sourceUrl === "string" && readme.sourceUrl) {
      await expect(readmeSection.getByTestId("project-readme-source")).toHaveAttribute("href", readme.sourceUrl);
    }

    if (readme.content.length > 2200) {
      const expandButton = readmeSection.getByRole("button", { name: "Expand" });
      await expect(expandButton).toBeVisible();
      await expandButton.click();
      await expect(readmeSection.getByRole("button", { name: "Collapse" })).toBeVisible();
    }
  });

  test("should show error for invalid project ID", async () => {
    test.skip(
      true,
      "Static export on Firebase only ships generated project routes; unknown project paths are a hosting-level 404 rather than a stable in-app E2E contract."
    );
  });
});

function getProjectResources(project: CanonicalProject): Array<{ label: string }> {
  return Array.isArray(project.resources) ? (project.resources as Array<{ label: string }>) : [];
}

function getRenderableWorkLogs(project: CanonicalProject): Array<Record<string, unknown>> {
  const workLogs = Array.isArray(project.workLogs) ? (project.workLogs as Array<Record<string, unknown>>) : [];
  return workLogs.filter((workLog) => Boolean(workLog.title || workLog.entry));
}

function getStandaloneAssets(project: CanonicalProject): Array<Record<string, unknown>> {
  return Array.isArray(project.assets) ? (project.assets as Array<Record<string, unknown>>) : [];
}

function findProjectWithStandaloneLinkAsset(
  projects: CanonicalProject[],
  predicate?: (asset: Record<string, unknown>) => boolean,
) {
  for (const project of projects) {
    const asset = getStandaloneAssets(project).find((item) => {
      if (!item || typeof item !== "object") return false;
      const type = typeof item.type === "string" ? item.type : "";
      const isLinkAsset = type === "url-link" || type === "local-link" || type === "folio";
      return isLinkAsset && (!predicate || predicate(item));
    });

    if (asset && typeof asset.id === "string") {
      return {
        project,
        asset: { id: asset.id },
      };
    }
  }

  return undefined;
}
