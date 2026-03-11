"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MediaDisplay } from "@/components/ui/media-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkLog } from "@/types";
import { cn, formatDate, getOptimizedMediaPath, isImageFile, isSvgFile, isVideoFile, getOptimizedImageExt } from "@/lib/utils";

export type WorkLogWithProject = WorkLog & {
  projectId?: string;
  projectTitle?: string;
  projectHref?: string;
  projectFolderName?: string;
};

export type TimelineSortOrder = "newest" | "oldest";
export type TimelineViewMode = "rail" | "horizontal" | "project-chart" | "session-chart" | "duration-chart";

export interface WorkLogProjectOption {
  id: string;
  title: string;
}

interface WorkLogTimelineProps {
  logs: WorkLogWithProject[];
  emptyText?: string;
  showControls?: boolean;
  projectOptions?: WorkLogProjectOption[];
  initialProjectId?: string;
  initialSortOrder?: TimelineSortOrder;
  initialSessionType?: string;
  initialSearchQuery?: string;
  initialViewMode?: TimelineViewMode;
  defaultControlsExpanded?: boolean;
  onProjectFilterChange?: (projectId?: string) => void;
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

interface WeeklyBucket {
  key: string;
  label: string;
  shortLabel: string;
  logCount: number;
  durationMinutes: number;
  projectCounts: Record<string, number>;
  sessionCounts: Record<string, number>;
}

const ALL_FILTER = "all";
const UNTYPED_SESSION = "Unspecified";

const PROJECT_PALETTE = [
  "#0f766e",
  "#1d4ed8",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
  "#7c2d12",
  "#4338ca",
  "#c026d3",
];

const SESSION_PALETTE = [
  "#0891b2",
  "#ca8a04",
  "#16a34a",
  "#7c3aed",
  "#dc2626",
  "#2563eb",
  "#0d9488",
  "#a16207",
  "#65a30d",
  "#9333ea",
];

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getSessionStart(log: WorkLogWithProject): string | undefined {
  return log.startTime || log.sessionStart || log.date;
}

function getSessionEnd(log: WorkLogWithProject): string | undefined {
  return log.endTime || log.sessionEnd || getSessionStart(log) || log.date;
}

function getLogTimestamp(log: WorkLogWithProject): number {
  return toTimestamp(getSessionStart(log));
}

function formatSessionRange(log: WorkLogWithProject): string {
  const start = getSessionStart(log);
  const end = getSessionEnd(log);

  if (!start && !end) return "Session time not set";
  if (!start && end) {
    const endLabel = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
    return endLabel ? `Ends ${endLabel}` : "Session time not set";
  }
  if (!start) return "Session time not set";

  const startTs = toTimestamp(start);
  const endTs = toTimestamp(end);

  const startDay = formatDate(start, { month: "short", day: "numeric", year: "numeric" });
  const startClock = formatDate(start, { hour: "numeric", minute: "2-digit" });
  if (!end || !startTs || !endTs || endTs <= startTs) {
    if (startDay && startClock) return `${startDay} · ${startClock}`;
    return startDay || "Session time not set";
  }

  const endDay = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
  const endClock = formatDate(end, { hour: "numeric", minute: "2-digit" });

  if (startDay && endDay && startDay === endDay && startClock && endClock) {
    return `${startDay} · ${startClock} - ${endClock}`;
  }

  const startPart = [startDay, startClock].filter(Boolean).join(" ");
  const endPart = [endDay, endClock].filter(Boolean).join(" ");
  return `${startPart} - ${endPart}`;
}

function formatShortDate(value?: string): string {
  if (!value) return "No date";
  return formatDate(value, { month: "short", day: "numeric" }) || "No date";
}

function getSessionDurationMinutes(log: WorkLogWithProject): number {
  if (typeof log.durationMinutes === "number" && log.durationMinutes > 0) {
    return log.durationMinutes;
  }

  const startTs = toTimestamp(getSessionStart(log));
  const endTs = toTimestamp(getSessionEnd(log));
  if (!startTs || !endTs || endTs <= startTs) return 0;
  return Math.round((endTs - startTs) / 60000);
}

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toAlphaColor(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(idx);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildColorMap(keys: string[], palette: string[]): Map<string, string> {
  const uniqueSorted = Array.from(new Set(keys.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const used = new Set<number>();
  const colorMap = new Map<string, string>();

  uniqueSorted.forEach((key, idx) => {
    let paletteIndex = hashString(key) % palette.length;
    if (used.has(paletteIndex)) {
      paletteIndex = idx % palette.length;
    }
    used.add(paletteIndex);
    colorMap.set(key, palette[paletteIndex]);
  });

  return colorMap;
}

function normalizeFileNameForType(value: string): string {
  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");
  return withoutQuery;
}

function isPdfFile(path?: string | null): boolean {
  if (!path) return false;
  return normalizeFileNameForType(path).toLowerCase().endsWith(".pdf");
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

function truncateText(value: string | undefined, maxLength: number): string {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function groupLogsByMonth(logs: WorkLogWithProject[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];

  for (const log of logs) {
    const value = getSessionStart(log) || log.date;
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

function getWeekBucketKey(dateValue?: string): string {
  const ts = toTimestamp(dateValue);
  if (!ts) return "undated";

  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function buildWeeklyBuckets(logs: WorkLogWithProject[]): WeeklyBucket[] {
  const bucketMap = new Map<string, WeeklyBucket>();

  for (const log of logs) {
    const bucketKey = getWeekBucketKey(getSessionStart(log));
    const bucketLabel =
      bucketKey === "undated"
        ? "Undated"
        : `${formatDate(bucketKey, { month: "short", day: "numeric" }) || bucketKey} week`;
    const shortLabel =
      bucketKey === "undated" ? "n/a" : formatDate(bucketKey, { month: "short", day: "numeric" }) || bucketKey;

    const bucket =
      bucketMap.get(bucketKey) ||
      {
        key: bucketKey,
        label: bucketLabel,
        shortLabel,
        logCount: 0,
        durationMinutes: 0,
        projectCounts: {},
        sessionCounts: {},
      };

    bucket.logCount += 1;
    bucket.durationMinutes += getSessionDurationMinutes(log);

    const projectKey = log.projectTitle || "Unknown project";
    bucket.projectCounts[projectKey] = (bucket.projectCounts[projectKey] || 0) + 1;

    const sessionTypes = log.sessionType && log.sessionType.length > 0 ? log.sessionType : [UNTYPED_SESSION];
    const uniqueSessionTypes = Array.from(new Set(sessionTypes));
    for (const sessionType of uniqueSessionTypes) {
      bucket.sessionCounts[sessionType] = (bucket.sessionCounts[sessionType] || 0) + 1;
    }

    bucketMap.set(bucketKey, bucket);
  }

  return Array.from(bucketMap.values()).sort((a, b) => {
    if (a.key === "undated") return 1;
    if (b.key === "undated") return -1;
    return a.key.localeCompare(b.key);
  });
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

function resolveWorkLogAssets(log: WorkLogWithProject): WorkLogAssetDisplay[] {
  const assets: WorkLogAssetDisplay[] = [];
  const seen = new Set<string>();

  const pushAsset = (asset: WorkLogAssetDisplay | null) => {
    if (!asset) return;
    if (seen.has(asset.href)) return;
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

    const mediaType: WorkLogAssetDisplay["mediaType"] = isVideoFile(candidateForType)
      ? "video"
      : isImageFile(candidateForType)
        ? "image"
        : "file";

    pushAsset({
      key: `${log.id}-${label}-${href}`,
      label,
      href,
      source: "asset",
      previewCandidates,
      mediaType,
    });
  }

  if (log.resource && log.resource.url) {
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
    if (href) {
      pushAsset({
        key: `${log.id}-asset-url-${href}`,
        label: "Asset URL",
        href,
        source: "asset-url",
        previewCandidates: candidates,
        mediaType: isVideoFile(href) ? "video" : isImageFile(href) ? "image" : "file",
      });
    }
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

function AssetPreview({ candidates, alt }: { candidates: string[]; alt: string }) {
  const src = useResolvedAssetSrc(candidates);
  if (!src) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/70 bg-muted/20">
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
        {asset && (
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
                <div className="relative h-[68vh] w-full overflow-hidden rounded-md border border-border/70 bg-muted/10">
                  <MediaDisplay src={activeSrc} alt={asset.label} fill className="object-contain" loop={false} autoPlay={false} />
                </div>
              ) : isVideo ? (
                <div className="w-full rounded-md border border-border/70 bg-black/80 p-2">
                  <video src={activeSrc} controls className="max-h-[70vh] w-full rounded-md" playsInline>
                    Your browser does not support this video.
                  </video>
                </div>
              ) : isPdf ? (
                <iframe
                  src={activeSrc}
                  title={asset.label}
                  className="h-[70vh] w-full rounded-md border border-border/70 bg-background"
                />
              ) : (
                <div className="rounded-md border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                  Inline preview is not available for this asset. Use <span className="font-medium">Open original</span>.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WorkLogAssetGallery({ log }: { log: WorkLogWithProject }) {
  const assets = useMemo(() => resolveWorkLogAssets(log), [log]);
  const [selectedAsset, setSelectedAsset] = useState<WorkLogAssetDisplay | null>(null);

  if (assets.length === 0) return null;

  const visibleAssets = assets.slice(0, 6);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assets</p>
          <span className="text-[10px] text-muted-foreground">
            {visibleAssets.length}
            {assets.length > visibleAssets.length ? ` of ${assets.length}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleAssets.map((asset) => {
            const isMedia = asset.mediaType === "image" || asset.mediaType === "video";

            return (
              <button
                key={asset.key}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                className="group rounded-md border border-border/70 bg-background p-2 text-left transition-colors hover:border-primary/50"
              >
                {isMedia && asset.previewCandidates.length > 0 ? (
                  <AssetPreview candidates={asset.previewCandidates} alt={asset.label} />
                ) : (
                  <div className="flex h-14 items-center rounded-md border border-dashed border-border/80 px-3 text-xs text-muted-foreground">
                    Open preview
                  </div>
                )}

                <div className="mt-2 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-[11px] font-medium text-foreground/90">{asset.label}</p>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{asset.source}</p>
              </button>
            );
          })}
        </div>
      </div>

      <WorkLogAssetDialog asset={selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)} />
    </>
  );
}

function SessionBadge({ label, color }: { label: string; color: string }) {
  const style = {
    borderColor: toAlphaColor(color, 0.45),
    backgroundColor: toAlphaColor(color, 0.13),
    color,
  };

  return (
    <Badge variant="outline" style={style} className="pointer-events-none cursor-default text-[10px]">
      {label}
    </Badge>
  );
}

function ProjectLegend({ colorMap }: { colorMap: Map<string, string> }) {
  const entries = Array.from(colorMap.entries());
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([label, color]) => (
        <div
          key={label}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="max-w-[150px] truncate">{label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartBars({
  buckets,
  countsKey,
  colorMap,
  title,
}: {
  buckets: WeeklyBucket[];
  countsKey: "projectCounts" | "sessionCounts";
  colorMap: Map<string, string>;
  title: string;
}) {
  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((bucket) => bucket.logCount), 1);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <span className="text-xs text-muted-foreground">Weekly buckets</span>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-end gap-3 rounded-md border border-border/60 bg-muted/10 p-3">
            {buckets.map((bucket, idx) => {
              const countMap = bucket[countsKey];
              const segments = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
              const barHeight = Math.max(Math.round((bucket.logCount / maxCount) * 100), 8);

              const titleText = [
                `${bucket.label}`,
                `${bucket.logCount} log${bucket.logCount === 1 ? "" : "s"}`,
                ...segments.map(([label, count]) => `${label}: ${count}`),
              ].join("\n");

              return (
                <div key={bucket.key} className="flex w-[42px] flex-col items-center gap-2" title={titleText}>
                  <div className="relative h-44 w-full overflow-hidden rounded-md border border-border/70 bg-background/80">
                    <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse" style={{ height: `${barHeight}%` }}>
                      {segments.map(([label, count]) => {
                        const color = colorMap.get(label) || "#64748b";
                        return <span key={`${bucket.key}-${label}`} style={{ flex: count, backgroundColor: color }} />;
                      })}
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground">{idx % 2 === 0 ? bucket.shortLabel : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DurationTrendChart({ buckets }: { buckets: WeeklyBucket[] }) {
  if (buckets.length === 0) return null;

  const chartHeight = 240;
  const chartWidth = Math.max(480, buckets.length * 84);
  const padding = { top: 18, right: 16, bottom: 36, left: 32 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxDuration = Math.max(...buckets.map((bucket) => bucket.durationMinutes), 1);

  const points = buckets.map((bucket, idx) => {
    const x =
      buckets.length <= 1
        ? padding.left + innerWidth / 2
        : padding.left + (idx / (buckets.length - 1)) * innerWidth;

    const ratio = bucket.durationMinutes / maxDuration;
    const y = padding.top + (1 - ratio) * innerHeight;
    return { bucket, x, y };
  });

  const linePath = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const baselineY = padding.top + innerHeight;
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

  const totalDuration = buckets.reduce((sum, bucket) => sum + bucket.durationMinutes, 0);
  const averageDuration = Math.round(totalDuration / buckets.length);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-3 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Session Duration Over Time</h4>
            <p className="text-xs text-muted-foreground">Weekly total duration by session start/end</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Total: {formatDuration(totalDuration) || "0m"}</p>
            <p>Avg / week: {formatDuration(averageDuration) || "0m"}</p>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <svg width={chartWidth} height={chartHeight} className="rounded-md border border-border/60 bg-muted/10">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * innerHeight;
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="currentColor"
                  opacity={0.12}
                />
              );
            })}

            <path d={areaPath} fill="rgba(37, 99, 235, 0.18)" />
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />

            {points.map((point) => (
              <g key={point.bucket.key}>
                <circle cx={point.x} cy={point.y} r={4} fill="#2563eb" />
                <text x={point.x} y={chartHeight - 14} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.75}>
                  {point.bucket.shortLabel}
                </text>
              </g>
            ))}

            <text x={8} y={padding.top + 8} fontSize="10" fill="currentColor" opacity={0.8}>
              {formatDuration(maxDuration) || "0m"}
            </text>
            <text x={8} y={baselineY} fontSize="10" fill="currentColor" opacity={0.8}>
              0m
            </text>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function DataSummary({ logs }: { logs: WorkLogWithProject[] }) {
  const totalDuration = useMemo(() => logs.reduce((sum, log) => sum + getSessionDurationMinutes(log), 0), [logs]);

  const uniqueProjects = useMemo(() => new Set(logs.map((log) => log.projectTitle || "Unknown project")).size, [logs]);

  const uniqueSessions = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (!log.sessionType || log.sessionType.length === 0) {
        set.add(UNTYPED_SESSION);
      } else {
        for (const sessionType of log.sessionType) {
          if (sessionType) set.add(sessionType);
        }
      }
    }
    return set.size;
  }, [logs]);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Card className="border-border/70">
        <CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Logs</p>
          <p className="text-xl font-semibold">{logs.length}</p>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projects</p>
          <p className="text-xl font-semibold">{uniqueProjects}</p>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Session Time</p>
          <p className="text-xl font-semibold">{formatDuration(totalDuration) || "0m"}</p>
          <p className="text-[11px] text-muted-foreground">{uniqueSessions} session types tracked</p>
        </CardContent>
      </Card>
    </div>
  );
}

function RailEntry({
  log,
  timelineKey,
  projectColor,
  sessionColorMap,
}: {
  log: WorkLogWithProject;
  timelineKey: string;
  projectColor: string;
  sessionColorMap: Map<string, string>;
}) {
  const duration = formatDuration(getSessionDurationMinutes(log));
  const sourceUrl = log.url;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-3 p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: projectColor }} />
              <h4 className="text-sm font-semibold leading-snug">{log.title || log.entry || "Work log"}</h4>
            </div>
            <p className="text-xs text-muted-foreground">{formatSessionRange(log)}</p>
          </div>
          {duration && (
            <Badge variant="outline" className="pointer-events-none cursor-default bg-muted/20 text-[11px]">
              {duration}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {log.projectHref && log.projectTitle && (
            <Link href={log.projectHref} className="inline-flex text-xs text-primary hover:underline">
              {log.projectTitle}
            </Link>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Session source
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {(log.whatHappened || log.entry) && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{log.whatHappened || log.entry}</p>
        )}

        {(log.problems || log.nextStep) && (
          <div className="space-y-1.5">
            {log.problems && (
              <p className="whitespace-pre-wrap text-xs text-amber-700 dark:text-amber-300">Problem: {log.problems}</p>
            )}
            {log.nextStep && (
              <p className="whitespace-pre-wrap text-xs text-emerald-700 dark:text-emerald-300">Next: {log.nextStep}</p>
            )}
          </div>
        )}

        {log.sessionType && log.sessionType.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {log.sessionType.map((sessionType) => {
              const color = sessionColorMap.get(sessionType) || "#475569";
              return <SessionBadge key={`${timelineKey}-${sessionType}`} label={sessionType} color={color} />;
            })}
          </div>
        )}

        <WorkLogAssetGallery log={log} />
      </CardContent>
    </Card>
  );
}

function HorizontalTimeline({
  logs,
  projectColorMap,
  sessionColorMap,
}: {
  logs: WorkLogWithProject[];
  projectColorMap: Map<string, string>;
  sessionColorMap: Map<string, string>;
}) {
  if (logs.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-max px-4 pb-14 pt-2">
        <div className="absolute bottom-7 left-4 right-4 h-px bg-border" />
        <div className="flex items-end gap-4">
          {logs.map((log, idx) => {
            const key = `${log.id || "work-log"}-${log.projectId || "project"}-${idx}`;
            const duration = formatDuration(getSessionDurationMinutes(log));
            const summary = truncateText(log.whatHappened || log.entry, 120);
            const dateLabel = formatShortDate(getSessionStart(log) || log.date);
            const projectName = log.projectTitle || "Unknown project";
            const projectColor = projectColorMap.get(projectName) || "#64748b";

            return (
              <div key={key} className="relative w-[280px] shrink-0 pb-12">
                <Card className="border-border/70 shadow-sm" style={{ borderLeftWidth: 4, borderLeftColor: projectColor }}>
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold leading-snug">
                        {truncateText(log.title || log.entry || "Work log", 70)}
                      </h4>
                      {duration && (
                        <Badge variant="outline" className="pointer-events-none cursor-default bg-muted/20 text-[10px]">
                          {duration}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">{formatSessionRange(log)}</p>

                    {summary && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{summary}</p>}

                    {log.sessionType && log.sessionType.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {log.sessionType.slice(0, 3).map((sessionType) => {
                          const color = sessionColorMap.get(sessionType) || "#475569";
                          return <SessionBadge key={`${key}-${sessionType}`} label={sessionType} color={color} />;
                        })}
                      </div>
                    )}

                    {log.projectHref && log.projectTitle && (
                      <Link href={log.projectHref} className="inline-flex text-xs text-primary hover:underline">
                        {log.projectTitle}
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <span
                  className="absolute bottom-[1.45rem] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-primary/50"
                  style={{ backgroundColor: projectColor }}
                />
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WorkLogTimeline({
  logs,
  emptyText = "No work logs available.",
  showControls = false,
  projectOptions = [],
  initialProjectId,
  initialSortOrder = "newest",
  initialSessionType = ALL_FILTER,
  initialSearchQuery = "",
  initialViewMode = "rail",
  defaultControlsExpanded = false,
  onProjectFilterChange,
}: WorkLogTimelineProps) {
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId || ALL_FILTER);
  const [sortOrder, setSortOrder] = useState<TimelineSortOrder>(initialSortOrder);
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>(initialSessionType);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [viewMode, setViewMode] = useState<TimelineViewMode>(initialViewMode);
  const [controlsExpanded, setControlsExpanded] = useState(defaultControlsExpanded);

  useEffect(() => {
    setProjectFilter(initialProjectId || ALL_FILTER);
  }, [initialProjectId]);

  const projectScopedLogs = useMemo(() => {
    if (projectFilter === ALL_FILTER) return logs;
    return logs.filter((log) => log.projectId === projectFilter);
  }, [logs, projectFilter]);

  const availableSessionTypes = useMemo(() => {
    const unique = new Set<string>();
    for (const log of projectScopedLogs) {
      for (const sessionType of log.sessionType || []) {
        if (sessionType) unique.add(sessionType);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [projectScopedLogs]);

  useEffect(() => {
    if (sessionTypeFilter !== ALL_FILTER && !availableSessionTypes.includes(sessionTypeFilter)) {
      setSessionTypeFilter(ALL_FILTER);
    }
  }, [availableSessionTypes, sessionTypeFilter]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const next = projectScopedLogs.filter((log) => {
      const matchesSessionType =
        sessionTypeFilter === ALL_FILTER ||
        Boolean((log.sessionType || []).find((sessionType) => sessionType === sessionTypeFilter));
      if (!matchesSessionType) return false;

      if (!normalizedSearch) return true;
      return createSearchText(log).includes(normalizedSearch);
    });

    next.sort((a, b) =>
      sortOrder === "newest" ? getLogTimestamp(b) - getLogTimestamp(a) : getLogTimestamp(a) - getLogTimestamp(b)
    );

    return next;
  }, [projectScopedLogs, searchQuery, sessionTypeFilter, sortOrder]);

  const groupedLogs = useMemo(() => groupLogsByMonth(filteredLogs), [filteredLogs]);
  const weeklyBuckets = useMemo(() => buildWeeklyBuckets(filteredLogs), [filteredLogs]);

  const hasProjectFilter = showControls && projectOptions.length > 0;
  const hasActiveFilters =
    projectFilter !== ALL_FILTER ||
    sessionTypeFilter !== ALL_FILTER ||
    searchQuery.trim().length > 0 ||
    sortOrder !== initialSortOrder;

  const projectColorMap = useMemo(() => {
    const keys = filteredLogs.map((log) => log.projectTitle || "Unknown project");
    return buildColorMap(keys, PROJECT_PALETTE);
  }, [filteredLogs]);

  const sessionColorMap = useMemo(() => {
    const sessionKeys: string[] = [];
    for (const log of filteredLogs) {
      if (!log.sessionType || log.sessionType.length === 0) {
        sessionKeys.push(UNTYPED_SESSION);
      } else {
        sessionKeys.push(...log.sessionType);
      }
    }
    return buildColorMap(sessionKeys, SESSION_PALETTE);
  }, [filteredLogs]);

  const legendColorMap =
    viewMode === "session-chart" ? sessionColorMap : viewMode === "duration-chart" ? new Map<string, string>() : projectColorMap;

  return (
    <div className="space-y-4">
      {showControls && (
        <Card className="border-border/70">
          <CardContent className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap rounded-md border border-border bg-muted/30 p-0.5">
                {[
                  { id: "rail", label: "Rail" },
                  { id: "horizontal", label: "Horizontal" },
                  { id: "project-chart", label: "Project Chart" },
                  { id: "session-chart", label: "Session Chart" },
                  { id: "duration-chart", label: "Duration Chart" },
                ].map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setViewMode(view.id as TimelineViewMode)}
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-xs transition-colors",
                      viewMode === view.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {view.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {filteredLogs.length}/{logs.length} logs
                </span>
                <button
                  type="button"
                  onClick={() => setControlsExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Filters{hasActiveFilters ? " *" : ""}
                  {controlsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {controlsExpanded && (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {hasProjectFilter && (
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Project</span>
                    <select
                      value={projectFilter}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setProjectFilter(nextValue);
                        onProjectFilterChange?.(nextValue === ALL_FILTER ? undefined : nextValue);
                      }}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value={ALL_FILTER}>All projects</option>
                      {projectOptions.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Sort</span>
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value as TimelineSortOrder)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Session</span>
                  <select
                    value={sessionTypeFilter}
                    onChange={(event) => setSessionTypeFilter(event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value={ALL_FILTER}>All sessions</option>
                    {availableSessionTypes.map((sessionType) => (
                      <option key={sessionType} value={sessionType}>
                        {sessionType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Search</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search notes or assets..."
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filteredLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <DataSummary logs={filteredLogs} />

          {legendColorMap.size > 0 && <ProjectLegend colorMap={legendColorMap} />}

          {viewMode === "horizontal" ? (
            <HorizontalTimeline logs={filteredLogs} projectColorMap={projectColorMap} sessionColorMap={sessionColorMap} />
          ) : viewMode === "project-chart" ? (
            <ChartBars
              buckets={weeklyBuckets}
              countsKey="projectCounts"
              colorMap={projectColorMap}
              title="Project Activity Over Time"
            />
          ) : viewMode === "session-chart" ? (
            <ChartBars
              buckets={weeklyBuckets}
              countsKey="sessionCounts"
              colorMap={sessionColorMap}
              title="Session Type Activity Over Time"
            />
          ) : viewMode === "duration-chart" ? (
            <DurationTrendChart buckets={weeklyBuckets} />
          ) : (
            <div className="space-y-6">
              {groupedLogs.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold tracking-wide text-foreground/90">{group.label}</h3>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">{group.logs.length}</span>
                  </div>

                  <div className="space-y-4">
                    {group.logs.map((log, idx) => {
                      const key = `${log.id || "work-log"}-${log.projectId || "project"}-${idx}`;
                      const isLast = idx === group.logs.length - 1;
                      const projectName = log.projectTitle || "Unknown project";
                      const projectColor = projectColorMap.get(projectName) || "#64748b";

                      return (
                        <div key={key} className="relative pl-8">
                          <span
                            className="absolute left-[0.55rem] top-2.5 h-3 w-3 rounded-full border border-primary/40"
                            style={{ backgroundColor: projectColor }}
                          />
                          {!isLast && <span className="absolute bottom-[-1.1rem] left-[0.88rem] top-6 w-px bg-border/80" />}
                          <RailEntry
                            log={log}
                            timelineKey={key}
                            projectColor={projectColor}
                            sessionColorMap={sessionColorMap}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
