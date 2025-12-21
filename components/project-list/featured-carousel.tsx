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
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"

interface FeaturedCarouselProps {
  projects: Project[]
  autoPlayInterval?: number // ms between slides
}

export function FeaturedCarousel({ 
  projects, 
  autoPlayInterval = 6000 
}: FeaturedCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const { setPreviousPath } = useBreadcrumb()
  const [isMobile, setIsMobile] = useState(false)
  
  // Sort featured projects by featuredOrder, with undefined values at the end
  const featuredProjects = projects
    .filter(p => p.featured)
    .sort((a, b) => {
      const aOrder = (a as Project).featuredOrder
      const bOrder = (b as Project).featuredOrder
      
      // If both have order, sort by order
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder
      }
      // If only a has order, a comes first
      if (aOrder !== undefined) return -1
      // If only b has order, b comes first
      if (bOrder !== undefined) return 1
      // If neither has order, maintain original order
      return 0
    })

  // Setup Embla Carousel with autoplay
  const autoplayPlugin = useRef(
    Autoplay({ delay: autoPlayInterval, stopOnInteraction: false })
  )
  
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [autoplayPlugin.current]
  )

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index)
  }, [emblaApi])

  if (featuredProjects.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      {/* Embla Carousel Container */}
      <div className="relative group">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {featuredProjects.map((project) => {
              const folderName = project.folderName || project.id
              const folderPath = `/projects/${folderName}`
              
              const bannerPath = getOptimizedMediaPath(
                project.images?.banner || project.images?.poster || project.images?.thumbnail, 
                folderPath
              )
              const bannerSettings = project.imageSettings?.banner || project.imageSettings?.poster

              const statusValue = project.status || ""
              const showStatusBadge = statusValue && statusValue.trim() !== "" && statusValue.toLowerCase() !== "done"

              return (
                <div key={project.id} className="flex-[0_0_100%] min-w-0">
                  <div 
                    className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl mx-1"
                    onClick={() => {
                      setPreviousPath("/", "Home")
                      if (isMobile) {
                        router.push(`/projects/${project.id}`)
                      } else {
                        router.push(`/?project=${project.id}`, { scroll: false })
                        router.prefetch(`/projects/${project.id}`)
                      }
                    }}
                  >
                    {/* Mobile: Full background image with overlay text */}
                    <div className="sm:hidden relative min-h-[280px]">
                      {/* Background Image */}
                      <MediaDisplay
                        src={bannerPath}
                        alt={`${project.title} banner`}
                        fill
                        className="object-cover"
                        sizes="100vw"
                        priority
                        loop={bannerSettings?.loop ?? true}
                        autoPlay={bannerSettings?.autoPlay ?? true}
                      />
                      
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
                      
                      {/* Overlayed Content */}
                      <div className="relative h-full min-h-[280px] p-4 flex flex-col justify-end">
                        <div className="space-y-2">
                          {/* Title and Subtitle */}
                          <div>
                            <div className="flex flex-row items-center">

                            <h3 className="text-lg font-bold text-foreground line-clamp-2">
                              {project.title}
                            </h3>
                                                        
                              {project.resources?.slice(0, 1).map((resource) => (
                                <ResourceButton 
                                  key={resource.url} 
                                  resource={resource} 
                                  iconOnly
                                  className="opacity-70 hover:opacity-100 transition-opacity"
                                />
                              ))}
                        

                            </div>
                            {project.subtitle && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {project.subtitle}
                              </p>
                            )}
                          </div>






                          {/* Footer */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">
                              Updated {formatDate(project.updatedAt)}
                            </span>
                            
                            {/* Tags - Show up to 2 tags */}
                            <div className="flex items-center gap-2">
                              {project.tags?.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              </div>
                          </div>




                        </div>
                      </div>
                    </div>

                    {/* Tablet/Desktop: Side-by-side layout */}
                    <div className="hidden sm:flex flex-row min-h-[320px] lg:min-h-[380px]">
                      {/* Left: Image/Banner */}
                      <div className="relative w-2/5 md:w-1/2 lg:w-3/5">
                        <MediaDisplay
                          src={bannerPath}
                          alt={`${project.title} banner`}
                          fill
                          className="object-cover transition-transform duration-500"
                          sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 40vw"
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
                                STATUS_COLOR[project.status as keyof typeof STATUS_COLOR]
                              } font-medium text-xs px-3 py-1`}
                            >
                              {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
                            </Badge>
                          </div>
                        )}

                        {/* Mediums badge */}
                        <div className="flex absolute top-4 right-4 items-center gap-2">
                          <ProjectMediums project={project} />
                        </div>
                      </div>

                      {/* Right: Content */}
                      <div className="w-3/5 md:w-1/2 lg:w-2/5 p-5 lg:p-8 flex flex-col justify-between">
                        <div className="space-y-3 lg:space-y-4">
                          {/* Title and Subtitle */}
                          <div>
                            <h3 className="text-xl lg:text-3xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                              {project.title}
                            </h3>
                            {project.subtitle && (
                              <p className="text-sm lg:text-base text-muted-foreground line-clamp-1">
                                {project.subtitle}
                              </p>
                            )}
                          </div>

                          {/* Summary */}
                          <p className="text-sm lg:text-base text-muted-foreground leading-relaxed line-clamp-3 sm:line-clamp-4">
                            {formatTextWithNewlines(project.summary)}
                          </p>

                          {/* Tags - Show on md and up (max 3) */}
                          <div className="flex flex-wrap gap-2">
                            {project.tags?.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Footer - Show on md and up */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            Updated {formatDate(project.updatedAt)}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            {project.resources?.slice(0, 3).map((resource) => (
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
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation Arrows - Overlay on desktop (md+), hidden on mobile */}
        {featuredProjects.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
              onClick={(e) => {
                e.stopPropagation()
                scrollPrev()
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
              onClick={(e) => {
                e.stopPropagation()
                scrollNext()
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Navigation and Pagination - Combined on mobile, pagination only on desktop */}
      {featuredProjects.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          {/* Left arrow - visible on mobile only */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden h-9 w-9 rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              scrollPrev()
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Pagination Dots */}
          <div className="flex items-center justify-center gap-2">
            {featuredProjects.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === selectedIndex
                    ? "w-8 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Right arrow - visible on mobile only */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden h-9 w-9 rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              scrollNext()
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
