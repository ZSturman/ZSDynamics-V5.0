import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { getProjectRoute, getProjectSlug } from "./media/helpers/project-media-fixtures";

type ArticleFixture = {
  slug: string;
  title: string;
  href: string;
  sourceUrl: string;
  series?: string;
  coverImage?: string;
  projectIds?: string[];
  linkPreviews?: Array<{ url: string; kind: "youtube" | "card" }>;
};

type ProjectFixture = {
  id: string;
  slug?: string;
  href?: string;
  title: string;
  articles?: Array<{ title: string; href: string }>;
  resources?: Array<{ label: string; url: string; iconUrl?: string }>;
  workLogs?: Array<{ id?: string; title?: string; entry?: string }>;
};

function loadArticles(): ArticleFixture[] {
  const manifestPath = path.join(process.cwd(), "public", "articles", "articles.json");
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter(
      (article): article is ArticleFixture =>
        Boolean(
          article &&
            typeof article === "object" &&
            typeof article.slug === "string" &&
            typeof article.title === "string" &&
            typeof article.href === "string" &&
            typeof article.sourceUrl === "string"
        )
    )
    .map((article) => {
      const normalizedArticle: ArticleFixture = {
        ...article,
        projectIds: Array.isArray(article.projectIds)
          ? article.projectIds.filter((projectId): projectId is string => typeof projectId === "string" && projectId.length > 0)
          : [],
        linkPreviews: Array.isArray(article.linkPreviews)
          ? article.linkPreviews.filter(
              (preview): preview is { url: string; kind: "youtube" | "card" } =>
                Boolean(
                  preview &&
                    typeof preview === "object" &&
                    typeof preview.url === "string" &&
                    (preview.kind === "youtube" || preview.kind === "card")
                )
            )
          : [],
      };

      if (typeof article.coverImage === "string" && article.coverImage.length > 0) {
        return normalizedArticle;
      }

      const markdownPath = path.join(process.cwd(), "public", "articles", article.slug, "index.md");
      if (!fs.existsSync(markdownPath)) {
        return normalizedArticle;
      }

      const markdown = fs.readFileSync(markdownPath, "utf8");
      const match = markdown.match(/!\[[^\]]*\]\((\/articles\/[^)\s]+\.(?:avif|gif|jpe?g|png|svg|webp))(?:\s+"[^"]*")?\)/i);
      return match?.[1] ? { ...normalizedArticle, coverImage: match[1] } : normalizedArticle;
    });
}

