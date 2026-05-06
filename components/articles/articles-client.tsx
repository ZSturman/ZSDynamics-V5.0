"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleFilters } from "@/components/articles/article-filters";
import { ArticleListItem } from "@/components/articles/article-list-item";
import type { ArticleListEntry, ArticleSearchScope, ArticleSortOption, ArticleViewMode, ArticleVisibilityFilter } from "./article-list-types";

const STORAGE_KEY = "articles.filters.v1";

interface ArticlesClientProps {
  articles: ArticleListEntry[];
}

interface StoredArticleFilters {
  searchQuery?: string;
  sort?: ArticleSortOption;
  viewMode?: ArticleViewMode;
  visibilityFilter?: ArticleVisibilityFilter;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<ArticleSortOption>("newest");
  const [viewMode, setViewMode] = useState<ArticleViewMode>("list");
  const [visibilityFilter, setVisibilityFilter] = useState<ArticleVisibilityFilter>("published");
  const [initialized, setInitialized] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (initialized) return;

    const hasUrlState = ["q", "sort", "view", "vis"].some((key) => {
      const value = searchParams?.get(key);
      return typeof value === "string" && value !== "";
    });

    if (hasUrlState) {
      const urlSearch = searchParams?.get("q") || "";
      const urlSort = searchParams?.get("sort");
      const urlView = searchParams?.get("view");
      const urlVis = searchParams?.get("vis");

      setSearchQuery(urlSearch);
      setSort(isSortOption(urlSort) ? urlSort : "newest");
      setViewMode(isViewMode(urlView) ? urlView : "list");
      setVisibilityFilter(isVisibilityFilter(urlVis) ? urlVis : "published");
      setInitialized(true);
      return;
    }

    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw) as StoredArticleFilters;
        setSearchQuery(typeof saved.searchQuery === "string" ? saved.searchQuery : "");
        setSort(isSortOption(saved.sort) ? saved.sort : "newest");
        setViewMode(isViewMode(saved.viewMode) ? saved.viewMode : "list");
        setVisibilityFilter(isVisibilityFilter(saved.visibilityFilter) ? saved.visibilityFilter : "published");
      }
    } catch {
      // Ignore restore failures and fall back to defaults.
    }

    setInitialized(true);
  }, [initialized, searchParams]);

  useEffect(() => {
    if (!initialized) return;

    try {
      if (typeof window !== "undefined") {
        const nextState: StoredArticleFilters = { searchQuery, sort, viewMode, visibilityFilter };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
    } catch {
      // Ignore storage failures.
    }

    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (sort !== "newest") params.set("sort", sort);
    if (viewMode !== "list") params.set("view", viewMode);
    if (visibilityFilter !== "published") params.set("vis", visibilityFilter);

    const basePath = pathname || "/articles";
    const nextUrl = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    router.replace(nextUrl, { scroll: false });
  }, [initialized, pathname, router, searchQuery, sort, viewMode, visibilityFilter]);

  const parsedSearch = useMemo(() => parseSearchQuery(deferredSearchQuery), [deferredSearchQuery]);

  const visibilityFilteredArticles = useMemo(() => {
    if (visibilityFilter === "all") return articles;
    return articles.filter((article) => typeof article.publishedAt === "string" && article.publishedAt.trim().length > 0);
  }, [articles, visibilityFilter]);

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
        <div className="space-y-4">
          {sortedArticles.map((article) => (
            <ArticleListItem key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}