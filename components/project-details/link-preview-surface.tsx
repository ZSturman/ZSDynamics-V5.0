"use client";

import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MediaDisplay } from "@/components/ui/media-display";
import type { LinkPreviewCard } from "@/types";
import { cn, getRenderableProjectPreviewPath } from "@/lib/utils";

const DEFAULT_TIMEOUT_MS = 2500;
const IFRAME_INSPECTION_DELAY_MS = 120;

interface LinkPreviewSurfaceProps {
  url: string;
  label: string;
  summary?: string;
  thumbnail?: string;
  title?: string;
  preview?: LinkPreviewCard;
  surfaceClassName?: string;
  previewClassName?: string;
  fallbackClassName?: string;
  iframeClassName?: string;
  openButtonClassName?: string;
  openLabel?: string;
  iframeSandbox?: string;
  iframeAllow?: string;
  timeoutMs?: number;
  onOpen?: () => void;
}

interface LinkMeta {
  isInternal: boolean;
  hostname: string;
  displayUrl: string;
}

function getLinkMeta(url: string): LinkMeta {
  const trimmed = url.trim();
  const looksInternal = trimmed.startsWith("/");

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://example.com";
    const parsed = new URL(trimmed, base);
    const isInternal =
      looksInternal ||
      (!/^https?:$/i.test(parsed.protocol) && !trimmed.startsWith("http")) ||
      (typeof window !== "undefined" && parsed.origin === window.location.origin);

    if (isInternal) {
      const path = `${parsed.pathname}${parsed.search}` || trimmed;
      return {
        isInternal: true,
        hostname: "Internal page",
        displayUrl: path,
      };
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return {
      isInternal: false,
      hostname: parsed.hostname,
      displayUrl: `${parsed.hostname}${path}${parsed.search}`,
    };
  } catch {
    return {
      isInternal: looksInternal,
      hostname: looksInternal ? "Internal page" : trimmed,
      displayUrl: trimmed,
    };
  }
}

function clearTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function isAccessibleIframeBlank(iframe: HTMLIFrameElement): boolean {
  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document ?? null;
  const href = frameWindow?.location.href ?? "";
  const title = frameDocument?.title?.trim() ?? "";
  const bodyText = frameDocument?.body?.textContent?.trim() ?? "";
  const childCount = frameDocument?.body?.children.length ?? 0;
  const bodyHtml = frameDocument?.body?.innerHTML?.trim() ?? "";
  const normalizedText = `${title} ${bodyText}`.toLowerCase();
  const isBrowserErrorPage =
    href.startsWith("chrome-error://") ||
    href.startsWith("edge-error://") ||
    href.startsWith("about:neterror") ||
    normalizedText.includes("this site can’t be reached") ||
    normalizedText.includes("this site can't be reached") ||
    normalizedText.includes("this page isn’t working") ||
    normalizedText.includes("this page isn't working") ||
    normalizedText.includes("err_");

  return (
    href === "about:blank" ||
    isBrowserErrorPage ||
    (!title && !bodyText && childCount === 0 && bodyHtml.length === 0)
  );
}

