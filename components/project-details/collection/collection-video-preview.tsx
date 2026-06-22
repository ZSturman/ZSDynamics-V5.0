"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollectionVideoPreviewProps {
  label?: string;
  posterSrc?: string;
  previewFrames?: string[];
  previewIntervalMs?: number;
  className?: string;
  onOpen?: () => void;
}

export function CollectionVideoPreview({
  label,
  posterSrc,
  previewFrames = [],
  previewIntervalMs = 650,
  className,
  onOpen,
}: CollectionVideoPreviewProps) {
  const [previewState, setPreviewState] = useState<"poster" | "frames">("poster");
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [hasPosterError, setHasPosterError] = useState(false);
  const [hasFrameSequenceError, setHasFrameSequenceError] = useState(false);
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const hasFrameSequence = !hasFrameSequenceError && previewFrames.length > 1;
  const posterImageSrc = hasPosterError ? undefined : posterSrc;
  const frameImageSrc =
    !hasFrameSequenceError ? previewFrames[activeFrameIndex] || previewFrames[0] : undefined;
  const activeImageSrc =
    previewState === "frames"
      ? frameImageSrc || posterImageSrc
      : posterImageSrc;

  useEffect(() => {
    if (previewState !== "frames" || hasFrameSequenceError || previewFrames.length < 2) {
      setActiveFrameIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveFrameIndex((currentIndex) => (currentIndex + 1) % previewFrames.length);
    }, previewIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasFrameSequenceError, previewFrames, previewIntervalMs, previewState]);

  useEffect(() => {
    return () => {
      if (hoverPreviewTimerRef.current) {
        clearTimeout(hoverPreviewTimerRef.current);
      }

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setHasPosterError(false);
    setHasFrameSequenceError(false);
    setPreviewState("poster");
    setActiveFrameIndex(0);
  }, [posterSrc, previewFrames]);

  const stopPreview = () => {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setPreviewState("poster");
    setActiveFrameIndex(0);
  };

  const startHoverPreview = () => {
    if (!hasFrameSequence) {
      return;
    }

    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
    }

    hoverPreviewTimerRef.current = window.setTimeout(() => {
      setPreviewState("frames");
      hoverPreviewTimerRef.current = null;
    }, 140);
  };

  const handleImageError = () => {
    if (previewState === "frames") {
      setHasFrameSequenceError(true);
      setPreviewState("poster");
      setActiveFrameIndex(0);
      return;
    }

    setHasPosterError(true);
  };

  const handleTouchStart = () => {
    if (!hasFrameSequence) {
      return;
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setPreviewState("frames");
    }, 320);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
    const shouldSuppressClick = suppressClickRef.current;

    stopPreview();

    if (shouldSuppressClick) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      return;
    }

    if (!onOpen) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    onOpen();

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);
  };

  const handleMouseDown = () => {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!suppressClickRef.current) {
      onOpen?.();
    }
  };

  return (
    <button
      type="button"
      aria-label={label ? `${label} preview` : "Video preview"}
      disabled={!onOpen}
      data-testid="collection-video-card-media"
      data-preview-state={previewState === "frames" ? "frames" : activeImageSrc ? "poster" : "fallback"}
      className={cn(
        "relative h-full w-full overflow-hidden bg-muted text-left",
        !onOpen && "cursor-default",
        className
      )}
      onMouseEnter={startHoverPreview}
      onMouseLeave={stopPreview}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClickCapture={handleClickCapture}
      onClick={handleClick}
    >
      {activeImageSrc ? (
        <Image
          src={activeImageSrc}
          alt={label ? `${label} preview` : "Video preview"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onError={handleImageError}
        />
      ) : (
        <div data-media-fallback="true" className="flex h-full w-full items-center justify-center bg-muted/60">
          <Play className="h-10 w-10 text-muted-foreground" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-background/90 p-4 shadow-lg ring-1 ring-black/10">
          <Play className="h-8 w-8 text-foreground" />
        </div>
      </div>
    </button>
  );
}
