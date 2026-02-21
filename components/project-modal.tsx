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
import ProjectDetailsMediaDisplay from "./project-details/project-details-media-display";
import { ProjectWorkLogs } from "./project-details/project-work-logs";

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
  const hasCollection = Boolean(project.collection && Object.keys(project.collection).length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTitle>
        <span className="sr-only">
          {project.title}
          Preview
        </span>
      </DialogTitle>

      <DialogContent className="max-h-[90vh] max-w-7xl p-0 flex flex-col overflow-hidden">
        <div className="relative flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-12">
          <ProjectHeader project={project} />

          <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-[1fr_320px] items-start md:items-stretch">
            <div className="space-y-6">
              <div className="md:hidden">
                <Button onClick={goToProjectPage} variant="outline" size="sm" className="w-full">
                  Go to Project Page
                </Button>
              </div>

              {hasCollection && (
                <div>
                  <Collection project={project} inModal={true} />
                </div>
              )}

              <ProjectWorkLogs project={project} />

              {hasContent && (
                <div>
                  <ProjectContent project={project} />
                </div>
              )}
            </div>

            <aside className="min-w-[280px] md:min-w-[320px]">
              <div className="hidden md:flex mb-4">
                <Button onClick={goToProjectPage} variant="outline" size="sm" className="w-full">
                  Go to Project Page
                </Button>
              </div>

              <div className="h-full space-y-6">
                <ProjectDetailsMediaDisplay project={project} />
                <ProjectMetadata project={project} />
              </div>
            </aside>
          </div>

          <ProjectDetailsFooter />
        </div>
      </DialogContent>
    </Dialog>
  );
}
