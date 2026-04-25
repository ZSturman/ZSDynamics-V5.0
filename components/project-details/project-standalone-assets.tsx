"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Maximize2, FileText, Music, Gamepad2, Box } from "lucide-react";
import { CollectionItem, Project, Resource, type LinkPreviewCard } from "@/types";
import { CollectionFullscreen } from "./collection/collection-item-fullscreen";
import ResourceButton from "./resource-button";
import { getStandaloneProjectAssets } from "@/lib/project-collections";
import { LinkPreviewSurface } from "./link-preview-surface";
import {
  cn,
  getRenderableProjectPreviewPath,
} from "@/lib/utils";
import {
  getCollectionItemOptimizedPath,
  getCollectionItemPosterPath,
  getCollectionItemResolvedPath,
} from "@/lib/collection-item-media";
import { MediaDisplay } from "@/components/ui/media-display";
import { getProjectAssetSectionId } from "@/lib/project-section-anchors";
import { ExpandableCardContent } from "./expandable-card-content";

const ASSET_SUMMARY_COLLAPSE_THRESHOLD = 520;

function getItemResources(item: CollectionItem): Resource[] {
  const out: Resource[] = [];
  if (Array.isArray(item.resources)) out.push(...item.resources);
  if (item.resource) out.push(item.resource);
  return out.filter((r) => r.url && r.label);
}

function getAssetFavicon(resources: Resource[]): string | undefined {
  const faviconResource = resources.find((resource) => {
    return (
      typeof resource.iconUrl === "string" &&
      resource.iconUrl.trim().length > 0 &&
      resource.iconUrl.includes("/icons/favicons/")
    );
  });

  return faviconResource?.iconUrl?.trim();
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
      return null;
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
    <div className="relative w-full max-w-full overflow-hidden rounded-md border border-border/30 bg-muted/15">
      <div className="relative aspect-video w-full">
        <MediaDisplay src={src} alt={alt} fill className="object-contain" autoPlay={false} loop={false} />
      </div>
    </div>
  );
}

function VideoMedia({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-md border border-border/30 bg-black/5">
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
    <div className="w-full max-w-full rounded-md border border-border/30 bg-muted/15 p-3 md:p-4">
      <audio src={src} controls className="w-full" aria-label={alt} />
    </div>
  );
}

function TextMedia({ src, alt }: { src: string; alt: string }) {
  const isPdf = src.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return (
      <div className="w-full max-w-full overflow-hidden rounded-md border border-border/30">
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
    <div className="max-w-full rounded-md border border-border/30 bg-muted/15 p-3 md:p-4">
      <p className="text-sm text-muted-foreground">Text file: {alt}</p>
    </div>
  );
}

function GameMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full max-w-full overflow-hidden rounded-md border border-border/30">
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
  summary,
  preview,
}: {
  url: string;
  thumbnail?: string;
  label: string;
  summary?: string;
  preview?: LinkPreviewCard;
}) {
  const previewThumbnail = getRenderableProjectPreviewPath(thumbnail);

  return (
    <LinkPreviewSurface
      url={url}
      thumbnail={previewThumbnail}
      label={label}
      summary={summary}
      preview={preview}
      openLabel="Open site"
    />
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
  const pathOptions = { folderName, collectionName };
  const path = getCollectionItemResolvedPath(item, pathOptions);
  const optimizedPath = getCollectionItemOptimizedPath(item, pathOptions);
  const thumb = getCollectionItemPosterPath(item, pathOptions);
  const label = item.label || item.id;
  const mediaPath = optimizedPath || path;

  if (!mediaPath && !thumb) return null;

  switch (item.type) {
    case "image":
      return mediaPath ? <ImageMedia src={mediaPath} alt={label} /> : null;
    case "video":
      return mediaPath ? <VideoMedia src={mediaPath} poster={thumb} alt={label} /> : null;
    case "audio":
      return mediaPath ? <AudioMedia src={mediaPath} alt={label} /> : null;
    case "text":
      return mediaPath ? <TextMedia src={mediaPath} alt={label} /> : null;
    case "game":
      return mediaPath ? <GameMedia src={mediaPath} alt={label} /> : null;
    case "3d-model":
      // 3d-model renders via fullscreen only for now — show thumbnail preview
      if (thumb) return <ImageMedia src={thumb} alt={label} />;
      return (
        <div className="flex aspect-video w-full max-w-full items-center justify-center rounded-md border border-border/30 bg-muted/15">
          <Box className="size-8 text-muted-foreground" />
        </div>
      );
    case "url-link":
    case "local-link":
    case "folio":
      return mediaPath ? (
        <LinkPreview
          url={mediaPath}
          thumbnail={thumb}
          label={label}
          summary={item.summary || item.oneLiner}
          preview={item.linkPreview}
        />
      ) : null;
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
  const faviconIcon = getAssetFavicon(resources);
  const linkType = isLinkType(item.type);
  const canFullscreen = !linkType;

  const openFullscreen = useCallback(() => {
    setFullscreenIndex(currentIndex);
    setIsFullscreen(true);
  }, [currentIndex]);

  const activeItem = allItems[fullscreenIndex] || item;

  return (
    <>
      <div
        ref={ref}
        className={cn(
          "max-w-full overflow-hidden rounded-lg border border-border/30 bg-card/25 p-3 transition-all duration-500 md:p-5",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        {/* Header: label + type icon */}
        <div data-testid="project-asset-title-row" className="flex min-w-0 items-start gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              {faviconIcon ? (
                <Image
                  data-testid="project-asset-favicon"
                  src={faviconIcon}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded-[4px] object-contain"
                />
              ) : null}
              <h4 className="min-w-0 break-words text-base font-semibold tracking-tight text-foreground md:text-2xl">
                {item.label || item.id}
              </h4>
            </div>
            {item.oneLiner && (
              <p className="break-words text-sm text-muted-foreground md:text-base">{item.oneLiner}</p>
            )}
          </div>
          <AssetTypeIcon type={item.type} className="mt-1.5" />
        </div>

        {/* Media — clickable for fullscreen (or open link) */}
        <div
          className={cn("relative group mt-4 max-w-full overflow-hidden", canFullscreen && "cursor-pointer")}
          onClick={canFullscreen ? openFullscreen : undefined}
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
          <ExpandableCardContent
            contentLength={item.summary.length}
            threshold={ASSET_SUMMARY_COLLAPSE_THRESHOLD}
            collapsedHeightClassName="max-h-32"
            collapsedHeightPx={128}
            minCollapsedOverflowPx={96}
            testId="project-asset-summary-expandable"
          >
            <p className="max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              {item.summary}
            </p>
          </ExpandableCardContent>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div className="flex max-w-full flex-wrap gap-2">
            {resources.map((r, i) => (
              <ResourceButton key={`${r.url}-${i}`} resource={r} currentProject={project} />
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
    <section
      id={inModal ? undefined : "assets"}
      data-testid="project-standalone-assets"
      data-project-id={project.id}
      className="min-w-0 max-w-full scroll-mt-24 space-y-5 overflow-x-clip md:space-y-6"
    >
      <div className="min-w-0 max-w-full space-y-4 md:space-y-5">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            id={inModal ? undefined : getProjectAssetSectionId(item, idx)}
            data-testid="project-standalone-asset"
            data-asset-id={item.id}
            className="min-w-0 max-w-full scroll-mt-24"
          >
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
