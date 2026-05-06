"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen, Newspaper } from "lucide-react";

import { MetadataTag, MetadataText } from "@/components/ui/metadata-text";
import { formatDate } from "@/lib/utils";
import type { ArticleListEntry } from "./article-list-types";

interface ArticleCardProps {
  article: ArticleListEntry;
}

function getPrimaryDate(article: ArticleListEntry): string {
  const primaryDate = article.publishedAt ?? article.updatedAt;
  return formatDate(primaryDate) || primaryDate || "Undated";
}

function getSeriesHref(series: string): string {
  const params = new URLSearchParams({ q: `series:${series}` });
  return `/articles?${params.toString()}`;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const isDraft = !article.publishedAt;
  return (
    <article
      data-testid="article-card-root"
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl"
    >
      <Link href={article.href} aria-label={article.title} className="absolute inset-0 z-10 rounded-[1.75rem]" />

      <div className="relative isolate aspect-[16/10] overflow-hidden border-b border-border/70 bg-muted/40">
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            alt={`Cover image for ${article.title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/60 text-muted-foreground">
            <Newspaper className="size-8" />
          </div>
        )}

        {isDraft && (
          <div className="pointer-events-none absolute left-3 top-3 z-20">
            <span className="inline-flex items-center rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700 ring-1 ring-amber-400/50 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-500/40">
              Draft
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/80">{getPrimaryDate(article)}</p>
            {article.series && (
              <MetadataText
                href={getSeriesHref(article.series)}
                tone="interactive"
                size="sm"
                className="pointer-events-auto line-clamp-1 text-white/92 underline decoration-white/25 underline-offset-4 hover:text-white"
              >
                Series: {article.series}
              </MetadataText>
            )}
          </div>
          <div className="rounded-full bg-background/90 p-2 text-foreground shadow-sm ring-1 ring-border/50">
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-3">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
            {article.title}
          </h3>
          <p className="line-clamp-4 text-sm leading-6 text-muted-foreground" title={article.summary}>{article.oneLiner ?? article.summary}</p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(article.tags || []).slice(0, 3).map((tag) => (
              <MetadataTag key={`${article.slug}-${tag}`} tag={tag} size="sm" />
            ))}
            {article.tags && article.tags.length > 3 && (
              <MetadataText size="sm">+{article.tags.length - 3} more</MetadataText>
            )}
          </div>

          {article.relatedProjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.relatedProjects.slice(0, 2).map((project) => (
                <Link
                  key={`${article.slug}-${project.id}`}
                  href={project.href}
                  className="relative z-20 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <FolderOpen className="size-3.5" />
                  {project.title}
                </Link>
              ))}
              {article.relatedProjects.length > 2 && (
                <MetadataText size="sm">+{article.relatedProjects.length - 2} projects</MetadataText>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
