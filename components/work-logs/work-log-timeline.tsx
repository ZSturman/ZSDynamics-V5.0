"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  GraduationCap,
  Hammer,
  LayoutList,
  PencilLine,
  Search,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MediaDisplay } from "@/components/ui/media-display";
import { PassiveChip } from "@/components/ui/passive-chip";
import { ProjectIdentity } from "@/components/ui/project-identity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, getOptimizedImageExt, getOptimizedMediaPath, isImageFile, isVideoFile } from "@/lib/utils";
import {
  formatWorkLogSessionRange,
  getWorkLogDurationMinutes,
  getWorkLogStart,
  getWorkLogSummary,
  getWorkLogTimestamp,
  getWorkLogTitle,
  toTimestamp,
  type WorkLogOverviewSummary,
  type WorkLogProjectOption,
  type WorkLogProjectSummary,
  type WorkLogSessionSummary,
  type WorkLogWithProject,
} from "@/lib/work-logs";

type DashboardTab = "overview" | "activity" | "projects";
type ActivityLayout = "list" | "timeline";
type TimelineSortOrder = "newest" | "oldest";

interface WorkLogsDashboardProps {
  logs: WorkLogWithProject[];
  projectOptions: WorkLogProjectOption[];
  projectSummaries: WorkLogProjectSummary[];
  overviewSummary: WorkLogOverviewSummary;
  sessionSummaries: WorkLogSessionSummary[];
  emptyText?: string;
  initialProjectSlug?: string;
  onProjectFilterChange?: (projectSlug?: string) => void;
}

interface TimelineGroup {
  key: string;
  label: string;
  logs: WorkLogWithProject[];
}

interface WorkLogAssetDisplay {
  key: string;
  label: string;
  href: string;
  source: "asset" | "resource" | "asset-url";
  previewCandidates: string[];
  mediaType: "image" | "video" | "file";
}

const ALL_FILTER = "all";

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatShortDate(value?: string): string {
  if (!value) return "No date";
  return formatDate(value, { month: "short", day: "numeric" }) || "No date";
}

function formatLongDate(value?: string): string {
  if (!value) return "No date";
  return formatDate(value, { month: "long", day: "numeric", year: "numeric" }) || "No date";
}

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return "No date range";
  if (!start || !end) return formatLongDate(start || end);

  const startLabel = formatDate(start, { month: "short", day: "numeric", year: "numeric" });
  const endLabel = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
  if (!startLabel || !endLabel) return "No date range";
  return `${startLabel} - ${endLabel}`;
}

function formatSessionRange(log: WorkLogWithProject): string {
  return formatWorkLogSessionRange(log);
}

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function getStringFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return maybeString(value);
  const record = asRecord(value);
  if (!record) return undefined;
  return maybeString(record.path) || maybeString(record.url) || maybeString(record.href);
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isPdfFile(path?: string | null): boolean {
  if (!path) return false;
  return path.split("?")[0]?.split("#")[0]?.toLowerCase().endsWith(".pdf") || false;
}

function toOptimizedPath(value: string): string {
  if (!value || isAbsoluteUrl(value)) return value;
  if (value.includes("-optimized") || value.includes("-thumb") || value.includes("-placeholder")) return value;

  if (isVideoFile(value)) {
    return value.replace(/\.[^.]+$/, "-optimized.mp4");
  }

  if (isImageFile(value)) {
    const ext = getOptimizedImageExt(value);
    return value.replace(/\.[^.]+$/, `-optimized${ext}`);
  }

  return value;
}

