import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";

import { loadArticles } from "@/lib/load-articles";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types";

export const dynamic = "force-static";

export default async function ArticlesPage() {
  const [articles, projects] = await Promise.all([
    loadArticles(),
    loadPublicJsonRecursively<Project>("projects"),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            {" / "}Articles
          </p>
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
          <div className="mt-10 space-y-5">
            {articles.map((article) => {
              const relatedProjects = (article.projectIds || [])
                .map((projectId) => projectById.get(projectId))
                .filter((project): project is Project => Boolean(project));

              return (
                <article
                  key={article.slug}
                  className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <Link
                    href={article.href}
                    aria-label={`Read article: ${article.title}`}
                    className="absolute inset-0 rounded-3xl"
                  />

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatDate(article.updatedAt ?? article.publishedAt ?? undefined) || article.updatedAt || article.publishedAt}</span>
                    {article.updatedAt && article.publishedAt && article.updatedAt !== article.publishedAt && (
                      <span>Updated {formatDate(article.updatedAt) || article.updatedAt}</span>
                    )}
                  </div>

                  <div className="relative mt-3 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-2xl font-semibold leading-tight transition-colors group-hover:text-primary">
                        {article.title}
                      </h2>
                      <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground md:text-base">{article.summary}</p>
                  </div>

                  {(article.tags?.length || relatedProjects.length) && (
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {(article.tags || []).map((tag) => (
                        <span
                          key={`${article.slug}-${tag}`}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {relatedProjects.map((project) => (
                        <Link
                          key={`${article.slug}-${project.id}`}
                          href={`/projects/${project.id}`}
                          className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <FolderOpen className="size-3.5" />
                          {project.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
