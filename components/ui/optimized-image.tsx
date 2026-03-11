"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  placeholder?: string; // Base64 or path to placeholder image
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * OptimizedImage component with lazy loading, blur placeholders, and progressive loading.
 * 
 * Automatically handles:
 * - Lazy loading with IntersectionObserver
 * - Blur placeholder while loading
 * - Responsive images with srcset
 * - Error fallback
 * 
 * Usage:
 *   <OptimizedImage 
 *     src="/path/to/image.jpg" 
 *     alt="Description"
 *     placeholder="/path/to/placeholder.jpg"
 *   />
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  sizes,
  placeholder,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

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
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority, isInView]);

  // Determine if src is external URL
  const isExternalUrl = src.startsWith('http://') || src.startsWith('https://');

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ width: width || '100%', height: height || 'auto' }}
    >
      {/* Blur placeholder */}
      {placeholder && !isLoaded && (
        <div className="absolute inset-0">
          <Image
            src={placeholder}
            alt=""
            fill
            className="blur-lg scale-110"
            style={{ objectFit }}
            unoptimized
          />
        </div>
      )}

      {/* Main image - only load when in view */}
      {(isInView || priority) && !hasError && (
        <Image
          src={src}
          alt={alt}
          fill={!width && !height}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectFit }}
          sizes={sizes || '100vw'}
          priority={priority}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          unoptimized={isExternalUrl} // Don't optimize external URLs
        />
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!isLoaded && !hasError && !placeholder && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700" />
      )}
    </div>
  );
}

/**
 * Helper function to get the best image source from variants
 * 
 * Example usage in projects data:
 *   {
 *     original: '/projects/proj-1/image.jpg',
 *     optimized: '/projects/proj-1/image-optimized.webp',
 *     thumbnail: '/projects/proj-1/image-thumb.webp',
 *     placeholder: '/projects/proj-1/image-placeholder.jpg'
 *   }
 */
type ImageVariants =
  | string
  | {
      optimized?: string;
      original?: string;
      placeholder?: string;
      [key: string]: unknown;
    }
  | null
  | undefined;

export function getImageSrc(imageVariants: ImageVariants): string {
  if (typeof imageVariants === 'string') {
    // If it's a simple string, try to convert to optimized version
    if (imageVariants.includes('-optimized') || imageVariants.includes('-thumb')) {
      return imageVariants;
    }
    // If it's an external URL, return as-is
    if (imageVariants.startsWith('http://') || imageVariants.startsWith('https://')) {
      return imageVariants;
    }
    // Try to use optimized version
    const withoutExt = imageVariants.replace(/\.[^.]+$/, '');
    const ext = imageVariants.match(/\.svg$/i) ? '.svg' : '.webp';
    return `${withoutExt}-optimized${ext}`;
  }
  
  // Prefer optimized version, fallback to original
  if (imageVariants && typeof imageVariants === 'object') {
    return (
      (imageVariants as { optimized?: string }).optimized ||
      (imageVariants as { original?: string }).original ||
      ''
    );
  }

  return '';
}

export function getImagePlaceholder(imageVariants: ImageVariants): string | undefined {
  if (typeof imageVariants === 'string') {
    // Try to find placeholder version
    if (imageVariants.startsWith('http://') || imageVariants.startsWith('https://')) {
      return undefined;
    }
    const withoutExt = imageVariants.replace(/\.[^.]+$/, '');
    return `${withoutExt}-placeholder.jpg`;
  }
  
  if (imageVariants && typeof imageVariants === 'object') {
    return (imageVariants as { placeholder?: string }).placeholder;
  }

  return undefined;
}
