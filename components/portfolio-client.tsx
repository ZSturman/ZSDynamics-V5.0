"use client";
import { useMemo, useState, useEffect } from "react";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectList } from "@/components/project-list/project-list";
import type { Project } from "@/types";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FeaturedCarousel } from "./project-list/featured-carousel";

interface PortfolioClientProps {
  projects: Project[];
}

export function PortfolioClient({ projects }: PortfolioClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Initialize from URL params once on mount
  useEffect(() => {
    // If there are any filter/query params present, prefer them.
    // Otherwise restore previously-saved filters from sessionStorage (fallback to localStorage for older data).
    const spEntries: Record<string, string> = searchParams
      ? Object.fromEntries(Array.from(searchParams.entries()))
      : {}
    const hasFilterParams = [
      "q",
      "medium",
      "mediums",
      "status",
      "tags",
      "searchScope",
      "sort",
      "view",
    ].some((k) => typeof spEntries[k] === "string" && spEntries[k] !== "")

    if (hasFilterParams) {
      const sp = spEntries
      // parse filters
      const urlSearch = sp.q ?? ""
      // legacy `medium` used as domain; prefer `domain` param
      const urlDomain = sp.domain ? sp.domain.split(",").filter(Boolean) : (sp.medium ? sp.medium.split(",").filter(Boolean) : ["all"])
      const urlMediums = sp.mediums ? sp.mediums.split(",").filter(Boolean) : ["all"]
      const urlStatus = sp.status ? sp.status.split(",").filter(Boolean) : ["all"]
      const urlTags = sp.tags ? sp.tags.split(",").filter(Boolean) : []
      const urlSearchScope = (sp.searchScope as "all" | "title" | "tags") || "any"
      const urlSort = (typeof sp.sort === "string" ? sp.sort : "newest") as "newest" | "oldest" | "title-asc" | "title-desc"
      const urlView = (typeof sp.view === "string" ? sp.view : "list") as "grid" | "list"
      setFilters({ search: urlSearch, medium: urlDomain, status: urlStatus, tags: urlTags })
      setExplicitMediums(urlMediums)
      setSearchScope(urlSearchScope)
      setSort(urlSort)
      setViewMode(urlView === "grid" ? "grid" : "list")
    } else {
      try {
        // Prefer sessionStorage (per-tab/session persistence). If nothing is there, fall back to localStorage
        const rawSession = typeof window !== "undefined" ? window.sessionStorage.getItem("portfolio.filters.v1") : null
        const rawLocal = typeof window !== "undefined" ? window.localStorage.getItem("portfolio.filters.v1") : null
        const raw = rawSession ?? rawLocal
        if (raw) {
          const saved = JSON.parse(raw)
          if (saved) {
            // restored from session/sessionStorage/localStorage
            setFilters({ search: saved.search || "", medium: saved.medium || ["all"], status: saved.status || ["all"], tags: saved.tags || [] })
            setExplicitMediums(saved.explicitMediums || ["all"])
            setSearchScope(saved.searchScope || "all")
            setSort(saved.sort || "newest")
            setViewMode(saved.viewMode === "grid" ? "grid" : "list")
          }
        }
      } catch {
        // ignore restore errors
      }
    }
    // mark that initial restore has completed so subsequent sync effects may run
    setInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // active filters state (filters.medium represents selected DOMAINs for compatibility)
  const [filters, setFilters] = useState<{
    search: string;
    medium: string[]; // domain values
    status: string[];
    tags: string[];
  }>({ search: "", medium: ["all"], status: ["all"], tags: [] });
  // explicit medium selections (e.g. Mobile/Desktop/CLI/Novel)
  const [explicitMediums, setExplicitMediums] = useState<string[]>(["all"])
  // search scope: any/title/tags
  const [searchScope, setSearchScope] = useState<"all" | "title" | "tags">("all")

  const [sort, setSort] = useState<
    "newest" | "oldest" | "title-asc" | "title-desc"
  >("newest");

  type IncomingFilters = {
    search?: string
    domain?: string[]
    medium?: string[]
    mediums?: string[]
    status?: string[]
    tags?: string[]
    searchScope?: "all" | "title" | "tags"
  }

  const handleFilterChange = (next: IncomingFilters) => {
    // next may include { search, domain, medium, status, tags, searchScope }
    const domainSelection = next.domain ?? next.medium ?? ["all"]
    const explicit = next.mediums ?? next.medium ?? ["all"]
    const adapted = { search: next.search || "", medium: domainSelection, status: next.status || ["all"], tags: next.tags || [] }
    setFilters(adapted)
    setExplicitMediums(Array.isArray(explicit) ? explicit : [explicit])
    if (next.searchScope) setSearchScope(next.searchScope)

  // save to sessionStorage so leaving the main list and returning restores
    persistFiltersToSessionStorage({
      search: adapted.search || "",
      medium: adapted.medium || ["all"],
      status: adapted.status || ["all"],
      tags: adapted.tags || [],
      explicitMediums: Array.isArray(explicit) ? explicit : [explicit],
      searchScope: next.searchScope ?? searchScope,
    })

    // push to URL (encode domain as legacy `medium` param, explicit as `mediums`) so the main list page reflects the filters
    // Only update the URL if we're on the main list path (safety check)
    // Only add non-default query parameters to keep URL clean
    const scope = next.searchScope ?? searchScope
    const params = new URLSearchParams()
    
    // Only add params that differ from defaults
    if (adapted.search) params.set("q", adapted.search)
    
    const mediumValue = (adapted.medium || ["all"]).filter(Boolean)
    if (mediumValue.length > 0 && !(mediumValue.length === 1 && mediumValue[0] === "all")) {
      params.set("medium", mediumValue.join(","))
    }
    
    const mediumsValue = (explicit || ["all"]).filter(Boolean)
    if (mediumsValue.length > 0 && !(mediumsValue.length === 1 && mediumsValue[0] === "all")) {
      params.set("mediums", mediumsValue.join(","))
    }
    
    const statusValue = (adapted.status || ["all"]).filter(Boolean)
    if (statusValue.length > 0 && !(statusValue.length === 1 && statusValue[0] === "all")) {
      params.set("status", statusValue.join(","))
    }
    
    const tagsValue = (adapted.tags || []).filter(Boolean)
    if (tagsValue.length > 0) params.set("tags", tagsValue.join(","))
    
    if (scope !== "all") params.set("searchScope", scope)
    if (sort !== "newest") params.set("sort", sort)
    if (viewMode !== "list") params.set("view", viewMode)
    
    try {
      const url = params.toString() ? `?${params.toString()}` : pathname || "/"
      if (initialized && (!pathname || pathname === "/")) router.replace(url)
    } catch {
      // router.replace may throw in certain environments; ignore and rely on sessionStorage
    }
  };

  // helper: persist current filter state to sessionStorage.
  const [initialized, setInitialized] = useState(false)

  function persistFiltersToSessionStorage(overrides?: Partial<{
    search: string;
    medium: string[];
    status: string[];
    tags: string[];
    explicitMediums: string[];
    searchScope: string;
    sort: typeof sort;
    viewMode: typeof viewMode;
  }>) {
    try {
      const toSave = {
        search: overrides?.search ?? filters.search ?? "",
        medium: overrides?.medium ?? filters.medium ?? ["all"],
        status: overrides?.status ?? filters.status ?? ["all"],
        tags: overrides?.tags ?? filters.tags ?? [],
        explicitMediums: overrides?.explicitMediums ?? explicitMediums ?? ["all"],
        searchScope: overrides?.searchScope ?? searchScope ?? "all",
        sort: overrides?.sort ?? sort,
        viewMode: overrides?.viewMode ?? viewMode,
      }
      if (typeof window !== "undefined") window.sessionStorage.setItem("portfolio.filters.v1", JSON.stringify(toSave))
    } catch {
      // ignore storage errors
    }
  }

  // Get all public projects for the list
  const publicProjects = useMemo(() => {
    return projects.filter((p) => {
      const vis = (p as unknown as { visibility?: string })?.visibility;
      const isPublic = typeof vis === "string" ? vis === "public" : true;
      return isPublic;
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const s = filters.search.trim().toLowerCase();

  return publicProjects.filter((p) => {
      // search matches according to searchScope
      if (s) {
        const inTitle = p.title.toLowerCase().includes(s) || (p.subtitle || "").toLowerCase().includes(s)
        const inTags = (p.tags || []).some((t) => t.toLowerCase().includes(s))
        const inSummary = (p.summary || "").toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s)
        if (searchScope === "title" && !inTitle) return false
        if (searchScope === "tags" && !inTags) return false
        if (searchScope === "all" && !inTitle && !inSummary && !inTags) return false
      }

      // domain filter: user selects domain ids
      if (
        filters.medium &&
        !(
          filters.medium.length === 0 ||
          (filters.medium.length === 1 && filters.medium[0] === "all")
        )
      ) {
        const projDomain = String(p.domain || "").toLowerCase();
        const matchesDomain = filters.medium.some((m) => projDomain === m.toLowerCase())
        if (!matchesDomain) return false
      }

      // status filter (multi-select): project status must match one of the selected, unless "all" selected
      if (
        filters.status &&
        !(
          filters.status.length === 0 ||
          (filters.status.length === 1 && filters.status[0] === "all")
        )
      ) {
        const status = (p as unknown as { status?: string })?.status;
        if (!status) return false;
        if (!filters.status.some((s) => s === status)) return false;
      }

      // explicit mediums filter: if user chose explicit mediums, ensure project has any of them
      if (explicitMediums && !(explicitMediums.length === 1 && explicitMediums[0] === "all")) {
        const projectMediums = new Set<string>()
        ;((p as Project) as unknown as { mediums?: string[] }).mediums?.forEach((m: string) => m && projectMediums.add(m.toLowerCase()))
        ;((p as Project) as unknown as { scriptMediums?: string[] }).scriptMediums?.forEach((m: string) => m && projectMediums.add(m.toLowerCase()))
        ;((p as Project) as unknown as { gameMediums?: string[] }).gameMediums?.forEach((m: string) => m && projectMediums.add(m.toLowerCase()))
        const required = explicitMediums.map((m) => m.toLowerCase())
        if (!required.some((r) => projectMediums.has(r))) return false
      }

      // tags filter: all selected tags must be present
      if (filters.tags && filters.tags.length > 0) {
        const projectTags = (p.tags || []).map((t) => t.toLowerCase());
        const required = filters.tags.map((t) => t.toLowerCase());
        if (!required.every((t) => projectTags.includes(t))) return false;
      }

      return true;
    });
  }, [publicProjects, filters, explicitMediums, searchScope]);

  const sortedProjects = useMemo(() => {
    const copy = [...filteredProjects];
    function toTimestamp(v: unknown) {
      if (v == null || v === "") return 0;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        // numeric string (unix timestamp) -> number
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
        // try ISO / date parse
        const d = Date.parse(v);
        return Number.isNaN(d) ? 0 : d;
      }
      if (v instanceof Date) return v.getTime();
      return 0;
    }
    switch (sort) {
      case "newest":
        return copy.sort((a, b) =>
          // newest first -> compare numeric timestamps using updatedAt
          toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
        );
      case "oldest":
        return copy.sort((a, b) =>
          // oldest first -> ascending timestamps using createdAt
          toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
        );
      case "title-asc":
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc":
        return copy.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return copy;
    }
  }, [filteredProjects, sort]);

  // Sync sort/view changes to URL
  useEffect(() => {
    if (!initialized) return

    // persist to sessionStorage
    try {
      const savedRaw = typeof window !== "undefined" ? window.sessionStorage.getItem("portfolio.filters.v1") : null
      const saved = savedRaw ? JSON.parse(savedRaw) : {}
      const toSave = {
        ...saved,
        sort,
        viewMode,
      }
      if (typeof window !== "undefined") window.sessionStorage.setItem("portfolio.filters.v1", JSON.stringify(toSave))
    } catch {
      console.error("Failed to save sort/view to sessionStorage")
    }

    // also update URL if on main list - only add non-default params
    try {
      if (!pathname || pathname === "/") {
        const params = new URLSearchParams()
        
        // Preserve existing filter params
        if (filters.search) params.set("q", filters.search)
        
        const mediumValue = (filters.medium || ["all"]).filter(Boolean)
        if (mediumValue.length > 0 && !(mediumValue.length === 1 && mediumValue[0] === "all")) {
          params.set("medium", mediumValue.join(","))
        }
        
        const mediumsValue = (explicitMediums || ["all"]).filter(Boolean)
        if (mediumsValue.length > 0 && !(mediumsValue.length === 1 && mediumsValue[0] === "all")) {
          params.set("mediums", mediumsValue.join(","))
        }
        
        const statusValue = (filters.status || ["all"]).filter(Boolean)
        if (statusValue.length > 0 && !(statusValue.length === 1 && statusValue[0] === "all")) {
          params.set("status", statusValue.join(","))
        }
        
        const tagsValue = (filters.tags || []).filter(Boolean)
        if (tagsValue.length > 0) params.set("tags", tagsValue.join(","))
        
        if (searchScope !== "all") params.set("searchScope", searchScope)
        if (sort !== "newest") params.set("sort", sort)
        if (viewMode !== "list") params.set("view", viewMode)
        
        const url = params.toString() ? `?${params.toString()}` : pathname || "/"
        router.replace(url)
      }
    } catch {
      // ignore router errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, viewMode])

  return (
    <>
      {/* Featured Carousel */}
      <FeaturedCarousel projects={publicProjects} />
      
      {/* Project List Header */}
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
          All Projects
        </h2>
      </div>

      {/* Filters */}
      {initialized ? (
        <ProjectFilters
          projects={projects}
          onFilterChange={handleFilterChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSortChange={(s) => setSort(s)}
          sort={sort}
          totalCount={publicProjects.length}
          visibleCount={filteredProjects.length}
          initialSearch={filters.search}
          initialMedium={filters.medium}
          initialStatus={filters.status}
          initialTags={filters.tags}
          initialSearchScope={searchScope}
        />
      ) : null}
      
      <ProjectList 
        viewMode={viewMode} 
        projects={sortedProjects}
        sortField={
          sort === "title-asc" || sort === "title-desc" 
            ? "title" 
            : sort === "newest"
              ? "updatedAt"
              : "createdAt"
        }
      />
    </>
  );
}
