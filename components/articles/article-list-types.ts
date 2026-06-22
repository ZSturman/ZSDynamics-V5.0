import type { Article } from "@/types";

export interface ArticleRelatedProject {
  id: string;
  title: string;
  href: string;
}

export interface ArticleListEntry extends Article {
  relatedProjects: ArticleRelatedProject[];
}

export type ArticleSortOption = "newest" | "oldest" | "title-asc" | "title-desc";
export type ArticleViewMode = "grid" | "list";
export type ArticleSearchScope = "all" | "title" | "tags" | "series" | "projects";
export type ArticleVisibilityFilter = "published" | "all";