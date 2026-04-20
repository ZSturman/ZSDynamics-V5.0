"use client";

import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { ProjectHeader } from "./project-details/project-banner";
import { ProjectContent } from "./project-details/project-description-and-story";
import { ProjectMetadata } from "./project-details/project-metadata";
import { Project } from "@/types";
import { Collection } from "./project-details/collection/collection";
import ProjectDetailsFooter from "./project-details/project-details-footer";
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { ProjectArticles } from "./project-details/project-articles";
import { hasProjectCollectionItems } from "@/lib/project-collections";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";

interface ProjectDetailsProps {
  project: Project;
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
  const hasArticles = Boolean(project.articles && project.articles.length > 0);
  const sections: Array<{ key: string; content: ReactNode }> = [];

  if (hasContent) {
    sections.push({
      key: "content",
      content: <ProjectContent project={project} />,
    });
  }

  if (hasCollection) {
    sections.push({
      key: "collection",
      content: <Collection project={project} inModal={false} />,
    });
  }

  sections.push({
    key: "details",
    content: (
      <>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Project Details</h3>
        <ProjectMetadata project={project} />
      </>
    ),
  });

  if (hasArticles) {
    sections.push({
      key: "articles",
      content: <ProjectArticles project={project} />,
    });
  }

  if (hasWorkLogs) {
    sections.push({
      key: "work-logs",
      content: <ProjectWorkLogs project={project} />,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:px-8 md:py-12 lg:py-16">
        <div className="space-y-6 md:space-y-8">
          <BreadcrumbTrail
            items={[
              { label: "Home", href: "/" },
              { label: "Projects", href: "/#projects" },
              { label: project.title },
            ]}
          />

          <ProjectHeader project={project} />
        </div>

        <div className="mt-8 md:mt-12">
          {sections.map((section, index) => (
            <section
              key={section.key}
              className={cn(
                index === 0 ? "" : "border-t border-border pt-8 md:pt-10",
                index < sections.length - 1 ? "pb-8 md:pb-10" : ""
              )}
            >
              {section.content}
            </section>
          ))}
        </div>

        <div className="mt-12 md:mt-16">
          <ProjectDetailsFooter />
        </div>
      </div>
    </div>
  );
}
