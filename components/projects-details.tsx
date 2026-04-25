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
import { ProjectWorkLogs } from "./project-details/project-work-logs";
import { ProjectArticles } from "./project-details/project-articles";
import { ProjectTableOfContents } from "./project-details/project-table-of-contents";
import { hasProjectCollectionItems, hasStandaloneProjectAssets } from "@/lib/project-collections";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import { PageFrame } from "@/components/layout/page-frame";

interface ProjectDetailsProps {
  project: Project;
  requestedCollectionItemId?: string;
}

export default function ProjectDetails({ project, requestedCollectionItemId }: ProjectDetailsProps) {
  if (!project) {
    notFound();
  }

  const hasCollection = hasProjectCollectionItems(project, { excludeAssets: true });
  const hasContent = Boolean(
    (project.description && String(project.description).trim()) ||
      (project.story && String(project.story).trim()) ||
      (project.readme?.content && String(project.readme.content).trim())
  );
  const hasWorkLogs = Boolean(project.workLogs && project.workLogs.length > 0);
  const hasArticles = Boolean(project.articles && project.articles.length > 0);
  const hasAssets = hasStandaloneProjectAssets(project);
  const sections: Array<{ key: string; id?: string; content: ReactNode }> = [];

  if (hasContent) {
    sections.push({
      key: "content",
      content: <ProjectContent project={project} />,
    });
  }

  if (hasCollection) {
    sections.push({
      key: "collection",
      id: "collection",
      content: <Collection project={project} inModal={false} requestedCollectionItemId={requestedCollectionItemId} />,
    });
  }

  if (hasAssets) {
    sections.push({
      key: "assets",
      content: <ProjectStandaloneAssets project={project} />,
    });
  }

  const supportingSections: Array<{ key: string; id: string; content: ReactNode }> = [];

  if (hasArticles) {
    supportingSections.push({
      key: "articles",
      id: "articles",
      content: <ProjectArticles project={project} />,
    });
  }

  if (hasWorkLogs) {
    supportingSections.push({
      key: "work-logs",
      id: "work-logs",
      content: <ProjectWorkLogs project={project} limit={4} />,
    });
  }

  return (
    <div className="min-h-[100svh] overflow-x-clip bg-background">
      <PageFrame className="overflow-x-clip py-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-12 lg:py-16">
        <div className="min-w-0 max-w-full space-y-5 md:space-y-8">
          <BreadcrumbTrail
            items={[
              { label: "Home", href: "/" },
              { label: "Projects", href: "/#projects" },
              { label: project.title },
            ]}
          />

          <ProjectHeader project={project} />

          <ProjectTableOfContents project={project} />
        </div>

        <div className="mt-8 md:mt-12">
          {sections.map((section, index) => (
            <section
              key={section.key}
              id={section.id}
              className={cn(
                "min-w-0 max-w-full overflow-x-clip",
                section.id && "scroll-mt-24",
                index > 0 && "pt-7 md:pt-10",
                index < sections.length - 1 && "pb-7 md:pb-10",
              )}
            >
              {section.content}
            </section>
          ))}
        </div>

        <div className="mt-10 md:mt-14">
          {supportingSections.length > 0 ? (
            <div className="grid min-w-0 max-w-full gap-7 overflow-x-clip lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:gap-10">
              <div className="min-w-0 max-w-full space-y-6 md:space-y-8">
                {supportingSections.map((section) => (
                  <section key={section.key} id={section.id} className="min-w-0 max-w-full scroll-mt-24 overflow-x-clip">
                    {section.content}
                  </section>
                ))}
              </div>

              <aside className="min-w-0 max-w-full self-start lg:sticky lg:top-24">
                <section id="project-details" className="min-w-0 max-w-full scroll-mt-24 space-y-4 overflow-x-clip">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Project Details</h3>
                  <ProjectMetadata project={project} />
                </section>
              </aside>
            </div>
          ) : (
            <section id="project-details" className="min-w-0 max-w-md scroll-mt-24 space-y-4 overflow-x-clip">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Project Details</h3>
              <ProjectMetadata project={project} />
            </section>
          )}
        </div>
      </PageFrame>
    </div>
  );
}
