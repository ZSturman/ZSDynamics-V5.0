"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { useUrlState, useUrlSearch } from "@/lib/use-url-state";

import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleFilters } from "@/components/articles/article-filters";
import { ArticleListItem } from "@/components/articles/article-list-item";
import type { ArticleListEntry, ArticleSearchScope, ArticleSortOption, ArticleViewMode, ArticleVisibilityFilter } from "./article-list-types";

interface ArticlesClientProps { articles: ArticleListEntry[]; }

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseSearchQuery(query: string): { scope: ArticleSearchScope; term: string } {
  const trimmed = query.trim();
  if (!trimmed) {
    return { scope: "all", term: "" };
  }

  const titleMatch = trimmed.match(/^title:(.*)$/i);
  const tagMatch = trimmed.match(/^tags?:(.*)$/i);
  const seriesMatch = trimmed.match(/^series:(.*)$/i);
  const projectMatch = trimmed.match(/^projects?:(.*)$/i);

  if (titleMatch) return { scope: "title", term: titleMatch[1].trim() };
  if (tagMatch) return { scope: "tags", term: tagMatch[1].trim() };
  if (seriesMatch) return { scope: "series", term: seriesMatch[1].trim() };
  if (projectMatch) return { scope: "projects", term: projectMatch[1].trim() };

  return { scope: "all", term: trimmed };
}

function isSortOption(value: string | null | undefined): value is ArticleSortOption {
  return value === "newest" || value === "oldest" || value === "title-asc" || value === "title-desc";
}

function isViewMode(value: string | null | undefined): value is ArticleViewMode {
  return value === "grid" || value === "list";
}

function isVisibilityFilter(value: string | null | undefined): value is ArticleVisibilityFilter {
  return value === "published" || value === "all";
}

