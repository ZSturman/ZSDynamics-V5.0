"use client";

import Link from "next/link";
import { ArrowUpRight, Newspaper } from "lucide-react";

import type { Project } from "@/types";

interface ProjectArticlesProps {
  project: Project;
}

export function ProjectArticles({ project }: ProjectArticlesProps) {
  const articles = project.articles || [];
  if (articles.length === 0) {
    return null;
  }

  return (
    <section
      className="min-w-0 max-w-full space-y-3 overflow-x-clip"
      data-analytics-section="project_articles"
      data-analytics-section-label="Project articles"
      data-analytics-project-slug={project.slug || project.id}
      data-analytics-project-title={project.title}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Articles</h3>
      </div>

      <div className="min-w-0 max-w-full space-y-2">
        {articles.map((article) => (
          <Link
            key={`${project.id}-${article.slug}`}
            href={article.href}
            data-analytics-item="project_article"
            data-analytics-item-id={article.slug}
            data-analytics-item-type="article"
            data-analytics-item-label={article.title}
            data-analytics-article-slug={article.slug}
            data-analytics-article-title={article.title}
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            className="group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-md border border-border/35 bg-card/35 p-2.5 transition-colors hover:border-primary/30 hover:bg-accent/25 md:p-3"
            title={article.title}
          >
            {article.coverImage ? (
              <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border/35 bg-muted/35">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.coverImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border/35 bg-muted/25 text-muted-foreground">
                <Newspaper className="size-4" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium transition-colors group-hover:text-primary">
                {article.title}
              </span>
              {(article.summary || article.oneLiner) && (
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                  {article.oneLiner || article.summary}
                </p>
              )}
            </div>

            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}
