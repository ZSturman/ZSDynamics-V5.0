
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

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
import { trackProjectFilter } from "@/lib/firebase-analytics";
import { getProjectHref } from "@/lib/project-paths";
import {
  EVIDENCE_FILTERS,
  FOCUS_AREAS,
  getFocusArea,
  getProjectEvidence,
  projectMatchesFocus,
  type EvidenceFilter,
  type FocusKey,
} from "@/lib/project-presentation";
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
  heading?: string;
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
  focus: FocusKey | null;
  evidence: EvidenceFilter[];
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
  group: "none",
  focus: null,
  evidence: [],
};

const HOME_DISCOVERY_STORAGE_KEY = "portfolio.filters.v2";
const LEGACY_HOME_DISCOVERY_STORAGE_KEY = "portfolio.filters.v1";
const HOME_DISCOVERY_PARAM_KEYS = ["q", "domain", "medium", "status", "tags", "searchScope", "sort", "view", "group", "focus", "has"] as const;

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

function parseFocus(value: unknown): FocusKey | null {
  return typeof value === "string" ? getFocusArea(value)?.key ?? null : null;
}

function parseEvidence(value: unknown): EvidenceFilter[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return EVIDENCE_FILTERS.map((filter) => filter.key).filter((key) => raw.includes(key));
}

