"use client";

import { Badge } from "@/components/ui/badge";
// Button is unused here; PrimaryActionButton provides the action button
import { Card } from "@/components/ui/card";
import type { Project } from "@/types";

import { MediaDisplay } from "@/components/ui/media-display";
import { formatDate, getOptimizedMediaPath, formatTextWithNewlines } from "@/lib/utils";
import ResourceButton from "../project-details/resource-button";
import { useRef } from "react";
import { displayDateLabel } from "@/lib/site-content-display";

export interface ProjectListItemProps {
  project: Project;
  onClick?: () => void;
  sortField?: "title" | "createdAt" | "updatedAt";
}

export function ProjectListItem({ project, onClick, sortField = "updatedAt" }: ProjectListItemProps) {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;
  
  const thumbnailPath = getOptimizedMediaPath(project.images?.thumbnail, folderPath);
  const thumbnailSettings = project.imageSettings?.thumbnail;

    const mediums = Array.isArray(project.mediums) ? project.mediums : [];
  
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const resourcesContainerRef = useRef<HTMLDivElement>(null);
  
  
  // Determine which date to display and label
  const displayDate = sortField === "createdAt" ? project.createdAt : project.updatedAt;
  const dateLabel = displayDateLabel(project.status, sortField, project.phase);
    
  // Note: no extra derived project shape needed here; `project` is used directly
  return (
    <Card
      className="p-2 md:px-6 md:pb-4 md:pt-3 hover:shadow-md transition-all duration-200 cursor-pointer group mb-2 max-w-full overflow-hidden"
      onClick={onClick}
    >
      <div className="flex flex-row-reverse md:flex-row gap-2 md:gap-6 max-w-full">
        {/* Thumbnail - Right on mobile, Left on desktop */}
        <div className="flex-shrink-0 ">
          <div className="relative w-24 h-24 md:w-32 md:h-32 lg:w-48 lg:h-48 rounded-lg overflow-hidden bg-muted aspect-square">
            <MediaDisplay
              src={thumbnailPath}
              alt={`${project.title} thumbnail`}
              fill
              className="object-cover md:group-hover:scale-105 transition-transform duration-200"
              loop={thumbnailSettings?.loop ?? true}
              autoPlay={thumbnailSettings?.autoPlay ?? true}
            />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 max-w-full overflow-hidden relative">
          <div className="flex flex-row items-center justify-between gap-1 md:gap-4 mb-1 md:mb-3 me-1.5 max-w-full">
            <div className="flex flex-row items-start gap-0.5 md:gap-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-lg font-semibold text-foreground group-hover:text-primary transition-colors break-words max-w-[calc(100%-4rem)] flex items-center">
                {project.title}
                </h3>
            

        {mediums.slice(0,4).map((m) => (
          <Badge key={String(m)} variant="secondary" className="ml-2 text-[10px] md:text-xs opacity-80 truncate hidden md:inline-block">
            {m}
          </Badge>
        ))}
     

            </div>
          </div>

          {/* Date positioned at top-right of the content area */}
          <div className="absolute top-1  right-2 z-10 flex flex-col items-end gap-0.5">
            <span className="text-[8px] md:text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide hidden md:inline-block">
              {dateLabel}
            </span>
            <span className="text-[9px] md:text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(displayDate, { month: "short", year: "numeric" })}
            </span>
          </div>

          <p className="text-muted-foreground text-[10px] md:text-sm mb-1.5 md:mb-4 pt-2 line-clamp-3 whitespace-pre-wrap break-words max-w-full">
            {formatTextWithNewlines(project.summary)}
          </p>
          

          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-2 max-w-full">
            <div ref={tagsContainerRef} className="hidden md:flex flex-wrap gap-1 max-w-full overflow-hidden">
              {(project.tags || []).slice(0, 4).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] md:text-xs truncate">
                  {tag}
                </Badge>
              ))}
              {project.tags && project.tags.length > 4 && (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  +{project.tags.length - 4}
                </Badge>
              )}
            </div>
          </div>

          {/* Resource icons positioned at bottom-right of the content area */}
          <div ref={resourcesContainerRef} className="hidden absolute bottom-2 right-2 md:flex items-center gap-1 md:gap-2">
            {project.resources && project.resources.map((resource) => (
              <ResourceButton 
                key={resource.url} 
                resource={resource} 
                iconOnly
                className="md:h-auto md:w-auto opacity-70 hover:opacity-100 transition-opacity hover:cursor-pointer mx-1" 
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
