import type { MetadataRoute } from "next";

import { loadArticles } from "@/lib/load-articles";
import { loadProjectsManifest } from "@/lib/load-projects";
import { getProjectHref } from "@/lib/project-paths";
import { FOCUS_AREAS } from "@/lib/project-presentation";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-static";

function toDate(value: unknown): Date | undefined {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, articles] = await Promise.all([loadProjectsManifest(), loadArticles()]);
  const pages = ["", "/projects", "/experience", "/about", "/resume", "/articles", "/work-logs", "/contact"];

  return [
    ...pages.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...FOCUS_AREAS.map((area) => ({ url: `${SITE_URL}/explore/${area.key}` })),
    ...projects.map((project) => ({ url: `${SITE_URL}${getProjectHref(project)}`, lastModified: toDate(project.updatedAt) })),
    ...articles.map((article) => ({
      url: `${SITE_URL}${article.href}`,
      lastModified: toDate(article.updatedAt || article.publishedAt),
    })),
  ];
}
