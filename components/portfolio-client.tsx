
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { FeaturedCarousel } from "./project-list/featured-carousel";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectList } from "@/components/project-list/project-list";
import {
  DEFAULT_HOME_DOMAIN,
  groupProjectsByStatus,
  normalizeDiscoveryValue,
  sortProjects,
  type HomeProjectGroupOption,
  type HomeProjectSortOption,
} from "@/lib/project-discovery";
import { getProjectHref } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

function toProjectHeadingLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSelectedDomainHeading(domains: string[]): string {
  const normalizedDomains = [...new Set(domains.map((domain) => normalizeDiscoveryValue(domain)).filter(Boolean))];

  if (normalizedDomains.length === 0 || normalizedDomains.includes("all")) {
    return "All Projects";
  }

  const labels = normalizedDomains.map(toProjectHeadingLabel);

  if (labels.length === 1) {
    return `${labels[0]} Projects`;
  }

  if (labels.length === 2) {
    return `${labels[0]} & ${labels[1]} Projects`;
  }

  return `${labels.slice(0, -1).join(", ")}, & ${labels[labels.length - 1]} Projects`;
}

type SearchScope = "all" | "title" | "tags";
type ViewMode = "grid" | "list";

interface PortfolioClientProps {
  projects: Project[];
  onProjectSelect?: (project: Project) => void;
}

interface PersistedHomeDiscoveryState {
  search: string;
  domain: string[];
  status: string[];
  tags: string[];
  searchScope: SearchScope;
  sort: HomeProjectSortOption;
  viewMode: ViewMode;
  group: HomeProjectGroupOption;
}

type HomeFilterState = Pick<PersistedHomeDiscoveryState, "search" | "domain" | "status" | "tags">;

const DEFAULT_HOME_STATE: PersistedHomeDiscoveryState = {
  search: "",
  domain: [DEFAULT_HOME_DOMAIN],
  status: ["all"],
  tags: [],
  searchScope: "all",
  sort: "newest",
  viewMode: "list",
  group: "status",
};

const HOME_DISCOVERY_PARAM_KEYS = ["q", "domain", "medium", "status", "tags", "searchScope", "sort", "view", "group"] as const;

