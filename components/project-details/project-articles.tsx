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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Articles</h3>
      </div>

      <div className="space-y-2">
        {articles.map((article) => (
          <Link
            key={`${project.id}-${article.slug}`}
            href={article.href}
            className="group block overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-primary/40"
            title={article.title}
          >
            {article.coverImage ? (
              <div className="overflow-hidden border-b border-border/70 bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.coverImage}
                  alt={`Cover image for ${article.title}`}
                  className="aspect-[16/8] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 text-muted-foreground">
                <div className="flex size-10 items-center justify-center rounded-xl bg-background">
                  <Newspaper className="size-4" />
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.14em]">Article</span>
              </div>
            )}

            <div className="flex items-start justify-between gap-3 px-4 py-4">
              <span className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-primary">
                {article.title}
              </span>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
