"use client";

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';

interface OptimizedVideoProps {
  src: string;
  poster?: string; // Thumbnail image
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  placeholder?: string; // Blur placeholder
}

/**
 * OptimizedVideo component with lazy loading and progressive enhancement.
 * 
 * Features:
 * - Lazy loads video when in viewport
 * - Shows poster/thumbnail before video loads
 * - Blur placeholder support
 * - Automatic format fallback
 * 
 * Usage:
 *   <OptimizedVideo 
 *     src="https://storage.googleapis.com/video.mp4"
 *     poster="/path/to/thumbnail.jpg"
 *     placeholder="/path/to/blur.jpg"
 *   />
 */
export function OptimizedVideo({
  src,
  poster,
  className = '',
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
  placeholder,
}: OptimizedVideoProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
      }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isInView]);

  return (
    <div 
      ref={videoRef}
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}
    >
      {/* Blur placeholder */}
      {placeholder && !isLoaded && (
        <Image
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
        />
      )}

      {/* Poster image (shown before video loads) */}
      {poster && !isLoaded && !placeholder && (
        <Image
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Video element - only render when in view */}
      {isInView && !hasError && (
        <video
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          controls={controls}
          autoPlay={isMobile ? false : autoPlay}
          muted={muted}
          loop={loop}
          poster={poster}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          playsInline
        >
          <source src={src} type="video/mp4" />
          <source src={src.replace(/\.mp4$/, '.webm')} type="video/webm" />
          Your browser does not support the video tag.
        </video>
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Failed to load video</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!isLoaded && !hasError && !poster && !placeholder && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to get video source from variants
 */
export function getVideoSrc(videoVariants: unknown): string {
  if (typeof videoVariants === 'string') {
    // If it's a simple string, try to convert to optimized version
    if (videoVariants.includes('-optimized')) {
      return videoVariants;
    }
    // If it's an external URL, return as-is
    if (videoVariants.startsWith('http://') || videoVariants.startsWith('https://')) {
      return videoVariants;
    }
    // Try to use optimized version
    return videoVariants.replace(/\.[^.]+$/, '-optimized.mp4');
  }
  
  const variants = videoVariants as Record<string, unknown>;
  return (variants?.optimized as string) || (variants?.original as string) || '';
}

export function getVideoPoster(videoVariants: unknown): string | undefined {
  if (typeof videoVariants === 'string') {
    // Try to find thumbnail version
    if (videoVariants.startsWith('http://') || videoVariants.startsWith('https://')) {
      return undefined;
    }
    const withoutExt = videoVariants.replace(/\.[^.]+$/, '');
    return `${withoutExt}-thumb.jpg`;
  }
  
  const variants = videoVariants as Record<string, unknown>;
  return variants?.thumbnail as string | undefined;
}

export function getVideoPlaceholder(videoVariants: unknown): string | undefined {
  if (typeof videoVariants === 'string') {
    // Try to find placeholder version
    if (videoVariants.startsWith('http://') || videoVariants.startsWith('https://')) {
      return undefined;
    }
    const withoutExt = videoVariants.replace(/\.[^.]+$/, '');
    return `${withoutExt}-placeholder.jpg`;
  }
  
  const variants = videoVariants as Record<string, unknown>;
  return variants?.placeholder as string | undefined;
}
