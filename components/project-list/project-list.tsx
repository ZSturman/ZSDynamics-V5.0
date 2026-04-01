"use client"

import { ProjectCard } from "@/components/project-list/project-card"
import { ProjectListItem } from "@/components/project-list/project-list-item"
import { trackProjectOpen } from "@/lib/firebase-analytics"
import { getProjectHref } from "@/lib/project-paths"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useBreadcrumb } from "@/lib/breadcrumb-context"

import type { Project } from "@/types"

interface ProjectListProps {
  viewMode?: "grid" | "list"
  projects: Project[]
  onProjectSelect?: (project: Project) => void
  sortField?: "title" | "createdAt" | "updatedAt"
}

export function ProjectList({
  viewMode = "list",
  projects,
  onProjectSelect,
  sortField = "updatedAt",
}: ProjectListProps) {
  const router = useRouter()
  const { setPreviousPath } = useBreadcrumb()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleClick = (project: Project) => {
    const projectSlug = project.slug || project.id

    if (onProjectSelect) {
      trackProjectOpen({
        projectSlug,
        projectTitle: project.title,
        openSurface: "project_list",
      })
      onProjectSelect(project)
      return
    }

    // Set breadcrumb state before navigating
    setPreviousPath("/", "Home")
    const projectHref = getProjectHref(project)
    trackProjectOpen({
      projectSlug,
      projectTitle: project.title,
      openSurface: "project_page_link",
    })
    router.push(projectHref, { scroll: false })
    if (!isMobile) {
      router.prefetch(projectHref)
    }
  }

  return (
    <>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-full overflow-x-hidden">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleClick(project)}
              compact
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 max-w-full overflow-x-hidden">
          {projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              onClick={() => handleClick(project)}
              sortField={sortField}
            />
          ))}
        </div>
      )}
    </>
  );
}
