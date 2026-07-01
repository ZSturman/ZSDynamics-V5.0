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
import * as THREE from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { CollectionItem, Project, Resource } from "@/types"
import { ArrowRight } from "lucide-react"
import { CollectionFullscreen } from "./collection-item-fullscreen"
import { getProjectHref } from "@/lib/project-paths"
import { cn, extractPathValue, resolveProjectAssetPath, isSvgFile, getRenderableProjectPreviewPath } from "@/lib/utils"
import {
  getCollectionItemPosterPath,
  getCollectionItemPreviewFrames,
  getCollectionItemPreviewIntervalMs,
  getCollectionItemResources,
  getCollectionItemTextContent,
  getCollectionItemOptimizedPath,
} from "@/lib/collection-item-media"
import ResourceButton from "../resource-button"
import { useBreadcrumb } from "@/lib/breadcrumb-context"
import { LinkPreviewSurface } from "../link-preview-surface"
import { CollectionVideoPreview } from "./collection-video-preview"
import { trackProjectItemOpen } from "@/lib/firebase-analytics"

// Helper function to extract thumbnail path from various formats (string or object)
function getThumbnailPath(item: CollectionItem): string | undefined {
  return extractPathValue(item.thumbnail);
}

// Helper function to get the item path from various possible formats
function getItemPath(item: CollectionItem, folderName?: string, collectionName?: string): string | undefined {
  const pathOptions = { folderName, collectionName, itemId: item.id };
  
  // First check for direct path
  if (item.path) {
    if (typeof item.path === 'string') {
      const resolvedPath = resolveProjectAssetPath(item.path, pathOptions);
      if (resolvedPath) return resolvedPath;
    }
  }
  
  // Then check for filePath (can be string or object)
  if (item.filePath) {
    const resolvedPath = resolveProjectAssetPath(item.filePath, pathOptions);
    if (resolvedPath) return resolvedPath;
  }

  if (item.relativePath) {
    const resolvedPath = resolveProjectAssetPath(item.relativePath, pathOptions);
    if (resolvedPath) return resolvedPath;
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
  if (resolvedResourceUrl && (item.type === 'url-link' || item.type === 'local-link' || item.type === 'folio')) {
    return resolvedResourceUrl
  }

  // Check thumbnail as fallback
  const thumbnailPath = getThumbnailPath(item);
  if (thumbnailPath && thumbnailPath !== '') {
    const resolvedPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (resolvedPath) return resolvedPath;
  }
  
  // If thumbnail.path is empty and this is an image type, use the main path/filePath instead
  if (item.type === 'image' && (!thumbnailPath || thumbnailPath === '')) {
    // Fall back to path or filePath for image types
    if (item.path) {
      const resolvedPath = resolveProjectAssetPath(item.path, pathOptions);
      if (resolvedPath) return resolvedPath;
    }
    if (item.filePath) {
      const resolvedPath = resolveProjectAssetPath(item.filePath, pathOptions);
      if (resolvedPath) return resolvedPath;
    }
  }
  
  return undefined;
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
  openFromQuery?: boolean
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
  const resources = getCollectionItemResources(item);
  const { oneLiner, summary } = getCollectionItemTextContent(item);
  
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
      data-testid="collection-item-card"
      data-collection-item-id={item.id}
      data-collection-item-type={item.type}
      data-analytics-item="collection_item"
      data-analytics-item-id={item.id}
      data-analytics-item-type={item.type}
      data-analytics-item-label={item.label}
      data-analytics-project-slug={project?.slug || project?.id}
      data-analytics-project-title={project?.title}
      className={cn(
        "relative flex h-full max-w-full flex-col overflow-hidden rounded-lg border-border/35 bg-card/35 p-0 shadow-none transition-colors hover:border-primary/25",
        onRequestFullscreen && !disableClickToFullscreen && "cursor-pointer",
        className
      )}
      onClick={handleCardClick}
    >

      
      {/* Content Area */}
      <div className="relative group aspect-video max-w-full bg-muted/60">
        {children}
      </div>

            {item.label && (
        <div className="min-w-0 px-2 pt-2">
          <h4 className="line-clamp-1 break-words text-sm font-semibold">{item.label}</h4>
        </div>
      )}
      
      {/* Summary Footer with resource buttons as icons */}
      {(oneLiner || summary || resources.length > 0) && (
        <div className="flex min-w-0 flex-1 flex-col gap-2 space-y-1.5 p-2 pt-1.5">
          {oneLiner && (
            <p data-testid="collection-item-one-liner" className="line-clamp-2 break-words text-sm font-medium leading-5 text-foreground/90">
              {oneLiner}
            </p>
          )}
          {summary && (
            <p data-testid="collection-item-summary" className="line-clamp-4 flex-1 break-words text-xs text-muted-foreground">
              {summary}
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

export default function CollectionItemCard({
  item,
  project,
  inModal,
  folderName,
  collectionName,
  allItems,
  currentIndex,
  openFromQuery = true,
}: ExtendedCollectionItemCardProps) {
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
  const itemPath = getItemPath(item, folderName, collectionName)
  const isProjectPageItem =
    item.type === "folio"
    || item.type === "local-link"
    || (item.type === "url-link" && typeof itemPath === "string" && itemPath.startsWith("/projects/"))

  useEffect(() => {
    if (!openFromQuery) {
      return
    }

    if (isProjectPageItem) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get("collectionItem") === item.id) {
      setIsFullscreen(true)
    }
  }, [isProjectPageItem, item.id, openFromQuery])

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

  // Handle project-link items - redirect directly to the page
  const handleFolioClick = () => {
    if (itemPath && typeof itemPath === 'string') {
      if (project) {
        trackProjectItemOpen({
          projectSlug: project.slug || project.id,
          projectTitle: project.title,
          itemId: item.id,
          itemType: item.type,
          itemLabel: item.label,
          collectionKey: collectionName,
          surface: inModal ? "project_modal_collection" : "project_page_collection",
          interactionType: "project_link",
        });
      }

      // Check if it's a local path or external URL
      if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
        // Check if it's the same host
        try {
          const linkUrl = new URL(itemPath, window.location.href);
          if (linkUrl.hostname === window.location.hostname) {
            // Set breadcrumb to current project before navigating
            if (project) {
              setPreviousPath(getProjectHref(project), project.title || 'Project');
            }
            router.push(`${linkUrl.pathname}${linkUrl.search}${linkUrl.hash}`);
          } else {
            window.open(itemPath, "_blank", "noopener,noreferrer");
          }
        } catch {
          window.open(itemPath, "_blank", "noopener,noreferrer");
        }
      } else {
        // Set breadcrumb to current project before navigating to another project
        if (project && typeof itemPath === 'string' && itemPath.startsWith('/projects/')) {
          setPreviousPath(getProjectHref(project), project.title || 'Project');
        }
        router.push(itemPath);
      }
    }
  };

  function renderInline() {
    // For project links, render a clickable card that redirects
    if (isProjectPageItem) {
      return <FolioViewer item={item} onRequestFullscreen={handleFolioClick} folderName={folderName} collectionName={collectionName} project={project} />;
    }
    
    switch (item.type) {
      case "image":
        return <ImageViewer item={item} onRequestFullscreen={openFullscreen} folderName={folderName} collectionName={collectionName} project={project} />
      case "url-link":
      case "local-link":
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
      
      {/* Don't show fullscreen for project-link types */}
      {isFullscreen && !isProjectPageItem && (
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

function UrlLinkViewer({ item, folderName, collectionName }: ExtendedCollectionItemViewerProps) {
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
  const pathOptions = { folderName, collectionName, itemId: item.id };
  
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath) return undefined;
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-optimized.webp`;
  };
  
  // Helper to get a static poster image from video thumbnail
  const getVideoPosterPath = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath || fullPath.startsWith("http://") || fullPath.startsWith("https://")) return undefined;
    // Try to get a -thumb.jpg version of the video
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-thumb.jpg`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();
  const videoPosterPath = getVideoPosterPath();

  // Helper to determine if thumbnail is a video
  const isVideoThumbnail = (thumbnail?: string): boolean => {
    if (!thumbnail) return false
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi']
    return videoExts.some(ext => thumbnail.toLowerCase().endsWith(ext))
  }

  const hasThumbnail = !!getThumbnailPath(item)
  const thumbnailIsVideo = isVideoThumbnail(getThumbnailPath(item))
  const previewThumbnail =
    hasThumbnail && thumbnailIsVideo
      ? videoPosterPath || thumbnailPath
      : thumbnailPath

  return (
    <Card className="max-w-full border-0 bg-transparent p-0 shadow-none">
      <LinkPreviewSurface
        url={itemPath || ""}
        label={item.label || itemPath || "Link preview"}
        summary={item.summary || item.oneLiner}
        thumbnail={getRenderableProjectPreviewPath(previewThumbnail)}
        preview={item.linkPreview}
        openLabel="Open link"
      />

      <div className="flex items-center justify-between mt-2">
        {item.label && <p className="text-sm text-muted-foreground">{item.label}</p>}
      </div>
    </Card>
  )
}

function FolioViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  const pathOptions = { folderName, collectionName, itemId: item.id };
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath) return undefined;
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    const ext = isSvgFile(fullPath) ? '.svg' : '.webp';
    return `${withoutExt}-optimized${ext}`;
  };
  
  // Helper to get a static poster image from video thumbnail
  const getVideoPosterPath = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath || fullPath.startsWith("http://") || fullPath.startsWith("https://")) return undefined;
    // Try to get a -thumb.jpg version of the video
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    return `${withoutExt}-thumb.jpg`;
  };
  
  const thumbnailPath = getOptimizedThumbnail();
  const videoPosterPath = getVideoPosterPath();
  
  // Helper to determine if thumbnail is a video
  const isVideoThumbnail = (thumbnail?: string): boolean => {
    if (!thumbnail) return false
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi']
    return videoExts.some(ext => thumbnail.toLowerCase().endsWith(ext))
  }

  const hasThumbnail = !!getThumbnailPath(item)
  const thumbnailIsVideo = isVideoThumbnail(getThumbnailPath(item))
  
  // Prefer a static thumbnail for folio cards to avoid autoplaying previews in the grid.
  const shouldAutoPlayVideoThumbnail = false;

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
            shouldAutoPlayVideoThumbnail ? (
              <video
                src={thumbnailPath}
                className="w-full h-full object-cover"
                autoPlay
                loop={item.loop !== false}
                muted
                playsInline
              />
            ) : (
              // On mobile, show static poster instead of autoplaying video thumbnail
              videoPosterPath ? (
                <Image
                  src={videoPosterPath}
                  alt={item.label || "Project link"}
                  fill
                  className="object-cover"
                />
              ) : (
                <video
                  src={thumbnailPath}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  poster={videoPosterPath}
                />
              )
            )
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
    const ext = isSvgFile(path) ? '.svg' : '.webp';
    return `${withoutExt}-optimized${ext}`;
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
  const pathOptions = { folderName, collectionName };
  const poster = getCollectionItemPosterPath(item, pathOptions);
  const previewFrames = getCollectionItemPreviewFrames(item, pathOptions);
  const previewIntervalMs = getCollectionItemPreviewIntervalMs(item);
  const itemPath = getCollectionItemOptimizedPath(item, pathOptions);

  return (
    <CollectionItemWrapper
      item={item}
      onRequestFullscreen={itemPath ? onRequestFullscreen : undefined}
      project={project}
    >
      <CollectionVideoPreview
        label={item.label}
        posterSrc={poster}
        previewFrames={previewFrames}
        previewIntervalMs={previewIntervalMs}
        onOpen={itemPath ? onRequestFullscreen : undefined}
      />
    </CollectionItemWrapper>
  )
}

function ModelViewer({ item, onRequestFullscreen, folderName, collectionName, project }: ExtendedCollectionItemViewerProps) {
  // Default to true for autoPlay unless explicitly set to false
  const shouldAutoPlay = item.autoPlay !== false;
  const [isPlaying, setIsPlaying] = useState(shouldAutoPlay)
  const [hasAnimations, setHasAnimations] = useState(false)

  // Check if thumbnail exists - if so, render thumbnail instead of 3D model
  const thumbnailPath = getThumbnailPath(item);

  if (thumbnailPath) {
    // Build full thumbnail path
    const getOptimizedThumbnail = (): string => {
      return (
        resolveProjectAssetPath(thumbnailPath, { folderName, collectionName, itemId: item.id }) ||
        thumbnailPath
      );
    };
    
    const optimizedThumbnailPath = getOptimizedThumbnail();
    
    return (
      <CollectionItemWrapper item={item} onRequestFullscreen={onRequestFullscreen} project={project}>
        <Image 
          src={optimizedThumbnailPath} 
          alt={item.label || "3D Model preview"} 
          fill
          className="object-cover" 
        />
      </CollectionItemWrapper>
    );
  }
  
  // No thumbnail - render 3D model as before
  const rawPath = getItemPath(item, folderName, collectionName);
  
  // Convert to optimized GLB format for 3D models
  const getOptimizedModelPath = (path: string | undefined): string | undefined => {
    if (!path || typeof path !== 'string') return undefined;
    
    // If it's an external URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    
    // Convert OBJ/GLTF to GLB (optimized format)
    if (path.match(/\.(obj|gltf)$/i)) {
      return path.replace(/\.[^.]+$/, '.glb');
    }
    
    // GLB files are already optimized
    return path;
  };
  
  const itemPath = getOptimizedModelPath(rawPath);

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
  // Determine file type
  const isOBJ = path.toLowerCase().endsWith('.obj')
  const isGLTF = path.toLowerCase().endsWith('.gltf') || path.toLowerCase().endsWith('.glb')
  
  // Render the appropriate model component based on file type
  if (isGLTF) {
    return <GLTFModel path={path} isPlaying={isPlaying} loop={loop} onAnimationsDetected={onAnimationsDetected} />
  }
  
  if (isOBJ) {
    return <OBJModel path={path} onAnimationsDetected={onAnimationsDetected} />
  }
  
  return null
}

function GLTFModel({ path, isPlaying, loop, onAnimationsDetected }: Model3DProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(path)
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    onAnimationsDetected(animations.length > 0)
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

function OBJModel({ path, onAnimationsDetected }: Omit<Model3DProps, 'isPlaying' | 'loop'>) {
  const group = useRef<THREE.Group>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)
  
  useEffect(() => {
    const loader = new OBJLoader()
    loader.load(
      path,
      (object) => {
        // Center the model
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)
        
        // Scale to fit in view
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2 / maxDim
        object.scale.multiplyScalar(scale)
        
        setModel(object)
        onAnimationsDetected(false)
      },
      undefined,
      (error) => {
        console.error('Error loading OBJ:', error)
      }
    )
  }, [path, onAnimationsDetected])

  if (!model) {
    return null
  }

  return <primitive ref={group} object={model} />
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
  const pathOptions = { folderName, collectionName, itemId: item.id };

  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath) return undefined;
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    const ext = isSvgFile(fullPath) ? '.svg' : '.webp';
    return `${withoutExt}-optimized${ext}`;
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
  const pathOptions = { folderName, collectionName, itemId: item.id };
  // Helper to get optimized thumbnail path
  const getOptimizedThumbnail = (): string | undefined => {
    const thumbnailPath = getThumbnailPath(item);
    if (!thumbnailPath || thumbnailPath === '') return undefined;
    const fullPath = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (!fullPath) return undefined;
    
    // If already optimized, use as-is
    if (fullPath.includes('-optimized') || fullPath.includes('-thumb')) {
      return fullPath;
    }
    
    // Convert to optimized version
    const withoutExt = fullPath.replace(/\.[^.]+$/, '');
    const ext = isSvgFile(fullPath) ? '.svg' : '.webp';
    return `${withoutExt}-optimized${ext}`;
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
