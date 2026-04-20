"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { ExternalLink, Maximize2, Globe, FileText, Music, Gamepad2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CollectionItem, Project, Resource } from "@/types";
import { CollectionFullscreen } from "./collection/collection-item-fullscreen";
import ResourceButton from "./resource-button";
import { getStandaloneProjectAssets } from "@/lib/project-collections";
import {
  cn,
  extractPathValue,
  resolveProjectAssetPath,
  isVideoFile,
  isImageFile,
  isSvgFile,
  getOptimizedMediaPath,
} from "@/lib/utils";
import { MediaDisplay } from "@/components/ui/media-display";

// ─── Path helpers ───────────────────────────────────────────────

function getItemPath(
  item: CollectionItem,
  folderName?: string,
  collectionName?: string,
): string | undefined {
  const opts = { folderName, collectionName, itemId: item.id };

  if (item.path) {
    const r = resolveProjectAssetPath(item.path, opts);
    if (r) return r;
  }
  if (item.filePath) {
    const r = resolveProjectAssetPath(item.filePath, opts);
    if (r) return r;
  }
  if (item.relativePath) {
    const r = resolveProjectAssetPath(item.relativePath, opts);
    if (r) return r;
  }

  // url-link / folio types – try url field or resources
  if (item.type === "url-link" || item.type === "local-link" || item.type === "folio") {
    if (item.url) return item.url;
    if (item.resource?.url) return item.resource.url;
    if (item.resources?.[0]?.url) return item.resources[0].url;
  }

  // thumbnail fallback
  const thumb = extractPathValue(item.thumbnail);
  if (thumb) {
    const r = resolveProjectAssetPath(thumb, opts);
    if (r) return r;
  }

  return undefined;
}

function getThumbnailPath(
  item: CollectionItem,
  folderName?: string,
  collectionName?: string,
): string | undefined {
  const raw = extractPathValue(item.thumbnail);
  if (!raw) return undefined;
  return resolveProjectAssetPath(raw, { folderName, collectionName, itemId: item.id }) || raw;
}

function getItemResources(item: CollectionItem): Resource[] {
  const out: Resource[] = [];
  if (Array.isArray(item.resources)) out.push(...item.resources);
  if (item.resource) out.push(item.resource);
  return out.filter((r) => r.url && r.label);
}

function isLinkType(type: string): boolean {
  return type === "url-link" || type === "local-link" || type === "folio";
}

// ─── Media type icon ────────────────────────────────────────────

function AssetTypeIcon({ type, className }: { type: string; className?: string }) {
  const c = cn("size-4 text-muted-foreground", className);
  switch (type) {
    case "url-link":
    case "local-link":
    case "folio":
      return <Globe className={c} />;
    case "text":
      return <FileText className={c} />;
    case "audio":
      return <Music className={c} />;
    case "game":
      return <Gamepad2 className={c} />;
    case "3d-model":
      return <Box className={c} />;
    default:
      return null;
  }
}

// ─── Inline media renderers ─────────────────────────────────────

function ImageMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-muted/20">
      <div className="relative aspect-video w-full">
        <MediaDisplay src={src} alt={alt} fill className="object-contain" autoPlay={false} loop={false} />
      </div>
    </div>
  );
}

function VideoMedia({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-black/5">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        className="w-full aspect-video object-contain"
        aria-label={alt}
      />
    </div>
  );
}

function AudioMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full rounded-lg border border-border/60 bg-muted/20 p-4">
      <audio src={src} controls className="w-full" aria-label={alt} />
    </div>
  );
}

function TextMedia({ src, alt }: { src: string; alt: string }) {
  const isPdf = src.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border/60">
        <iframe
          src={src}
          title={alt}
          className="h-[60vh] w-full"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">Text file: {alt}</p>
    </div>
  );
}

function GameMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/60">
      <iframe
        src={src}
        title={alt}
        className="aspect-video w-full"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="fullscreen"
      />
    </div>
  );
}

