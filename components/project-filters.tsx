"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Grid3X3, List, Search, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HOME_DOMAIN,
  getProjectGroupLabel,
  getProjectSortLabel,
  getProjectStatusLabel,
  type HomeProjectGroupOption,
  type HomeProjectSortOption,
} from "@/lib/project-discovery";
import type { Project } from "@/types";

type SearchScope = "all" | "tags" | "title";
type OpenMenu = "view" | null;
type ViewOptionsSection = "filters" | "group" | "sort";

type ProjectFilterChange = {
  search: string;
  domain: string[];
  status: string[];
  tags: string[];
  searchScope: SearchScope;
};

interface ProjectFiltersProps {
  projects?: Project[];
  onFilterChange?: (filters: ProjectFilterChange) => void;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  onSortChange?: (sort: HomeProjectSortOption) => void;
  sort?: HomeProjectSortOption;
  group?: HomeProjectGroupOption;
  onGroupChange?: (group: HomeProjectGroupOption) => void;
  totalCount?: number;
  visibleCount?: number;
  initialSearch?: string;
  initialSearchScope?: SearchScope;
  initialDomain?: string[];
  initialStatus?: string[];
  initialTags?: string[];
  defaultDomainSelection?: string[];
  defaultSort?: HomeProjectSortOption;
  defaultGroup?: HomeProjectGroupOption;
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueNormalizedValues(values: string[]): string[] {
  return [...new Set(values.map(normalizeValue).filter(Boolean))];
}

function areSelectionsEqual(left: string[], right: string[]): boolean {
  const normalizedLeft = [...uniqueNormalizedValues(left)].sort();
  const normalizedRight = [...uniqueNormalizedValues(right)].sort();

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseSearchQuery(query: string): { scope: SearchScope; term: string; filterType?: "domain" | "status" | "tags" } {
  const trimmed = query.trim();
  if (!trimmed) return { scope: "all", term: "" };

  const domainMatch = trimmed.match(/^domain:(.*)$/i);
  const statusMatch = trimmed.match(/^status:(.*)$/i);
  const tagsMatch = trimmed.match(/^tags?:(.*)$/i);
  const titleMatch = trimmed.match(/^title:(.*)$/i);

  if (domainMatch) return { scope: "all", term: domainMatch[1].trim(), filterType: "domain" };
  if (statusMatch) return { scope: "all", term: statusMatch[1].trim(), filterType: "status" };
  if (tagsMatch) return { scope: "tags", term: tagsMatch[1].trim(), filterType: "tags" };
  if (titleMatch) return { scope: "title", term: titleMatch[1].trim() };

  return { scope: "all", term: trimmed };
}

function getFilterChangeSignature(filters: ProjectFilterChange): string {
  return JSON.stringify([
    filters.search,
    filters.domain,
    filters.status,
    filters.tags,
    filters.searchScope,
  ]);
}


function MenuSurface({
  children,
  widthClassName = "w-56",
}: {
  children: React.ReactNode;
  widthClassName?: string;
}) {
  return (
    <div
      role="menu"
      className={cn(
        "absolute left-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-lg",
        widthClassName
      )}
    >
      {children}
    </div>
  );
}

function MenuSectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5 text-sm font-medium text-foreground">{children}</div>;
}

function MenuSectionTrigger({
  children,
  expanded,
  onClick,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span>{children}</span>
      <ChevronRight className={cn("h-4 w-4 transition-transform", expanded ? "rotate-90" : "")} />
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}

function MenuCheckboxItem({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

function MenuRadioItem({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function ProjectFilters({
  projects = [],
  onFilterChange,
  viewMode = "grid",
  onViewModeChange,
  onSortChange,
  sort = "newest",
  group = "status",
  onGroupChange,
  totalCount,
  visibleCount,
  initialSearch = "",
  initialDomain = [DEFAULT_HOME_DOMAIN],
  initialStatus = ["all"],
  initialTags = [],
  defaultDomainSelection = [DEFAULT_HOME_DOMAIN],
  defaultSort = "newest",
  defaultGroup = "status",
}: ProjectFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState(uniqueNormalizedValues(initialDomain));
  const [selectedStatuses, setSelectedStatuses] = useState(uniqueNormalizedValues(initialStatus));
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [openSections, setOpenSections] = useState<Record<ViewOptionsSection, boolean>>({
    filters: false,
    group: false,
    sort: false,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const onFilterChangeRef = useRef(onFilterChange);
  const lastFilterChangeSignatureRef = useRef<string | null>(null);

  const defaultDomains = useMemo(
    () => uniqueNormalizedValues(defaultDomainSelection),
    [defaultDomainSelection]
  );

  const parsedSearchQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);

  const filterChange = useMemo<ProjectFilterChange>(() => ({
    search: parsedSearchQuery.term,
    domain: selectedDomains,
    status: selectedStatuses,
    tags: selectedTags,
    searchScope: parsedSearchQuery.scope,
  }), [parsedSearchQuery, selectedDomains, selectedStatuses, selectedTags]);

  const filterChangeSignature = useMemo(
    () => getFilterChangeSignature(filterChange),
    [filterChange]
  );

  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  }, [onFilterChange]);

  const domains = useMemo(() => {
    const values = new Set<string>();
    projects.forEach((project) => {
      if (project?.domain) values.add(String(project.domain).trim());
    });
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [projects]);

  const domainLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach((domain) => map.set(normalizeValue(domain), domain));
    return map;
  }, [domains]);

  const statuses = useMemo(() => {
    const values = new Set<string>();
    projects.forEach((project) => {
      if (project?.status) values.add(String(project.status).trim());
    });
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [projects]);

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    statuses.forEach((status) => map.set(normalizeValue(status), status));
    return map;
  }, [statuses]);

  const allTags = useMemo(() => {
    const values = new Set<string>();
    projects.forEach((project) => {
      if (Array.isArray(project.tags)) {
        project.tags.forEach((tag) => values.add(tag));
      }
    });
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [projects]);

  useEffect(() => {
    const parsed = parsedSearchQuery;

    if (!parsed.term) {
      setSuggestions([]);
      return;
    }

    if (parsed.filterType === "domain") {
      setSuggestions(
        domains.filter((domain) => domain.toLowerCase().includes(parsed.term.toLowerCase())).slice(0, 5)
      );
      return;
    }

    if (parsed.filterType === "status") {
      setSuggestions(
        statuses.filter((status) => status.toLowerCase().includes(parsed.term.toLowerCase())).slice(0, 5)
      );
      return;
    }

    if (parsed.filterType === "tags") {
      setSuggestions(
        allTags.filter((tag) => tag.toLowerCase().includes(parsed.term.toLowerCase())).slice(0, 5)
      );
      return;
    }

    setSuggestions([]);
  }, [allTags, domains, parsedSearchQuery, statuses]);

  useEffect(() => {
    if (lastFilterChangeSignatureRef.current === filterChangeSignature) {
      return;
    }

    lastFilterChangeSignatureRef.current = filterChangeSignature;
    onFilterChangeRef.current?.(filterChange);
  }, [filterChange, filterChangeSignature]);

  useEffect(() => {
    if (!openMenu) return;

    const activeRef = viewMenuRef;

    const handlePointerDown = (event: MouseEvent) => {
      if (!activeRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const handleSearchClear = () => {
    setSearchQuery("");
    setSuggestions([]);
    searchInputRef.current?.focus();
  };

  const toggleDomain = (value: string) => {
    const normalizedValue = normalizeValue(value);

    setSelectedDomains((current) => {
      if (normalizedValue === "all") {
        return ["all"];
      }

      const next = current.includes("all") ? [] : [...current];
      const exists = next.includes(normalizedValue);

      if (exists) {
        const filtered = next.filter((entry) => entry !== normalizedValue);
        return filtered.length > 0 ? filtered : [...defaultDomains];
      }

      return [...next, normalizedValue];
    });
    setOpenMenu(null);
  };

  const toggleStatus = (value: string) => {
    const normalizedValue = normalizeValue(value);

    setSelectedStatuses((current) => {
      if (normalizedValue === "all") {
        return ["all"];
      }

      const next = current.includes("all") ? [] : [...current];
      const exists = next.includes(normalizedValue);

      if (exists) {
        const filtered = next.filter((entry) => entry !== normalizedValue);
        return filtered.length > 0 ? filtered : ["all"];
      }

      return [...next, normalizedValue];
    });
    setOpenMenu(null);
  };

  const domainSummary = useMemo(() => {
    if (selectedDomains.includes("all")) return "All";
    const labels = selectedDomains.map((value) => domainLabelMap.get(value) || toTitleCase(value));
    if (labels.length <= 1) return labels[0] || "All";
    return `${labels[0]} +${labels.length - 1}`;
  }, [domainLabelMap, selectedDomains]);

  const statusSummary = useMemo(() => {
    if (selectedStatuses.includes("all")) return "All";
    const labels = selectedStatuses.map((value) => statusLabelMap.get(value) || getProjectStatusLabel(value));
    if (labels.length <= 1) return labels[0] || "All";
    return `${labels[0]} +${labels.length - 1}`;
  }, [selectedStatuses, statusLabelMap]);

  const hasCustomFilters =
    searchQuery.trim().length > 0 ||
    !areSelectionsEqual(selectedDomains, defaultDomains) ||
    !areSelectionsEqual(selectedStatuses, ["all"]) ||
    selectedTags.length > 0;

  const toggleSection = (section: ViewOptionsSection) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const removeDomainFilter = (value: string) => {
    const normalizedValue = normalizeValue(value);
    setSelectedDomains((current) => {
      const next = current.filter((entry) => entry !== normalizedValue);
      return next.length > 0 ? next : [...defaultDomains];
    });
  };

  const removeStatusFilter = (value: string) => {
    const normalizedValue = normalizeValue(value);
    setSelectedStatuses((current) => {
      const next = current.filter((entry) => entry !== normalizedValue);
      return next.length > 0 ? next : ["all"];
    });
  };

  const selectedCustomDomains = selectedDomains.filter(
    (value) => value !== "all" && !defaultDomains.includes(value)
  );
  const selectedCustomStatuses = selectedStatuses.filter((value) => value !== "all");

  return (
    <div className="mb-5 space-y-3">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search projects or use tags:react"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 pl-9 pr-9"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      const prefix = `${searchQuery.split(":")[0]}:`;
                      setSearchQuery(`${prefix}${suggestion}`);
                      setSuggestions([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div ref={viewMenuRef} className="relative">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="View options"
                aria-expanded={openMenu === "view"}
                data-testid="project-view-options-trigger"
                className="h-11 w-11"
                onClick={() => setOpenMenu((current) => (current === "view" ? null : "view"))}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                data-testid="project-view-mode-trigger"
                className="h-11 w-11"
                onClick={() => onViewModeChange?.(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
            </div>

            {openMenu === "view" ? (
              <MenuSurface widthClassName="right-0 left-auto w-80 space-y-1 p-2">
                <MenuSectionLabel>View options</MenuSectionLabel>
                <MenuDivider />

                <MenuSectionTrigger expanded={openSections.filters} onClick={() => toggleSection("filters")}>
                  Filters
                </MenuSectionTrigger>
                {openSections.filters ? (
                  <div className="space-y-1 pl-2">
                    <MenuSectionLabel>Domain</MenuSectionLabel>
                    <MenuCheckboxItem
                      label="All domains"
                      checked={selectedDomains.includes("all")}
                      onClick={() => toggleDomain("all")}
                    />
                    {domains.map((domain) => {
                      const normalizedDomain = normalizeValue(domain);
                      return (
                        <MenuCheckboxItem
                          key={domain}
                          label={domain}
                          checked={selectedDomains.includes(normalizedDomain)}
                          onClick={() => toggleDomain(domain)}
                        />
                      );
                    })}

                    <MenuDivider />

                    <MenuSectionLabel>Status</MenuSectionLabel>
                    <MenuCheckboxItem
                      label="All statuses"
                      checked={selectedStatuses.includes("all")}
                      onClick={() => toggleStatus("all")}
                    />
                    {statuses.map((status) => {
                      const normalizedStatus = normalizeValue(status);
                      return (
                        <MenuCheckboxItem
                          key={status}
                          label={status}
                          checked={selectedStatuses.includes(normalizedStatus)}
                          onClick={() => toggleStatus(status)}
                        />
                      );
                    })}
                  </div>
                ) : null}

                <MenuDivider />

                <MenuSectionTrigger expanded={openSections.group} onClick={() => toggleSection("group")}>
                  Group by
                </MenuSectionTrigger>
                {openSections.group ? (
                  <div className="space-y-1 pl-2">
                    <MenuRadioItem
                      label="Status"
                      checked={group === "status"}
                      onClick={() => {
                        onGroupChange?.("status");
                        setOpenMenu(null);
                      }}
                    />
                    <MenuRadioItem
                      label="None"
                      checked={group === "none"}
                      onClick={() => {
                        onGroupChange?.("none");
                        setOpenMenu(null);
                      }}
                    />
                  </div>
                ) : null}

                <MenuDivider />

                <MenuSectionTrigger expanded={openSections.sort} onClick={() => toggleSection("sort")}>
                  Sort by
                </MenuSectionTrigger>
                {openSections.sort ? (
                  <div className="space-y-1 pl-2">
                    <MenuRadioItem
                      label="Last updated"
                      checked={sort === "newest"}
                      onClick={() => {
                        onSortChange?.("newest");
                        setOpenMenu(null);
                      }}
                    />
                    <MenuRadioItem
                      label="Started earliest"
                      checked={sort === "oldest"}
                      onClick={() => {
                        onSortChange?.("oldest");
                        setOpenMenu(null);
                      }}
                    />
                    <MenuRadioItem
                      label="Title A-Z"
                      checked={sort === "title-asc"}
                      onClick={() => {
                        onSortChange?.("title-asc");
                        setOpenMenu(null);
                      }}
                    />
                    <MenuRadioItem
                      label="Title Z-A"
                      checked={sort === "title-desc"}
                      onClick={() => {
                        onSortChange?.("title-desc");
                        setOpenMenu(null);
                      }}
                    />
                  </div>
                ) : null}


              </MenuSurface>
            ) : null}
          </div>
        </div>


      {hasCustomFilters ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="project-active-filters">
          {searchQuery.trim() ? (
            <Badge variant="secondary" className="gap-1">
              {`Search: ${searchQuery}`}
              <button type="button" onClick={handleSearchClear} className="ml-1 hover:text-foreground">
                ×
              </button>
            </Badge>
          ) : null}

          {selectedCustomDomains.map((domain) => (
            <Badge key={domain} variant="secondary" className="gap-1">
              {`Domain: ${domainLabelMap.get(domain) || toTitleCase(domain)}`}
              <button
                type="button"
                onClick={() => removeDomainFilter(domain)}
                className="ml-1 hover:text-foreground"
              >
                ×
              </button>
            </Badge>
          ))}

          {selectedCustomStatuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {`Status: ${statusLabelMap.get(status) || getProjectStatusLabel(status)}`}
              <button
                type="button"
                onClick={() => removeStatusFilter(status)}
                className="ml-1 hover:text-foreground"
              >
                ×
              </button>
            </Badge>
          ))}

          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {`Tag: ${tag}`}
            </Badge>
          ))}

        </div>
      ) : null}
    </div>

    </div>
  );
}