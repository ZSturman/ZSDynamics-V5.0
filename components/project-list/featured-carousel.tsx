"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MediaDisplay } from "@/components/ui/media-display"
import { formatDate, getOptimizedMediaPath, formatTextWithNewlines } from "@/lib/utils"
import { STATUS_COLOR } from "@/lib/resource-map"
import ResourceButton from "../project-details/resource-button"
import ProjectMediums from "../project-details/project-mediums"
import { useRouter } from "next/navigation"
import { useBreadcrumb } from "@/lib/breadcrumb-context"
import type { Project } from "@/types"

interface FeaturedCarouselProps {
  projects: Project[]
  autoPlayInterval?: number // ms between slides
}

export function FeaturedCarousel({ 
  projects, 
  autoPlayInterval = 6000 
}: FeaturedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()
  const { setPreviousPath } = useBreadcrumb()
  const [isMobile, setIsMobile] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const featuredProjects = projects.filter(p => p.featured)

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex(index)
    setTimeout(() => setIsTransitioning(false), 700)
  }, [isTransitioning])

  const goToNext = useCallback(() => {
    if (featuredProjects.length === 0) return
    goToSlide((currentIndex + 1) % featuredProjects.length)
  }, [currentIndex, featuredProjects.length, goToSlide])

  const goToPrev = useCallback(() => {
    if (featuredProjects.length === 0) return
    goToSlide((currentIndex - 1 + featuredProjects.length) % featuredProjects.length)
  }, [currentIndex, featuredProjects.length, goToSlide])

  // Auto-play functionality - continues even while hovering
  useEffect(() => {
    if (featuredProjects.length <= 1) return
    
    timerRef.current = setInterval(() => {
      goToNext()
    }, autoPlayInterval)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [autoPlayInterval, goToNext, featuredProjects.length])

  const handleClick = (project: Project) => {
    setPreviousPath("/", "Home")
    
    if (isMobile) {
      router.push(`/projects/${project.id}`)
    } else {
      router.push(`/?project=${project.id}`, { scroll: false })
      router.prefetch(`/projects/${project.id}`)
    }
  }

  if (featuredProjects.length === 0) {
    return null
  }

  const currentProject = featuredProjects[currentIndex]
  const folderName = currentProject.folderName || currentProject.id
  const folderPath = `/projects/${folderName}`
  
  const bannerPath = getOptimizedMediaPath(
    currentProject.images?.banner || currentProject.images?.poster || currentProject.images?.thumbnail, 
    folderPath
  )
  const thumbnailPath = getOptimizedMediaPath(currentProject.images?.thumbnail, folderPath)
  const bannerSettings = currentProject.imageSettings?.banner || currentProject.imageSettings?.poster

  const statusValue = currentProject.status || ""
  const showStatusBadge = statusValue && statusValue.trim() !== "" && statusValue.toLowerCase() !== "done"

  return (
    <div className="mb-8">
      {/* Main Carousel Container */}
      <div className="relative group">
        {/* Featured Card */}
        <div 
          className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg cursor-pointer transition-all duration-700 ease-in-out hover:shadow-xl"
          onClick={() => handleClick(currentProject)}
          style={{
            animation: isTransitioning ? 'fadeSlide 700ms ease-in-out' : 'none'
          }}
        >
          {/* Desktop Layout - Side by side */}
          <div className="hidden md:flex flex-row min-h-[320px] lg:min-h-[380px]">
            {/* Left: Image/Banner */}
            <div className="relative w-1/2 lg:w-3/5">
              <MediaDisplay
                src={bannerPath}
                alt={`${currentProject.title} banner`}
                fill
                className="object-cover transition-transform duration-500"
                sizes="(min-width: 1024px) 60vw, 50vw"
                priority
                loop={bannerSettings?.loop ?? true}
                autoPlay={bannerSettings?.autoPlay ?? true}
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/80" />
              
              {/* Status badge */}
              {showStatusBadge && (
                <div className="absolute top-4 left-4">
                  <Badge
                    variant="secondary"
                    className={`${
                      STATUS_COLOR[currentProject.status as keyof typeof STATUS_COLOR]
                    } font-medium text-xs px-3 py-1`}
                  >
                    {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
                  </Badge>
                </div>
              )}

              {/* Mediums badge */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <ProjectMediums project={currentProject} />
              </div>
            </div>

            {/* Right: Content */}
            <div className="w-1/2 lg:w-2/5 p-6 lg:p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {currentProject.title}
                  </h3>
                  {currentProject.subtitle && (
                    <p className="text-sm lg:text-base text-muted-foreground">
                      {currentProject.subtitle}
                    </p>
                  )}
                </div>

                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed line-clamp-4">
                  {formatTextWithNewlines(currentProject.summary)}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {currentProject.tags?.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {currentProject.tags && currentProject.tags.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{currentProject.tags.length - 5}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  Updated {formatDate(currentProject.updatedAt)}
                </span>
                
                <div className="flex items-center gap-2">
                  {currentProject.resources?.slice(0, 3).map((resource) => (
                    <ResourceButton 
                      key={resource.url} 
                      resource={resource} 
                      iconOnly
                      className="opacity-70 hover:opacity-100 transition-opacity"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout - Stacked */}
          <div className="md:hidden">
            {/* Image */}
            <div className="relative aspect-video w-full">
              <MediaDisplay
                src={thumbnailPath}
                alt={`${currentProject.title} thumbnail`}
                fill
                className="object-cover"
                sizes="100vw"
                priority
                loop={bannerSettings?.loop ?? true}
                autoPlay={bannerSettings?.autoPlay ?? true}
              />
              
              {/* Status and mediums badges */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                {showStatusBadge ? (
                  <Badge
                    variant="secondary"
                    className={`${
                      STATUS_COLOR[currentProject.status as keyof typeof STATUS_COLOR]
                    } font-medium text-xs`}
                  >
                    {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
                  </Badge>
                ) : <div />}
                
                <div className="flex items-center gap-1">
                  <ProjectMediums project={currentProject} />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold text-foreground">
                {currentProject.title}
              </h3>
              
              <p className="text-sm text-muted-foreground line-clamp-3">
                {formatTextWithNewlines(currentProject.summary)}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {currentProject.tags?.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(currentProject.updatedAt)}
                </span>
                
                <div className="flex items-center gap-1">
                  {currentProject.resources?.slice(0, 2).map((resource) => (
                    <ResourceButton 
                      key={resource.url} 
                      resource={resource} 
                      iconOnly
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows - Desktop only */}
        {featuredProjects.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              onClick={(e) => {
                e.stopPropagation()
                goToPrev()
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Pagination Dots */}
      {featuredProjects.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {featuredProjects.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? "w-8 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeSlide {
          0% {
            opacity: 0.7;
            transform: translateX(20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
