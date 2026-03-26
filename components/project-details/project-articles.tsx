"use client";

import Link from "next/link";

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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Articles</h3>
      </div>

      <div className="space-y-2">
        {articles.map((article) => (
          <Link
            key={`${project.id}-${article.slug}`}
            href={article.href}
            className="flex min-h-11 items-center rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
            title={article.title}
          >
            <span className="truncate">{article.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
