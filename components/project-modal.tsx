"use client";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Project } from "@/types";
import { ProjectHeader } from "./project-details/project-banner";
import { ProjectContent } from "./project-details/project-description-and-story";

import { ProjectMetadata } from "./project-details/project-metadata";
import { Collection } from "./project-details/collection/collection";
import { ProjectStandaloneAssets } from "./project-details/project-standalone-assets";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { ProjectArticles } from "./project-details/project-articles";
import ResourceButtons from "./project-details/resource-buttons";
import { getProjectHref } from "@/lib/project-paths";
import { cn, getOptimizedMediaPath } from "@/lib/utils";
import { MediaDisplay } from "./ui/media-display";
import { hasProjectCollectionItems, hasStandaloneProjectAssets } from "@/lib/project-collections";
import { trackProjectOpen } from "@/lib/firebase-analytics";
import { ArrowUpRight } from "lucide-react";

interface ProjectModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectModal({ project, isOpen, onClose }: ProjectModalProps) {
  const router = useRouter();
  const { setPreviousPath } = useBreadcrumb();

  const goToProjectPage = () => {
    if (!project) return;
    // Set breadcrumb to come back to home (not modal) when navigating to project page
    setPreviousPath("/", "Home");
    onClose();
    // Use Next.js router for proper client-side navigation
    trackProjectOpen({
      projectSlug: project.slug || project.id,
      projectTitle: project.title,
      openSurface: "project_modal_cta",
    });
    router.push(getProjectHref(project));
  };

  if (!project) return null;
  const hasContent = Boolean(
    (project.description && String(project.description).trim()) ||
      (project.story && String(project.story).trim())
  );
  const hasCollection = hasProjectCollectionItems(project, { excludeAssets: true });
  const hasWorkLogs = Boolean(project.workLogs && project.workLogs.length > 0);
  const hasArticles = Boolean(project.articles && project.articles.length > 0);
  const hasResources = Boolean(project.resources && project.resources.length > 0);
  const hasAssets = hasStandaloneProjectAssets(project);
  const folderName = project.folderName || project.id;
  const folderPath = `/projects/${folderName}`;
  const bannerMedia =
    project.images?.banner ||
    project.images?.posterLandscape ||
    project.images?.poster ||
    project.images?.thumbnail;
  const bannerPath = bannerMedia ? getOptimizedMediaPath(bannerMedia, folderPath) : null;
  const bannerSettings = project.images?.banner
    ? project.imageSettings?.banner
    : project.images?.posterLandscape
    ? project.imageSettings?.posterLandscape || project.imageSettings?.poster
    : project.images?.poster
    ? project.imageSettings?.poster
    : project.imageSettings?.thumbnail;
  const sections: Array<{ key: string; content: ReactNode }> = [];

  if (hasContent) {
    sections.push({
      key: "content",
      content: <ProjectContent project={project} showReadme={false} />,
    });
  }

  if (hasCollection) {
    sections.push({
      key: "collection",
      content: <Collection project={project} inModal={true} />,
    });
  }

  if (hasAssets) {
    sections.push({
      key: "assets",
      content: <ProjectStandaloneAssets project={project} inModal />,
    });
  }

  const supportingSections: Array<{ key: string; content: ReactNode }> = [];

  if (hasArticles) {
    supportingSections.push({
      key: "articles",
      content: <ProjectArticles project={project} />,
    });
  }

  if (hasWorkLogs) {
    supportingSections.push({
      key: "work-logs",
      content: <ProjectWorkLogs project={project} limit={4} />,
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTitle>
        <span className="sr-only">
          {project.title}
          Preview
        </span>
      </DialogTitle>

      <DialogContent
        data-testid="project-modal-content"
        data-project-id={project.id}
        className="max-h-[92vh] max-w-7xl p-0 flex flex-col overflow-hidden"
      >
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          {bannerPath && (
            <div
              data-testid="project-modal-banner"
              data-project-id={project.id}
              data-media-role={project.images?.banner ? "banner" : project.images?.posterLandscape ? "posterLandscape" : project.images?.poster ? "poster" : "thumbnail"}
              className="relative h-40 md:h-56 lg:h-64 w-full overflow-hidden border-b border-border"
            >
              <MediaDisplay
                src={bannerPath}
                alt={`${project.title} banner`}
                fill
                className="h-full w-full object-cover opacity-45"
                autoPlay={bannerSettings?.autoPlay ?? false}
                loop={bannerSettings?.loop ?? true}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
            </div>
          )}

          <div className="px-4 pt-6 pb-12 md:px-6 space-y-8">
            <ProjectHeader
              project={project}
              hideBanner
              showResourceRow={false}
              resourceRow={
                hasResources ? (
                  <div data-testid="project-modal-resources">
                    <ResourceButtons project={project} showMessage={false} />
                  </div>
                ) : undefined
              }
              headerActions={
                <div className="flex justify-end">
                  <Button
                    data-testid="project-modal-open-project-button"
                    onClick={goToProjectPage}
                    className="w-full gap-2 md:w-auto"
                    size="sm"
                  >
                    Open Full Project Page
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
              }
            />

            <div>
              {sections.map((section, index) => (
                <section
                  key={section.key}
                  className={cn(
                    index > 0 && "pt-6",
                    index < sections.length - 1 && "pb-6",
                  )}
                >
                  {section.content}
                </section>
              ))}
            </div>

            <div>
              {supportingSections.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-6">
                    {supportingSections.map((section) => (
                      <section key={section.key}>
                        {section.content}
                      </section>
                    ))}
                  </div>

                  <aside className="space-y-4">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">Project Details</h3>
                    <ProjectMetadata project={project} />
                  </aside>
                </div>
              ) : (
                <section className="max-w-md space-y-4">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Project Details</h3>
                  <ProjectMetadata project={project} />
                </section>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
