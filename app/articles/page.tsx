import { ArticlesClient } from "@/components/articles/articles-client";
import { PageFrame } from "@/components/layout/page-frame";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import type { ArticleListEntry } from "@/components/articles/article-list-types";
import { loadArticles } from "@/lib/load-articles";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { getProjectHref } from "@/lib/project-paths";
import type { Project } from "@/types";

export const dynamic = "force-static";

export default async function ArticlesPage() {
  const [articles, projects] = await Promise.all([
    loadArticles(),
    loadPublicJsonRecursively<Project>("projects"),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const articleEntries: ArticleListEntry[] = articles.map((article) => ({
    ...article,
    relatedProjects: (article.projectIds || [])
      .map((projectId) => projectById.get(projectId))
      .filter((project): project is Project => Boolean(project))
      .map((project) => ({
        id: project.id,
        title: project.title,
        href: getProjectHref(project),
      })),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageFrame as="main" data-testid="site-page-frame" className="py-8 md:py-12">
        <div className="space-y-2">
          <BreadcrumbTrail items={[{ label: "Home", href: "/" }, { label: "Articles" }]} />
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Articles</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Long-form writing pulled directly from the dedicated articles repository and published here as part of the portfolio.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
            No articles are published yet.
          </div>
        ) : (
          <ArticlesClient articles={articleEntries} />
        )}
      </PageFrame>
    </div>
  );
}
