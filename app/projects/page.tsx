import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";

import { PortfolioPageClient } from "@/components/portfolio-page-client";
import { loadProjectsManifest } from "@/lib/load-projects";

const routeMetadata: Metadata = {
  title: "Projects",
  description:
    "Every published project: software, AI and data, hardware and electronics, research experiments, and creative work, with search and filters.",
  alternates: { canonical: "/projects" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Projects', routeMetadata.description || "Portfolio information.", "/projects") };

export default async function ProjectsPage() {
  const projects = await loadProjectsManifest();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PortfolioPageClient
        projects={projects}
        header={
          <header key="projects-header" className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Projects</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              The complete archive, including older and archived work. Filter by focus area, by whether a project has a
              demo, download, or public source, or search by title and technology.
            </p>
          </header>
        }
      />
    </div>
  );
}
