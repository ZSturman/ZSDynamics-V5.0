import { Project } from "@/types";
import { formatTextWithNewlines, getOptimizedMediaPath } from "@/lib/utils";
import ResourceButton from "./resource-button";
import ResourceButtons from "./resource-buttons";
import { MediaDisplay } from "@/components/ui/media-display";

interface ProjectHeaderProps {
  project: Project;
  hideBanner?: boolean;
}

export function ProjectHeader({ project, hideBanner = false }: ProjectHeaderProps) {
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const iconPath = project.images?.icon ? getOptimizedMediaPath(project.images.icon, folderPath) : null;
  const iconSettings = project.imageSettings?.icon;
  const headerMedia = project.images?.banner || project.images?.posterLandscape || project.images?.poster;
  const srcBanner = headerMedia ? getOptimizedMediaPath(headerMedia, folderPath) : null;
  const headerMediaSettings = project.images?.banner
    ? project.imageSettings?.banner
    : project.images?.posterLandscape
    ? project.imageSettings?.posterLandscape || project.imageSettings?.poster
    : project.imageSettings?.poster;
  const posterAccentPath = project.images?.posterPortrait
    ? getOptimizedMediaPath(project.images.posterPortrait, folderPath)
    : project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;
  const posterAccentSettings = project.images?.posterPortrait
    ? project.imageSettings?.posterPortrait || project.imageSettings?.poster
    : project.imageSettings?.poster;

  return (
    <header className="space-y-3 md:space-y-6 border-b border-border pb-4 md:pb-8">
      {!hideBanner && srcBanner && (
        <div className="relative -mx-3 md:-mx-6 -mt-3 md:-mt-6 mb-3 md:mb-6 h-32 md:h-48 lg:h-64 overflow-hidden rounded-t-lg">
          <MediaDisplay
            src={srcBanner}
            alt={`${project.title} banner`}
            fill
            className="h-full w-full object-cover opacity-40"
            autoPlay={headerMediaSettings?.autoPlay ?? false}
            loop={headerMediaSettings?.loop ?? true}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 md:gap-4">
        <div className="flex-1 space-y-1 md:space-y-2">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {iconPath && (
              <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-xl border border-border/70 bg-card">
                <MediaDisplay
                  src={iconPath}
                  alt={`${project.title} icon`}
                  fill
                  className="object-cover"
                  autoPlay={iconSettings?.autoPlay ?? false}
                  loop={iconSettings?.loop ?? true}
                />
              </div>
            )}
            <h1 className="text-balance font-sans text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              {project.title}
            </h1>
            {project.resources && project.resources.length > 0 && (
              <div className="flex gap-2">
                {project.resources.slice(0, 4).map((resource) => (
                  <ResourceButton key={resource.url} resource={resource} iconOnly className="h-8 w-8 border-0" />
                ))}
              </div>
            )}
          </div>
          {project.subtitle && <p className="text-pretty text-sm md:text-lg text-muted-foreground">{project.subtitle}</p>}
        </div>
      </div>

      <div className="overflow-hidden">
        {posterAccentPath && (
          <div className="float-none sm:float-right sm:ml-4 sm:mb-2 w-[8.5rem] md:w-[10rem] lg:w-[11rem]">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/70 bg-card/30">
              <MediaDisplay
                src={posterAccentPath}
                alt={`${project.title} poster`}
                fill
                className="object-contain"
                objectFit="contain"
                autoPlay={posterAccentSettings?.autoPlay ?? false}
                loop={posterAccentSettings?.loop ?? true}
              />
            </div>
          </div>
        )}

        <p className="text-pretty text-sm md:text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {formatTextWithNewlines(project.summary)}
        </p>
      </div>

      {project.resources && project.resources.length > 0 && (
        <div>
          <ResourceButtons project={project} />
        </div>
      )}
    </header>
  );
}