function loadProjects(): ProjectFixture[] {
  const projectsPath = path.join(process.cwd(), "public", "projects", "projects.json");
  if (!fs.existsSync(projectsPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (project): project is ProjectFixture =>
      Boolean(project && typeof project === "object" && typeof project.id === "string" && typeof project.title === "string")
  );
}

const articles = loadArticles();
const projects = loadProjects();
const projectWithArticles = projects.find((project) => Array.isArray(project.articles) && project.articles.length > 0);
const projectWithWorkLogs = projects.find((project) => Array.isArray(project.workLogs) && project.workLogs.length > 0);
const articleWithCover = articles.find((article) => typeof article.coverImage === "string" && article.coverImage.length > 0);
const articleWithStandalonePreviews = articles.find(
  (article) =>
    (article.linkPreviews || []).some((preview) => preview.kind === "youtube") &&
    (article.linkPreviews || []).some((preview) => preview.kind === "card")
);
const wolfArticle = articles.find((article) => article.slug === "the-wolf-project-reworking-a-real-world-project");
const wolfProject = projects.find((project) => project.slug === "the-wolf-project" || project.title === "The Wolf Project");
const projectWithFetchedFavicon = projects.find((project) => {
  const resources = project.resources || [];
  return (
    resources.some((resource) => typeof resource.iconUrl === "string" && resource.iconUrl.includes("/icons/favicons/")) &&
    resources.some((resource) => resource.url.includes("github.com"))
  );
});
const articleWithSeriesAndLinkedProject = articles
  .flatMap((article) =>
    typeof article.series === "string" && article.series.length > 0
      ? (article.projectIds || []).map((projectId) => {
          const project = projects.find(
            (candidate) => candidate.id === projectId || candidate.slug === projectId || candidate.href === projectId
          );
          return project ? { article, project } : null;
        })
      : []
  )
  .find((entry): entry is { article: ArticleFixture; project: ProjectFixture } => Boolean(entry));
const projectLinkedFromArticle = articles
  .flatMap((article) =>
    (article.projectIds || []).map((projectId) => {
      const project = projects.find(
        (candidate) => candidate.id === projectId || candidate.slug === projectId || candidate.href === projectId
      );
      return project ? { article, project } : null;
    })
  )
  .find((entry): entry is { article: ArticleFixture; project: ProjectFixture } => Boolean(entry));

test.describe("Articles", () => {
  test("home header exposes articles and work logs navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Articles" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Work Logs" })).toBeVisible();
  });

  test("articles index renders with either content or empty state", async ({ page }) => {
    await page.goto("/articles");

    await expect(page.getByRole("heading", { name: "Articles" })).toBeVisible();
    if (articles.length > 0) {
      await expect(page.getByRole("link", { name: articles[0].title })).toBeVisible();
    } else {
      await expect(page.getByText("No articles are published yet.")).toBeVisible();
    }
  });

  test("articles index renders a full-card article link", async ({ page }) => {
    test.skip(articles.length === 0, "No synced articles are available in this checkout.");

    const article = articles[0];
    await page.goto("/articles");

    await expect(
      page.locator(`[data-testid="article-list-item-root"] a[aria-label="${article.title}"]`).first()
    ).toHaveAttribute("href", article.href);
  });

  test("articles index supports search and view toggles", async ({ page }) => {
    test.skip(articles.length === 0, "No synced articles are available in this checkout.");

    const article = articles[0];
    const secondDistinctArticle = articles.find((candidate) => candidate.title !== article.title);

    await page.goto("/articles");

    const searchInput = page.getByRole("textbox", { name: "Search articles" });
    await searchInput.fill(`title:${article.title}`);

    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("link", { name: article.title }).first()).toBeVisible();
    if (secondDistinctArticle) {
      await expect(page.getByRole("link", { name: secondDistinctArticle.title }).first()).not.toBeVisible();
    }

    await page.getByRole("button", { name: "Switch to grid view" }).click();
    await expect(page).toHaveURL(/view=grid/);
    await expect(page.locator('[data-testid="article-card-root"]').first()).toBeVisible();
  });

  test("articles index supports sorting", async ({ page }) => {
    test.skip(articles.length < 2, "At least two articles are required to verify sorting.");
    const firstArticleTitleAlphabetically = [...articles].map((article) => article.title).sort((left, right) => left.localeCompare(right))[0]!;

    await page.goto("/articles");

    await page.getByRole("button", { name: "Sort articles" }).click();
    await page.getByRole("menuitemradio", { name: "Title A-Z" }).click();

    await expect(page).toHaveURL(/sort=title-asc/);
    await expect(page.locator('[data-testid="article-list-item-root"] h2').first()).toHaveText(firstArticleTitleAlphabetically);
  });

  test("article detail route shows the full breadcrumb and no source link", async ({ page }) => {
    test.skip(articles.length === 0, "No synced articles are available in this checkout.");

    const article = articles[0];
    await page.goto(article.href);

    await expect(page.getByRole("heading", { name: article.title })).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Articles" })).toBeVisible();
    await expect(breadcrumb.getByText(article.title, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Source on GitHub" })).toHaveCount(0);
  });

  test("article cards render cover images when one is associated with the article", async ({ page }) => {
    test.skip(!articleWithCover, "No article with a cover image is available in this checkout.");

    await page.goto("/articles");

    await expect(page.getByRole("img", { name: `Cover image for ${articleWithCover!.title}` })).toBeVisible();
  });

  test("article detail renders standalone youtube embeds and rich preview cards", async ({ page }) => {
    test.skip(!articleWithStandalonePreviews, "No article with standalone link previews is available in this checkout.");

    const previewedArticle = articleWithStandalonePreviews!;
    await page.goto(previewedArticle.href);

    await expect(page.getByTestId("article-youtube-embed")).toBeVisible();
    await expect(
      page.locator('[data-testid="article-link-preview-card"][href*="instagram.com"]').first()
    ).toBeVisible();
  });

  test("project detail page exposes internal article links when project article data exists", async ({ page }) => {
    const linkedProject = projectLinkedFromArticle?.project ?? projectWithArticles;
    const linkedArticleTitle = projectLinkedFromArticle?.article.title ?? projectWithArticles?.articles?.[0]?.title;

    if (!linkedProject || !linkedArticleTitle) {
      test.skip(true, "No projects with normalized article links are available in this checkout.");
      return;
    }

    await page.goto(getProjectRoute(linkedProject));
    await expect(page.getByTestId("project-header").getByRole("heading", { name: linkedProject.title })).toBeVisible();
    await expect(page.getByRole("link", { name: linkedArticleTitle })).toBeVisible();
  });

  test("the wolf project page lists the wolf article", async ({ page }) => {
    test.skip(!wolfProject || !wolfArticle, "The Wolf Project fixtures are not available in this checkout.");

    await page.goto(getProjectRoute(wolfProject!));
    await expect(page.getByTestId("project-header").getByRole("heading", { name: wolfProject!.title })).toBeVisible();
    await expect(page.getByRole("link", { name: wolfArticle!.title })).toBeVisible();
  });

  test("project resources prefer fetched favicons while github keeps the bundled icon", async ({ page }) => {
    test.skip(!projectWithFetchedFavicon, "No project with both a fetched favicon and GitHub resource is available in this checkout.");

    const project = projectWithFetchedFavicon!;
    const externalResource = (project.resources || []).find(
      (resource) => typeof resource.iconUrl === "string" && resource.iconUrl.includes("/icons/favicons/")
    );
    const githubResource = (project.resources || []).find((resource) => resource.url.includes("github.com"));

    if (!externalResource || !githubResource) {
      test.skip(true, "Expected both favicon-backed and GitHub resources.");
      return;
    }

    await page.goto(getProjectRoute(project));

    const faviconButton = page.getByRole("button", { name: new RegExp(externalResource.label) });
    await expect(faviconButton.locator("img")).toHaveAttribute("src", /\/icons\/favicons\//);

    const githubButton = page.getByRole("button", { name: new RegExp(githubResource.label) });
    await expect(githubButton.locator("img")).toHaveAttribute("src", /\/icons\/github\.svg/);
  });

  test("article metadata chips stay passive while connected projects remain links", async ({ page }) => {
    test.skip(!articleWithSeriesAndLinkedProject, "An article with both a series and connected project is required for this regression.");

    const seriesArticle = articleWithSeriesAndLinkedProject!.article;
    const linkedProject = articleWithSeriesAndLinkedProject!.project;

    await page.goto(seriesArticle.href);

    await expect(page.locator('[data-slot="passive-chip"]').filter({ hasText: `Series: ${seriesArticle.series}` })).toHaveCount(1);
    await expect(page.getByRole("button", { name: `Series: ${seriesArticle.series}` })).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(linkedProject.title) }).first()).toBeVisible();
  });

  test("work logs route renders and supports project filters when work log data exists", async ({ page }) => {
    await page.goto("/work-logs");
    await expect(page.getByRole("heading", { name: /Work Logs/ })).toBeVisible();

    if (!projectWithWorkLogs) {
      await expect(page.getByText("No work logs found yet.")).toBeVisible();
      return;
    }

    await page.goto(`/work-logs?project=${getProjectSlug(projectWithWorkLogs)}`);
    await expect(page.getByRole("heading", { name: `${projectWithWorkLogs.title} Work Logs` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Show all" })).toBeVisible();
  });

  test("legacy UUID work-log filters normalize to the canonical slug filter", async ({ page }) => {
    test.skip(!projectWithWorkLogs, "No projects with work logs are available in this checkout.");

    await page.goto(`/work-logs?project=${projectWithWorkLogs!.id}`);

    await expect(page).toHaveURL(new RegExp(`/work-logs\\?project=${getProjectSlug(projectWithWorkLogs!)}`));
    await expect(page.getByRole("heading", { name: `${projectWithWorkLogs!.title} Work Logs` })).toBeVisible();
  });
});