function readWindowSearchEntries(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

function replaceHomeUrl(params: URLSearchParams): void {
  if (typeof window === "undefined") {
    return;
  }

  const pathname = window.location.pathname || "/";
  const mergedParams = new URLSearchParams(window.location.search);

  for (const key of HOME_DISCOVERY_PARAM_KEYS) {
    mergedParams.delete(key);
  }

  params.forEach((value, key) => {
    mergedParams.set(key, value);
  });

  const query = mergedParams.toString();
  const nextUrl = query ? `${pathname}?${query}` : pathname;
  const currentUrl = `${pathname}${window.location.search}`;

  if (currentUrl === nextUrl) {
    return;
  }

  window.history.replaceState(window.history.state, "", nextUrl);
}

function normalizeSelection(values: string[] | undefined, fallback: string[]): string[] {
  const normalized = [...new Set((values || []).map((value) => normalizeDiscoveryValue(value)).filter(Boolean))];
  return normalized.length > 0 ? normalized : [...fallback];
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areHomeFilterStatesEqual(left: HomeFilterState, right: HomeFilterState): boolean {
  return (
    left.search === right.search &&
    areStringArraysEqual(left.domain, right.domain) &&
    areStringArraysEqual(left.status, right.status) &&
    areStringArraysEqual(left.tags, right.tags)
  );
}

function parseMultiValueParam(rawValue: string | undefined, fallback: string[]): string[] {
  if (!rawValue) {
    return [...fallback];
  }

  return normalizeSelection(rawValue.split(","), fallback);
}

function isSearchScope(value: string | undefined): value is SearchScope {
  return value === "all" || value === "title" || value === "tags";
}

function isSortOption(value: string | undefined): value is HomeProjectSortOption {
  return value === "newest" || value === "oldest" || value === "title-asc" || value === "title-desc";
}

function isViewMode(value: string | undefined): value is ViewMode {
  return value === "grid" || value === "list";
}

function isGroupOption(value: string | undefined): value is HomeProjectGroupOption {
  return value === "status" || value === "none";
}

function buildHomeStateFromUrl(entries: Record<string, string>): PersistedHomeDiscoveryState | null {
  const hasUrlState = ["q", "domain", "medium", "status", "tags", "searchScope", "sort", "view", "group"].some((key) => {
    return typeof entries[key] === "string" && entries[key] !== "";
  });

  if (!hasUrlState) {
    return null;
  }

  return {
    search: entries.q ?? DEFAULT_HOME_STATE.search,
    domain: parseMultiValueParam(entries.domain ?? entries.medium, DEFAULT_HOME_STATE.domain),
    status: parseMultiValueParam(entries.status, DEFAULT_HOME_STATE.status),
    tags: entries.tags ? entries.tags.split(",").filter(Boolean) : [...DEFAULT_HOME_STATE.tags],
    searchScope: isSearchScope(entries.searchScope) ? entries.searchScope : DEFAULT_HOME_STATE.searchScope,
    sort: isSortOption(entries.sort) ? entries.sort : DEFAULT_HOME_STATE.sort,
    viewMode: isViewMode(entries.view) ? entries.view : DEFAULT_HOME_STATE.viewMode,
    group: isGroupOption(entries.group) ? entries.group : DEFAULT_HOME_STATE.group,
  };
}

function buildHomeUrlParams(state: PersistedHomeDiscoveryState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.search) params.set("q", state.search);

  if (state.domain.length > 0 && state.domain.join(",") !== DEFAULT_HOME_STATE.domain.join(",")) {
    params.set("domain", state.domain.join(","));
  }

  if (state.status.length > 0 && state.status.join(",") !== DEFAULT_HOME_STATE.status.join(",")) {
    params.set("status", state.status.join(","));
  }

  if (state.tags.length > 0) {
    params.set("tags", state.tags.join(","));
  }

  if (state.searchScope !== DEFAULT_HOME_STATE.searchScope) {
    params.set("searchScope", state.searchScope);
  }

  if (state.sort !== DEFAULT_HOME_STATE.sort) {
    params.set("sort", state.sort);
  }

  if (state.viewMode !== DEFAULT_HOME_STATE.viewMode) {
    params.set("view", state.viewMode);
  }

  if (state.group !== DEFAULT_HOME_STATE.group) {
    params.set("group", state.group);
  }

  return params;
}

function toStoredHomeState(value: unknown): PersistedHomeDiscoveryState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    search: typeof record.search === "string" ? record.search : DEFAULT_HOME_STATE.search,
    domain: normalizeSelection(
      Array.isArray(record.domain)
        ? (record.domain as string[])
        : Array.isArray(record.medium)
        ? (record.medium as string[])
        : undefined,
      DEFAULT_HOME_STATE.domain
    ),
    status: normalizeSelection(Array.isArray(record.status) ? (record.status as string[]) : undefined, DEFAULT_HOME_STATE.status),
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [...DEFAULT_HOME_STATE.tags],
    searchScope: isSearchScope(typeof record.searchScope === "string" ? record.searchScope : undefined)
      ? (record.searchScope as SearchScope)
      : DEFAULT_HOME_STATE.searchScope,
    sort: isSortOption(typeof record.sort === "string" ? record.sort : undefined)
      ? (record.sort as HomeProjectSortOption)
      : DEFAULT_HOME_STATE.sort,
    viewMode: isViewMode(typeof record.viewMode === "string" ? record.viewMode : undefined)
      ? (record.viewMode as ViewMode)
      : DEFAULT_HOME_STATE.viewMode,
    group: isGroupOption(typeof record.group === "string" ? record.group : undefined)
      ? (record.group as HomeProjectGroupOption)
      : DEFAULT_HOME_STATE.group,
  };
}

