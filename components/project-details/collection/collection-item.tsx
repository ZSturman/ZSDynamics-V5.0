"use client"

import type React from "react"

import { useState, useRef, useEffect, Suspense } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import type * as THREE from "three"
import { CollectionItem, Project, Resource } from "@/types"
import { ExternalLink, ArrowRight } from "lucide-react"
import { CollectionFullscreen } from "./collection-item-fullscreen"
import { cn } from "@/lib/utils"
import ResourceButton from "../resource-button"
import { useBreadcrumb } from "@/lib/breadcrumb-context"

// Helper function to extract thumbnail path from various formats (string or object)
function getThumbnailPath(item: CollectionItem): string | undefined {
  if (!item.thumbnail) return undefined;
  
  // Handle thumbnail as string
  if (typeof item.thumbnail === 'string') {
    return item.thumbnail;
  }
  
  // Handle thumbnail as object with path property
  if (typeof item.thumbnail === 'object' && 'path' in item.thumbnail) {
    const thumbnailPath = (item.thumbnail as { path?: string }).path;
    return thumbnailPath || undefined;
  }
  
  return undefined;
}

// Helper function to get the item path from various possible formats
function getItemPath(item: CollectionItem, folderName?: string, collectionName?: string): string | undefined {
  // Build the base path: /projects/{folderName}/{collectionName}/{itemId}/
  const buildFullPath = (relativePath: string): string => {
    if (!folderName) return relativePath;
    
    // If item has an ID and collectionName, include the subfolder structure
    if (item.id && collectionName) {
      return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
    }
    
    // Otherwise just use the project folder
    return `/projects/${folderName}/${relativePath}`;
  };
  
  // First check for direct path
  if (item.path) {
    // If it's an external URL, return as-is
    if (typeof item.path === 'string' && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
      return item.path;
    }
    // Otherwise build full path
    if (typeof item.path === 'string') {
      return buildFullPath(item.path);
    }
  }
  
  // Then check for filePath (can be string or object)
  if (item.filePath) {
    let path: string | undefined;
    
    // Handle filePath as string
    if (typeof item.filePath === 'string') {
      path = item.filePath;
    }
    // Handle filePath as object with path property
    else if (typeof item.filePath === 'object' && 'path' in item.filePath) {
      path = (item.filePath as { path?: string }).path;
    }
    
    // If we got a valid path string
    if (path && path !== '') {
      // If it's an external URL, return as-is
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      // Otherwise build full path
      return buildFullPath(path);
    }
  }
  // If this is a URL/link item, prefer any explicit URL found in the item
  const extractUrlFromResources = (): string | undefined => {
    // support legacy or alternate fields in a type-safe way
    const recordItem = item as unknown as Record<string, unknown>
    const maybeUrl = recordItem["url"]
    if (typeof maybeUrl === "string") return maybeUrl
    const maybeHref = recordItem["href"]
    if (typeof maybeHref === "string") return maybeHref

    if (item.resource && typeof (item.resource as Resource).url === "string") {
      return (item.resource as Resource).url
    }

    if (item.resources && Array.isArray(item.resources)) {
      const r = item.resources.find((r) => typeof (r as Resource).url === "string")
      if (r) return (r as Resource).url
    }

    return undefined
  }

  const resolvedResourceUrl = extractUrlFromResources()
  if (resolvedResourceUrl && (item.type === 'url-link' || item.type === 'folio')) {
    return resolvedResourceUrl
  }

  // Check thumbnail as fallback
  const thumbnailPath = getThumbnailPath(item);
  if (thumbnailPath && thumbnailPath !== '') {
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    // Otherwise build full path
    return buildFullPath(thumbnailPath);
  }
  
  // If thumbnail.path is empty and this is an image type, use the main path/filePath instead
  if (item.type === 'image' && (!thumbnailPath || thumbnailPath === '')) {
    // Fall back to path or filePath for image types
    if (item.path) {
      return typeof item.path === 'string' && (item.path.startsWith('http://') || item.path.startsWith('https://'))
        ? item.path
        : buildFullPath(item.path);
    }
    if (item.filePath) {
      // Handle filePath as string
      if (typeof item.filePath === 'string') {
        return item.filePath.startsWith('http://') || item.filePath.startsWith('https://')
          ? item.filePath
          : buildFullPath(item.filePath);
      }
      // Handle filePath as object with path property
      if (typeof item.filePath === 'object' && 'path' in item.filePath) {
        const filePathStr = (item.filePath as { path?: string }).path;
        if (filePathStr && filePathStr !== '') {
          return filePathStr.startsWith('http://') || filePathStr.startsWith('https://')
            ? filePathStr
            : buildFullPath(filePathStr);
        }
      }
    }
  }
  
  return undefined;
}

