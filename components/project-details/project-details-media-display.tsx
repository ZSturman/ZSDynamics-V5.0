import { cn, getOptimizedMediaPath } from "@/lib/utils";
import { Project } from "@/types";
import { MediaDisplay } from "../ui/media-display";

interface ProjectDetailsMediaDisplayProps {
  project: Project;
}

interface MediaCard {
  id: string;
  mediaRole: string;
  label: string;
  src: string;
  aspectClass: string;
  maxWidthClass: string;
  loop: boolean;
  autoPlay: boolean;
}

function roleToLabel(role: string): string {
  switch (role) {
    case "posterPortrait":
      return "Poster (Portrait)";
    case "posterLandscape":
      return "Poster (Landscape)";
    case "poster":
      return "Poster";
    case "banner":
      return "Banner";
    case "thumbnail":
      return "Thumbnail";
    case "icon":
      return "Icon";
    default:
      return role
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
  }
}

const ProjectDetailsMediaDisplay = ({ project }: ProjectDetailsMediaDisplayProps) => {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const thumbnailPath = getOptimizedMediaPath(project.images?.thumbnail, folderPath);
  const bannerPath = project.images?.banner ? getOptimizedMediaPath(project.images.banner, folderPath) : null;
  const posterPortraitPath = project.images?.posterPortrait
    ? getOptimizedMediaPath(project.images.posterPortrait, folderPath)
    : null;
  const posterPath = project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;
  const posterLandscapePath = project.images?.posterLandscape
    ? getOptimizedMediaPath(project.images.posterLandscape, folderPath)
    : posterPath;

  const bannerSettings = project.imageSettings?.banner;
  const posterPortraitSettings = project.imageSettings?.posterPortrait || project.imageSettings?.poster;
  const posterLandscapeSettings = project.imageSettings?.posterLandscape || project.imageSettings?.poster;
  const thumbnailSettings = project.imageSettings?.thumbnail;
  const landscapeMediaPath = bannerPath || posterLandscapePath;

  const shouldRenderDedicatedPoster =
    Boolean(posterPath) &&
    posterPath !== posterPortraitPath &&
    posterPath !== landscapeMediaPath;

  if (
    !posterPortraitPath &&
    !posterLandscapePath &&
    !bannerPath &&
    !project.images?.thumbnail &&
    !project.images?.icon &&
    !shouldRenderDedicatedPoster
  ) {
    return null;
  }

  const mediaCards: MediaCard[] = [];
  const seenPaths = new Set<string>();
  const addMediaCard = (card: MediaCard | null) => {
    if (!card) return;
    if (seenPaths.has(card.src)) return;
    seenPaths.add(card.src);
    mediaCards.push(card);
  };

  addMediaCard(
    posterPortraitPath
      ? {
          id: "posterPortrait",
          mediaRole: "posterPortrait",
          label: "Poster (Portrait)",
          src: posterPortraitPath,
          aspectClass: "aspect-[3/4]",
          maxWidthClass: "max-w-[16rem]",
          loop: posterPortraitSettings?.loop ?? true,
          autoPlay: posterPortraitSettings?.autoPlay ?? false,
        }
      : null
  );

  addMediaCard(
    landscapeMediaPath
      ? {
          id: bannerPath ? "banner" : "posterLandscape",
          mediaRole: bannerPath ? "banner" : "posterLandscape",
          label: bannerPath ? "Banner" : "Poster (Landscape)",
          src: landscapeMediaPath,
          aspectClass: "aspect-video",
          maxWidthClass: "max-w-[28rem]",
          loop: bannerSettings?.loop ?? posterLandscapeSettings?.loop ?? true,
          autoPlay: bannerSettings?.autoPlay ?? posterLandscapeSettings?.autoPlay ?? false,
        }
      : null
  );

  addMediaCard(
    shouldRenderDedicatedPoster && posterPath
      ? {
          id: "poster",
          mediaRole: "poster",
          label: "Poster",
          src: posterPath,
          aspectClass: "aspect-[4/5]",
          maxWidthClass: "max-w-[16rem]",
          loop: project.imageSettings?.poster?.loop ?? true,
          autoPlay: project.imageSettings?.poster?.autoPlay ?? false,
        }
      : null
  );

  addMediaCard(
    thumbnailPath
      ? {
          id: "thumbnail",
          mediaRole: "thumbnail",
          label: "Thumbnail",
          src: thumbnailPath,
          aspectClass: "aspect-square",
          maxWidthClass: "max-w-[14rem]",
          loop: thumbnailSettings?.loop ?? true,
          autoPlay: thumbnailSettings?.autoPlay ?? false,
        }
      : null
  );

  const iconPath = project.images?.icon ? getOptimizedMediaPath(project.images.icon, folderPath) : null;
  addMediaCard(
    iconPath
      ? {
          id: "icon",
          mediaRole: "icon",
          label: "Icon",
          src: iconPath,
          aspectClass: "aspect-square",
          maxWidthClass: "max-w-[7rem]",
          loop: project.imageSettings?.icon?.loop ?? true,
          autoPlay: project.imageSettings?.icon?.autoPlay ?? false,
        }
      : null
  );

  const handledKeys = new Set([
    "thumbnail",
    "banner",
    "poster",
    "posterPortrait",
    "posterLandscape",
    "icon",
  ]);

  Object.entries(project.images || {}).forEach(([key, value]) => {
    if (handledKeys.has(key)) return;
    if (!value) return;

    const src = getOptimizedMediaPath(value, folderPath);
    addMediaCard({
      id: key,
      mediaRole: key,
      label: roleToLabel(key),
      src,
      aspectClass: "aspect-video",
      maxWidthClass: "max-w-[24rem]",
      loop: project.imageSettings?.[key]?.loop ?? true,
      autoPlay: project.imageSettings?.[key]?.autoPlay ?? false,
    });
  });

  if (mediaCards.length === 0) {
    return null;
  }

  return (
    <section data-testid="project-assets-section" data-project-id={project.id} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Project Assets</h3>
        <span className="text-xs text-muted-foreground">{mediaCards.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {mediaCards.map((media) => (
          <article
            key={media.id}
            data-testid="project-asset-card"
            data-project-id={project.id}
            data-media-role={media.mediaRole}
            className="rounded-lg border border-border bg-card/50 p-2.5"
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {media.label}
            </p>
            <div
              data-testid="project-asset-media"
              data-project-id={project.id}
              data-media-role={media.mediaRole}
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-md border border-border/60 bg-muted/20",
                media.aspectClass,
                media.maxWidthClass
              )}
            >
              <MediaDisplay
                src={media.src}
                alt={`${project.title} ${media.label}`}
                fill
                className="object-contain"
                objectFit="contain"
                loop={media.loop}
                autoPlay={media.autoPlay}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ProjectDetailsMediaDisplay;
