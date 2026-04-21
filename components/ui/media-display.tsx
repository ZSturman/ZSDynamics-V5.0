"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { isVideoFile } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PLACEHOLDER_SRC = "/placeholder.svg";
const IMAGE_CANDIDATE_EXTENSIONS = [
  "webp",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "bmp",
  "tiff",
  "avif",
  "heic",
];
const VIDEO_CANDIDATE_EXTENSIONS = [
  "mp4",
  "mov",
  "webm",
  "mkv",
  "avi",
  "flv",
  "ogv",
  "wmv",
  "mpg",
  "mpeg",
];

interface MediaDisplayProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  priority?: boolean;
  sizes?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

interface FallbackMediaProps extends MediaDisplayProps {
  fallbackSrc?: string;
}

interface PlaceholderLayerProps {
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

function getFallbackCandidateSources(src: string): string[] {
  if (!src || src === PLACEHOLDER_SRC || src.startsWith("http://") || src.startsWith("https://")) {
    return [src];
  }

  const match = src.match(/^(.*?)-(optimized|thumb|placeholder)\.([^.\/]+)$/i);
  if (!match) {
    return [src];
  }

  const [, basePath, , extension] = match;
  const normalizedExtension = extension.toLowerCase();
  const candidates = new Set<string>([src]);
  const candidateExtensions = isVideoFile(src)
    ? [normalizedExtension, ...VIDEO_CANDIDATE_EXTENSIONS]
    : [normalizedExtension, ...IMAGE_CANDIDATE_EXTENSIONS];

  for (const candidateExtension of candidateExtensions) {
    candidates.add(`${basePath}.${candidateExtension}`);
  }

  return [...candidates];
}

function getNextCandidateIndex(currentIndex: number, candidateCount: number): number | null {
  if (currentIndex + 1 < candidateCount) {
    return currentIndex + 1;
  }

  return null;
}

function PlaceholderLayer({
  alt,
  className,
  width,
  height,
  fill = false,
  priority = false,
  sizes,
  objectFit = "cover",
}: PlaceholderLayerProps) {
  if (fill) {
    return (
      <div data-media-placeholder="true" className="absolute inset-0 overflow-hidden bg-muted/30">
        <Image
          src={PLACEHOLDER_SRC}
          alt={alt}
          fill
          className={className}
          style={{ objectFit }}
          priority={priority}
          sizes={sizes}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div data-media-placeholder="true" className="absolute inset-0 overflow-hidden bg-muted/30">
      <Image
        src={PLACEHOLDER_SRC}
        alt={alt}
        width={width || 800}
        height={height || 600}
        className={className}
        style={{ objectFit }}
        priority={priority}
        sizes={sizes}
        unoptimized
      />
    </div>
  );
}

function FallbackMedia({
  alt,
  className,
  width,
  height,
  fill = false,
  priority = false,
  sizes,
  objectFit = "cover",
  fallbackSrc = PLACEHOLDER_SRC,
}: FallbackMediaProps) {
  if (fill) {
    return (
      <div data-media-fallback="true" className="relative h-full w-full overflow-hidden bg-muted/30">
        <Image
          src={fallbackSrc}
          alt={alt}
          fill
          className={className}
          style={{ objectFit }}
          priority={priority}
          sizes={sizes}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div data-media-fallback="true" className="relative overflow-hidden bg-muted/30">
      <Image
        src={fallbackSrc}
        alt={alt}
        width={width || 800}
        height={height || 600}
        className={className}
        style={{ objectFit }}
        priority={priority}
        sizes={sizes}
        unoptimized
      />
    </div>
  );
}

/**
 * MediaDisplay component - Displays either an image or video based on file extension
 * Supports GIFs, all image formats, and video files (mp4, webm, mov, etc.)
 * For videos: autoPlay defaults to true, loop defaults to true, muted defaults to true
 */
export function MediaDisplay({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  loop = true,
  autoPlay = true,
  muted = true,
  playsInline = true,
  priority = false,
  sizes,
  objectFit = "cover",
}: MediaDisplayProps) {
  const [hasError, setHasError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const candidateSources = getFallbackCandidateSources(src);
  const activeSrc = candidateSources[candidateIndex] || src;
  const isVideo = isVideoFile(activeSrc);
  const shouldRenderFallback = !activeSrc || activeSrc === PLACEHOLDER_SRC || hasError;
  const candidateCount = candidateSources.length;

  const handleMediaFailure = () => {
    setCandidateIndex((currentIndex) => {
      const nextCandidateIndex = getNextCandidateIndex(currentIndex, candidateCount);
      if (nextCandidateIndex !== null) {
        setIsImageLoaded(false);
        return nextCandidateIndex;
      }

      setHasError(true);
      return currentIndex;
    });
  };

  useEffect(() => {
    setHasError(false);
    setIsImageLoaded(false);
    setCandidateIndex(0);
  }, [src]);

  useEffect(() => {
    if (isVideo || shouldRenderFallback) {
      return;
    }

    let frameId = 0;

    const syncImageState = () => {
      const currentImage = imageRef.current;
      if (!currentImage) {
        return;
      }

      if (!currentImage.complete) {
        frameId = window.requestAnimationFrame(syncImageState);
        return;
      }

      if (currentImage.naturalWidth > 0) {
        setIsImageLoaded(true);
        return;
      }

      setCandidateIndex((currentIndex) => {
        const nextCandidateIndex = getNextCandidateIndex(currentIndex, candidateCount);
        if (nextCandidateIndex !== null) {
          setIsImageLoaded(false);
          return nextCandidateIndex;
        }

        setHasError(true);
        return currentIndex;
      });
    };

    frameId = window.requestAnimationFrame(syncImageState);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeSrc, candidateCount, isVideo, shouldRenderFallback]);

  if (shouldRenderFallback) {
    return (
      <FallbackMedia
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        objectFit={objectFit}
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={activeSrc}
        className={cn("w-full h-full", className)}
        style={{ objectFit }}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        aria-label={alt}
        onError={handleMediaFailure}
      />
    );
  }

  // For images (including GIFs)
  if (fill) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {!isImageLoaded ? (
          <PlaceholderLayer
            alt={alt}
            className={className}
            fill
            priority={priority}
            sizes={sizes}
            objectFit={objectFit}
          />
        ) : null}
        <Image
          ref={imageRef}
          src={activeSrc}
          alt={alt}
          fill
          className={cn(className, !isImageLoaded && "opacity-0")}
          style={{ objectFit }}
          priority={priority}
          sizes={sizes}
          onLoad={() => setIsImageLoaded(true)}
          onError={handleMediaFailure}
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {!isImageLoaded ? (
        <PlaceholderLayer
          alt={alt}
          className={className}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          objectFit={objectFit}
        />
      ) : null}
      <Image
        ref={imageRef}
        src={activeSrc}
        alt={alt}
        width={width || 800}
        height={height || 600}
        className={cn(className, !isImageLoaded && "opacity-0")}
        style={{ objectFit }}
        priority={priority}
        sizes={sizes}
        onLoad={() => setIsImageLoaded(true)}
        onError={handleMediaFailure}
      />
    </div>
  );
}
