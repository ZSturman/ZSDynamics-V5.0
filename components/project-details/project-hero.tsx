import { Project } from "@/types";
import ThumbnailView from "./hero-views/thumbnail-view";
import PortraitView from "./hero-views/portrait-view";
import LandscapeView from "./hero-views/landscape-view";
import NoImageHeroImage from "./hero-views/no-image-view";
import { getOptimizedMediaPath } from "@/lib/utils";

const ProjectHero = ({ project }: { project: Project }) => {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const srcBanner = project.images?.banner ? getOptimizedMediaPath(project.images.banner, folderPath) : null;
  const srcPosterLandscape = project.images?.posterLandscape
    ? getOptimizedMediaPath(project.images.posterLandscape, folderPath)
    : project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;
  const srcPosterPortrait = project.images?.posterPortrait
    ? getOptimizedMediaPath(project.images.posterPortrait, folderPath)
    : project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;
  const srcThumb = project.images?.thumbnail ? getOptimizedMediaPath(project.images.thumbnail, folderPath) : null;

  const desktopMedia = srcBanner || srcPosterLandscape || srcThumb;
  const mobileMedia = srcPosterPortrait || srcBanner || srcThumb;

  if (!desktopMedia && !mobileMedia) {
    return <NoImageHeroImage project={project} />;
  }

  return (
    <div className="space-y-4">
      <div className="md:hidden">
        {mobileMedia === srcPosterPortrait && srcPosterPortrait ? (
          <PortraitView project={project} image={srcPosterPortrait} />
        ) : mobileMedia ? (
          <LandscapeView project={project} image={mobileMedia} />
        ) : (
          <ThumbnailView project={project} image={srcThumb || "/placeholder.svg"} />
        )}
      </div>

      <div className="hidden md:block">
        {desktopMedia === srcBanner && srcBanner ? (
          <LandscapeView project={project} image={srcBanner} />
        ) : desktopMedia === srcPosterLandscape && srcPosterLandscape ? (
          <PortraitView project={project} image={srcPosterLandscape} />
        ) : (
          <ThumbnailView project={project} image={desktopMedia || "/placeholder.svg"} />
        )}
      </div>
    </div>
  );
};

export default ProjectHero;