function buildAssetPathCandidates(pathValue: string, projectFolderName?: string): string[] {
  const value = pathValue.trim();
  if (!value) return [];

  if (isAbsoluteUrl(value) || value.startsWith("/")) {
    if (value.startsWith("/")) {
      const optimized = !value.includes("-optimized") ? toOptimizedPath(value) : value;
      return Array.from(new Set([optimized, value]));
    }
    return [value];
  }

  const normalized = value.replace(/^\.\//, "");
  if (!projectFolderName) {
    const rootPath = `/${normalized}`;
    const optimized = toOptimizedPath(rootPath);
    return Array.from(new Set([optimized, rootPath]));
  }

  const folderPath = `/projects/${projectFolderName}`;
  const original = `${folderPath}/${normalized}`;
  const optimized = getOptimizedMediaPath(normalized, folderPath);
  return Array.from(new Set([optimized, original]));
}

function resolveWorkLogAssets(log: WorkLogWithProject): WorkLogAssetDisplay[] {
  const assets: WorkLogAssetDisplay[] = [];
  const seen = new Set<string>();

  const pushAsset = (asset: WorkLogAssetDisplay | null) => {
    if (!asset || seen.has(asset.href)) return;
    seen.add(asset.href);
    assets.push(asset);
  };

  for (const assetItem of log.assets || []) {
    const record = asRecord(assetItem);
    if (!record) continue;

    const label =
      maybeString(record.label) ||
      maybeString(record.name) ||
      maybeString(record.title) ||
      maybeString(record.id) ||
      "Asset";

    const primaryPath =
      maybeString(record.url) ||
      maybeString(record.path) ||
      getStringFromUnknown(record.filePath) ||
      maybeString(record.relativePath);
    const thumbnailPath = getStringFromUnknown(record.thumbnail);

    const primaryCandidates = primaryPath ? buildAssetPathCandidates(primaryPath, log.projectFolderName) : [];
    const thumbnailCandidates = thumbnailPath ? buildAssetPathCandidates(thumbnailPath, log.projectFolderName) : [];
    const href = primaryCandidates[primaryCandidates.length - 1] || thumbnailCandidates[thumbnailCandidates.length - 1];
    if (!href) continue;

    const previewCandidates = Array.from(new Set([...thumbnailCandidates, ...primaryCandidates])).filter(Boolean);
    const candidateForType = previewCandidates[0] || href;

    pushAsset({
      key: `${log.id}-${label}-${href}`,
      label,
      href,
      source: "asset",
      previewCandidates,
      mediaType: isVideoFile(candidateForType) ? "video" : isImageFile(candidateForType) ? "image" : "file",
    });
  }

  if (log.resource?.url) {
    pushAsset({
      key: `${log.id}-resource-singular-${log.resource.url}`,
      label: log.resource.label || "Resource",
      href: log.resource.url,
      source: "resource",
      previewCandidates: [],
      mediaType: "file",
    });
  }

  for (const resource of log.resources || []) {
    if (!resource?.url) continue;
    pushAsset({
      key: `${log.id}-resource-${resource.url}`,
      label: resource.label || "Resource",
      href: resource.url,
      source: "resource",
      previewCandidates: [],
      mediaType: "file",
    });
  }

  if (log.assetUrl) {
    const candidates = buildAssetPathCandidates(log.assetUrl, log.projectFolderName);
    const href = candidates[candidates.length - 1];
    if (!href) return assets;

    pushAsset({
      key: `${log.id}-asset-url-${href}`,
      label: "Asset URL",
      href,
      source: "asset-url",
      previewCandidates: candidates,
      mediaType: isVideoFile(href) ? "video" : isImageFile(href) ? "image" : "file",
    });
  }

  return assets;
}

function useResolvedAssetSrc(candidates: string[]): string | null {
  const candidateKey = candidates.join("|");
  const [resolved, setResolved] = useState<string | null>(candidates[0] || null);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      if (candidates.length === 0) {
        if (mounted) setResolved(null);
        return;
      }

      for (const candidate of candidates) {
        if (!candidate) continue;

        if (isAbsoluteUrl(candidate)) {
          if (mounted) setResolved(candidate);
          return;
        }

        try {
          const response = await fetch(candidate, { method: "HEAD" });
          if (!mounted) return;
          if (response.ok || response.status === 405) {
            setResolved(candidate);
            return;
          }
        } catch {
          // Continue to fallback candidates.
        }
      }

      if (mounted) {
        setResolved(candidates[candidates.length - 1] || null);
      }
    };

    void resolve();

    return () => {
      mounted = false;
    };
  }, [candidateKey, candidates]);

  return resolved;
}

