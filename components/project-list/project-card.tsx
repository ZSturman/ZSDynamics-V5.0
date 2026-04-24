"use client";

import type React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PassiveChip } from "@/components/ui/passive-chip";
import { MetadataTag, MetadataText } from "@/components/ui/metadata-text";
import { MediaDisplay } from "@/components/ui/media-display";
import { Project } from "@/types";
import { getProjectStatusLabel, getProjectStatusToneClass } from "@/lib/project-discovery";
import ProjectMediums from "../project-details/project-mediums";
import { formatDate, getOptimizedMediaPath } from "@/lib/utils";
import { ProjectResourceIconStrip } from "./project-resource-icon-strip";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  compact?: boolean;
}

export function ProjectCard({
  project,
  onClick,
}: ProjectCardProps) {

  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;
  
  const thumb = getOptimizedMediaPath(project.images?.thumbnail, folderPath);
  const thumbnailSettings = project.imageSettings?.thumbnail;
  const updatedLabel = formatDate(project.updatedAt);

  // Get status value and check if it should be displayed
  const statusValue = project.status || "";
  const showStatusBadge = statusValue && statusValue.trim() !== "";

  return (
    <Card
      data-testid="project-card-root"
      data-project-id={project.id}
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg md:hover:scale-[1.01] bg-card border-border max-w-full overflow-hidden flex flex-col h-full p-0"
      onClick={onClick}
    >


      <CardHeader className="p-0">
        {/* Thumbnail with aspect-video to match Collection Items */}
        <div className="relative overflow-hidden">
          <div
            data-testid="project-card-media"
            data-project-id={project.id}
            data-media-role="thumbnail"
            className="relative w-full aspect-video "
          >
            <MediaDisplay
              src={thumb}
              alt={`${project.title} thumbnail`}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 400px, 100vw"
              priority={false}
              loop={thumbnailSettings?.loop ?? true}
              autoPlay={thumbnailSettings?.autoPlay ?? false}
            />

            {showStatusBadge && (
              <div className="absolute top-1.5 md:top-2 left-1.5 md:left-2">
                <PassiveChip
                  tone="strong"
                  className={`${getProjectStatusToneClass(project.status)} font-medium text-[10px] md:text-xs py-0 px-1.5 md:px-2`}
                >
                  {getProjectStatusLabel(project.status)}
                </PassiveChip>
              </div>
            )}

            <div className="absolute top-1.5 md:top-2 right-1.5 md:right-2">
              <div className="flex items-center gap-0.5 md:gap-1">
                <ProjectMediums project={project} />

                {/* Starred badge */}
                {Boolean(
                  (project as unknown as { featured?: boolean }).featured
                ) && (
                  <div className="ml-0.5 rounded-full bg-yellow-300 text-yellow-900 text-[10px] md:text-xs px-1 md:px-1.5 py-0 font-semibold">
                    ★
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2  space-y-1.5 md:space-y-2 flex-1 flex flex-col max-w-full">
     
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-xs md:text-sm text-card-foreground leading-tight group-hover:text-primary transition-colors break-words">
            {project.title}
          </h3>

          {/* One-liner / Summary */}
          <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words flex-1">
            {project.oneLiner || project.summary}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {project.tags?.slice(0, 3).map((tag) => (
            <MetadataTag key={tag} tag={tag} size="sm" className="text-[10px] md:text-[11px]" />
          ))}
          {project.tags && project.tags.length > 3 && (
            <MetadataText size="sm" className="text-[10px] md:text-[11px]">
              +{project.tags.length - 3} more
            </MetadataText>
          )}
        </div>

        {/* Footer with date and resources */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          {updatedLabel ? (
            <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
              {updatedLabel}
            </span>
          ) : (
            <span />
          )}

          <ProjectResourceIconStrip
            project={project}
            maxItems={2}
            testId="project-card-resource-icons"
            className="ml-auto justify-end"
            buttonClassName="h-8 w-8"
          />
        </div>
      </CardContent>
    </Card>
  );
}
