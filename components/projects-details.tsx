"use client";

import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { ProjectHeader } from "./project-details/project-banner";
import { ProjectContent } from "./project-details/project-description-and-story";
import { ProjectMetadata } from "./project-details/project-metadata";
import { Project } from "@/types";
import { Collection } from "./project-details/collection/collection";
import { ProjectStandaloneAssets } from "./project-details/project-standalone-assets";
import ProjectDetailsFooter from "./project-details/project-details-footer";
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { ProjectArticles } from "./project-details/project-articles";
import { hasProjectCollectionItems, hasStandaloneProjectAssets } from "@/lib/project-collections";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";

interface ProjectDetailsProps {
  project: Project;
}

export default function ProjectDetails({ project }: ProjectDetailsProps) {
  if (!project) {
    notFound();
  }

  const hasCollection = hasProjectCollectionItems(project, { excludeAssets: true });
  const hasContent = Boolean(
    (project.description && String(project.description).trim()) ||
      (project.story && String(project.story).trim())
  );
  const hasWorkLogs = Boolean(project.workLogs && project.workLogs.length > 0);
  const hasArticles = Boolean(project.articles && project.articles.length > 0);
  const hasAssets = hasStandaloneProjectAssets(project);
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

  if (hasAssets) {
    sections.push({
      key: "assets",
      content: <ProjectStandaloneAssets project={project} />,
    });
  }

  // Footer sections — ordered: articles, work logs, then details
  const footerSections: Array<{ key: string; content: ReactNode }> = [];

  if (hasArticles) {
    footerSections.push({
      key: "articles",
      content: <ProjectArticles project={project} />,
    });
  }

  if (hasWorkLogs) {
    footerSections.push({
      key: "work-logs",
      content: <ProjectWorkLogs project={project} />,
    });
  }

  footerSections.push({
    key: "details",
    content: (
      <>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Project Details</h3>
        <ProjectMetadata project={project} />
      </>
    ),
  });

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
                index > 0 && "pt-8 md:pt-10",
                index < sections.length - 1 && "pb-8 md:pb-10",
              )}
            >
              {section.content}
            </section>
          ))}
        </div>

        {/* Footer: articles → work logs → details */}
        <div className="mt-8 md:mt-12 space-y-6 md:space-y-8">
          {footerSections.map((section) => (
            <section key={section.key}>
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
