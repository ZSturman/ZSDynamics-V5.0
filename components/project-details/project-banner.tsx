"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaDisplay } from "@/components/ui/media-display";
import { cn, formatTextWithNewlines, getOptimizedMediaPath, isVideoFile } from "@/lib/utils";
import { Project } from "@/types";
import ResourceButtons from "./resource-buttons";

interface ProjectHeaderProps {
  project: Project;
  hideBanner?: boolean;
  showResourceRow?: boolean;
  resourceRow?: ReactNode;
  headerActions?: ReactNode;
}

interface HeaderLightboxMedia {
  src: string;
  alt: string;
  label: string;
  autoPlay: boolean;
  loop: boolean;
}

interface HeaderMediaTileProps {
  project: Project;
  mediaRole: string;
  testId: string;
  src: string;
  alt: string;
  autoPlay: boolean;
  loop: boolean;
  className: string;
  mediaClassName: string;
  objectFit?: "contain" | "cover";
  onOpen: (media: HeaderLightboxMedia) => void;
}

function HeaderMediaTile({
  project,
  mediaRole,
  testId,
  src,
  alt,
  autoPlay,
  loop,
  className,
  mediaClassName,
  objectFit = "cover",
  onOpen,
}: HeaderMediaTileProps) {
  return (
    <button
      type="button"
      data-testid="project-header-media-trigger"
      data-project-id={project.id}
      data-media-role={mediaRole}
      className="group block w-full max-w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() =>
        onOpen({
          src,
          alt,
          label: mediaRole === "hero" ? "Hero media" : "Poster preview",
          autoPlay,
          loop,
        })
      }
    >
      <div
        data-testid={testId}
        data-project-id={project.id}
        data-media-role={mediaRole}
        className={cn(
          "relative max-w-full overflow-hidden rounded-lg border border-border/35 bg-card/25 transition-colors duration-200 group-hover:border-primary/30",
          className
        )}
      >
        <MediaDisplay
          src={src}
          alt={alt}
          fill
          className={mediaClassName}
          objectFit={objectFit}
          autoPlay={autoPlay}
          loop={loop}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/12 via-transparent to-transparent" />
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-3" />
          Fullscreen
        </div>
      </div>
    </button>
  );
}

