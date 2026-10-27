"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { PortfolioHeader, type ProfileLink } from "@/components/portfolio-header";
import { PortfolioClient } from "@/components/portfolio-client";
import { ProjectModal } from "@/components/project-modal";
import { PageFrame } from "@/components/layout/page-frame";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { findProjectByAlias, getProjectHref, getProjectSlug } from "@/lib/project-paths";
import type { Project } from "@/types";

interface PortfolioPageClientProps {
  projects: Project[];
  profileLinks?: ProfileLink[];
  /** Homepage sections rendered between the introduction and the archive. */
  children?: ReactNode;
  archiveHeading?: string;
  /** Replaces the homepage introduction (used by the /projects catalog). */
  header?: ReactNode;
}

const MOBILE_PROJECT_BREAKPOINT_QUERY = "(max-width: 767px)";

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname || "/";
}

// Keeps modal deep links (`?project=`) on whichever catalog page is open.
function buildHomeUrl(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${currentPath()}?${query}` : currentPath();
}

export function PortfolioPageClient({ projects, profileLinks, children, archiveHeading, header }: PortfolioPageClientProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const router = useRouter();
  const { setPreviousPath } = useBreadcrumb();

  const navigateToProjectPage = useCallback((project: Project, replace = false) => {
    const path = currentPath();
    setPreviousPath(path, path === "/" ? "Home" : "Projects");
    setSelectedProject(null);

    const href = getProjectHref(project);
    if (replace) {
      router.replace(href);
      return;
    }

    router.push(href);
  }, [router, setPreviousPath]);

  const isMobileProjectViewport = useCallback(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(MOBILE_PROJECT_BREAKPOINT_QUERY).matches;
  }, []);

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

      if (projectParam && resolvedProject && isMobileProjectViewport()) {
        navigateToProjectPage(resolvedProject, true);
        return;
      }

      setSelectedProject(resolvedProject);
    };

    syncSelectedProjectFromLocation();
    window.addEventListener("popstate", syncSelectedProjectFromLocation);
    window.addEventListener("resize", syncSelectedProjectFromLocation);

    return () => {
      window.removeEventListener("popstate", syncSelectedProjectFromLocation);
      window.removeEventListener("resize", syncSelectedProjectFromLocation);
    };
  }, [isMobileProjectViewport, navigateToProjectPage, projects]);

  const handleProjectSelect = (project: Project) => {
    if (typeof window === "undefined") {
      return;
    }

    if (isMobileProjectViewport()) {
      navigateToProjectPage(project);
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
      <PageFrame data-testid="site-page-frame" className="overflow-x-hidden py-6 md:py-8">
        {header ?? <PortfolioHeader profileLinks={profileLinks} />}
        {children}
        <PortfolioClient projects={projects} onProjectSelect={handleProjectSelect} heading={archiveHeading} />
      </PageFrame>
      <ProjectModal
        project={selectedProject}
        isOpen={Boolean(selectedProject)}
        onClose={handleCloseProjectModal}
      />
    </>
  );
}
