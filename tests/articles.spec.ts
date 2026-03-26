import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

type ArticleFixture = {
  slug: string;
  title: string;
  href: string;
  sourceUrl: string;
};

type ProjectFixture = {
  id: string;
  title: string;
  articles?: Array<{ title: string; href: string }>;
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

  return parsed.filter(
    (article): article is ArticleFixture =>
      Boolean(
        article &&
          typeof article === "object" &&
          typeof article.slug === "string" &&
          typeof article.title === "string" &&
          typeof article.href === "string" &&
          typeof article.sourceUrl === "string"
      )
  );
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

  test("article detail route renders source link when article data exists", async ({ page }) => {
    test.skip(articles.length === 0, "No synced articles are available in this checkout.");

    const article = articles[0];
    await page.goto(article.href);

    await expect(page.getByRole("heading", { name: article.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Source on GitHub" })).toHaveAttribute("href", article.sourceUrl);
  });

  test("project detail page exposes internal article links when project article data exists", async ({ page }) => {
    test.skip(!projectWithArticles, "No projects with normalized article links are available in this checkout.");

    await page.goto(`/projects/${projectWithArticles!.id}`);
    await expect(page.getByRole("heading", { name: projectWithArticles!.title })).toBeVisible();
    await expect(page.getByRole("link", { name: projectWithArticles!.articles![0].title })).toBeVisible();
  });

  test("work logs route renders and supports project filters when work log data exists", async ({ page }) => {
    await page.goto("/work-logs");
    await expect(page.getByRole("heading", { name: /Work Logs/ })).toBeVisible();

    if (!projectWithWorkLogs) {
      await expect(page.getByText("No work logs found yet.")).toBeVisible();
      return;
    }

    await page.goto(`/work-logs?project=${projectWithWorkLogs.id}`);
    await expect(page.getByRole("heading", { name: `${projectWithWorkLogs.title} Work Logs` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Show all" })).toBeVisible();
  });
});
