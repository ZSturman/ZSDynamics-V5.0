import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FolderOpen, Newspaper } from "lucide-react";

import { ArticleAnalyticsTracker } from "@/components/analytics/article-analytics-tracker";
import { ArticleMarkdown } from "@/components/articles/article-markdown";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import { PassiveChip } from "@/components/ui/passive-chip";
import { loadArticleBySlug, loadArticles } from "@/lib/load-articles";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { getProjectHref } from "@/lib/project-paths";
import { SITE_DESCRIPTION } from "@/lib/site-metadata";
import { formatDate, getOptimizedMediaPath } from "@/lib/utils";
import type { Project } from "@/types";

export const dynamic = "force-static";

function getTagOverlap(articleTags: string[], candidateTags: string[]): number {
  if (articleTags.length === 0 || candidateTags.length === 0) return 0;
  const normalizedCurrent = new Set(articleTags.map((tag) => tag.toLowerCase()));
  return candidateTags.reduce((count, tag) => count + (normalizedCurrent.has(tag.toLowerCase()) ? 1 : 0), 0);
}

function getProjectTagPool(project: Project): string[] {
  return [
    ...(project.tags || []),
    ...(project.topics || []),
    ...(project.subjects || []),
    ...(project.mediums || []),
    ...(project.genres || []),
  ];
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getProjectThumbnail(project: Project): string | null {
  if (!project.images?.thumbnail) {
    return null;
  }

  const folderName = project.folderName || project.id;
  return getOptimizedMediaPath(project.images.thumbnail, `/projects/${folderName}`);
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const articles = await loadArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const articleResult = await loadArticleBySlug(slug);

  if (!articleResult) {
    return {
      title: "Article not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { article } = articleResult;
  const description = article.summary || SITE_DESCRIPTION;

  return {
    title: article.title,
    description,
    alternates: {
      canonical: article.href,
    },
    openGraph: {
      title: article.title,
      description,
      url: article.href,
      ...(article.coverImage ? { images: [{ url: article.coverImage, alt: article.title }] } : {}),
    },
    twitter: {
      title: article.title,
      description,
      ...(article.coverImage ? { images: [article.coverImage] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [articleResult, articles, projects] = await Promise.all([
    loadArticleBySlug(slug),
    loadArticles(),
    loadPublicJsonRecursively<Project>("projects"),
  ]);

  if (!articleResult) {
    notFound();
  }

  const { article, content } = articleResult;
  const articleTags = article.tags || [];
  const pinnedProjects = (article.projectIds || [])
    .map((projectId) => projects.find((project) => project.id === projectId))
    .filter((project): project is Project => Boolean(project));
  const projectIds = new Set(pinnedProjects.map((project) => project.id));
  const similarProjects = projects
    .filter((project) => !projectIds.has(project.id))
    .map((project) => ({
      project,
      overlap: getTagOverlap(articleTags, getProjectTagPool(project)),
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((left, right) => {
      if (right.overlap !== left.overlap) return right.overlap - left.overlap;
      return (right.project.updatedAt || "").localeCompare(left.project.updatedAt || "");
    })
    .slice(0, 3)
    .map(({ project }) => project);
  const relatedProjects = [...pinnedProjects, ...similarProjects].slice(0, 4);

  const recommendedArticles = articles
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => ({
      article: candidate,
      overlap: getTagOverlap(articleTags, candidate.tags || []),
    }))
    .sort((left, right) => {
      if (right.overlap !== left.overlap) return right.overlap - left.overlap;
      return toTimestamp(right.article.updatedAt ?? right.article.publishedAt) - toTimestamp(left.article.updatedAt ?? left.article.publishedAt);
    })
    .slice(0, 4)
    .map(({ article: recommendedArticle }) => recommendedArticle);

  const hasFooterContent = recommendedArticles.length > 0 || relatedProjects.length > 0;
  const publishedLabel = formatDate(article.publishedAt ?? article.updatedAt) || article.publishedAt || article.updatedAt;
  const updatedLabel =
    article.updatedAt && article.publishedAt && article.updatedAt !== article.publishedAt
      ? formatDate(article.updatedAt) || article.updatedAt
      : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <ArticleAnalyticsTracker slug={article.slug} title={article.title} />

        <div className="space-y-8">
          <BreadcrumbTrail
            items={[
              { label: "Home", href: "/" },
              { label: "Articles", href: "/articles" },
              { label: article.title },
            ]}
          />

          <div className="space-y-6 border-b border-border/70 pb-8 md:pb-10">
            {article.coverImage && (
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-muted/40 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.coverImage}
                  alt={`Cover image for ${article.title}`}
                  className="aspect-[16/7] w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{publishedLabel}</span>
                {updatedLabel && <span>Updated {updatedLabel}</span>}
              </div>

              <div className="max-w-4xl space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{article.title}</h1>
                <p className="text-base leading-8 text-muted-foreground md:text-lg">{article.summary}</p>
              </div>

              {(article.series || article.tags?.length) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {article.series && <PassiveChip tone="strong">Series: {article.series}</PassiveChip>}
                  {article.tags?.map((tag) => (
                    <PassiveChip key={`${article.slug}-${tag}`}>{tag}</PassiveChip>
                  ))}
                </div>
              )}

              {relatedProjects.length > 0 && (
                <div className="pt-2">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Projects connected to this article
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedProjects.map((project) => {
                      const projectThumbnail = getProjectThumbnail(project);

                      return (
                        <Link
                          key={`${article.slug}-${project.id}`}
                          href={getProjectHref(project)}
                          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/50 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-card"
                        >
                          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                            {projectThumbnail ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={projectThumbnail}
                                  alt={project.title}
                                  className="h-20 w-28 object-cover"
                                />
                              </>
                            ) : (
                              <div className="flex h-20 w-28 items-center justify-center text-muted-foreground">
                                <FolderOpen className="size-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Project
                            </p>
                            <p className="font-medium leading-6 text-foreground">{project.title}</p>
                            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {project.oneLiner || project.summary}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="max-w-4xl pt-2">
            <ArticleMarkdown content={content} slug={article.slug} linkPreviews={article.linkPreviews} />
          </div>
        </div>

        {hasFooterContent && (
          <section className="mt-16 rounded-[2rem] border border-border/70 bg-card/35 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Keep reading</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">More from the portfolio</h2>
              </div>
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Browse all articles
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {recommendedArticles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">Related and recent articles</h3>
                  <div className="space-y-3">
                    {recommendedArticles.map((recommendedArticle) => (
                      <Link
                        key={recommendedArticle.slug}
                        href={recommendedArticle.href}
                        className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40"
                      >
                        <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                          {recommendedArticle.coverImage ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={recommendedArticle.coverImage}
                                alt={`Cover image for ${recommendedArticle.title}`}
                                className="h-20 w-28 object-cover"
                              />
                            </>
                          ) : (
                            <div className="flex h-20 w-28 items-center justify-center text-muted-foreground">
                              <Newspaper className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Article
                          </p>
                          <p className="font-medium leading-6 text-foreground">{recommendedArticle.title}</p>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {recommendedArticle.oneLiner ?? recommendedArticle.summary}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(recommendedArticle.updatedAt ?? recommendedArticle.publishedAt) || recommendedArticle.updatedAt || recommendedArticle.publishedAt}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {relatedProjects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">Projects connected to this article</h3>
                  <div className="space-y-3">
                    {relatedProjects.map((project) => {
                      const projectThumbnail = getProjectThumbnail(project);

                      return (
                        <Link
                          key={project.id}
                          href={getProjectHref(project)}
                          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40"
                        >
                          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                            {projectThumbnail ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={projectThumbnail}
                                  alt={project.title}
                                  className="h-20 w-28 object-cover"
                                />
                              </>
                            ) : (
                              <div className="flex h-20 w-28 items-center justify-center text-muted-foreground">
                                <FolderOpen className="size-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Project
                            </p>
                            <p className="font-medium leading-6 text-foreground">{project.title}</p>
                            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {project.oneLiner || project.summary}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