export function ArticlesClient({ articles }: ArticlesClientProps) {
  const { params, update, hydrated } = useUrlState();
  const [searchQuery, setSearchQuery] = useUrlSearch();
  const sortParam = params.get("sort");
  const viewParam = params.get("view");
  const visParam = params.get("vis");
  const sort = isSortOption(sortParam) ? sortParam : "newest";
  const viewMode = isViewMode(viewParam) ? viewParam : "list";
  const visibilityFilter = isVisibilityFilter(visParam) ? visParam : "published";
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const setSort = (value: ArticleSortOption) => update({ sort: value === "newest" ? undefined : value });
  const setViewMode = (value: ArticleViewMode) => update({ view: value === "list" ? undefined : value });
  const setVisibilityFilter = (value: ArticleVisibilityFilter) => update({ vis: value === "published" ? undefined : value });
  const seriesFilter = params.get("series") || "";
  const tagFilter = params.get("tag") || "";
  const projectFilter = params.get("project") || "";

  const restoredPreferences = useRef(false);
  useEffect(() => {
    if (!hydrated || restoredPreferences.current) return;
    restoredPreferences.current = true;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem("articles.filters.v1") || "{}");
      const patch: Record<string, string> = {};
      if (!params.has("view") && isViewMode(saved.viewMode) && saved.viewMode !== "list") patch.view = saved.viewMode;
      if (!params.has("sort") && isSortOption(saved.sort) && saved.sort !== "newest") patch.sort = saved.sort;
      update(patch, true);
    } catch { /* Storage is optional; URL filters remain authoritative. */ }
  }, [hydrated, params, update]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.sessionStorage.setItem("articles.filters.v1", JSON.stringify({ viewMode, sort })); }
    catch { /* Private browsing may disable storage. */ }
  }, [hydrated, sort, viewMode]);

  const parsedSearch = useMemo(() => parseSearchQuery(deferredSearchQuery), [deferredSearchQuery]);

  const visibilityFilteredArticles = useMemo(() => {
    return articles.filter((article) =>
      (visibilityFilter === "all" || Boolean(article.publishedAt?.trim())) &&
      (!seriesFilter || article.series === seriesFilter) &&
      (!tagFilter || article.tags?.includes(tagFilter)) &&
      (!projectFilter || article.relatedProjects.some((project) => project.id === projectFilter))
    );
  }, [articles, visibilityFilter, seriesFilter, tagFilter, projectFilter]);

  const filteredArticles = useMemo(() => {
    const normalizedTerm = parsedSearch.term.toLowerCase();
    if (!normalizedTerm) {
      return visibilityFilteredArticles;
    }

    return visibilityFilteredArticles.filter((article) => {
      const title = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();
      const series = (article.series || "").toLowerCase();
      const tagText = (article.tags || []).join(" ").toLowerCase();
      const projectText = article.relatedProjects.map((project) => project.title).join(" ").toLowerCase();

      switch (parsedSearch.scope) {
        case "title":
          return title.includes(normalizedTerm);
        case "tags":
          return tagText.includes(normalizedTerm);
        case "series":
          return series.includes(normalizedTerm);
        case "projects":
          return projectText.includes(normalizedTerm);
        default:
          return (
            title.includes(normalizedTerm) ||
            summary.includes(normalizedTerm) ||
            series.includes(normalizedTerm) ||
            tagText.includes(normalizedTerm) ||
            projectText.includes(normalizedTerm)
          );
      }
    });
  }, [visibilityFilteredArticles, parsedSearch]);

  const sortedArticles = useMemo(() => {
    const copy = [...filteredArticles];

    switch (sort) {
      case "newest":
        return copy.sort((left, right) => {
          const diff = toTimestamp(right.publishedAt || right.updatedAt) - toTimestamp(left.publishedAt || left.updatedAt);
          return diff !== 0 ? diff : left.title.localeCompare(right.title);
        });
      case "oldest":
        return copy.sort((left, right) => {
          const diff = toTimestamp(left.publishedAt || left.updatedAt) - toTimestamp(right.publishedAt || right.updatedAt);
          return diff !== 0 ? diff : left.title.localeCompare(right.title);
        });
      case "title-asc":
        return copy.sort((left, right) => left.title.localeCompare(right.title));
      case "title-desc":
        return copy.sort((left, right) => right.title.localeCompare(left.title));
      default:
        return copy;
    }
  }, [filteredArticles, sort]);

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-wrap gap-3">
        {([
          ["series", "Series", seriesFilter, [...new Set(articles.map((a) => a.series).filter(Boolean))].map((v) => ({ value: v!, label: v! }))],
          ["tag", "Tag", tagFilter, [...new Set(articles.flatMap((a) => a.tags || []))].map((v) => ({ value: v, label: v }))],
          ["project", "Project", projectFilter, [...new Map(articles.flatMap((a) => a.relatedProjects).map((p) => [p.id, { value: p.id, label: p.title }])).values()]],
        ] as const).map(([key, label, value, options]) => (
          <label key={key} className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
            {label}
            <select aria-label={`Filter by ${label.toLowerCase()}`} value={value} onChange={(e) => update({ [key]: e.target.value || undefined })} className="min-h-11 max-w-64 rounded-md border border-border bg-background px-3 text-foreground">
              <option value="">All {label.toLowerCase()}s</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        {(seriesFilter || tagFilter || projectFilter) && <Button variant="ghost" onClick={() => update({ series: undefined, tag: undefined, project: undefined })}>Clear filters</Button>}
      </div>
      <ArticleFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sort={sort}
        onSortChange={setSort}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        visibilityFilter={visibilityFilter}
        onVisibilityFilterChange={setVisibilityFilter}
        totalCount={articles.length}
        visibleCount={sortedArticles.length}
      />

      {sortedArticles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
          <p>No articles match the current search.</p>
          {searchQuery.trim() && (
            <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {sortedArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/70 border-y border-border/70" data-testid="article-list">
          {sortedArticles.map((article) => (
            <ArticleListItem key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}