export function LinkPreviewSurface({
  url,
  label,
  summary,
  thumbnail,
  title,
  preview,
  surfaceClassName,
  previewClassName = "aspect-video w-full",
  fallbackClassName,
  iframeClassName = "h-full w-full border-0",
  openButtonClassName,
  openLabel,
  iframeSandbox = "allow-scripts allow-same-origin",
  iframeAllow,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onOpen,
}: LinkPreviewSurfaceProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const inspectionRef = useRef<number | null>(null);

  const { isInternal, hostname, displayUrl } = useMemo(
    () => getLinkMeta(url),
    [url],
  );
  const normalizedThumbnail = useMemo(
    () => getRenderableProjectPreviewPath(thumbnail),
    [thumbnail],
  );
  const normalizedPreviewImage = useMemo(
    () => getRenderableProjectPreviewPath(preview?.image),
    [preview?.image],
  );
  const resolvedLocalPreview =
    normalizedThumbnail || (preview?.imageSource === "capture" ? normalizedPreviewImage : undefined);
  const hasPreviewCardContent =
    Boolean(preview?.title?.trim()) ||
    Boolean(preview?.description?.trim()) ||
    Boolean(preview?.siteName?.trim()) ||
    Boolean(preview?.provider?.trim()) ||
    Boolean(preview?.displayUrl?.trim()) ||
    Boolean(normalizedPreviewImage);
  const canAttemptIframe = !resolvedLocalPreview && !isInternal && !hasPreviewCardContent;

  const clearPendingTimers = useCallback(() => {
    clearTimer(timeoutRef);
    clearTimer(inspectionRef);
  }, []);

  const markIframeFailed = useCallback(() => {
    clearPendingTimers();
    setIframeLoaded(false);
    setIframeFailed(true);
  }, [clearPendingTimers]);

  const markIframeLoaded = useCallback(() => {
    clearPendingTimers();
    setIframeFailed(false);
    setIframeLoaded(true);
  }, [clearPendingTimers]);

  const inspectIframeAfterLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      markIframeFailed();
      return;
    }

    try {
      if (isAccessibleIframeBlank(iframe)) {
        markIframeFailed();
        return;
      }

      markIframeLoaded();
    } catch {
      if (hasPreviewCardContent) {
        markIframeFailed();
        return;
      }

      markIframeLoaded();
    }
  }, [hasPreviewCardContent, markIframeFailed, markIframeLoaded]);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
    clearPendingTimers();

    if (!canAttemptIframe) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      markIframeFailed();
    }, timeoutMs);

    return () => {
      clearPendingTimers();
    };
  }, [canAttemptIframe, clearPendingTimers, markIframeFailed, timeoutMs, url]);

  const handleOpen = useCallback(() => {
    if (onOpen) {
      onOpen();
      return;
    }

    if (isInternal) {
      window.location.assign(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }, [isInternal, onOpen, url]);

  const resolvedOpenLabel = openLabel || (isInternal ? "Open page" : "Open site");
  const resolvedSummary = summary?.trim();
  const resolvedPreviewTitle = preview?.title?.trim() || title || label;
  const resolvedPreviewSiteName = preview?.siteName?.trim() || preview?.provider?.trim() || hostname;
  const resolvedPreviewDescription = preview?.description?.trim() || resolvedSummary;
  const resolvedPreviewDisplayUrl = preview?.displayUrl?.trim() || displayUrl;
  const resolvedPreviewImage = resolvedLocalPreview || normalizedPreviewImage;

  const openBadge = (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm transition-opacity hover:bg-background",
        openButtonClassName,
      )}
    >
      <ExternalLink className="size-3" />
      {resolvedOpenLabel}
    </div>
  );

  if (resolvedLocalPreview) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        data-link-preview-state="thumbnail"
        data-link-preview-kind={isInternal ? "internal" : "external"}
        className={cn(
          "group relative block w-full overflow-hidden rounded-lg border border-border/60 bg-muted/10 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          surfaceClassName,
        )}
      >
        <div className={cn("relative w-full", previewClassName)}>
          <MediaDisplay
            src={resolvedLocalPreview}
            alt={label}
            fill
            className="object-cover transition-transform group-hover:scale-[1.02]"
            autoPlay={false}
            loop={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
            {openBadge}
          </div>
        </div>
      </button>
    );
  }

  if (!canAttemptIframe || iframeFailed) {
    return (
      <div
        data-link-preview-state="fallback"
        data-link-preview-kind={isInternal ? "internal" : "external"}
        className={cn(
          "flex w-full flex-col justify-between gap-4 overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 p-5",
          previewClassName,
          surfaceClassName,
          fallbackClassName,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/30 sm:h-24 sm:w-24">
            {resolvedPreviewImage ? (
              <MediaDisplay
                src={resolvedPreviewImage}
                alt={resolvedPreviewTitle}
                fill
                className="object-cover"
                autoPlay={false}
                loop={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Globe className="size-5 text-primary" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <span>{resolvedPreviewSiteName}</span>
                <span className="h-1 w-1 rounded-full bg-border/80" />
                <span className="truncate">{resolvedPreviewDisplayUrl}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{resolvedPreviewTitle}</p>
            </div>

            {resolvedPreviewDescription ? (
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                {resolvedPreviewDescription}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Preview unavailable for this link.
              </p>
            )}

            <p className="truncate text-xs text-muted-foreground/80">{resolvedPreviewDisplayUrl}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleOpen}
          >
            {resolvedOpenLabel}
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-link-preview-state={iframeLoaded ? "iframe-loaded" : "iframe-loading"}
      data-link-preview-kind="external"
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/60 bg-card",
        surfaceClassName,
      )}
    >
      <div className={cn("relative w-full bg-muted/20", previewClassName)}>
        <iframe
          ref={iframeRef}
          src={url}
          title={title || label}
          className={iframeClassName}
          sandbox={iframeSandbox}
          allow={iframeAllow}
          loading="lazy"
          onLoad={() => {
            clearTimer(timeoutRef);
            clearTimer(inspectionRef);
            inspectionRef.current = window.setTimeout(() => {
              inspectIframeAfterLoad();
            }, IFRAME_INSPECTION_DELAY_MS);
          }}
          onError={() => {
            markIframeFailed();
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="absolute bottom-2 right-2"
      >
        {openBadge}
      </button>
    </div>
  );
}
