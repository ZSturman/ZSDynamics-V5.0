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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Articles</h3>
      </div>

      <div className="space-y-2">
        {articles.map((article) => (
          <Link
            key={`${project.id}-${article.slug}`}
            href={article.href}
            className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
            title={article.title}
          >
            {article.coverImage ? (
              <div className="shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted/40 h-10 w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.coverImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex shrink-0 h-10 w-14 items-center justify-center rounded-md border border-border/50 bg-muted/30 text-muted-foreground">
                <Newspaper className="size-4" />
              </div>
            )}

            <span className="min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-primary">
              {article.title}
            </span>

            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}
