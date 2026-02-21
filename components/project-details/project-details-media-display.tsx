import { getOptimizedMediaPath } from "@/lib/utils";
import { Project } from "@/types";
import { MediaDisplay } from "../ui/media-display";

interface ProjectDetailsMediaDisplayProps {
  project: Project;
}

const ProjectDetailsMediaDisplay = ({ project }: ProjectDetailsMediaDisplayProps) => {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const thumbnailPath = getOptimizedMediaPath(project.images?.thumbnail, folderPath);
  const bannerPath = project.images?.banner ? getOptimizedMediaPath(project.images.banner, folderPath) : null;
  const posterPortraitPath = project.images?.posterPortrait
    ? getOptimizedMediaPath(project.images.posterPortrait, folderPath)
    : null;
  const posterLandscapePath = project.images?.posterLandscape
    ? getOptimizedMediaPath(project.images.posterLandscape, folderPath)
    : project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;

  const bannerSettings = project.imageSettings?.banner;
  const posterPortraitSettings = project.imageSettings?.posterPortrait || project.imageSettings?.poster;
  const posterLandscapeSettings = project.imageSettings?.posterLandscape || project.imageSettings?.poster;
  const thumbnailSettings = project.imageSettings?.thumbnail;

  if (!posterPortraitPath && !posterLandscapePath && !bannerPath && !project.images?.thumbnail) {
    return null;
  }

  return (
    <div className="space-y-3">
      {posterPortraitPath && (
        <div className="overflow-hidden rounded-lg relative border border-border">
          <MediaDisplay
            src={posterPortraitPath}
            alt={`${project.title} poster`}
            width={400}
            height={600}
            className="w-full h-auto object-cover"
            loop={posterPortraitSettings?.loop ?? true}
            autoPlay={posterPortraitSettings?.autoPlay ?? false}
          />
        </div>
      )}

      {(bannerPath || posterLandscapePath) && (
        <div className="overflow-hidden rounded-lg relative border border-border">
          <MediaDisplay
            src={bannerPath || posterLandscapePath || "/placeholder.svg"}
            alt={`${project.title} media`}
            fill
            className="w-full object-cover aspect-video"
            loop={bannerSettings?.loop ?? posterLandscapeSettings?.loop ?? true}
            autoPlay={bannerSettings?.autoPlay ?? posterLandscapeSettings?.autoPlay ?? false}
          />
        </div>
      )}

      {project.images?.thumbnail && !posterPortraitPath && !bannerPath && !posterLandscapePath && (
        <div className="overflow-hidden rounded-lg relative border border-border">
          <MediaDisplay
            src={thumbnailPath}
            alt={`${project.title} thumbnail`}
            fill
            className="w-full object-cover aspect-video"
            loop={thumbnailSettings?.loop ?? true}
            autoPlay={thumbnailSettings?.autoPlay ?? false}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsMediaDisplay;
