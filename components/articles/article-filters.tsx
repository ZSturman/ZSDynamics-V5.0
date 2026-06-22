"use client";

import { ArrowUpDown, Grid3X3, List, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ArticleSortOption, ArticleViewMode, ArticleVisibilityFilter } from "./article-list-types";

interface ArticleFiltersProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sort: ArticleSortOption;
  onSortChange: (value: ArticleSortOption) => void;
  viewMode: ArticleViewMode;
  onViewModeChange: (value: ArticleViewMode) => void;
  visibilityFilter: ArticleVisibilityFilter;
  onVisibilityFilterChange: (value: ArticleVisibilityFilter) => void;
  totalCount: number;
  visibleCount: number;
}

export function ArticleFilters({
  searchQuery,
  onSearchQueryChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  visibilityFilter,
  onVisibilityFilterChange,
  totalCount,
  visibleCount,
}: ArticleFiltersProps) {
  const countLabel = visibleCount === totalCount ? `${totalCount} articles` : `${visibleCount} of ${totalCount} articles`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search articles"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search articles with title:, tag:, series:, or project:"
            className="h-10 pl-9 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear article search"
              onClick={() => onSearchQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[40px] min-w-[40px] p-0" aria-label="Sort articles" title="Sort articles">
                <ArrowUpDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort articles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value as ArticleSortOption)}>
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title-asc">Title A-Z</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title-desc">Title Z-A</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Visibility</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={visibilityFilter} onValueChange={(value) => onVisibilityFilterChange(value as ArticleVisibilityFilter)}>
                <DropdownMenuRadioItem value="published">Published only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="all">Show all</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="min-h-[40px] min-w-[40px] p-0"
            aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            onClick={() => onViewModeChange(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? <List className="size-4" /> : <Grid3X3 className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button type="button" onClick={() => onSearchQueryChange("")} className="ml-1 transition-colors hover:text-foreground">
                ×
              </button>
            </Badge>
          )}
          {visibilityFilter === "all" && (
            <Badge variant="outline" className="gap-1 border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Showing drafts
              <button type="button" onClick={() => onVisibilityFilterChange("published")} className="ml-1 transition-colors hover:text-foreground">
                ×
              </button>
            </Badge>
          )}
          {(searchQuery || visibilityFilter === "all") && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { onSearchQueryChange(""); onVisibilityFilterChange("published"); }}>
              Clear all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}