function LinkPreview({
  url,
  thumbnail,
  label,
}: {
  url: string;
  thumbnail?: string;
  label: string;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!thumbnail && !iframeLoaded) {
      timerRef.current = setTimeout(() => setIframeFailed(true), 2500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [thumbnail, iframeLoaded]);

  const handleOpen = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Has thumbnail → show as clickable card
  if (thumbnail) {
    return (
      <button
        onClick={handleOpen}
        className="group relative w-full overflow-hidden rounded-lg border border-border/60 bg-muted/10 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-video w-full">
          <Image src={thumbnail} alt={label} fill className="object-cover transition-transform group-hover:scale-[1.02]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="size-3" />
            Visit
          </div>
        </div>
      </button>
    );
  }

  // No thumbnail → try iframe, fallback to card
  if (iframeFailed) {
    return (
      <button
        onClick={handleOpen}
        className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 transition-all hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Globe className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border/60">
      <iframe
        src={url}
        title={label}
        className="aspect-video w-full"
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => {
          setIframeLoaded(true);
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
      />
      <button
        onClick={handleOpen}
        className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm transition-opacity hover:bg-background"
      >
        <ExternalLink className="size-3" />
        Open site
      </button>
    </div>
  );
}

// ─── Per-asset media dispatcher ─────────────────────────────────

function AssetMedia({
  item,
  folderName,
}: {
  item: CollectionItem;
  folderName: string;
}) {
  const collectionName = "assets";
  const path = getItemPath(item, folderName, collectionName);
  const thumb = getThumbnailPath(item, folderName, collectionName);
  const label = item.label || item.id;

  if (!path && !thumb) return null;

  const optimized = path
    ? isImageFile(path) && !isSvgFile(path)
      ? getOptimizedMediaPath(path, `/projects/${folderName}`)
      : isVideoFile(path)
        ? path.replace(/\.[^.]+$/, "-optimized.mp4")
        : path
    : undefined;

  switch (item.type) {
    case "image":
      return <ImageMedia src={optimized || path!} alt={label} />;
    case "video":
      return <VideoMedia src={optimized || path!} poster={thumb} alt={label} />;
    case "audio":
      return <AudioMedia src={path!} alt={label} />;
    case "text":
      return <TextMedia src={path!} alt={label} />;
    case "game":
      return <GameMedia src={path!} alt={label} />;
    case "3d-model":
      // 3d-model renders via fullscreen only for now — show thumbnail preview
      if (thumb) return <ImageMedia src={thumb} alt={label} />;
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border/60 bg-muted/20">
          <Box className="size-8 text-muted-foreground" />
        </div>
      );
    case "url-link":
    case "local-link":
    case "folio":
      return <LinkPreview url={path!} thumbnail={thumb} label={label} />;
    default:
      if (thumb) return <ImageMedia src={thumb} alt={label} />;
      return null;
  }
}

// ─── Single asset section ───────────────────────────────────────

function StandaloneAssetItem({
  item,
  project,
  folderName,
  allItems,
  currentIndex,
  inModal,
}: {
  item: CollectionItem;
  project: Project;
  folderName: string;
  allItems: CollectionItem[];
  currentIndex: number;
  inModal?: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(currentIndex);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1, rootMargin: "0px 0px 60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const resources = getItemResources(item);
  const linkType = isLinkType(item.type);
  const canFullscreen = !linkType;

  const openFullscreen = useCallback(() => {
    if (linkType) {
      const path = getItemPath(item, folderName, "assets");
      if (path) window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    setFullscreenIndex(currentIndex);
    setIsFullscreen(true);
  }, [item, folderName, linkType, currentIndex]);

  const activeItem = allItems[fullscreenIndex] || item;

  return (
    <>
      <div
        ref={ref}
        className={cn(
          "space-y-4 transition-all duration-500",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        {/* Header: label + type icon */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-lg font-semibold tracking-tight">{item.label || item.id}</h4>
            {item.oneLiner && (
              <p className="text-sm text-muted-foreground">{item.oneLiner}</p>
            )}
          </div>
          <AssetTypeIcon type={item.type} className="mt-1" />
        </div>

        {/* Media — clickable for fullscreen (or open link) */}
        <div
          className={cn("relative group", canFullscreen && "cursor-pointer")}
          onClick={openFullscreen}
          role={canFullscreen ? "button" : undefined}
          tabIndex={canFullscreen ? 0 : undefined}
          onKeyDown={canFullscreen ? (e) => { if (e.key === "Enter" || e.key === " ") openFullscreen(); } : undefined}
        >
          <AssetMedia item={item} folderName={folderName} />
          {canFullscreen && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-xs font-medium opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-3" />
              Fullscreen
            </div>
          )}
        </div>

        {/* Summary */}
        {item.summary && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {item.summary}
          </p>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resources.map((r, i) => (
              <ResourceButton key={`${r.url}-${i}`} resource={r} project={project} size="sm" />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && canFullscreen && (
        <CollectionFullscreen
          item={activeItem}
          project={project}
          allItems={allItems}
          currentIndex={fullscreenIndex}
          onClose={() => setIsFullscreen(false)}
          inModal={inModal}
          folderName={folderName}
          collectionName="assets"
          onNavigate={setFullscreenIndex}
        />
      )}
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────

interface ProjectStandaloneAssetsProps {
  project: Project;
  inModal?: boolean;
}

export function ProjectStandaloneAssets({ project, inModal }: ProjectStandaloneAssetsProps) {
  const items = getStandaloneProjectAssets(project);
  if (items.length === 0) return null;

  const folderName = project.folderName || project.id;

  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground">Project Assets</h3>
      </div>

      <div className="divide-y divide-border/50">
        {items.map((item, idx) => (
          <div key={item.id || idx} className={cn(idx > 0 && "pt-8", idx < items.length - 1 && "pb-8")}>
            <StandaloneAssetItem
              item={item}
              project={project}
              folderName={folderName}
              allItems={items}
              currentIndex={idx}
              inModal={inModal}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
