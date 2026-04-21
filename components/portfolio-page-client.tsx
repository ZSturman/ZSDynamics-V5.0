"use client";

import { useEffect, useState } from "react";

import { PortfolioHeader } from "@/components/portfolio-header";
import { PortfolioClient } from "@/components/portfolio-client";
import { ProjectModal } from "@/components/project-modal";
import { findProjectByAlias, getProjectSlug } from "@/lib/project-paths";
import type { Project } from "@/types";

interface PortfolioPageClientProps {
  projects: Project[];
}

function buildHomeUrl(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function PortfolioPageClient({ projects }: PortfolioPageClientProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSelectedProjectFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const projectParam = params.get("project");
      const resolvedProject = projectParam ? findProjectByAlias(projects, projectParam) ?? null : null;

      if (projectParam && !resolvedProject) {
        params.delete("project");
        window.history.replaceState(window.history.state, "", buildHomeUrl(params));
      }

      setSelectedProject(resolvedProject);
    };

    syncSelectedProjectFromLocation();
    window.addEventListener("popstate", syncSelectedProjectFromLocation);

    return () => {
      window.removeEventListener("popstate", syncSelectedProjectFromLocation);
    };
  }, [projects]);

  const handleProjectSelect = (project: Project) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set("project", getProjectSlug(project));
    window.history.pushState(window.history.state, "", buildHomeUrl(params));
    setSelectedProject(project);
  };

  const handleCloseProjectModal = () => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("project");
    window.history.replaceState(window.history.state, "", buildHomeUrl(params));
    setSelectedProject(null);
  };

  return (
    <>
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8 max-w-7xl overflow-x-hidden">
        <PortfolioHeader />
        <PortfolioClient projects={projects} onProjectSelect={handleProjectSelect} />
      </div>
      <ProjectModal
        project={selectedProject}
        isOpen={Boolean(selectedProject)}
        onClose={handleCloseProjectModal}
      />
    </>
  );
}
