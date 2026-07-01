"use client";

import { PassiveChip } from "@/components/ui/passive-chip";
import { MetadataTag, MetadataText } from "@/components/ui/metadata-text";
// Button is unused here; PrimaryActionButton provides the action button
import { Card } from "@/components/ui/card";
import type { Project } from "@/types";

import { MediaDisplay } from "@/components/ui/media-display";
import { formatDate, getOptimizedMediaPath, formatTextWithNewlines } from "@/lib/utils";
import { useRef } from "react";
import { displayDateLabel } from "@/lib/site-content-display";
import { ProjectResourceIconStrip } from "./project-resource-icon-strip";

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
  // Determine which date to display and label
  const displayDate = sortField === "createdAt" ? project.createdAt : project.updatedAt;
  const formattedDisplayDate = formatDate(displayDate, { month: "short", year: "numeric" });
  const dateLabel = displayDateLabel(project.status, sortField, project.phase);
    
  // Note: no extra derived project shape needed here; `project` is used directly
  return (
    <Card
      data-testid="project-list-item-root"
      data-project-id={project.id}
      data-analytics-item="project_list_item"
      data-analytics-item-id={project.slug || project.id}
      data-analytics-item-type="project"
      data-analytics-item-label={project.title}
      data-analytics-project-slug={project.slug || project.id}
      data-analytics-project-title={project.title}
      data-analytics-surface="project_list"
      className="mb-2 max-w-full cursor-pointer overflow-hidden rounded-lg border-border/35 bg-card/35 p-2 shadow-none transition-colors duration-200 hover:border-primary/25 md:px-6 md:pb-4 md:pt-3"
      onClick={onClick}
    >
      <div className="flex flex-row-reverse md:flex-row gap-2 md:gap-6 max-w-full min-h-24 md:min-h-32 lg:min-h-48">
        {/* Thumbnail - Right on mobile, Left on desktop */}
        <div className="flex-shrink-0 ">
          <div
            data-testid="project-list-item-media"
            data-project-id={project.id}
            data-media-role="thumbnail"
            className="relative w-24 h-24 md:w-32 md:h-32 lg:w-48 lg:h-48 rounded-lg overflow-hidden bg-muted aspect-square"
          >
            <MediaDisplay
              src={thumbnailPath}
              alt={`${project.title} thumbnail`}
              fill
              className="object-cover md:group-hover:scale-105 transition-transform duration-200"
              loop={thumbnailSettings?.loop ?? true}
              autoPlay={thumbnailSettings?.autoPlay ?? false}
            />
          </div>
        </div>
        {/* Content */}
        <div className="flex flex-1 min-w-0 max-w-full overflow-hidden relative flex-col">

          <div className="flex flex-row items-center justify-between gap-1 md:gap-4 mb-1 md:mb-3 me-1.5 max-w-full">
            <div className="flex flex-row items-start gap-0.5 md:gap-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-lg font-semibold text-foreground group-hover:text-primary transition-colors break-words max-w-[calc(100%-4rem)] flex items-center">
                {project.title}
                </h3>
            

        {mediums.slice(0,4).map((m) => (
          <PassiveChip key={String(m)} tone="strong" className="ml-2 text-[10px] md:text-xs truncate hidden md:inline-flex">
            {m}
          </PassiveChip>
        ))}
     

            </div>
          </div>

          {/* Date positioned at top-right of the content area */}
          {formattedDisplayDate && (
            <div className="absolute top-1  right-2 z-10 flex flex-col items-end gap-0.5">
              <span className="text-[8px] md:text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide hidden md:inline-block">
                {dateLabel}
              </span>
              <span className="text-[9px] md:text-sm text-muted-foreground whitespace-nowrap">
                {formattedDisplayDate}
              </span>
            </div>
          )}

          <p className="text-muted-foreground text-[10px] md:text-sm pt-2 line-clamp-3 whitespace-pre-wrap break-words max-w-full">
            {formatTextWithNewlines(project.oneLiner || project.summary)}
          </p>
          

          <div className="mt-auto flex flex-col gap-1.5 pt-2 md:flex-row md:items-end md:justify-between md:gap-2 max-w-full">
            <div ref={tagsContainerRef} className="hidden md:flex flex-wrap gap-x-2 gap-y-1 max-w-full overflow-hidden">
              {(project.tags || []).slice(0, 4).map((tag: string) => (
                <MetadataTag key={tag} tag={tag} size="sm" className="text-[10px] md:text-xs" />
              ))}
              {project.tags && project.tags.length > 4 && (
                <MetadataText size="sm" className="text-[10px] md:text-xs">
                  +{project.tags.length - 4} more
                </MetadataText>
              )}
            </div>

            <ProjectResourceIconStrip
              project={project}
              maxItems={3}
              testId="project-list-item-resource-icons"
              className="ml-auto justify-end"
              buttonClassName="h-8 w-8"
            />
          </div>

        </div>
      </div>
    </Card>
  );
}