function buildHomeStateFromUrl(entries: Record<string, string>): PersistedHomeDiscoveryState | null {
  const hasUrlState = HOME_DISCOVERY_PARAM_KEYS.some((key) => {
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
    focus: parseFocus(entries.focus),
    evidence: parseEvidence(entries.has),
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

  if (state.focus) params.set("focus", state.focus);
  if (state.evidence.length > 0) params.set("has", state.evidence.join(","));

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
    focus: parseFocus(record.focus),
    evidence: parseEvidence(record.evidence),
  };
}

export function PortfolioClient({ projects, onProjectSelect, heading }: PortfolioClientProps) {
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
  const [focus, setFocus] = useState<FocusKey | null>(DEFAULT_HOME_STATE.focus);
  const [evidence, setEvidence] = useState<EvidenceFilter[]>(DEFAULT_HOME_STATE.evidence);
  const focusArea = getFocusArea(focus);
  const projectHeading = focusArea ? `${focusArea.label} Projects` : getSelectedDomainHeading(filters.domain);

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
    focus: overrides && "focus" in overrides ? overrides.focus ?? null : focus,
    evidence: overrides?.evidence ?? evidence,
  }), [evidence, filters.domain, filters.search, filters.status, filters.tags, focus, group, searchScope, sort, viewMode]);

  const persistHomeState = useCallback((state: PersistedHomeDiscoveryState): void => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(HOME_DISCOVERY_STORAGE_KEY, JSON.stringify(state));
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
        const rawSession = typeof window !== "undefined" ? window.sessionStorage.getItem(HOME_DISCOVERY_STORAGE_KEY) : null;
        const rawLocal = typeof window !== "undefined" ? window.localStorage.getItem(HOME_DISCOVERY_STORAGE_KEY) : null;
        const rawLegacySession =
          typeof window !== "undefined" ? window.sessionStorage.getItem(LEGACY_HOME_DISCOVERY_STORAGE_KEY) : null;
        const rawLegacyLocal =
          typeof window !== "undefined" ? window.localStorage.getItem(LEGACY_HOME_DISCOVERY_STORAGE_KEY) : null;
        const raw = rawSession ?? rawLocal ?? rawLegacySession ?? rawLegacyLocal;
        const isLegacyState = !rawSession && !rawLocal && Boolean(rawLegacySession ?? rawLegacyLocal);

        if (raw) {
          const parsed = JSON.parse(raw);
          const stored = toStoredHomeState(parsed);
          if (stored) {
            nextState = isLegacyState ? { ...stored, group: DEFAULT_HOME_STATE.group } : stored;
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
    setFocus(nextState.focus);
    setEvidence(nextState.evidence);
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
      if (initialized) {
        if (!areStringArraysEqual(filters.domain, nextFilters.domain)) {
          trackProjectFilter({ filterType: "domain", filterValue: nextFilters.domain.join(",") });
        }
        if (!areStringArraysEqual(filters.status, nextFilters.status)) {
          trackProjectFilter({ filterType: "status", filterValue: nextFilters.status.join(",") });
        }
        if (!areStringArraysEqual(filters.tags, nextFilters.tags)) {
          trackProjectFilter({ filterType: "tag", filterValue: nextFilters.tags.join(",") || "none" });
        }
      }
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

  // Focus views span every domain, so a focus replaces the default
  // technology-only domain selection.
  const handleFocusChange = useCallback((nextFocus: FocusKey | null) => {
    const nextDomain =
      nextFocus && areStringArraysEqual(filters.domain, DEFAULT_HOME_STATE.domain) ? ["all"] : filters.domain;
    setFocus(nextFocus);
    trackProjectFilter({ filterType: "focus", filterValue: nextFocus ?? "all" });
    setFilters((current) => ({ ...current, domain: nextDomain }));
    syncHomeState({ focus: nextFocus, domain: nextDomain });
  }, [filters.domain, syncHomeState]);

  const handleEvidenceToggle = useCallback((key: EvidenceFilter) => {
    const nextEvidence = evidence.includes(key) ? evidence.filter((value) => value !== key) : [...evidence, key];
    setEvidence(nextEvidence);
    trackProjectFilter({ filterType: "evidence", filterValue: `${key}:${nextEvidence.includes(key) ? "on" : "off"}` });
    syncHomeState({ evidence: nextEvidence });
  }, [evidence, syncHomeState]);

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

      if (!projectMatchesFocus(project, focus)) return false;

      if (evidence.length > 0) {
        const available = getProjectEvidence(project);
        if (!evidence.every((key) => available[key])) return false;
      }

      return true;
    });
  }, [evidence, filters.domain, filters.search, filters.status, filters.tags, focus, publicProjects, searchScope]);

  const sortedProjects = useMemo(() => sortProjects(filteredProjects, sort), [filteredProjects, sort]);

  // One event per settled search, not per keystroke.
  const visibleProjectCount = sortedProjects.length;
  useEffect(() => {
    const term = filters.search.trim();
    if (!initialized || !term) return undefined;
    const timer = window.setTimeout(() => {
      trackProjectFilter({ filterType: "search", filterValue: term, resultCount: visibleProjectCount });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [filters.search, initialized, visibleProjectCount]);
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
      <div id="projects" className="mb-4 scroll-mt-24">
        {heading ? (
          <>
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">{heading}</h2>
            <p data-testid="project-archive-scope" className="mb-4 mt-1 text-sm text-muted-foreground">
              Showing {projectHeading.toLowerCase()} · {sortedProjects.length} of {publicProjects.length}
            </p>
          </>
        ) : (
          <h2 className="mb-4 text-lg font-semibold text-foreground md:text-xl">{projectHeading}</h2>
        )}
      </div>

      {initialized ? (
        <div className="mb-4 space-y-2" data-testid="project-focus-filters">
          <div role="group" aria-label="Focus area" className="flex flex-wrap gap-2">
            {[{ key: null, shortLabel: "All areas" }, ...FOCUS_AREAS].map((area) => {
              const active = focus === area.key;
              return (
                <button
                  key={area.key ?? "all"}
                  type="button"
                  aria-pressed={active}
                  data-testid={`project-focus-${area.key ?? "all"}`}
                  onClick={() => handleFocusChange(area.key as FocusKey | null)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {area.shortLabel}
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Available evidence" className="flex flex-wrap gap-2">
            {EVIDENCE_FILTERS.map((filter) => {
              const active = evidence.includes(filter.key);
              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={active}
                  data-testid={`project-evidence-${filter.key}`}
                  onClick={() => handleEvidenceToggle(filter.key)}
                  className={cn(
                    "min-h-8 rounded-md border px-2.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-dashed border-border/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active ? "✓ " : ""}{filter.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {initialized ? (
        <ProjectFilters
          key={focus ?? "all-focus"}
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
