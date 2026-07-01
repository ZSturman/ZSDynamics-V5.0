"use client"

import type React from "react"

import { useState, useRef, useEffect, Suspense } from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { CollectionItem, Project } from "@/types"
import Image from "next/image"
import {
  getCollectionItemOptimizedPath,
  getCollectionItemPosterPath,
  getCollectionItemResolvedPath,
} from "@/lib/collection-item-media"
import { LinkPreviewSurface } from "../link-preview-surface"
import { trackProjectMediaProgress } from "@/lib/firebase-analytics"

interface ContentViewerProps {
  item: CollectionItem
  project: Project
  folderName?: string
  collectionName?: string
}

export function ContentViewer({ item, project, folderName, collectionName }: ContentViewerProps) {
  const pathOptions = { folderName, collectionName };
  const rawPath = getCollectionItemResolvedPath(item, pathOptions);
  const itemPath = getCollectionItemOptimizedPath(item, pathOptions);
  
  // Check if the path is a PDF
  const isPDF = rawPath?.toLowerCase().endsWith('.pdf');
  
  switch (item.type) {
    case "image":
      return <ImageContent path={itemPath || ""} />
    case "video":
      return <VideoContent item={item} project={project} folderName={folderName} collectionName={collectionName} />
    case "3d-model":
      return <ModelContent item={item} project={project} folderName={folderName} collectionName={collectionName} />
    case "game":
      return <GameContent path={itemPath || ""} item={item} project={project} collectionName={collectionName} />
    case "url-link":
    case "local-link":
    case "folio":
      return <UrlLinkContent path={itemPath || ""} item={item} project={project} collectionName={collectionName} />
    case "text":
      // PDFs should be displayed in an iframe, not as text
      if (isPDF) {
        return <PDFContent path={rawPath || ""} />
      }
      return <TextContent path={itemPath || ""} item={item} project={project} collectionName={collectionName} />
    case "audio":
      return <AudioContent path={itemPath || ""} item={item} project={project} collectionName={collectionName} />
    default:
      return <div className="text-muted-foreground">Unsupported content type</div>
  }
}

function ImageContent({ path }: { path: string }) {
  return (
    <div className="relative w-full" style={{ minHeight: '60vh', maxHeight: '90vh', height: '80vh' }}>
      <Image
        src={path || "/placeholder.svg"}
        alt="Content"
        fill
        className="object-contain rounded-lg"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        priority
      />
    </div>
  )
}

function UrlLinkContent({ path, item, project, collectionName }: { path: string; item: CollectionItem; project: Project; collectionName?: string }) {
  useEffect(() => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "other",
      mediaUrl: path,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType: "link_preview_view",
    });
  }, [collectionName, item.id, item.type, path, project.id, project.slug, project.title]);

  return (
    <div className="w-full max-w-6xl">
      <LinkPreviewSurface
        url={path}
        label={item.label || path}
        summary={item.summary || item.oneLiner}
        title={item.label || path}
        preview={item.linkPreview}
        previewClassName="aspect-video w-full"
        openLabel="Open link"
      />
    </div>
  )
}

