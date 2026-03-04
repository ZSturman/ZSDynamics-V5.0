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
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { hasProjectCollectionItems } from "@/lib/project-collections";

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

  const hasCollection = hasProjectCollectionItems(project);
  const hasContent = Boolean(
    (project.description && String(project.description).trim()) ||
      (project.story && String(project.story).trim())
  );
  const hasWorkLogs = Boolean(project.workLogs && project.workLogs.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <HomeLink project={project} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:px-8 md:py-12 lg:py-16">
        <ProjectHeader project={project} />

        <div className="mt-8 md:mt-12 space-y-8">
          {hasCollection && (
            <section>
              <Collection project={project} inModal={false} />
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

          {hasWorkLogs && (
            <section className="border-t border-border pt-6">
              <ProjectWorkLogs project={project} />
            </section>
          )}
        </div>

        <ProjectDetailsFooter />
      </div>
    </div>
  );
}
