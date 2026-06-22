"use client";

import { cn } from "@/lib/utils";
import type { Project } from "@/types";

import ResourceButton from "../project-details/resource-button";

interface ProjectResourceIconStripProps {
  project: Project;
  maxItems?: number;
  className?: string;
  buttonClassName?: string;
  testId?: string;
}

export function ProjectResourceIconStrip({
  project,
  maxItems = 3,
  className,
  buttonClassName,
  testId,
}: ProjectResourceIconStripProps) {
  const resources = project.resources?.slice(0, maxItems) || [];

  if (resources.length === 0) {
    return null;
  }

  return (
    <div
      data-testid={testId}
      data-project-id={project.id}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {resources.map((resource) => (
        <ResourceButton
          key={resource.url}
          resource={resource}
          currentProject={project}
          iconOnly
          className={buttonClassName}
        />
      ))}
    </div>
  );
}
