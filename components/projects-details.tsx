"use client";
import { notFound, useRouter } from "next/navigation";
import { ProjectHeader } from "./project-details/project-banner";
import { ProjectContent } from "./project-details/project-description-and-story";
import { ProjectMetadata } from "./project-details/project-metadata";
import { Project } from "@/types";
import { Collection } from "./project-details/collection/collection";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { ArrowLeft } from "lucide-react";
import ProjectDetailsFooter from "./project-details/project-details-footer";
import ProjectDetailsMediaDisplay from "./project-details/project-details-media-display";
import { ProjectWorkLogs } from "./project-details/project-work-logs";

interface ProjectDetailsProps {
  project: Project;
}

function HomeLink({ project }: { project: Project }) {
  const { previousPath, previousLabel } = useBreadcrumb();
  const router = useRouter();

  const handleBack = () => {
    // Check if previousPath is the same as current project path (circular navigation)
    const currentPath = `/projects/${project.id}`;
    const isCircular = previousPath === currentPath;
    
    if (previousPath && !isCircular) {
      router.push(previousPath);
    } else {
      router.push("/");
    }
  };

  // If previousPath is circular, show "Home" instead of the previous label
  const currentPath = `/projects/${project.id}`;
  const isCircular = previousPath === currentPath;
  const label = (previousPath && !isCircular) ? (previousLabel || "Home") : "Home";

  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="container  px-4 md:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetails({ project }: ProjectDetailsProps) {
  if (!project) {
    notFound();
  }

  const hasCollection = Boolean(project.collection && Object.keys(project.collection).length > 0);

  return (
    <div className="min-h-screen bg-background">
      <HomeLink project={project} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:px-8 md:py-12 lg:py-16">
        <ProjectHeader project={project} />

        <div className="mt-8 md:mt-12 space-y-8">
          {/* Priority: Collection/Media first */}
          {hasCollection && (
            <div>
              <Collection project={project} inModal={false} />
            </div>
          )}

          <ProjectWorkLogs project={project} />


          {/* Metadata and About/Story arranged responsively in a grid.
              If there's no description/story, show metadata full-width. */}
          {(() => {
            const hasContent = Boolean(
              (project.description && String(project.description).trim()) ||
                (project.story && String(project.story).trim())
            );

            if (!hasContent) {
              return (
                <div className="grid gap-6">
                  <ProjectMetadata project={project} />
                </div>
              );
            }

            return (
              <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-[1fr_320px] items-start">
                <div className="min-w-0 space-y-6">
                  {/* Show metadata first on mobile */}
                  <div className="lg:hidden">
                    <ProjectMetadata project={project} />
                  </div>
                  
                  <ProjectContent project={project} />
                  
                  {/* Media display on mobile */}
                  <div className="lg:hidden">
                    <ProjectDetailsMediaDisplay project={project} />
                  </div>
                </div>

                <aside className="hidden lg:block min-w-[320px] space-y-6 sticky top-20">
                  <ProjectDetailsMediaDisplay project={project} />
                  <ProjectMetadata project={project} />
                </aside>
              </div>
            );
          })()}
        </div>

        <ProjectDetailsFooter />
      </div>
    </div>
  );
}
