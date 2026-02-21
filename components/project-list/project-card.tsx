"use client";

import type React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaDisplay } from "@/components/ui/media-display";
import { Project } from "@/types";
import { STATUS_COLOR } from "@/lib/resource-map";
import ProjectMediums from "../project-details/project-mediums";
import { formatDate, getOptimizedMediaPath } from "@/lib/utils";
import ResourceButton from "../project-details/resource-button";

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

  // Get status value and check if it should be displayed
  const statusValue = project.status || "";
  const showStatusBadge = statusValue && statusValue.trim() !== "" && statusValue.toLowerCase() !== "done";

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg md:hover:scale-[1.01] bg-card border-border max-w-full overflow-hidden flex flex-col h-full p-0"
      onClick={onClick}
    >


      <CardHeader className="p-0">
        {/* Thumbnail with aspect-video to match Collection Items */}
        <div className="relative overflow-hidden">
          <div className="relative w-full aspect-video ">
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
                <Badge
                  variant="secondary"
                  className={`${
                    STATUS_COLOR[project.status as keyof typeof STATUS_COLOR]
                  } font-medium text-[10px] md:text-xs py-0 px-1.5 md:px-2 pointer-events-none cursor-default`}
                >
                  {(project.status || "").charAt(0).toUpperCase() +
                    (project.status || "").slice(1)}
                </Badge>
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
    
        {/* Summary */}
        <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words flex-1">
          {project.summary}
        </p>
</div>

        {/* Tags */}
        <div className="flex flex-wrap gap-0.5 md:gap-1">
          {project.tags?.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[8px] md:text-[10px] py-0 px-1 md:px-1.5 truncate max-w-full pointer-events-none cursor-default bg-muted/30"
            >
              {tag}
            </Badge>
          ))}
          {project.tags && project.tags.length > 3 && (
            <Badge variant="outline" className="text-[8px] md:text-[10px] py-0 px-1 md:px-1.5 pointer-events-none cursor-default bg-muted/30">
              +{project.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Footer with date and action */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
            {formatDate(project.updatedAt)}
          </span>
          
          {/* Resource icons and action button */}
          <div className="flex items-center gap-0.5">
            {project.resources && project.resources.slice(0, 2).map((resource) => (
              <ResourceButton key={resource.url} resource={resource} iconOnly  />
            ))}

          </div>
        </div>
      </CardContent>
    </Card>
  );
}
