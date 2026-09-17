import type { Project } from "@/types";
import { getOptimizedMediaPath } from "@/lib/utils";

export interface ProjectIdentityMedia {
  projectIconSrc: string | null;
  projectThumbnailSrc: string | null;
  projectVisualSrc: string | null;
}

type ProjectIdentitySource = Pick<Project, "id" | "folderName" | "images">;

export function getProjectIdentityMedia(project: ProjectIdentitySource): ProjectIdentityMedia {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const projectIconSrc = project.images?.icon ? getOptimizedMediaPath(project.images.icon, folderPath) : null;
  const projectThumbnailSrc = project.images?.thumbnail
    ? getOptimizedMediaPath(project.images.thumbnail, folderPath)
    : null;

  return {
    projectIconSrc,
    projectThumbnailSrc,
    projectVisualSrc: projectIconSrc || projectThumbnailSrc || null,
  };
}
