"use client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Project } from "@/types";
import { ProjectHeader } from "./project-details/project-banner";
import { ProjectContent } from "./project-details/project-description-and-story";

import { ProjectMetadata } from "./project-details/project-metadata";
import { Collection } from "./project-details/collection/collection";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import ProjectDetailsFooter from "./project-details/project-details-footer";
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { ProjectArticles } from "./project-details/project-articles";
import { getOptimizedMediaPath } from "@/lib/utils";
import { MediaDisplay } from "./ui/media-display";
import { hasProjectCollectionItems } from "@/lib/project-collections";

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
    router.push(`/projects/${project.id}`);
  };

  if (!project) return null;
  const hasContent = Boolean(
    (project.description && String(project.description).trim()) ||
      (project.story && String(project.story).trim())
  );
  const hasCollection = hasProjectCollectionItems(project);
  const hasWorkLogs = Boolean(project.workLogs && project.workLogs.length > 0);
  const hasArticles = Boolean(project.articles && project.articles.length > 0);
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
            <div className="flex justify-end">
              <Button onClick={goToProjectPage} variant="outline" size="sm">
                Go to Project Page
              </Button>
            </div>

            <ProjectHeader project={project} hideBanner />

            {hasCollection && (
              <section>
                <Collection project={project} inModal={true} />
              </section>
            )}

            {hasContent && (
              <section>
                <ProjectContent project={project} />
              </section>
            )}

            <section className="border-t border-border pt-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">Project Details</h3>
              <ProjectMetadata project={project} />
            </section>

            {hasArticles && (
              <section className="border-t border-border pt-6">
                <ProjectArticles project={project} />
              </section>
            )}

            {hasWorkLogs && (
              <section className="border-t border-border pt-6">
                <ProjectWorkLogs project={project} />
              </section>
            )}

            <div className="pt-2">
              <ProjectDetailsFooter />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