export function ProjectHeader({
  project,
  hideBanner = false,
  showResourceRow = true,
  resourceRow,
  headerActions,
}: ProjectHeaderProps) {
  const [activeMedia, setActiveMedia] = useState<HeaderLightboxMedia | null>(null);
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;

  const iconMedia = project.images?.icon || project.images?.thumbnail;
  const iconPath = iconMedia ? getOptimizedMediaPath(iconMedia, folderPath) : null;
  const iconSettings = project.images?.icon ? project.imageSettings?.icon : project.imageSettings?.thumbnail;
  const headerMedia =
    project.images?.banner ||
    project.images?.posterLandscape ||
    project.images?.poster ||
    project.images?.thumbnail;
  const srcBanner = headerMedia ? getOptimizedMediaPath(headerMedia, folderPath) : null;
  const headerMediaSettings = project.images?.banner
    ? project.imageSettings?.banner
    : project.images?.posterLandscape
    ? project.imageSettings?.posterLandscape || project.imageSettings?.poster
    : project.images?.poster
    ? project.imageSettings?.poster
    : project.imageSettings?.thumbnail;
  const posterAccentPath = project.images?.posterPortrait
    ? getOptimizedMediaPath(project.images.posterPortrait, folderPath)
    : project.images?.poster
    ? getOptimizedMediaPath(project.images.poster, folderPath)
    : null;
  const posterAccentRole = project.images?.posterPortrait ? "posterPortrait" : "poster";
  const posterAccentSettings = project.images?.posterPortrait
    ? project.imageSettings?.posterPortrait || project.imageSettings?.poster
    : project.imageSettings?.poster;
  const heroPath = project.images?.hero
    ? getOptimizedMediaPath(project.images.hero, folderPath)
    : null;
  const heroSettings = project.imageSettings?.hero;
  const resourceRowContent =
    resourceRow ?? (showResourceRow && project.resources && project.resources.length > 0 ? <ResourceButtons project={project} /> : null);

  useEffect(() => {
    const requestedHeaderMedia = new URLSearchParams(window.location.search).get("headerMedia");

    if (requestedHeaderMedia === "hero" && heroPath) {
      setActiveMedia({
        src: heroPath,
        alt: `${project.title} hero media`,
        label: "Hero media",
        autoPlay: heroSettings?.autoPlay ?? false,
        loop: heroSettings?.loop ?? true,
      });
      return;
    }

    if (
      requestedHeaderMedia === posterAccentRole &&
      posterAccentPath
    ) {
      setActiveMedia({
        src: posterAccentPath,
        alt: `${project.title} poster`,
        label: "Poster preview",
        autoPlay: posterAccentSettings?.autoPlay ?? false,
        loop: posterAccentSettings?.loop ?? true,
      });
    }
  }, [
    heroPath,
    heroSettings?.autoPlay,
    heroSettings?.loop,
    posterAccentPath,
    posterAccentRole,
    posterAccentSettings?.autoPlay,
    posterAccentSettings?.loop,
    project.title,
  ]);

  return (
    <>
      <header
        data-testid="project-header"
        data-project-id={project.id}
        className="max-w-full space-y-5 overflow-x-clip border-b border-border/45 pb-6 md:space-y-7 md:pb-8"
      >
        {!hideBanner && srcBanner && (
          <div
            data-testid="project-header-banner"
            data-project-id={project.id}
            data-media-role={
              project.images?.banner
                ? "banner"
                : project.images?.posterLandscape
                ? "posterLandscape"
                : project.images?.poster
                ? "poster"
                : "thumbnail"
            }
            className="relative -mx-3 -mt-3 mb-4 h-32 overflow-hidden rounded-t-lg md:-mx-6 md:-mt-6 md:mb-6 md:h-48 lg:h-64"
          >
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

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex-1 space-y-3">
            <div data-testid="project-header-title-row" className="flex items-start gap-3 md:gap-4">
              {iconPath && (
                <div
                  data-testid="project-header-icon"
                  data-project-id={project.id}
                  data-media-role={project.images?.icon ? "icon" : "thumbnail"}
                  className="relative mt-1 h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-card/50 md:h-12 md:w-12"
                >
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

              <div className="min-w-0 max-w-full space-y-1.5">
                <h1 className="text-balance break-words font-sans text-xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
                  {project.title}
                </h1>
                {project.subtitle ? (
                  <p className="text-pretty text-sm text-muted-foreground md:text-lg">{project.subtitle}</p>
                ) : null}
              </div>
            </div>

            {project.oneLiner ? (
              <p className="max-w-3xl text-pretty text-sm italic text-muted-foreground/85 md:text-base">
                {project.oneLiner}
              </p>
            ) : null}
          </div>

          {headerActions ? (
            <div className="w-full lg:w-auto lg:max-w-sm lg:shrink-0 lg:pl-4">{headerActions}</div>
          ) : null}
        </div>

        {resourceRowContent ? (
          <div data-testid="project-header-resource-row" data-project-id={project.id} className="max-w-4xl">
            {resourceRowContent}
          </div>
        ) : null}

        <div
          className={cn(
            "grid min-w-0 max-w-full gap-5 md:gap-6",
            posterAccentPath ? "xl:grid-cols-[minmax(0,1fr)_12rem]" : undefined
          )}
        >
          <div className="min-w-0 max-w-full space-y-5 md:space-y-6">
            {heroPath ? (
              <HeaderMediaTile
                project={project}
                mediaRole="hero"
                testId="project-header-hero"
                src={heroPath}
                alt={`${project.title} hero media`}
                autoPlay={heroSettings?.autoPlay ?? false}
                loop={heroSettings?.loop ?? true}
                className="aspect-video w-full"
                mediaClassName="object-cover"
                onOpen={setActiveMedia}
              />
            ) : null}

            <p className="w-full max-w-full whitespace-pre-wrap text-pretty break-words text-sm leading-relaxed text-muted-foreground md:text-base">
              {formatTextWithNewlines(project.summary)}
            </p>
          </div>

          {posterAccentPath ? (
            <div className="w-full max-w-[11rem] sm:max-w-[13rem] xl:justify-self-end">
              <HeaderMediaTile
                project={project}
                mediaRole={posterAccentRole}
                testId="project-header-poster-accent"
                src={posterAccentPath}
                alt={`${project.title} poster`}
                autoPlay={posterAccentSettings?.autoPlay ?? false}
                loop={posterAccentSettings?.loop ?? true}
                className="aspect-[3/4] w-full"
                mediaClassName="object-contain"
                objectFit="contain"
                onOpen={setActiveMedia}
              />
            </div>
          ) : null}
        </div>
      </header>

      <Dialog open={Boolean(activeMedia)} onOpenChange={(open) => (!open ? setActiveMedia(null) : undefined)}>
        <DialogContent
          data-testid="project-header-media-lightbox"
          className="max-h-[92vh] max-w-[min(96vw,1200px)] overflow-hidden border-border/60 bg-background/98 p-0"
        >
          <DialogTitle className="sr-only">{activeMedia?.alt || `${project.title} media preview`}</DialogTitle>
          {activeMedia ? (
            <>
              <div className="border-b border-border/60 px-5 py-3">
                <p className="text-sm font-medium text-foreground">{project.title}</p>
                <p className="text-xs text-muted-foreground">{activeMedia.label}</p>
              </div>
              <div className="flex h-[min(78vh,900px)] items-center justify-center bg-black/80 p-4 md:p-6">
                {isVideoFile(activeMedia.src) ? (
                  <video
                    src={activeMedia.src}
                    controls
                    autoPlay={activeMedia.autoPlay}
                    loop={activeMedia.loop}
                    playsInline
                    className="max-h-full w-full rounded-lg object-contain"
                    aria-label={activeMedia.alt}
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <MediaDisplay
                      src={activeMedia.src}
                      alt={activeMedia.alt}
                      fill
                      className="object-contain"
                      objectFit="contain"
                      autoPlay={activeMedia.autoPlay}
                      loop={activeMedia.loop}
                    />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
