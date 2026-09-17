import type { Project } from "@/types";

export const DEFAULT_HOME_DOMAIN = "technology";

export type HomeProjectSortOption = "newest" | "oldest" | "title-asc" | "title-desc";
export type HomeProjectGroupOption = "status" | "none";

export interface ProjectStatusGroup {
  key: string;
  label: string;
  order: number;
}

export interface ProjectGroupSection {
  key: string;
  label: string;
  projects: Project[];
}

const COMPLETE_STATUSES = new Set(["complete", "completed", "done", "finished", "released"]);
const ACTIVE_STATUSES = new Set(["active", "in progress", "in_progress", "prototype", "draft", "idea", "alpha", "beta"]);
const DORMANT_STATUSES = new Set(["dormant", "maintenance", "paused", "on hold", "on_hold", "archived"]);
const DEPRECATED_STATUSES = new Set(["deprecated", "abandoned", "end of life", "end_of_life", "cancelled", "canceled"]);

export function normalizeDiscoveryValue(value?: string | null): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

export function getProjectStatusGroup(status?: string | null): ProjectStatusGroup {
  const normalizedStatus = normalizeDiscoveryValue(status);

  if (COMPLETE_STATUSES.has(normalizedStatus)) {
    return { key: "complete", label: "Complete", order: 0 };
  }

  if (ACTIVE_STATUSES.has(normalizedStatus)) {
    return { key: "active", label: "Active", order: 1 };
  }

  if (DORMANT_STATUSES.has(normalizedStatus)) {
    return { key: "dormant", label: "Dormant", order: 2 };
  }

  if (DEPRECATED_STATUSES.has(normalizedStatus)) {
    return { key: "deprecated", label: "Deprecated", order: 3 };
  }

  return {
    key: normalizedStatus || "other",
    label: status?.trim() || "Other",
    order: 99,
  };
}

export function getProjectStatusLabel(status?: string | null): string {
  return getProjectStatusGroup(status).label;
}

export function getProjectStatusToneClass(status?: string | null): string {
  const group = getProjectStatusGroup(status);

  switch (group.key) {
    case "complete":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "active":
      return "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100";
    case "dormant":
      return "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
    case "deprecated":
      return "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export function getProjectSortLabel(sort: HomeProjectSortOption): string {
  switch (sort) {
    case "oldest":
      return "Started earliest";
    case "title-asc":
      return "Title A-Z";
    case "title-desc":
      return "Title Z-A";
    case "newest":
    default:
      return "Last updated";
  }
}

export function getProjectGroupLabel(group: HomeProjectGroupOption): string {
  switch (group) {
    case "status":
      return "Status";
    case "none":
    default:
      return "None";
  }
}

export function toProjectTimestamp(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value instanceof Date) return value.getTime();
  return 0;
}

export function sortProjects(projects: Project[], sort: HomeProjectSortOption): Project[] {
  const next = [...projects];

  switch (sort) {
    case "oldest":
      return next.sort((left, right) => toProjectTimestamp(left.createdAt) - toProjectTimestamp(right.createdAt));
    case "title-asc":
      return next.sort((left, right) => left.title.localeCompare(right.title));
    case "title-desc":
      return next.sort((left, right) => right.title.localeCompare(left.title));
    case "newest":
    default:
      return next.sort((left, right) => toProjectTimestamp(right.updatedAt) - toProjectTimestamp(left.updatedAt));
  }
}

export function groupProjectsByStatus(projects: Project[]): ProjectGroupSection[] {
  const groupedProjects = new Map<string, ProjectGroupSection>();

  for (const project of projects) {
    const group = getProjectStatusGroup(project.status);
    const existing = groupedProjects.get(group.key);

    if (existing) {
      existing.projects.push(project);
      continue;
    }

    groupedProjects.set(group.key, {
      key: group.key,
      label: group.label,
      projects: [project],
    });
  }

  return [...groupedProjects.values()].sort((left, right) => {
    const leftGroup = getProjectStatusGroup(left.label);
    const rightGroup = getProjectStatusGroup(right.label);
    return leftGroup.order - rightGroup.order || left.label.localeCompare(right.label);
  });
}
