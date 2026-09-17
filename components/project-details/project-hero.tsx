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
    return (
      <div data-testid="project-hero-empty" data-project-id={project.id}>
        <NoImageHeroImage project={project} />
      </div>
    );
  }

  return (
    <div data-testid="project-hero-container" data-project-id={project.id} className="space-y-4">
      <div className="md:hidden">
        {mobileMedia === srcPosterPortrait && srcPosterPortrait ? (
          <div
            data-testid="project-hero-mobile"
            data-project-id={project.id}
            data-media-role="posterPortrait"
            data-analytics-item="project_hero_media"
            data-analytics-item-id="mobile-posterPortrait"
            data-analytics-item-type="project_media"
            data-analytics-item-label="Mobile poster portrait"
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role="posterPortrait"
          >
            <PortraitView project={project} image={srcPosterPortrait} />
          </div>
        ) : mobileMedia ? (
          <div
            data-testid="project-hero-mobile"
            data-project-id={project.id}
            data-media-role={mobileMedia === srcBanner ? "banner" : "thumbnail"}
            data-analytics-item="project_hero_media"
            data-analytics-item-id={mobileMedia === srcBanner ? "mobile-banner" : "mobile-thumbnail"}
            data-analytics-item-type="project_media"
            data-analytics-item-label={mobileMedia === srcBanner ? "Mobile banner" : "Mobile thumbnail"}
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role={mobileMedia === srcBanner ? "banner" : "thumbnail"}
          >
            <LandscapeView project={project} image={mobileMedia} />
          </div>
        ) : (
          <div
            data-testid="project-hero-mobile"
            data-project-id={project.id}
            data-media-role="thumbnail"
            data-analytics-item="project_hero_media"
            data-analytics-item-id="mobile-thumbnail"
            data-analytics-item-type="project_media"
            data-analytics-item-label="Mobile thumbnail"
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role="thumbnail"
          >
            <ThumbnailView project={project} image={srcThumb || "/placeholder.svg"} />
          </div>
        )}
      </div>

      <div className="hidden md:block">
        {desktopMedia === srcBanner && srcBanner ? (
          <div
            data-testid="project-hero-desktop"
            data-project-id={project.id}
            data-media-role="banner"
            data-analytics-item="project_hero_media"
            data-analytics-item-id="desktop-banner"
            data-analytics-item-type="project_media"
            data-analytics-item-label="Desktop banner"
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role="banner"
          >
            <LandscapeView project={project} image={srcBanner} />
          </div>
        ) : desktopMedia === srcPosterLandscape && srcPosterLandscape ? (
          <div
            data-testid="project-hero-desktop"
            data-project-id={project.id}
            data-media-role={project.images?.posterLandscape ? "posterLandscape" : "poster"}
            data-analytics-item="project_hero_media"
            data-analytics-item-id={project.images?.posterLandscape ? "desktop-posterLandscape" : "desktop-poster"}
            data-analytics-item-type="project_media"
            data-analytics-item-label={project.images?.posterLandscape ? "Desktop poster landscape" : "Desktop poster"}
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role={project.images?.posterLandscape ? "posterLandscape" : "poster"}
          >
            <PortraitView project={project} image={srcPosterLandscape} />
          </div>
        ) : (
          <div
            data-testid="project-hero-desktop"
            data-project-id={project.id}
            data-media-role="thumbnail"
            data-analytics-item="project_hero_media"
            data-analytics-item-id="desktop-thumbnail"
            data-analytics-item-type="project_media"
            data-analytics-item-label="Desktop thumbnail"
            data-analytics-project-slug={project.slug || project.id}
            data-analytics-project-title={project.title}
            data-analytics-media-role="thumbnail"
          >
            <ThumbnailView project={project} image={desktopMedia || "/placeholder.svg"} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHero;
