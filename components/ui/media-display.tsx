"use client";

// No React hooks required here
import Image from "next/image";
import { isVideoFile } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
  const isVideo = isVideoFile(src);

  if (isVideo) {
    return (
      <video
        src={src}
        className={cn("w-full h-full", className)}
        style={{ objectFit }}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        aria-label={alt}
      />
    );
  }

  // For images (including GIFs)
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        style={{ objectFit }}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 800}
      height={height || 600}
      className={className}
      style={{ objectFit }}
      priority={priority}
      sizes={sizes}
    />
  );
}