export function PortfolioClient({ projects, onProjectSelect }: PortfolioClientProps) {
  const [filters, setFilters] = useState<HomeFilterState>({
    search: DEFAULT_HOME_STATE.search,
    domain: [...DEFAULT_HOME_STATE.domain],
    status: [...DEFAULT_HOME_STATE.status],
    tags: [...DEFAULT_HOME_STATE.tags],
  });
  const [searchScope, setSearchScope] = useState<SearchScope>(DEFAULT_HOME_STATE.searchScope);
  const [sort, setSort] = useState<HomeProjectSortOption>(DEFAULT_HOME_STATE.sort);
  const [group, setGroup] = useState<HomeProjectGroupOption>(DEFAULT_HOME_STATE.group);
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_HOME_STATE.viewMode);
  const [initialized, setInitialized] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const projectHeading = getSelectedDomainHeading(filters.domain);

  const getCurrentState = useCallback((
    overrides?: Partial<PersistedHomeDiscoveryState>
  ): PersistedHomeDiscoveryState => ({
    search: overrides?.search ?? filters.search,
    domain: overrides?.domain ?? filters.domain,
    status: overrides?.status ?? filters.status,
    tags: overrides?.tags ?? filters.tags,
    searchScope: overrides?.searchScope ?? searchScope,
    sort: overrides?.sort ?? sort,
    viewMode: overrides?.viewMode ?? viewMode,
    group: overrides?.group ?? group,
  }), [filters.domain, filters.search, filters.status, filters.tags, group, searchScope, sort, viewMode]);

  const persistHomeState = useCallback((state: PersistedHomeDiscoveryState): void => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("portfolio.filters.v1", JSON.stringify(state));
      }
    } catch {
      // Ignore storage errors and rely on in-memory state.
    }
  }, []);

  const syncHomeState = useCallback((overrides?: Partial<PersistedHomeDiscoveryState>): void => {
    const nextState = getCurrentState(overrides);
    persistHomeState(nextState);

    if (!initialized) {
      return;
    }

    try {
      replaceHomeUrl(buildHomeUrlParams(nextState));
    } catch {
      // Ignore history update failures and rely on sessionStorage.
    }
  }, [getCurrentState, initialized, persistHomeState]);

  const toggleGroupCollapsed = useCallback((groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }, []);

  useEffect(() => {
    const urlState = buildHomeStateFromUrl(readWindowSearchEntries());
    let nextState = DEFAULT_HOME_STATE;

    if (urlState) {
      nextState = urlState;
    } else {
      try {
        const rawSession = typeof window !== "undefined" ? window.sessionStorage.getItem("portfolio.filters.v1") : null;
        const rawLocal = typeof window !== "undefined" ? window.localStorage.getItem("portfolio.filters.v1") : null;
        const raw = rawSession ?? rawLocal;

        if (raw) {
          const parsed = JSON.parse(raw);
          const stored = toStoredHomeState(parsed);
          if (stored) {
            nextState = stored;
          }
        }
      } catch {
        // Ignore restore errors and fall back to defaults.
      }
    }

    setFilters({
      search: nextState.search,
      domain: nextState.domain,
      status: nextState.status,
      tags: nextState.tags,
    });
    setSearchScope(nextState.searchScope);
    setSort(nextState.sort);
    setGroup(nextState.group);
    setViewMode(nextState.viewMode);
    setInitialized(true);
  }, []);

  const handleFilterChange = useCallback((next: {
    search?: string;
    domain?: string[];
    status?: string[];
    tags?: string[];
    searchScope?: SearchScope;
  }) => {
    const nextFilters = {
      search: next.search || "",
      domain: normalizeSelection(next.domain, DEFAULT_HOME_STATE.domain),
      status: normalizeSelection(next.status, DEFAULT_HOME_STATE.status),
      tags: next.tags || [],
    };
    const nextSearchScope = next.searchScope ?? searchScope;

    if (areHomeFilterStatesEqual(filters, nextFilters) && searchScope === nextSearchScope) {
      return;
    }

    if (!areHomeFilterStatesEqual(filters, nextFilters)) {
      setFilters(nextFilters);
    }

    if (searchScope !== nextSearchScope) {
      setSearchScope(nextSearchScope);
    }

    syncHomeState({
      ...nextFilters,
      searchScope: nextSearchScope,
    });
  }, [filters, searchScope, syncHomeState]);

  useEffect(() => {
    if (!initialized) return;
    syncHomeState({ sort, group, viewMode });
  }, [group, initialized, sort, syncHomeState, viewMode]);

  const publicProjects = useMemo(() => {
    return projects.filter((project) => {
      const visibility = (project as unknown as { visibility?: string })?.visibility;
      return typeof visibility === "string" ? visibility === "public" : true;
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return publicProjects.filter((project) => {
      if (searchTerm) {
        const inTitle =
          project.title.toLowerCase().includes(searchTerm) ||
          (project.subtitle || "").toLowerCase().includes(searchTerm);
        const inTags = (project.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm));
        const inSummary =
          (project.oneLiner || "").toLowerCase().includes(searchTerm) ||
          (project.summary || "").toLowerCase().includes(searchTerm) ||
          (project.description || "").toLowerCase().includes(searchTerm);

        if (searchScope === "title" && !inTitle) return false;
        if (searchScope === "tags" && !inTags) return false;
        if (searchScope === "all" && !inTitle && !inSummary && !inTags) return false;
      }

      if (!(filters.domain.length === 1 && filters.domain[0] === "all")) {
        const projectDomain = normalizeDiscoveryValue(project.domain);
        if (!filters.domain.some((domain) => domain === projectDomain)) return false;
      }

      if (!(filters.status.length === 1 && filters.status[0] === "all")) {
        const projectStatus = normalizeDiscoveryValue(project.status);
        if (!filters.status.some((status) => status === projectStatus)) return false;
      }

      if (filters.tags.length > 0) {
        const projectTags = (project.tags || []).map((tag) => tag.toLowerCase());
        const requiredTags = filters.tags.map((tag) => tag.toLowerCase());
        if (!requiredTags.every((tag) => projectTags.includes(tag))) return false;
      }

      return true;
    });
  }, [filters.domain, filters.search, filters.status, filters.tags, publicProjects, searchScope]);

  const sortedProjects = useMemo(() => sortProjects(filteredProjects, sort), [filteredProjects, sort]);
  const groupedProjects = useMemo(
    () => (group === "status" ? groupProjectsByStatus(sortedProjects) : []),
    [group, sortedProjects]
  );

  const handleProjectSelect = (project: Project) => {
    if (onProjectSelect) {
      onProjectSelect(project);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(getProjectHref(project));
    }
  };

  const sortField =
    sort === "title-asc" || sort === "title-desc"
      ? "title"
      : sort === "newest"
      ? "updatedAt"
      : "createdAt";

  return (
    <>
      <FeaturedCarousel projects={publicProjects} onProjectSelect={handleProjectSelect} />

      <div id="projects" className="mb-4 scroll-mt-24">
        <h2 className="mb-4 text-lg font-semibold text-foreground md:text-xl">{projectHeading}</h2>
      </div>

      {initialized ? (
        <ProjectFilters
          projects={projects}
          onFilterChange={handleFilterChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSortChange={setSort}
          sort={sort}
          group={group}
          onGroupChange={setGroup}
          totalCount={publicProjects.length}
          visibleCount={sortedProjects.length}
          initialSearch={filters.search}
          initialDomain={filters.domain}
          initialStatus={filters.status}
          initialTags={filters.tags}
          initialSearchScope={searchScope}
          defaultDomainSelection={DEFAULT_HOME_STATE.domain}
          defaultSort={DEFAULT_HOME_STATE.sort}
          defaultGroup={DEFAULT_HOME_STATE.group}
        />
      ) : null}

      {group === "status" ? (
        <div data-testid="project-group-list" className="space-y-8">
          {groupedProjects.map((section) => (
            <section
              key={section.key}
              data-testid="project-list-group"
              data-group-key={section.key}
              className="space-y-4"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between border-b border-border/60 pb-2 text-left"
                aria-expanded={!collapsedGroups[section.key]}
                onClick={() => toggleGroupCollapsed(section.key)}
              >
                <span className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      collapsedGroups[section.key] ? "" : "rotate-90"
                    )}
                  />
                  <h3
                    data-testid="project-list-group-heading"
                    className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    {section.label}
                  </h3>
                </span>
                <span className="text-xs text-muted-foreground">{section.projects.length}</span>
              </button>

              {!collapsedGroups[section.key] ? (
                <ProjectList
                  viewMode={viewMode}
                  projects={section.projects}
                  onProjectSelect={handleProjectSelect}
                  sortField={sortField}
                />
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <ProjectList
          viewMode={viewMode}
          projects={sortedProjects}
          onProjectSelect={handleProjectSelect}
          sortField={sortField}
        />
      )}
    </>
  );
}
