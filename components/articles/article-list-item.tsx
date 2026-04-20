"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen, Newspaper } from "lucide-react";

import { MetadataTag, MetadataText } from "@/components/ui/metadata-text";
import { formatDate } from "@/lib/utils";
import type { ArticleListEntry } from "./article-list-types";

interface ArticleListItemProps {
  article: ArticleListEntry;
}

function getPrimaryDate(article: ArticleListEntry): string {
  const primaryDate = article.publishedAt ?? article.updatedAt;
  return formatDate(primaryDate) || primaryDate || "Undated";
}

function getUpdatedDate(article: ArticleListEntry): string | null {
  if (!article.publishedAt || !article.updatedAt || article.updatedAt === article.publishedAt) {
    return null;
  }

  return formatDate(article.updatedAt) || article.updatedAt;
}

function getSeriesHref(series: string): string {
  const params = new URLSearchParams({ q: `series:${series}` });
  return `/articles?${params.toString()}`;
}

export function ArticleListItem({ article }: ArticleListItemProps) {
  const updatedDate = getUpdatedDate(article);

  return (
    <article
      data-testid="article-list-item-root"
      className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-3 shadow-sm transition-all duration-200 hover:border-foreground/20 hover:shadow-md md:p-4"
    >
      <Link href={article.href} aria-label={article.title} className="absolute inset-0 z-10 rounded-3xl" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/40 sm:h-24 sm:w-36 md:h-28 md:w-44 lg:h-32 lg:w-48">
            {article.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverImage}
                alt={`Cover image for ${article.title}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-28 items-center justify-center bg-muted/60 text-muted-foreground sm:h-full">
                <Newspaper className="size-7" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span>{getPrimaryDate(article)}</span>
            {updatedDate && <span>Updated {updatedDate}</span>}
            {article.series && (
              <MetadataText
                href={getSeriesHref(article.series)}
                tone="interactive"
                size="sm"
                className="relative z-20 normal-case tracking-normal underline decoration-border/70 underline-offset-4"
              >
                Series: {article.series}
              </MetadataText>
            )}
          </div>

          <div className="mt-3 flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold leading-tight transition-colors group-hover:text-primary md:text-2xl">
              {article.title}
            </h2>
            <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>

          <p className="mt-2 text-sm leading-7 text-muted-foreground md:text-base" title={article.summary}>{article.oneLiner ?? article.summary}</p>

          {(article.tags?.length || article.relatedProjects.length) && (
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
              {(article.tags || []).map((tag) => (
                <MetadataTag key={`${article.slug}-${tag}`} tag={tag} size="sm" />
              ))}
              {article.relatedProjects.map((project) => (
                <Link
                  key={`${article.slug}-${project.id}`}
                  href={project.href}
                  className="relative z-20 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <FolderOpen className="size-3.5" />
                  {project.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