// Helper function to get resources as array
function getItemResources(item: CollectionItem): Resource[] {
  const resources: Resource[] = [];
  
  // Add resources array if exists
  if (item.resources && Array.isArray(item.resources)) {
    resources.push(...item.resources);
  }
  
  // Add singular resource if exists
  if (item.resource) {
    resources.push(item.resource);
  }
  
  // Filter out resources with empty url or label
  return resources.filter(resource => {
    return resource.url && resource.url !== '' && resource.label && resource.label !== '';
  });
}

interface CollectionItemViewerProps {
  item: CollectionItem

}

interface ExtendedCollectionItemCardProps extends CollectionItemViewerProps {
  project: Project
  inModal?: boolean
  folderName?: string
  collectionName?: string
  allItems?: CollectionItem[]
  currentIndex?: number
}

interface ExtendedCollectionItemViewerProps extends CollectionItemViewerProps {
  onRequestFullscreen?: () => void
  folderName?: string
  collectionName?: string
  project?: Project
}

interface CollectionItemWrapperProps {
  item: CollectionItem
  onRequestFullscreen?: () => void
  children: React.ReactNode
  className?: string
  disableClickToFullscreen?: boolean
  project?: Project
}

function CollectionItemWrapper({ item, onRequestFullscreen, children, className, disableClickToFullscreen, project }: CollectionItemWrapperProps) {
  const resources = getItemResources(item);
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger fullscreen if disabled or no handler
    if (disableClickToFullscreen || !onRequestFullscreen) return;
    
    const target = e.target as HTMLElement;
    
    // Check if the click was on a button, video controls, or resource link
    if (
      target.closest('button') ||
      target.closest('video') ||
      target.closest('audio') ||
      target.closest('a') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    
    onRequestFullscreen();
  };
  
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-lg flex flex-col h-full relative p-0",
        onRequestFullscreen && !disableClickToFullscreen && "cursor-pointer",
        className
      )}
      onClick={handleCardClick}
    >

      
      {/* Content Area */}
      <div className="relative group aspect-video bg-muted">
        {children}
      </div>

            {item.label && (
        <div className="px-2 pt-2">
          <h4 className="font-semibold text-sm line-clamp-1">{item.label}</h4>
        </div>
      )}
      
      {/* Summary Footer with resource buttons as icons */}
      {(item.summary || resources.length > 0) && (
        <div className="p-2 pt-1.5 space-y-1.5  flex-1 flex flex-col gap-2">
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-4 flex-1">
              {item.summary}
            </p>
          )}
          {resources.length > 0 && (
            <div className="flex w-full justify-end gap-0.5 flex-shrink-0">
              {resources.map((resource) => (
                <ResourceButton key={resource.url} resource={resource} currentProject={project} iconSize={12} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function CollectionItemCard({ item, project, inModal, folderName, collectionName, allItems, currentIndex }: ExtendedCollectionItemCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState(currentIndex ?? 0)
  const router = useRouter()
  const { setPreviousPath } = useBreadcrumb()

  const openFullscreen = () => setIsFullscreen(true)
  const closeFullscreen = () => setIsFullscreen(false)

  // Update currentItemIndex when currentIndex prop changes
  useEffect(() => {
    if (currentIndex !== undefined) {
      setCurrentItemIndex(currentIndex)
    }
  }, [currentIndex])

  // Get current item from allItems if available
  const currentItem = allItems && currentItemIndex !== undefined 
    ? allItems[currentItemIndex] 
    : item

  // Navigation handler
  const handleNavigate = (index: number) => {
    if (allItems && index >= 0 && index < allItems.length) {
      setCurrentItemIndex(index)
    }
  }

  // When fullscreen opens in a modal, prevent the modal content from scrolling
  useEffect(() => {
    if (isFullscreen && inModal) {
      // Find the scrollable parent (the modal content div)
      const scrollableParent = document.querySelector('[class*="overflow-y-auto"]');
      if (scrollableParent) {
        const savedScrollTop = scrollableParent.scrollTop;
        const savedOverflow = (scrollableParent as HTMLElement).style.overflow;
        
        // Prevent scrolling and lock position
        (scrollableParent as HTMLElement).style.overflow = 'hidden';
        scrollableParent.scrollTop = 0;
        
        return () => {
          // Restore scrolling when fullscreen closes
          (scrollableParent as HTMLElement).style.overflow = savedOverflow;
          scrollableParent.scrollTop = savedScrollTop;
        };
      }
    }
  }, [isFullscreen, inModal]);

  // Handle folio type - redirect directly to the page
  const handleFolioClick = () => {
    const itemPath = getItemPath(item, folderName, collectionName);
    if (itemPath && typeof itemPath === 'string') {
      // Check if it's a local path or external URL
      if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
        // Check if it's the same host
        try {
          const linkUrl = new URL(itemPath, window.location.href);
          if (linkUrl.hostname === window.location.hostname) {
            // Set breadcrumb to current project before navigating
            if (project) {
              setPreviousPath(`/projects/${project.id}`, project.title || 'Project');
            }
            router.push(linkUrl.pathname);
          } else {
            window.open(itemPath, "_blank", "noopener,noreferrer");
          }
        } catch {
          window.open(itemPath, "_blank", "noopener,noreferrer");
        }
      } else {
        // Set breadcrumb to current project before navigating to another project
        if (project && typeof itemPath === 'string' && itemPath.startsWith('/projects/')) {
          setPreviousPath(`/projects/${project.id}`, project.title || 'Project');
        }
        router.push(itemPath);
      }
    }
  };

  function renderInline() {
    // For folio type, render a clickable card that redirects
    if (item.type === "folio") {
      return <FolioViewer item={item} onRequestFullscreen={handleFolioClick} folderName={folderName} collectionName={collectionName} project={project} />;
    }
    
    switch (item.type) {
      case "image":
        return <ImageViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "url-link":
        return <UrlLinkViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "video":
        return <VideoViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "3d-model":
        return <ModelViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "game":
        return <GameViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "text":
        return <TextViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "audio":
        return <AudioViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      default:
        return <UnsupportedTypeViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
    }
  }
  

  return (
    <>
      {renderInline()}
      
      {/* Don't show fullscreen for folio type */}
      {isFullscreen && item.type !== "folio" && (
        <CollectionFullscreen 
          item={currentItem} 
          onClose={closeFullscreen} 
          project={project} 
          inModal={inModal} 
          folderName={folderName} 
          collectionName={collectionName}
          allItems={allItems}
          currentIndex={currentItemIndex}
          onNavigate={handleNavigate}
        />
      )}
      
    </>
  )
}

function UrlLinkViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  // embed state: null = loading, true = allowed, false = blocked
  const [embedAllowed, setEmbedAllowed] = useState<boolean | null>(null)
  const timeoutRef = useRef<number | null>(null)
  
  const rawPath = getItemPath(item, folderName, collectionName);
  // Prefer optimized video file when available, fall back to original
  const getOptimizedVideoPath = (path: string | undefined): string | undefined => {
    if (!path || typeof path !== 'string') return undefined;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.includes('-optimized') || path.includes('-thumb') || path.includes('-placeholder')) return path;
    if (path.match(/\.(mp4|mov|webm|avi)$/i)) {
      return path.replace(/\.[^.]+$/, '-optimized.mp4');
    }
    return path;
  }
  const itemPath = getOptimizedVideoPath(rawPath) || rawPath;
  
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    
    // Build the full path with collection structure
    const buildFullPath = (relativePath: string): string => {
      if (!folderName) return relativePath;
      
      if (item.id && collectionName) {
        return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
      }
      
      return `/projects/${folderName}/${relativePath}`;
    };
    
    const fullPath = buildFullPath(thumbnailPath);
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();

  // Determine if the link is external or same-host
  const isSameHost = (url: string): boolean => {
    try {
      const linkUrl = new URL(url, window.location.href)
      return linkUrl.hostname === window.location.hostname
    } catch {
      return false
    }
  }

  const handleOpen = () => {
    if (itemPath) {
      // Only open in new tab if it's an external link
      if (isSameHost(itemPath)) {
        window.location.href = itemPath
      } else {
        window.open(itemPath, "_blank", "noopener,noreferrer")
      }
    }
  }

  // Helper to determine if thumbnail is a video
  const isVideoThumbnail = (thumbnail?: string): boolean => {
    if (!thumbnail) return false
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi']
    return videoExts.some(ext => thumbnail.toLowerCase().endsWith(ext))
  }

  const hasThumbnail = !!getThumbnailPath(item)
  const thumbnailIsVideo = isVideoThumbnail(getThumbnailPath(item))

  useEffect(() => {
    // Only set up embed timeout if we don't have a thumbnail
    if (!hasThumbnail) {
      // start a timeout to assume embedding is blocked if iframe doesn't fire onLoad
      // some sites block embedding (X-Frame-Options/CSP) and iframe may never load.
      timeoutRef.current = window.setTimeout(() => {
        setEmbedAllowed(false)
      }, 2000)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [itemPath, hasThumbnail])

  const onIframeLoad = () => {
    // iframe loaded successfully, mark embed allowed and clear timeout
    setEmbedAllowed(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  // Render thumbnail if available
  if (hasThumbnail) {
    return (
      <CollectionItemWrapper 
        item={item} 
        onRequestFullscreen={onRequestFullscreen}
        project={project}
      >
        <div className="relative aspect-video bg-muted overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); handleOpen(); }}>
          {thumbnailIsVideo ? (
            <video
              src={thumbnailPath}
              className="w-full h-full object-cover"
              autoPlay={item.autoPlay !== false}
              loop={item.loop !== false}
              muted
              playsInline
            />
          ) : (
            <Image
              src={thumbnailPath || "/placeholder.svg"}
              alt={item.label || "Link preview"}
              fill
              className="object-cover"
            />
          )}
          
          {/* Overlay to indicate it's a link */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-background/90 rounded-full p-4">
                <ExternalLink className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>
      </CollectionItemWrapper>
    )
  }

  // Fallback to iframe embed when no thumbnail
  return (
    <Card className="p-4">
      <div className="relative group">
        <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
          {embedAllowed === false ? (
            // fallback when embedding is blocked
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">Preview not available for this site.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleOpen}>
                    Open link
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // show iframe while loading or when allowed
            <iframe
              src={itemPath}
              title={item.label || itemPath}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              onLoad={onIframeLoad}
            />
          )}
        </div>

        <div className="absolute top-2 right-2">
          <Button size="icon" variant="secondary" onClick={handleOpen}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {item.label && <p className="text-sm text-muted-foreground">{item.label}</p>}
      </div>
    </Card>
  )
}

function FolioViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    
    // Build the full path with collection structure
    const buildFullPath = (relativePath: string): string => {
      if (!folderName) return relativePath;
      
      if (item.id && collectionName) {
        return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
      }
      
      return `/projects/${folderName}/${relativePath}`;
    };
    
    const fullPath = buildFullPath(thumbnailPath);
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();
  
  // Helper to determine if thumbnail is a video
  const isVideoThumbnail = (thumbnail?: string): boolean => {
    if (!thumbnail) return false
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi']
    return videoExts.some(ext => thumbnail.toLowerCase().endsWith(ext))
  }

  const hasThumbnail = !!getThumbnailPath(item)
  const thumbnailIsVideo = isVideoThumbnail(getThumbnailPath(item))

  return (
    <CollectionItemWrapper 
      item={item} 
      onRequestFullscreen={onRequestFullscreen}
      disableClickToFullscreen={false}
      project={project}
    >
      <div className="relative aspect-video bg-muted overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); onRequestFullscreen?.(); }}>
        {hasThumbnail ? (
          thumbnailIsVideo ? (
            <video
              src={thumbnailPath}
              className="w-full h-full object-cover"
              autoPlay={item.autoPlay !== false}
              loop={item.loop !== false}
              muted
              playsInline
            />
          ) : (
            <Image
              src={thumbnailPath || "/placeholder.svg"}
              alt={item.label || "Project link"}
              fill
              className="object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay to indicate it's a link to another project */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-background/90 rounded-full p-4">
              <ArrowRight className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
    </CollectionItemWrapper>
  )
}

function ImageViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const itemPath = getItemPath(item, folderName, collectionName);
  
  // Helper to get optimized image path
  const getOptimizedPath = (path: string | undefined): string => {
    if (!path || typeof path !== 'string') return "/placeholder.svg";
    
    // If it's an external URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // If already optimized, use as-is
    if (path.includes('-optimized') || path.includes('-thumb')) {
      return path;
    }
    
    // For .bin files (which are often images), don't apply optimization - use as-is
    if (path.toLowerCase().endsWith('.bin')) {
      return path;
    }
    
    // Convert to optimized version for standard image formats
    const withoutExt = path.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  const imageSrc = getOptimizedPath(itemPath);
  
  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      <Image 
        src={imageSrc} 
        alt={item.label || "Image"} 
        fill
        className="object-cover" 
      />
    </CollectionItemWrapper>
  )
}

function VideoViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  
  const rawPath = getItemPath(item, folderName, collectionName);
  
  // Helper to get optimized video path
  const getOptimizedVideoPath = (path: string | undefined): string | undefined => {
    if (!path || typeof path !== 'string') return undefined;
    
    // If it's an external URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // If already optimized, return as-is
    if (path.includes('-optimized') || path.includes('-thumb') || path.includes('-placeholder')) {
      return path;
    }
    
    // Convert to optimized version for video files
    if (path.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
      return path.replace(/\.[^.]+$/, '-optimized.mp4');
    }
    
    return path;
  };
  
  const itemPath = getOptimizedVideoPath(rawPath);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // Helper to get optimized thumbnail path for poster
  const getOptimizedPoster = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    
    // Build the full path with collection structure
    const buildFullPath = (relativePath: string): string => {
      if (!folderName) return relativePath;
      
      if (item.id && collectionName) {
        return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
      }
      
      return `/projects/${folderName}/${relativePath}`;
    };
    
    const fullPath = buildFullPath(thumbnailPath);
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };

  // use thumbnail as poster when provided
  const poster = getOptimizedPoster();
  
  // Default to true for autoPlay and loop unless explicitly set to false
  const shouldAutoPlay = item.autoPlay !== false;
  const shouldLoop = item.loop !== false;

  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      <video
        ref={videoRef}
        src={itemPath}
        poster={poster}
        className="w-full h-full object-cover"
        controls
        autoPlay={shouldAutoPlay}
        loop={shouldLoop}
        muted={shouldAutoPlay} // Auto-playing videos should be muted by default
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={(e) => e.stopPropagation()}
      >
        Your browser does not support the video tag.
      </video>

      <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </CollectionItemWrapper>
  )
}

function ModelViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  // Default to true for autoPlay unless explicitly set to false
  const shouldAutoPlay = item.autoPlay !== false;
  const [isPlaying, setIsPlaying] = useState(shouldAutoPlay)
  const [hasAnimations, setHasAnimations] = useState(false)
  
  const itemPath = getItemPath(item, folderName, collectionName);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      <div className="w-full h-full bg-muted">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          <Suspense fallback={null}>
            <Model3D
              path={itemPath || ""}
              isPlaying={isPlaying}
              loop={item.loop === true}
              onAnimationsDetected={(hasAnims) => setHasAnimations(hasAnims)}
            />
          </Suspense>
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
      </div>
      {hasAnimations && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button size="icon" variant="secondary" onClick={handlePlayClick}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </CollectionItemWrapper>
  )
}

interface Model3DProps {
  path: string
  isPlaying: boolean
  loop: boolean
  onAnimationsDetected: (hasAnimations: boolean) => void
}

function Model3D({ path, isPlaying, loop, onAnimationsDetected }: Model3DProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(path)
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    if (animations && animations.length > 0) {
      onAnimationsDetected(true)
    } else {
      onAnimationsDetected(false)
    }
  }, [animations, onAnimationsDetected])

  useEffect(() => {
    if (names.length > 0 && actions[names[0]]) {
      const action = actions[names[0]]
      if (action) {
        action.setLoop(loop ? 2201 : 2200, Infinity) // LoopRepeat : LoopOnce
        if (isPlaying) {
          action.play()
        } else {
          action.stop()
        }
      }
    }
  }, [isPlaying, loop, actions, names])

  return <primitive ref={group} object={scene} />
}

function GameViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const itemPath = getItemPath(item, folderName, collectionName);
  
  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      <div className="aspect-video bg-muted">
        <iframe
          src={itemPath}
          className="w-full h-full border-0"
          title={item.label || "Game"}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </CollectionItemWrapper>
  )
}

function TextViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const itemPath = getItemPath(item, folderName, collectionName);

  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    
    // Build the full path with collection structure
    const buildFullPath = (relativePath: string): string => {
      if (!folderName) return relativePath;
      
      if (item.id && collectionName) {
        return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
      }
      
      return `/projects/${folderName}/${relativePath}`;
    };
    
    const fullPath = buildFullPath(thumbnailPath);
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();
  
  // Check if this is a PDF
  const isPDF = itemPath?.toLowerCase().endsWith('.pdf');

  return (
    <CollectionItemWrapper 
      item={item} 
      onRequestFullscreen={onRequestFullscreen}
      project={project}
    >
      <div className="w-full h-full">
        {thumbnailPath ? (
          // If there's a thumbnail, show it
          <Image 
            src={thumbnailPath} 
            alt={item.label || "Document preview"} 
            fill
            className="object-cover" 
          />
        ) : isPDF ? (
          // PDF without thumbnail - show PDF icon
          <div className="flex flex-col items-center justify-center h-full bg-muted/50">
            <svg
              className="w-16 h-16 text-muted-foreground mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground font-medium">PDF Document</p>
          </div>
        ) : (
          // Text file without thumbnail - show document icon
          <div className="flex flex-col items-center justify-center h-full bg-muted/50">
            <svg
              className="w-16 h-16 text-muted-foreground mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground font-medium">Text Document</p>
          </div>
        )}
      </div>
    </CollectionItemWrapper>
  )
}

function UnsupportedTypeViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    
    // If it's an external URL, return as-is
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath;
    }
    
    // Build the full path with collection structure
    const buildFullPath = (relativePath: string): string => {
      if (!folderName) return relativePath;
      
      if (item.id && collectionName) {
        return `/projects/${folderName}/${collectionName}/${item.id}/${relativePath}`;
      }
      
      return `/projects/${folderName}/${relativePath}`;
    };
    
    const fullPath = buildFullPath(thumbnailPath);
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();

  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      {thumbnailPath ? (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <Image 
            src={thumbnailPath} 
            alt={item.label || "Unsupported item"} 
            fill
            className="object-cover" 
          />
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Unsupported item type: {item.type}</p>
        </div>
      )}
    </CollectionItemWrapper>
  )
}

function AudioViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  
  const itemPath = getItemPath(item, folderName, collectionName);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number.parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
      <div className="bg-muted p-8">
        <audio
          ref={audioRef}
          src={itemPath}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="secondary" className="h-12 w-12" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="flex-1 space-y-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollectionItemWrapper>
  )
}

// Fullscreen modal moved to separate component file (CollectionFullscreen). Removed unused local FullscreenModal.

// Text fullscreen rendering moved to CollectionFullscreen component.
