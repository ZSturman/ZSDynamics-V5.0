"use client";

import Link from "next/link";
import { useUrlState } from "@/lib/use-url-state";
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
  if (!article.publishedAt || !article.updatedAt || Date.parse(article.updatedAt) <= Date.parse(article.publishedAt) || !Number.isFinite(Date.parse(article.updatedAt))) {
    return null;
  }

  return formatDate(article.updatedAt) || article.updatedAt;
}

function getSeriesHref(series: string): string {
  const params = new URLSearchParams({ q: `series:${series}` });
  return `/articles?${params.toString()}`;
}

export function ArticleListItem({ article }: ArticleListItemProps) {
  const { params } = useUrlState();
  const updatedDate = getUpdatedDate(article);
  const isDraft = !article.publishedAt;

  return (
    <article
      data-testid="article-list-item-root"
      data-analytics-item="article_list_item"
      data-analytics-item-id={article.slug}
      data-analytics-item-type="article"
      data-analytics-item-label={article.title}
      data-analytics-article-slug={article.slug}
      data-analytics-article-title={article.title}
      data-analytics-surface="article_list"
      className={`group relative min-w-0 px-1 py-5 transition-colors hover:bg-muted/30 sm:px-3 ${
        isDraft
          ? "bg-amber-50/30 dark:bg-amber-950/10"
          : ""
      }`}
    >
      <Link href={article.href} aria-label={article.title} className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-primary" />

      <div className="flex items-start gap-3 sm:gap-5">
        <div className="shrink-0">
          <div className="size-16 overflow-hidden rounded-lg border border-border/70 bg-muted/40 sm:size-20">
            {article.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverImage}
                alt={`Cover image for ${article.title}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted/60 text-muted-foreground">
                <Newspaper className="size-7" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{getPrimaryDate(article)}</span>
            {updatedDate && <span>Updated {updatedDate}</span>}
            {isDraft && (
              <span className="inline-flex items-center rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700 ring-1 ring-amber-400/50 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-500/40">
                Draft
              </span>
            )}
            {article.series && (
              <MetadataText
                href={`${getSeriesHref(article.series)}${[...params].filter(([key]) => !["q", "series"].includes(key)).map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("")}`}
                tone="interactive"
                size="sm"
                className="relative z-20 normal-case tracking-normal underline decoration-border/70 underline-offset-4"
              >
                Series: {article.series}
              </MetadataText>
            )}
          </div>

          <div className="mt-1.5 flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-primary sm:text-lg">
              {article.title}
            </h2>
            <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground" title={article.summary}>{article.oneLiner ?? article.summary}</p>

          {(article.tags?.length || article.relatedProjects.length) && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {(article.tags || []).slice(0, 3).map((tag) => (
                <MetadataTag key={`${article.slug}-${tag}`} tag={tag} size="sm" />
              ))}
              {article.relatedProjects.slice(0, 1).map((project) => (
                <Link
                  key={`${article.slug}-${project.id}`}
                  href={project.href}
                  data-article-project={project.href.split("/").pop()}
                  data-project-id={project.id}
                  className="relative z-20 inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
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