function createSearchText(log: WorkLogWithProject): string {
  const assetTerms: string[] = [];

  for (const asset of log.assets || []) {
    if (!asset) continue;
    if (typeof asset === "string") {
      assetTerms.push(asset);
      continue;
    }
    if (typeof asset !== "object") continue;

    const record = asset as Record<string, unknown>;
    assetTerms.push(
      maybeString(record.label) || "",
      maybeString(record.name) || "",
      maybeString(record.url) || "",
      maybeString(record.path) || "",
      maybeString(record.relativePath) || ""
    );
  }

  for (const resource of log.resources || []) {
    if (!resource) continue;
    assetTerms.push(resource.label || "", resource.url || "", resource.type || "");
  }

  return [
    log.title,
    log.entry,
    log.whatHappened,
    log.problems,
    log.nextStep,
    log.projectTitle,
    log.assetUrl,
    ...(log.sessionType || []),
    ...assetTerms,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function groupLogsByMonth(logs: WorkLogWithProject[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];

  for (const log of logs) {
    const value = getWorkLogStart(log) || log.date;
    const key = value ? formatDate(value, "YYYY-MM") || "undated" : "undated";
    const label = value ? formatDate(value, { month: "long", year: "numeric" }) || "Undated" : "Undated";
    const current = groups[groups.length - 1];

    if (!current || current.key !== key) {
      groups.push({ key, label, logs: [log] });
      continue;
    }

    current.logs.push(log);
  }

  return groups;
}

function getSessionTypeMeta(sessionType?: string): { icon: LucideIcon; label: string } {
  const normalized = (sessionType || "").trim().toLowerCase();

  switch (normalized) {
    case "organizing":
      return { icon: FolderKanban, label: sessionType || "Organizing" };
    case "planning":
      return { icon: Target, label: sessionType || "Planning" };
    case "build":
      return { icon: Hammer, label: sessionType || "Build" };
    case "learning":
      return { icon: GraduationCap, label: sessionType || "Learning" };
    case "experiment":
      return { icon: FlaskConical, label: sessionType || "Experiment" };
    case "writing":
      return { icon: PencilLine, label: sessionType || "Writing" };
    default:
      return { icon: Sparkles, label: sessionType || "Session" };
  }
}

function AssetPreview({ candidates, alt }: { candidates: string[]; alt: string }) {
  const src = useResolvedAssetSrc(candidates);
  if (!src) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-muted/20">
      <MediaDisplay src={src} alt={alt} fill className="object-cover" loop={false} autoPlay={false} />
    </div>
  );
}

function WorkLogAssetDialog({
  asset,
  onOpenChange,
}: {
  asset: WorkLogAssetDisplay | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(asset);

  const candidates = useMemo(() => {
    if (!asset) return [];
    return Array.from(new Set([...(asset.previewCandidates || []), asset.href]));
  }, [asset]);

  const resolvedSrc = useResolvedAssetSrc(candidates);
  const activeSrc = resolvedSrc || asset?.href || "";
  const isImage = isImageFile(activeSrc);
  const isVideo = isVideoFile(activeSrc);
  const isPdf = isPdfFile(activeSrc);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0" showCloseButton>
        {asset ? (
          <>
            <DialogHeader className="border-b px-4 py-3 md:px-6 md:py-4">
              <DialogTitle className="pr-12 text-base md:text-lg">{asset.label}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-xs">
                <span className="uppercase tracking-wide text-muted-foreground">{asset.source}</span>
                <a
                  href={asset.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open original
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[80vh] overflow-auto p-4 md:p-6">
              {isImage ? (
                <div className="relative h-[68vh] w-full overflow-hidden rounded-xl border border-border/70 bg-muted/10">
                  <MediaDisplay src={activeSrc} alt={asset.label} fill className="object-contain" loop={false} autoPlay={false} />
                </div>
              ) : isVideo ? (
                <div className="w-full rounded-xl border border-border/70 bg-black/80 p-2">
                  <video src={activeSrc} controls className="max-h-[70vh] w-full rounded-lg" playsInline>
                    Your browser does not support this video.
                  </video>
                </div>
              ) : isPdf ? (
                <iframe
                  src={activeSrc}
                  title={asset.label}
                  className="h-[70vh] w-full rounded-xl border border-border/70 bg-background"
                />
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                  Inline preview is not available for this asset. Use <span className="font-medium">Open original</span>.
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WorkLogAssetGallery({ log }: { log: WorkLogWithProject }) {
  const assets = useMemo(() => resolveWorkLogAssets(log), [log]);
  const [selectedAsset, setSelectedAsset] = useState<WorkLogAssetDisplay | null>(null);

  if (assets.length === 0) return null;

  const visibleAssets = assets.slice(0, 4);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Assets</p>
          <span className="text-[10px] text-muted-foreground">
            {visibleAssets.length}
            {assets.length > visibleAssets.length ? ` of ${assets.length}` : ""}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleAssets.map((asset) => {
            const isMedia = asset.mediaType === "image" || asset.mediaType === "video";

            return (
              <button
                key={asset.key}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                className="group rounded-2xl border border-border/70 bg-background p-2.5 text-left transition-colors hover:border-primary/40"
              >
                {isMedia && asset.previewCandidates.length > 0 ? (
                  <AssetPreview candidates={asset.previewCandidates} alt={asset.label} />
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-border/80 px-3 text-xs text-muted-foreground">
                    Open preview
                  </div>
                )}

                <div className="mt-2 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-xs font-medium text-foreground">{asset.label}</p>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{asset.source}</p>
              </button>
            );
          })}
        </div>
      </div>

      <WorkLogAssetDialog asset={selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)} />
    </>
  );
}

function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  secondary,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary: string;
}) {
  return (
    <Card className="border-border/70 bg-card/65 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight text-foreground md:text-xl">{value}</p>
          <p className="text-sm leading-6 text-muted-foreground">{secondary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaChip({
  icon: Icon,
  label,
  tone = "default",
  className,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "strong";
  className?: string;
}) {
  return (
    <PassiveChip tone={tone} className={cn("gap-1.5 text-[11px] leading-none", className)}>
      <Icon className="size-3.5" />
      {label}
    </PassiveChip>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/55 shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-foreground md:text-base">{title}</h3>
            {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SessionTypePill({ sessionType, count }: { sessionType: string; count?: number }) {
  const { icon: Icon, label } = getSessionTypeMeta(sessionType);

  return (
    <PassiveChip className="gap-1.5 text-[11px] leading-none">
      <Icon className="size-3.5" />
      <span>{label}</span>
      {typeof count === "number" ? <span className="text-muted-foreground">· {count}</span> : null}
    </PassiveChip>
  );
}

function ProjectFilterMenu({
  projectOptions,
  selectedProject,
  onSelect,
}: {
  projectOptions: WorkLogProjectOption[];
  selectedProject?: WorkLogProjectOption;
  onSelect: (projectSlug?: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-auto min-h-10 rounded-full px-3 py-2 shadow-sm">
          <span className="min-w-0 flex-1">
            {selectedProject ? (
              <ProjectIdentity
                title={selectedProject.title}
                iconSrc={selectedProject.projectIconSrc}
                thumbnailSrc={selectedProject.projectThumbnailSrc}
                size="sm"
                truncate
              />
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="size-4 text-muted-foreground" />
                All projects
              </span>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>Project scope</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedProject?.slug || ALL_FILTER}
          onValueChange={(value) => onSelect(value === ALL_FILTER ? undefined : value)}
        >
          <DropdownMenuRadioItem value={ALL_FILTER}>
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              All projects
            </span>
          </DropdownMenuRadioItem>

          {projectOptions.map((project) => (
            <DropdownMenuRadioItem key={project.id} value={project.slug}>
              <ProjectIdentity
                title={project.title}
                iconSrc={project.projectIconSrc}
                thumbnailSrc={project.projectThumbnailSrc}
                size="sm"
                truncate
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OverviewTab({
  summary,
  projectSummaries,
  sessionSummaries,
  selectedProjectTitle,
}: {
  summary: WorkLogOverviewSummary;
  projectSummaries: WorkLogProjectSummary[];
  sessionSummaries: WorkLogSessionSummary[];
  selectedProjectTitle?: string;
}) {
  const topProjects = useMemo(
    () =>
      [...projectSummaries]
        .filter((project) => project.logCount > 0)
        .sort((left, right) => right.logCount - left.logCount || toTimestamp(right.latestSessionStart) - toTimestamp(left.latestSessionStart))
        .slice(0, 5),
    [projectSummaries]
  );

  const cadenceLines = selectedProjectTitle
    ? [
        `${summary.totalLogs} recorded session${summary.totalLogs === 1 ? "" : "s"} for ${selectedProjectTitle}.`,
        summary.mostRecentSessionStart
          ? `Most recent work landed on ${formatLongDate(summary.mostRecentSessionStart)}.`
          : "No recent session date is available.",
      ]
    : [
        `${summary.totalLogs} recorded session${summary.totalLogs === 1 ? "" : "s"} across ${summary.totalProjects} project${
          summary.totalProjects === 1 ? "" : "s"
        }.`,
        summary.logsLast30Days > 0
          ? `${summary.logsLast30Days} session${summary.logsLast30Days === 1 ? "" : "s"} landed in the last 30 days across ${
              summary.activeProjectsLast30Days
            } project${summary.activeProjectsLast30Days === 1 ? "" : "s"}.`
          : "No sessions landed in the last 30 days.",
      ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryMetricCard
          icon={CalendarDays}
          label="Most recent session"
          value={formatLongDate(summary.mostRecentSessionStart)}
          secondary={
            summary.totalLogs > 0
              ? `${summary.totalLogs} session${summary.totalLogs === 1 ? "" : "s"} recorded`
              : "No sessions recorded yet"
          }
        />
        <SummaryMetricCard
          icon={CalendarRange}
          label="Tracking window"
          value={formatDateRange(summary.earliestSessionStart, summary.latestSessionStart)}
          secondary={
            summary.totalProjects > 0
              ? `${summary.totalProjects} project${summary.totalProjects === 1 ? "" : "s"} represented`
              : "No projects tracked yet"
          }
        />
        <SummaryMetricCard
          icon={Clock3}
          label="Tracked time"
          value={formatDuration(summary.totalDurationMinutes) || "0m"}
          secondary={
            summary.totalDurationMinutes > 0
              ? "Calculated from session duration when available"
              : "Duration will appear as sessions capture start and end times"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title={selectedProjectTitle ? "Project focus" : "Top active projects"}
          description={
            selectedProjectTitle
              ? "The selected project stays visible here as the primary work stream."
              : "Projects with the heaviest activity, kept readable instead of charted."
          }
        >
          {topProjects.length > 0 ? (
            <div className="space-y-3">
              {topProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <ProjectIdentity
                    title={project.title}
                    href={project.href}
                    iconSrc={project.projectIconSrc}
                    thumbnailSrc={project.projectThumbnailSrc}
                    truncate
                    size="sm"
                    variant="chip"
                    className="max-w-full"
                  />

                  <div className="flex flex-wrap gap-2">
                    <MetaChip icon={CalendarDays} label={formatShortDate(project.latestSessionStart)} />
                    <MetaChip icon={Clock3} label={formatDuration(project.totalDurationMinutes) || "0m"} />
                    <MetaChip
                      icon={FileText}
                      label={`${project.logCount} log${project.logCount === 1 ? "" : "s"}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No project activity has been recorded yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Session mix"
          description="Session types stay icon-led so the dashboard does not depend on color to explain itself."
        >
          {sessionSummaries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sessionSummaries.map((sessionSummary) => (
                <SessionTypePill
                  key={sessionSummary.sessionType}
                  sessionType={sessionSummary.sessionType}
                  count={sessionSummary.count}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No session types have been recorded yet.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Cadence"
        description="A plain-language readout of how the work log timeline is moving."
      >
        <div className="space-y-2 text-sm leading-7 text-muted-foreground">
          {cadenceLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {summary.earliestSessionStart && summary.latestSessionStart ? (
            <p>The current window runs from {formatLongDate(summary.earliestSessionStart)} to {formatLongDate(summary.latestSessionStart)}.</p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

function ActivityFilters({
  controlsExpanded,
  onToggleControls,
  layout,
  onLayoutChange,
  sortOrder,
  onSortOrderChange,
  searchQuery,
  onSearchQueryChange,
  sessionFilter,
  onSessionFilterChange,
  sessionSummaries,
  filteredCount,
  totalCount,
  onReset,
  hasActiveFilters,
}: {
  controlsExpanded: boolean;
  onToggleControls: () => void;
  layout: ActivityLayout;
  onLayoutChange: (layout: ActivityLayout) => void;
  sortOrder: TimelineSortOrder;
  onSortOrderChange: (sortOrder: TimelineSortOrder) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sessionFilter: string;
  onSessionFilterChange: (value: string) => void;
  sessionSummaries: WorkLogSessionSummary[];
  filteredCount: number;
  totalCount: number;
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/55 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-tight text-foreground">Activity</p>
              <p className="text-xs text-muted-foreground">
                {filteredCount} of {totalCount} session{totalCount === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Compact, date-first rows with details hidden until you need them.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border/70 bg-background p-1">
              <Button
                type="button"
                size="sm"
                variant={layout === "list" ? "secondary" : "ghost"}
                aria-label="Switch to list view"
                className="rounded-full"
                onClick={() => onLayoutChange("list")}
              >
                <LayoutList className="size-4" />
                List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={layout === "timeline" ? "secondary" : "ghost"}
                aria-label="Switch to timeline view"
                className="rounded-full"
                onClick={() => onLayoutChange("timeline")}
              >
                <Waypoints className="size-4" />
                Timeline
              </Button>
            </div>

            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onToggleControls}>
              <Filter className="size-4" />
              Filters
              {controlsExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </div>

        {controlsExpanded ? (
          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/75 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Search work logs</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search work logs"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    placeholder="Search titles, notes, next steps, or assets..."
                    className="h-10 rounded-full pl-9"
                  />
                </div>
              </label>

              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Sort</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={sortOrder === "newest" ? "secondary" : "outline"}
                    className="rounded-full"
                    onClick={() => onSortOrderChange("newest")}
                  >
                    Newest
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sortOrder === "oldest" ? "secondary" : "outline"}
                    className="rounded-full"
                    onClick={() => onSortOrderChange("oldest")}
                  >
                    Oldest
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">State</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={hasActiveFilters ? "outline" : "ghost"}
                    className="rounded-full"
                    onClick={onReset}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Session types</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sessionFilter === ALL_FILTER ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => onSessionFilterChange(ALL_FILTER)}
                >
                  All sessions
                </Button>
                {sessionSummaries.map((summary) => {
                  const { icon: Icon, label } = getSessionTypeMeta(summary.sessionType);
                  return (
                    <Button
                      key={summary.sessionType}
                      type="button"
                      size="sm"
                      variant={sessionFilter === summary.sessionType ? "secondary" : "outline"}
                      className="rounded-full"
                      onClick={() => onSessionFilterChange(summary.sessionType)}
                    >
                      <Icon className="size-4" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkLogRow({
  log,
  compact = false,
}: {
  log: WorkLogWithProject;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const durationLabel = formatDuration(getWorkLogDurationMinutes(log));
  const summary = getWorkLogSummary(log);

  return (
    <Card className="border-border/70 bg-card/55 shadow-sm">
      <CardContent className={cn("p-4", compact && "p-3.5")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="shrink-0 rounded-2xl border border-border/70 bg-background/85 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {formatDate(getWorkLogStart(log), { month: "short" }) || "Date"}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatDate(getWorkLogStart(log), { day: "numeric" }) || "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">{formatDate(getWorkLogStart(log), { year: "numeric" }) || ""}</p>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {log.projectTitle ? (
                  <ProjectIdentity
                    title={log.projectTitle}
                    href={log.projectHref}
                    iconSrc={log.projectIconSrc}
                    thumbnailSrc={log.projectThumbnailSrc}
                    size="sm"
                    truncate
                    variant="chip"
                    className="max-w-full"
                  />
                ) : null}
                {durationLabel ? <MetaChip icon={Clock3} label={durationLabel} /> : null}
              </div>

              <div className="space-y-1">
                <h3 className={cn("text-base font-semibold tracking-tight text-foreground", compact && "text-sm")}>
                  {getWorkLogTitle(log)}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">{formatSessionRange(log)}</p>
              </div>

              {summary ? (
                <p className={cn("text-sm leading-6 text-muted-foreground", !expanded && "line-clamp-2")}>{summary}</p>
              ) : null}

              {log.sessionType && log.sessionType.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {log.sessionType.map((sessionType) => (
                    <SessionTypePill key={`${log.id}-${sessionType}`} sessionType={sessionType} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-start justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant={expanded ? "secondary" : "outline"}
              className="rounded-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Hide details" : "Details"}
            </Button>
          </div>
        </div>

        {expanded ? (
          <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetaChip icon={CalendarDays} label={formatLongDate(getWorkLogStart(log))} tone="strong" />
              {durationLabel ? <MetaChip icon={Clock3} label={durationLabel} tone="strong" /> : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {summary ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/75 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <FileText className="size-3.5" />
                    Notes
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{summary}</p>
                </div>
              ) : null}

              {log.problems ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/75 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <TriangleAlert className="size-3.5" />
                    Problems
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{log.problems}</p>
                </div>
              ) : null}

              {log.nextStep ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/75 p-4 lg:col-span-2">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowRight className="size-3.5" />
                    Next step
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{log.nextStep}</p>
                </div>
              ) : null}
            </div>

            <WorkLogAssetGallery log={log} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityTimeline({ logs }: { logs: WorkLogWithProject[] }) {
  if (logs.length === 0) return null;

  return (
    <div data-testid="work-log-activity-timeline" className="overflow-x-auto pb-2">
      <div className="relative min-w-max px-2 pb-16 pt-1">
        <div className="absolute bottom-8 left-2 right-2 h-px bg-border" />
        <div className="flex items-end gap-4">
          {logs.map((log, idx) => {
            const key = `${log.id || "work-log"}-${idx}`;
            const durationLabel = formatDuration(getWorkLogDurationMinutes(log));

            return (
              <div key={key} className="relative w-[320px] shrink-0 pb-12">
                <WorkLogRow log={log} compact />
                <span className="absolute bottom-[1.65rem] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-primary/40 bg-background" />
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">
                  {formatShortDate(getWorkLogStart(log) || log.date)}
                  {durationLabel ? ` · ${durationLabel}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({
  projectSummaries,
  logsByProject,
  onFocusProject,
}: {
  projectSummaries: WorkLogProjectSummary[];
  logsByProject: Map<string, WorkLogWithProject[]>;
  onFocusProject: (projectSlug: string) => void;
}) {
  return (
    <div className="space-y-4">
      {projectSummaries.map((project) => (
        <ProjectSummaryRow
          key={project.id}
          project={project}
          recentLogs={logsByProject.get(project.slug) || []}
          onFocusProject={onFocusProject}
        />
      ))}
    </div>
  );
}

function ProjectSummaryRow({
  project,
  recentLogs,
  onFocusProject,
}: {
  project: WorkLogProjectSummary;
  recentLogs: WorkLogWithProject[];
  onFocusProject: (projectSlug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border/70 bg-card/55 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <ProjectIdentity
              title={project.title}
              href={project.href}
              iconSrc={project.projectIconSrc}
              thumbnailSrc={project.projectThumbnailSrc}
              size="md"
              truncate
            />

            <div className="flex flex-wrap gap-2">
              <MetaChip icon={CalendarDays} label={`Last session ${formatShortDate(project.latestSessionStart)}`} />
              <MetaChip icon={Clock3} label={formatDuration(project.totalDurationMinutes) || "0m"} />
              <MetaChip icon={FileText} label={`${project.logCount} log${project.logCount === 1 ? "" : "s"}`} />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{project.latestLogTitle || "No session title yet"}</p>
              {project.latestLogSummary ? (
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{project.latestLogSummary}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => onFocusProject(project.slug)}>
              Focus in activity
            </Button>
            <Button
              type="button"
              size="sm"
              variant={expanded ? "secondary" : "outline"}
              className="rounded-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Hide recent logs" : "Recent logs"}
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href={project.href}>Open project</Link>
            </Button>
          </div>
        </div>

        {expanded ? (
          <div className="space-y-3 border-t border-border/70 pt-4">
            {(recentLogs.length > 0 ? recentLogs.slice(0, 3) : []).map((log) => (
              <div key={`${project.id}-${log.id || getWorkLogTitle(log)}`} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{getWorkLogTitle(log)}</p>
                  <div className="flex flex-wrap gap-2">
                    <MetaChip icon={CalendarDays} label={formatShortDate(getWorkLogStart(log) || log.date)} />
                    {formatDuration(getWorkLogDurationMinutes(log)) ? (
                      <MetaChip icon={Clock3} label={formatDuration(getWorkLogDurationMinutes(log)) || "0m"} />
                    ) : null}
                  </div>
                </div>
                {getWorkLogSummary(log) ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{getWorkLogSummary(log)}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WorkLogsDashboard({
  logs,
  projectOptions,
  projectSummaries,
  overviewSummary,
  sessionSummaries,
  emptyText = "No work logs available.",
  initialProjectSlug,
  onProjectFilterChange,
}: WorkLogsDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectSlug || ALL_FILTER);
  const [layout, setLayout] = useState<ActivityLayout>("list");
  const [sortOrder, setSortOrder] = useState<TimelineSortOrder>("newest");
  const [sessionFilter, setSessionFilter] = useState<string>(ALL_FILTER);
  const [searchQuery, setSearchQuery] = useState("");
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setProjectFilter(initialProjectSlug || ALL_FILTER);
  }, [initialProjectSlug]);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.slug === projectFilter || project.id === projectFilter),
    [projectFilter, projectOptions]
  );

  const scopedLogs = useMemo(() => {
    if (projectFilter === ALL_FILTER) return logs;
    return logs.filter((log) => log.projectSlug === projectFilter || log.projectId === projectFilter);
  }, [logs, projectFilter]);

  const selectedProjectSummary = useMemo(
    () => projectSummaries.find((project) => project.slug === projectFilter || project.id === projectFilter),
    [projectFilter, projectSummaries]
  );

  const visibleSessionSummaries = selectedProjectSummary ? selectedProjectSummary.sessionSummaries : sessionSummaries;

  useEffect(() => {
    if (sessionFilter !== ALL_FILTER && !visibleSessionSummaries.some((summary) => summary.sessionType === sessionFilter)) {
      setSessionFilter(ALL_FILTER);
    }
  }, [sessionFilter, visibleSessionSummaries]);

  const filteredActivityLogs = useMemo(() => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();

    const next = scopedLogs.filter((log) => {
      const matchesSession =
        sessionFilter === ALL_FILTER ||
        Boolean((log.sessionType || []).find((sessionType) => sessionType === sessionFilter));
      if (!matchesSession) return false;

      if (!normalizedSearch) return true;
      return createSearchText(log).includes(normalizedSearch);
    });

    next.sort((left, right) =>
      sortOrder === "newest" ? getWorkLogTimestamp(right) - getWorkLogTimestamp(left) : getWorkLogTimestamp(left) - getWorkLogTimestamp(right)
    );

    return next;
  }, [deferredSearchQuery, scopedLogs, sessionFilter, sortOrder]);

  const logsByProject = useMemo(() => {
    const map = new Map<string, WorkLogWithProject[]>();

    for (const log of logs) {
      const key = log.projectSlug || log.projectId;
      if (!key) continue;
      const current = map.get(key) || [];
      current.push(log);
      map.set(key, current);
    }

    for (const [key, items] of map.entries()) {
      map.set(key, [...items].sort((left, right) => getWorkLogTimestamp(right) - getWorkLogTimestamp(left)));
    }

    return map;
  }, [logs]);

  const groupedLogs = useMemo(() => groupLogsByMonth(filteredActivityLogs), [filteredActivityLogs]);

  const filteredProjectSummaries = useMemo(() => {
    if (projectFilter === ALL_FILTER) return projectSummaries.filter((project) => project.logCount > 0);
    return projectSummaries.filter((project) => project.slug === projectFilter || project.id === projectFilter);
  }, [projectFilter, projectSummaries]);

  const scopedOverview = selectedProjectSummary
    ? {
        totalLogs: selectedProjectSummary.logCount,
        totalProjects: selectedProjectSummary.logCount > 0 ? 1 : 0,
        totalDurationMinutes: selectedProjectSummary.totalDurationMinutes,
        mostRecentSessionStart: selectedProjectSummary.latestSessionStart,
        earliestSessionStart: selectedProjectSummary.earliestSessionStart,
        latestSessionStart: selectedProjectSummary.latestSessionStart,
        logsLast30Days: 0,
        activeProjectsLast30Days: 1,
      }
    : overviewSummary;

  const hasActiveActivityFilters =
    sessionFilter !== ALL_FILTER || deferredSearchQuery.trim().length > 0 || sortOrder !== "newest";

  const handleProjectScopeChange = (projectSlug?: string) => {
    const nextValue = projectSlug || ALL_FILTER;
    setProjectFilter(nextValue);
    onProjectFilterChange?.(projectSlug);
  };

  const resetActivityFilters = () => {
    setSortOrder("newest");
    setSessionFilter(ALL_FILTER);
    setSearchQuery("");
  };

  const handleFocusProject = (projectSlug: string) => {
    handleProjectScopeChange(projectSlug);
    setActiveTab("activity");
  };

  if (logs.length === 0) {
    return (
      <Card className="border-border/70 bg-card/55 shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-border/70 bg-card/55 p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-auto rounded-full border border-border/70 bg-background/85 p-1">
            <TabsTrigger value="overview" className="rounded-full px-4 py-2">Overview</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-full px-4 py-2">Activity</TabsTrigger>
            <TabsTrigger value="projects" className="rounded-full px-4 py-2">Projects</TabsTrigger>
          </TabsList>

          <ProjectFilterMenu
            projectOptions={projectOptions}
            selectedProject={selectedProject}
            onSelect={handleProjectScopeChange}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <MetaChip
            icon={CalendarDays}
            label={`Most recent ${formatShortDate(scopedOverview.mostRecentSessionStart)}`}
          />
          <MetaChip
            icon={Clock3}
            label={formatDuration(scopedOverview.totalDurationMinutes) || "0m"}
          />
          <MetaChip
            icon={FileText}
            label={`${scopedOverview.totalLogs} log${scopedOverview.totalLogs === 1 ? "" : "s"}`}
          />
        </div>
      </div>

      <TabsContent value="overview">
        {scopedLogs.length === 0 ? (
          <Card className="border-border/70 bg-card/55 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">{emptyText}</CardContent>
          </Card>
        ) : (
          <OverviewTab
            summary={scopedOverview}
            projectSummaries={filteredProjectSummaries}
            sessionSummaries={visibleSessionSummaries}
            selectedProjectTitle={selectedProjectSummary?.title}
          />
        )}
      </TabsContent>

      <TabsContent value="activity" className="space-y-4">
        <ActivityFilters
          controlsExpanded={controlsExpanded}
          onToggleControls={() => setControlsExpanded((current) => !current)}
          layout={layout}
          onLayoutChange={setLayout}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          sessionFilter={sessionFilter}
          onSessionFilterChange={setSessionFilter}
          sessionSummaries={visibleSessionSummaries}
          filteredCount={filteredActivityLogs.length}
          totalCount={scopedLogs.length}
          onReset={resetActivityFilters}
          hasActiveFilters={hasActiveActivityFilters}
        />

        {filteredActivityLogs.length === 0 ? (
          <Card className="border-border/70 bg-card/55 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              {hasActiveActivityFilters ? "No sessions match these filters." : emptyText}
            </CardContent>
          </Card>
        ) : layout === "timeline" ? (
          <ActivityTimeline logs={filteredActivityLogs} />
        ) : (
          <div data-testid="work-log-activity-list" className="space-y-6">
            {groupedLogs.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold tracking-wide text-foreground/90">{group.label}</h3>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">{group.logs.length}</span>
                </div>

                <div className="space-y-3">
                  {group.logs.map((log, idx) => (
                    <WorkLogRow key={`${log.id || "work-log"}-${idx}`} log={log} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="projects">
        {filteredProjectSummaries.length === 0 ? (
          <Card className="border-border/70 bg-card/55 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">{emptyText}</CardContent>
          </Card>
        ) : (
          <ProjectsTab
            projectSummaries={filteredProjectSummaries}
            logsByProject={logsByProject}
            onFocusProject={handleFocusProject}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