function VideoContent({ item, project, folderName, collectionName }: { item: CollectionItem; project: Project; folderName?: string; collectionName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [hasVideoError, setHasVideoError] = useState(false)
  const progressMilestones = useRef<Set<number>>(new Set())
  
  const pathOptions = { folderName, collectionName };
  const rawPath = getCollectionItemResolvedPath(item, pathOptions);
  const itemPath = getCollectionItemOptimizedPath(item, pathOptions) || rawPath;

  const shouldAutoPlay = item.autoPlay === true;
  const shouldLoop = item.loop === true

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleError = () => setHasVideoError(true);
    video.addEventListener('error', handleError);

    // If the error already fired before this effect ran (e.g., the 404 was
    // received before React hydrated and attached the onError prop handler),
    // surface the error state immediately without triggering another load.
    if (video.error) {
      setHasVideoError(true);
    } else {
      video.load();
    }

    return () => {
      video.removeEventListener('error', handleError);
    };
  }, [itemPath]);

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

  const poster = getCollectionItemPosterPath(item, pathOptions);

  const trackVideoProgress = (interactionType: string, progressPercent?: number) => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "video",
      mediaUrl: itemPath,
      progressPercent,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType,
    });
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const percent = Math.floor((video.currentTime / video.duration) * 100);
    for (const milestone of [25, 50, 75]) {
      if (percent >= milestone && !progressMilestones.current.has(milestone)) {
        progressMilestones.current.add(milestone);
        trackVideoProgress("progress", milestone);
      }
    }
  };

  if (!itemPath || hasVideoError) {
    return (
      <div
        data-testid="collection-video-content-fallback"
        data-fallback-source={poster ? "poster" : "placeholder"}
        className="w-full max-w-5xl space-y-4"
      >
        <div className="relative aspect-video overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/40">
          {poster ? (
            <Image
              src={poster}
              alt={item.label || "Video fallback preview"}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 80vw"
            />
          ) : (
            <div data-media-fallback="true" className="flex h-full w-full items-center justify-center bg-muted/50">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="max-w-2xl space-y-1">
          <p className="text-sm font-medium text-foreground">Video preview unavailable</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Showing the best available still instead. Re-run media optimization or replace the source video if this
            item should be playable here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group max-w-full">
      <video
        ref={videoRef}
        src={itemPath}
        poster={poster}
        className="max-w-full max-h-[80vh] rounded-lg"
        controls
        preload="metadata"
        autoPlay={shouldAutoPlay}
        loop={shouldLoop}
        muted={shouldAutoPlay}
        playsInline // Critical for iOS - prevents fullscreen takeover
        onPlay={() => {
          setIsPlaying(true)
          if (!progressMilestones.current.has(0)) {
            progressMilestones.current.add(0)
            trackVideoProgress("play", 0)
          }
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleVideoTimeUpdate}
        onEnded={() => {
          setIsPlaying(false)
          if (!progressMilestones.current.has(100)) {
            progressMilestones.current.add(100)
            trackVideoProgress("complete", 100)
          }
        }}
        onError={() => setHasVideoError(true)}
      >
        Your browser does not support the video tag.
      </video>
      <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="secondary" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="secondary" onClick={toggleMute}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

function ModelContent({ item, project, folderName, collectionName }: { item: CollectionItem; project: Project; folderName?: string; collectionName?: string }) {
  const shouldAutoPlay = item.autoPlay === true
  const shouldLoop = item.loop === true
  const [isPlaying, setIsPlaying] = useState(shouldAutoPlay)
  const [hasAnimations, setHasAnimations] = useState(false)
  
  const pathOptions = { folderName, collectionName };
  const itemPath = getCollectionItemOptimizedPath(item, pathOptions);

  useEffect(() => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "3d_model",
      mediaUrl: itemPath,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType: "model_view",
    });
  }, [collectionName, item.id, item.type, itemPath, project.id, project.slug, project.title]);

  return (
    <div className="w-full max-w-4xl aspect-square relative border-2 border-white">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} className="rounded-lg">
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        <Suspense fallback={null}>
          <Model3D 
            path={itemPath || ""} 
            isPlaying={isPlaying} 
            loop={shouldLoop}
            onAnimationsDetected={(hasAnims) => setHasAnimations(hasAnims)} 
          />
        </Suspense>
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
      {hasAnimations && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-4 right-4"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center mt-2">
        Drag to rotate • Scroll to zoom • Right-click to pan
      </p>
    </div>
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

function GameContent({ path, item, project, collectionName }: { path: string; item: CollectionItem; project: Project; collectionName?: string }) {
  useEffect(() => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "game",
      mediaUrl: path,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType: "game_view",
    });
  }, [collectionName, item.id, item.type, path, project.id, project.slug, project.title]);

  return (
    <div className="w-full max-w-4xl aspect-video">
      <iframe
        src={path}
        className="w-full h-full border-0 rounded-lg"
        title="Game"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}

function TextContent({ path, item, project, collectionName }: { path: string; item: CollectionItem; project: Project; collectionName?: string }) {
  const [content, setContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [fileExists, setFileExists] = useState(true)

  useEffect(() => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "text",
      mediaUrl: path,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType: "text_view",
    });

    fetch(path)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`File not found: ${res.status}`)
        }
        return res.text()
      })
      .then((text) => {
        setContent(text)
        setIsLoading(false)
        setFileExists(true)
      })
      .catch((err) => {
        console.error("Failed to load text file:", err)
        setContent(`File not found: ${path}`)
        setIsLoading(false)
        setFileExists(false)
      })
  }, [collectionName, item.id, item.type, path, project.id, project.slug, project.title])

  return (
    <Card className="p-6 max-w-4xl w-full">
      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : fileExists ? (
        <div className="relative group">
          <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto" style={{ maxHeight: 'min(70vh, 700px)' }}>{content}</pre>
          {path && (
            <a
              href={path}
              download
              className="absolute top-2 right-2 px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Download
            </a>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground italic p-8 text-center">
          <p>File not available</p>
        </div>
      )}
    </Card>
  )
}

function PDFContent({ path }: { path: string }) {
  return (
    <div className="w-full max-w-6xl relative" style={{ height: 'min(80vh, 800px)' }}>
      <iframe
        src={path}
        className="w-full h-full border-0 rounded-lg bg-background"
        title="PDF Document"
      />
      <a
        href={path}
        download
        className="absolute top-4 right-4 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors shadow-lg"
      >
        Download PDF
      </a>
    </div>
  )
}

function AudioContent({ path, item, project, collectionName }: { path: string; item: CollectionItem; project: Project; collectionName?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const progressMilestones = useRef<Set<number>>(new Set())

  const trackAudioProgress = (interactionType: string, progressPercent?: number) => {
    trackProjectMediaProgress({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      mediaKind: "audio",
      mediaUrl: path,
      progressPercent,
      itemId: item.id,
      itemType: item.type,
      collectionKey: collectionName,
      surface: "collection_fullscreen",
      interactionType,
    });
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
        if (!progressMilestones.current.has(0)) {
          progressMilestones.current.add(0)
          trackAudioProgress("play", 0)
        }
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
      if (duration > 0) {
        const percent = Math.floor((audioRef.current.currentTime / duration) * 100)
        for (const milestone of [25, 50, 75]) {
          if (percent >= milestone && !progressMilestones.current.has(milestone)) {
            progressMilestones.current.add(milestone)
            trackAudioProgress("progress", milestone)
          }
        }
      }
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
    <Card className="p-8 max-w-2xl w-full">
      <audio
        ref={audioRef}
        src={path}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false)
          if (!progressMilestones.current.has(100)) {
            progressMilestones.current.add(100)
            trackAudioProgress("complete", 100)
          }
        }}
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button size="icon" variant="secondary" className="h-12 w-12" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          <Button size="icon" variant="secondary" onClick={toggleMute}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <div className="flex-1 space-y-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
