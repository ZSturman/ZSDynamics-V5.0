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
import { CollectionItem, Resource } from "@/types"
import Image from "next/image"

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
    if (item.path.startsWith('http://') || item.path.startsWith('https://')) {
      return item.path;
    }
    // Otherwise build full path
    return buildFullPath(item.path);
  }
  
  // Then check for filePath (now simplified to string)
  if (item.filePath) {
    const path = item.filePath;
    
    if (!path || typeof path !== 'string') return undefined;
    
    // If it's an external URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Otherwise build full path
    return buildFullPath(path);
  }
  // If this is a URL/link item, prefer any explicit URL found in the item
  const recordItem = item as unknown as Record<string, unknown>
  const maybeUrl = recordItem["url"]
  if (typeof maybeUrl === "string" && (item.type === 'url-link' || item.type === 'folio')) return maybeUrl
  const maybeHref = recordItem["href"]
  if (typeof maybeHref === "string" && (item.type === 'url-link' || item.type === 'folio')) return maybeHref

  // Check resources (resource/resources)
  const resource = (item as unknown as { resource?: Resource }).resource
  if (resource && typeof resource.url === 'string' && (item.type === 'url-link' || item.type === 'folio')) {
    return resource.url
  }
  const resourcesArr = (item as unknown as { resources?: Resource[] }).resources
  if (resourcesArr && Array.isArray(resourcesArr) && (item.type === 'url-link' || item.type === 'folio')) {
    const found = resourcesArr.find(r => typeof r.url === 'string')
    if (found) return found.url
  }

  // Check thumbnail as fallback
  if (item.thumbnail && typeof item.thumbnail === 'string') {
    // If it's an external URL, return as-is
    if (item.thumbnail.startsWith('http://') || item.thumbnail.startsWith('https://')) {
      return item.thumbnail;
    }
    // Otherwise build full path
    return buildFullPath(item.thumbnail);
  }
  
  return undefined;
}

// Helper to get optimized path for local files
function getOptimizedPath(path: string | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  
  // If it's an external URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If already optimized, return as-is
  if (path.includes('-optimized') || path.includes('-thumb') || path.includes('-placeholder')) {
    return path;
  }
  
  // For videos, try optimized version
  if (path.match(/\.(mp4|mov|webm|avi)$/i)) {
    return path.replace(/\.[^.]+$/, '-optimized.mp4');
  }
  
  // For images, convert to optimized webp
  if (path.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    return path.replace(/\.[^.]+$/, '-optimized.webp');
  }
  
  // For 3D models, convert to GLB (optimized format)
  if (path.match(/\.(obj|gltf)$/i)) {
    return path.replace(/\.[^.]+$/, '.glb');
  }
  
  // For other files (audio, etc.), return as-is
  return path;
}

interface ContentViewerProps {
  item: CollectionItem
  folderName?: string
  collectionName?: string
}

export function ContentViewer({ item, folderName, collectionName }: ContentViewerProps) {
  const rawPath = getItemPath(item, folderName, collectionName);
  const itemPath = getOptimizedPath(rawPath);
  
  // Check if the path is a PDF
  const isPDF = rawPath?.toLowerCase().endsWith('.pdf');
  
  switch (item.type) {
    case "image":
      return <ImageContent path={itemPath || ""} />
    case "video":
      return <VideoContent item={item} folderName={folderName} collectionName={collectionName} />
    case "3d-model":
      return <ModelContent item={item} folderName={folderName} collectionName={collectionName} />
    case "game":
      return <GameContent path={itemPath || ""} />
    case "url-link":
    case "folio":
      return <UrlLinkContent path={itemPath || ""} item={item} />
    case "text":
      // PDFs should be displayed in an iframe, not as text
      if (isPDF) {
        return <PDFContent path={rawPath || ""} />
      }
      return <TextContent path={itemPath || ""} />
    case "audio":
      return <AudioContent path={itemPath || ""} />
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

function UrlLinkContent({ path, item }: { path: string; item: CollectionItem }) {
  const [embedAllowed, setEmbedAllowed] = useState<boolean | null>(null)
  const timeoutRef = useRef<number | null>(null)

  // Helper to determine if the link is external or same-host
  const isSameHost = (url: string): boolean => {
    try {
      const linkUrl = new URL(url, window.location.href)
      return linkUrl.hostname === window.location.hostname
    } catch {
      return false
    }
  }

  const handleOpen = () => {
    if (path) {
      // Only open in new tab if it's an external link
      if (isSameHost(path)) {
        window.location.href = path
      } else {
        window.open(path, "_blank", "noopener,noreferrer")
      }
    }
  }

  useEffect(() => {
    // Start a timeout to assume embedding is blocked if iframe doesn't fire onLoad
    // Some sites block embedding (X-Frame-Options/CSP) and iframe may never load
    timeoutRef.current = window.setTimeout(() => {
      setEmbedAllowed(false)
    }, 2000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [path])

  const onIframeLoad = () => {
    // iframe loaded successfully, mark embed allowed and clear timeout
    setEmbedAllowed(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
        {embedAllowed === false ? (
          // Fallback when embedding is blocked
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                This content cannot be embedded. Click below to open it in a new tab.
              </p>
              <Button size="sm" variant="default" onClick={handleOpen}>
                Open Link
              </Button>
            </div>
          </div>
        ) : (
          // Show iframe while loading or when allowed
          <iframe
            src={path}
            title={item.label || path}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            onLoad={onIframeLoad}
          />
        )}
      </div>
    </div>
  )
}

function VideoContent({ item, folderName, collectionName }: { item: CollectionItem; folderName?: string; collectionName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  
  const rawPath = getItemPath(item, folderName, collectionName);
  const itemPath = getOptimizedPath(rawPath) || rawPath;

  // Default to true for autoPlay and loop unless explicitly set to false
  const shouldAutoPlay = item.autoPlay !== false;
  const shouldLoop = item.loop !== false;

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

  return (
    <div className="relative group max-w-full">
      <video
        ref={videoRef}
        src={itemPath}
        className="max-w-full max-h-[80vh] rounded-lg"
        controls
        autoPlay={shouldAutoPlay}
        loop={shouldLoop}
        muted={shouldAutoPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
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

function ModelContent({ item, folderName, collectionName }: { item: CollectionItem; folderName?: string; collectionName?: string }) {
  const shouldAutoPlay = item.autoPlay === true
  const shouldLoop = item.loop === true
  const [isPlaying, setIsPlaying] = useState(shouldAutoPlay)
  const [hasAnimations, setHasAnimations] = useState(false)
  
  const rawPath = getItemPath(item, folderName, collectionName);
  const itemPath = getOptimizedPath(rawPath);

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

function GameContent({ path }: { path: string }) {
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

function TextContent({ path }: { path: string }) {
  const [content, setContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [fileExists, setFileExists] = useState(true)

  useEffect(() => {
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
  }, [path])

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

function AudioContent({ path }: { path: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

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
    <Card className="p-8 max-w-2xl w-full">
      <audio
        ref={audioRef}
        src={path}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
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
