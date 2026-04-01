
"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PortfolioHeader } from "@/components/portfolio-header"
import { PortfolioClient } from "@/components/portfolio-client"
import { LoadingSpinner } from "@/components/global-ui/loading-spinner"
import { ProjectModal } from "@/components/project-modal"
import { findProjectByAlias } from "@/lib/project-paths"
import type { Project } from "@/types"

function PortfolioContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectParam = searchParams.get('project')
  const selectedProject = !loading && projectParam ? findProjectByAlias(projects, projectParam) ?? null : null

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch('/projects/projects.json')
        if (!res.ok) throw new Error('Failed to fetch projects')
        const data = (await res.json()) as Project[]
        if (mounted) setProjects(data)
      } catch (err) {
        console.error('Error loading projects', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (loading || !projectParam || selectedProject) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete("project")
    const query = params.toString()

    router.replace(query ? `/?${query}` : "/", { scroll: false })
  }, [loading, projectParam, router, searchParams, selectedProject])

  const handleCloseProjectModal = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("project")
    const query = params.toString()
    router.replace(query ? `/?${query}` : "/", { scroll: false })
  }

  return (
    <>
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8 max-w-7xl overflow-x-hidden">
        <PortfolioHeader />
        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground text-sm md:text-base">
            <LoadingSpinner />
            <span>Loading projects…</span>
          </div>
        ) : <PortfolioClient projects={projects} />}
      </div>
      {!loading && (
        <ProjectModal
          project={selectedProject}
          isOpen={Boolean(selectedProject)}
          onClose={handleCloseProjectModal}
        />
      )}
    </>
  )
}

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Suspense fallback={
        <div className="container mx-auto px-3 md:px-4 py-6 md:py-8 max-w-7xl overflow-x-hidden">
          <PortfolioHeader />
          <div className="flex items-center gap-3 text-muted-foreground text-sm md:text-base">
            <LoadingSpinner />
            <span>Loading…</span>
          </div>
        </div>
      }>
        <PortfolioContent />
      </Suspense>
    </div>
  )
}
