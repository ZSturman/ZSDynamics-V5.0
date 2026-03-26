import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, FolderOpen, Github, Newspaper } from "lucide-react";

import { ArticleMarkdown } from "@/components/articles/article-markdown";
import { loadArticleBySlug, loadArticles } from "@/lib/load-articles";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { formatDate } from "@/lib/utils";
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

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const articles = await loadArticles();
  return articles.map((article) => ({ slug: article.slug }));
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

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <div className="space-y-3 border-b border-border/70 pb-8">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            {" / "}
            <Link href="/articles" className="hover:text-foreground">
              Articles
            </Link>
          </p>

          <div className="space-y-4">
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

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{formatDate(article.publishedAt ?? article.updatedAt) || article.publishedAt || article.updatedAt}</span>
              {article.updatedAt && article.publishedAt && article.updatedAt !== article.publishedAt && (
                <span>Updated {formatDate(article.updatedAt) || article.updatedAt}</span>
              )}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{article.title}</h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">{article.summary}</p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <Github className="size-4" />
                View Source on GitHub
                <ArrowUpRight className="size-4" />
              </a>
              {article.tags?.map((tag) => (
                <span
                  key={`${article.slug}-${tag}`}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {relatedProjects.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {relatedProjects.map((project) => (
                  <Link
                    key={`${article.slug}-${project.id}`}
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <FolderOpen className="size-3.5" />
                    {project.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-8">
          <ArticleMarkdown content={content} slug={article.slug} />
        </div>

        {hasFooterContent && (
          <section className="mt-16 rounded-[2rem] border border-border/70 bg-muted/30 p-6 sm:p-8">
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

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Newspaper className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium leading-6 text-foreground">{recommendedArticle.title}</p>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{recommendedArticle.summary}</p>
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
                    {relatedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40"
                      >
                        <div className="overflow-hidden rounded-xl bg-muted">
                          {project.images?.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={project.images.thumbnail}
                              alt={project.title}
                              className="size-12 object-cover"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center text-muted-foreground">
                              <FolderOpen className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium leading-6 text-foreground">{project.title}</p>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{project.summary}</p>
                        </div>
                      </Link>
                    ))}
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
