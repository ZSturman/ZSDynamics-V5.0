"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProjectAnalyticsTracker } from "@/components/analytics/project-analytics-tracker"
import { getProjectHref, getProjectSlug } from "@/lib/project-paths"
import ProjectDetails from "@/components/projects-details"
import type { Project } from "@/types"

interface ProjectDetailsClientWrapperProps {
  project: Project
  requestedProject?: string
}

function ProjectDetailsContent({ project, requestedProject }: ProjectDetailsClientWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const hadLegacyQuery = params.has("project")
    if (hadLegacyQuery) {
      params.delete("project")
    }

    const needsCanonicalPath = Boolean(requestedProject) && requestedProject !== getProjectSlug(project)
    if (hadLegacyQuery || needsCanonicalPath) {
      const newUrl = `${getProjectHref(project)}${params.toString() ? `?${params.toString()}` : ""}`
      router.replace(newUrl, { scroll: false })
    }
  }, [project, requestedProject, router, searchParams])

  const requestedCollectionItemId = searchParams.get("collectionItem") ?? undefined

  return (
    <>
      <ProjectAnalyticsTracker
        projectSlug={getProjectSlug(project)}
        projectTitle={project.title}
      />
      <ProjectDetails project={project} requestedCollectionItemId={requestedCollectionItemId} />
    </>
  )
}

export default function ProjectDetailsClientWrapper({ project, requestedProject }: ProjectDetailsClientWrapperProps) {
  return (
    <Suspense fallback={<ProjectDetails project={project} />}>
      <ProjectDetailsContent project={project} requestedProject={requestedProject} />
    </Suspense>
  )
}
