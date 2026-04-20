import type { Metadata } from "next"
import { loadArticles } from "@/lib/load-articles"
import { loadPublicJsonRecursively } from "@/lib/load-public-json"
import { findProjectByAlias, getProjectHref, getProjectSlug } from "@/lib/project-paths"
import { getOptimizedMediaPath } from "@/lib/utils"
import ProjectDetailsClientWrapper from "@/components/project-details-client-wrapper"
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail"
import type { Article, Project, ProjectArticleReference } from "@/types"

function getProjectDescription(project: Project): string {
  return project.summary || project.oneLiner || project.description || `${project.title} by Zachary Sturman.`
}

function getProjectSocialImage(project: Project): string | undefined {
  const folderName = project.folderName || project.id
  const folderPath = `/projects/${folderName}`
  const candidate =
    project.images?.banner ||
    project.images?.hero ||
    project.images?.posterLandscape ||
    project.images?.poster ||
    project.images?.thumbnail

  return candidate ? getOptimizedMediaPath(candidate, folderPath) : undefined
}

function toProjectArticleReference(article: Article): ProjectArticleReference {
  return {
    title: article.title,
    slug: article.slug,
    href: article.href,
    sourceUrl: article.sourceUrl,
    ...(article.coverImage ? { coverImage: article.coverImage } : {}),
  }
}

function hydrateProjectArticles(project: Project, articles: Article[]): Project {
  const bySlug = new Map(articles.map((article) => [article.slug, article]))
  const byHref = new Map(articles.map((article) => [article.href, article]))
  const bySourceUrl = new Map(articles.map((article) => [article.sourceUrl, article]))
  const relationAliases = new Set(
    [
      project.id,
      project.slug,
      project.href,
      project.folderName,
      getProjectSlug(project),
      project.id.replace(/-/g, ""),
    ].filter((value): value is string => Boolean(value))
  )

  const mergedArticles: ProjectArticleReference[] = []
  const seenReferences = new Set<string>()

  function appendReference(reference: ProjectArticleReference): void {
    const hydratedArticle =
      bySlug.get(reference.slug) ||
      byHref.get(reference.href) ||
      bySourceUrl.get(reference.sourceUrl)

    const normalizedReference = hydratedArticle ? toProjectArticleReference(hydratedArticle) : reference
    const referenceKey = normalizedReference.slug || normalizedReference.href || normalizedReference.sourceUrl

    if (!referenceKey || seenReferences.has(referenceKey)) {
      return
    }

    seenReferences.add(referenceKey)
    mergedArticles.push(normalizedReference)
  }

  for (const reference of project.articles || []) {
    appendReference(reference)
  }

  for (const article of articles) {
    const matchesProject = (article.projectIds || []).some((projectId) => relationAliases.has(projectId))
    if (matchesProject) {
      appendReference(toProjectArticleReference(article))
    }
  }

  if (mergedArticles.length === 0 && !project.articles?.length) {
    return project
  }

  return {
    ...project,
    articles: mergedArticles,
  }
}

export async function generateStaticParams(): Promise<Array<{ project: string }>> {
  const projects = await loadPublicJsonRecursively<Project>("projects")
  const params = new Set<string>()

  for (const project of projects) {
    params.add(getProjectSlug(project))
    params.add(project.id)
  }

  return Array.from(params).map((project) => ({ project }))
}

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const { project } = await params
  const projects = await loadPublicJsonRecursively<Project>("projects")
  const resolvedProject = findProjectByAlias(projects, project)

  if (!resolvedProject) {
    return {
      title: "Project not found",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const description = getProjectDescription(resolvedProject)
  const socialImage = getProjectSocialImage(resolvedProject)

  return {
    title: resolvedProject.title,
    description,
    alternates: {
      canonical: getProjectHref(resolvedProject),
    },
    openGraph: {
      title: resolvedProject.title,
      description,
      url: getProjectHref(resolvedProject),
      ...(socialImage ? { images: [{ url: socialImage, alt: resolvedProject.title }] } : {}),
    },
    twitter: {
      title: resolvedProject.title,
      description,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params

  try {
    const [projects, articles] = await Promise.all([
      loadPublicJsonRecursively<Project>("projects"),
      loadArticles(),
    ])
    const resolvedProject = findProjectByAlias(projects, project)

    if (!resolvedProject) {
      return (
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="space-y-6">
              <BreadcrumbTrail
                items={[
                  { label: "Home", href: "/" },
                  { label: "Projects", href: "/#projects" },
                ]}
              />
              <div className="text-center text-muted-foreground">Project not found.</div>
            </div>
          </div>
        </div>
      )
    }

    const hydratedProject = hydrateProjectArticles(resolvedProject, articles)

    return (
      <ProjectDetailsClientWrapper project={hydratedProject} requestedProject={project} />
    )
  } catch (e) {
    console.error(e)
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-6">
            <BreadcrumbTrail
              items={[
                { label: "Home", href: "/" },
                { label: "Projects", href: "/#projects" },
              ]}
            />
            <div className="text-center text-muted-foreground">Error loading project.</div>
          </div>
        </div>
      </div>
    )
  }
}
