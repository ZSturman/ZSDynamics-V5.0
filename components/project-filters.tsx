"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Project } from "@/types"
import { Search, X, Grid3X3, List, ArrowUpDown } from "lucide-react"
import { friendlyStatusLabel } from "@/lib/resource-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

type SearchScope = "all" | "tags" | "title"

interface ProjectFiltersProps {
  projects?: Project[];
  onFilterChange?: (filters: {
    search: string;
    domain: string[];
    medium: string[];
    status: string[];
    tags: string[];
    searchScope?: "all" | "title" | "tags";
  }) => void;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  onSortChange?: (s: "newest" | "oldest" | "title-asc" | "title-desc") => void;
  sort?: "newest" | "oldest" | "title-asc" | "title-desc";
  totalCount?: number;
  visibleCount?: number;
  initialSearch?: string;
  initialMedium?: string[];
  initialStatus?: string[];
  initialTags?: string[];
  initialSearchScope?: "all" | "title" | "tags";
}

export function ProjectFilters({
  projects = [],
  onFilterChange,
  viewMode = "grid",
  onViewModeChange,
  onSortChange,
  sort = "newest",
  initialSearch = "",
  initialMedium = ["all"],
  initialStatus = ["all"],
  initialTags = [],
}: ProjectFiltersProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(true)
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [selectedDomains, setSelectedDomains] = useState<string[]>(initialMedium)
  const [selectedMediums, setSelectedMediums] = useState<string[]>(["all"])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialStatus)
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)

  // Parse search query for regex-based filtering
  const parseSearchQuery = (query: string): {
    scope: SearchScope;
    term: string;
    filterType?: "domain" | "medium" | "status" | "tags";
  } => {
    const trimmed = query.trim()
    if (!trimmed) return { scope: "all", term: "" }

    // Check for prefix patterns: domain:, medium:, status:, tags:, title:
    const domainMatch = trimmed.match(/^domain:(.*)$/i)
    const mediumMatch = trimmed.match(/^medium:(.*)$/i)
    const statusMatch = trimmed.match(/^status:(.*)$/i)
    const tagsMatch = trimmed.match(/^tags?:(.*)$/i)
    const titleMatch = trimmed.match(/^title:(.*)$/i)

    if (domainMatch) return { scope: "all", term: domainMatch[1].trim(), filterType: "domain" }
    if (mediumMatch) return { scope: "all", term: mediumMatch[1].trim(), filterType: "medium" }
    if (statusMatch) return { scope: "all", term: statusMatch[1].trim(), filterType: "status" }
    if (tagsMatch) return { scope: "tags", term: tagsMatch[1].trim(), filterType: "tags" }
    if (titleMatch) return { scope: "title", term: titleMatch[1].trim() }

    return { scope: "all", term: trimmed }
  }

  // Derive available options from projects
  const domains = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      if (p?.domain) set.add(String(p.domain))
    })
    return Array.from(set).sort()
  }, [projects])

  const mediums = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      const maybeMediums = (p as unknown as { mediums?: unknown }).mediums
      if (Array.isArray(maybeMediums)) (maybeMediums as string[]).forEach((m) => m && set.add(String(m)))
      const maybeScript = (p as unknown as { scriptMediums?: unknown }).scriptMediums
      if (Array.isArray(maybeScript)) (maybeScript as string[]).forEach((m) => m && set.add(String(m)))
      const maybeGame = (p as unknown as { gameMediums?: unknown }).gameMediums
      if (Array.isArray(maybeGame)) (maybeGame as string[]).forEach((m) => m && set.add(String(m)))
    })
    return Array.from(set).sort()
  }, [projects])

  const statuses = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      const s = (p as unknown as { status?: string })?.status
      if (s) set.add(String(s))
    })
    return Array.from(set).sort()
  }, [projects])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      if (Array.isArray(p.tags)) p.tags.forEach(t => set.add(t))
    })
    return Array.from(set).sort()
  }, [projects])

  // Update suggestions based on search query
  useEffect(() => {
    const parsed = parseSearchQuery(searchQuery)
    if (!parsed.term) {
      setSuggestions([])
      return
    }

    const query = searchQuery.toLowerCase()
    let newSuggestions: string[] = []

    if (query.startsWith("domain:")) {
      newSuggestions = domains
        .filter(d => d.toLowerCase().includes(parsed.term.toLowerCase()))
        .slice(0, 5)
    } else if (query.startsWith("medium:")) {
      newSuggestions = mediums
        .filter(m => m.toLowerCase().includes(parsed.term.toLowerCase()))
        .slice(0, 5)
    } else if (query.startsWith("status:")) {
      newSuggestions = statuses
        .filter(s => s.toLowerCase().includes(parsed.term.toLowerCase()))
        .slice(0, 5)
    } else if (query.startsWith("tag:") || query.startsWith("tags:")) {
      newSuggestions = allTags
        .filter(t => t.toLowerCase().includes(parsed.term.toLowerCase()))
        .slice(0, 5)
    }

    setSuggestions(newSuggestions)
  }, [searchQuery, domains, mediums, statuses, allTags])

  // Auto-focus search input when opened
  useEffect(() => {
    if (!isSearchFocused && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchFocused])

  // Handle escape key to close search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && searchInputRef.current === document.activeElement) {
        setSearchQuery("")
        setSuggestions([])
        searchInputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isSearchFocused])

  // Propagate filter changes
  useEffect(() => {
    const parsed = parseSearchQuery(searchQuery)
    onFilterChange?.({
      search: parsed.term,
      domain: selectedDomains,
      medium: selectedMediums,
      status: selectedStatuses,
      tags: selectedTags,
      searchScope: parsed.scope,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedDomains, selectedMediums, selectedStatuses, selectedTags])

  // Notify sort changes
  useEffect(() => {
    if (!onSortChange) return
    onSortChange(sort)
  }, [sort, onSortChange])

  const activeFilterCount =
    (selectedDomains.includes("all") ? 0 : selectedDomains.length) +
    (selectedMediums.includes("all") ? 0 : selectedMediums.length) +
    (selectedStatuses.includes("all") ? 0 : selectedStatuses.length) +
    selectedTags.length +
    (searchQuery.trim() ? 1 : 0)

  const handleSearchClear = () => {
    setSearchQuery("")
    setSuggestions([])
  }

  const clearAllFilters = () => {
    setSelectedDomains(["all"])
    setSelectedMediums(["all"])
    setSelectedStatuses(["all"])
    setSelectedTags([])
    setSearchQuery("")
    setSuggestions([])
  }

  const removeDomainFilter = (domain: string) => {
    setSelectedDomains(prev => {
      const next = prev.filter(d => d !== domain)
      return next.length === 0 ? ["all"] : next
    })
  }

  const removeMediumFilter = (medium: string) => {
    setSelectedMediums(prev => {
      const next = prev.filter(m => m !== medium)
      return next.length === 0 ? ["all"] : next
    })
  }

  const removeStatusFilter = (status: string) => {
    setSelectedStatuses(prev => {
      const next = prev.filter(s => s !== status)
      return next.length === 0 ? ["all"] : next
    })
  }

  return (
    <div className="mb-4 space-y-3">
      {/* Single row with all controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search - collapsible */}

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search (e.g., tag:react, medium:video, status:completed, tags:react)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10"
            />
            <button
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const prefix = searchQuery.split(":")[0] + ":"
                      setSearchQuery(prefix + suggestion)
                      setSuggestions([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        

        {/* Spacer to push right-side controls */}
        <div className="flex-1" />

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[40px] min-w-[40px] p-0"
              title="Sort projects"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSortChange?.(v as typeof sort)}>
              <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title-asc">Title A-Z</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title-desc">Title Z-A</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode toggle - shows opposite of current */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewModeChange?.(viewMode === "grid" ? "list" : "grid")}
          className="min-h-[40px] min-w-[40px] p-0"
          title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
        >
          {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Active filter badges - only show when there are active filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 border-t">
          {searchQuery.trim() && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button onClick={handleSearchClear} className="ml-1 hover:text-foreground">
                ×
              </button>
            </Badge>
          )}
          {selectedDomains
            .filter((d) => d !== "all")
            .map((domain) => (
              <Badge key={domain} variant="secondary" className="gap-1">
                Domain: {domain}
                <button onClick={() => removeDomainFilter(domain)} className="ml-1 hover:text-foreground">
                  ×
                </button>
              </Badge>
            ))}
          {selectedMediums
            .filter((m) => m !== "all")
            .map((medium) => (
              <Badge key={medium} variant="secondary" className="gap-1">
                Medium: {medium}
                <button onClick={() => removeMediumFilter(medium)} className="ml-1 hover:text-foreground">
                  ×
                </button>
              </Badge>
            ))}
          {selectedStatuses
            .filter((s) => s !== "all")
            .map((status) => (
              <Badge key={status} variant="secondary" className="gap-1">
                Status: {friendlyStatusLabel(status) || status}
                <button onClick={() => removeStatusFilter(status)} className="ml-1 hover:text-foreground">
                  ×
                </button>
              </Badge>
            ))}
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="ml-auto h-8 px-2">
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
