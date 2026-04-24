import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FolderOpen, Newspaper, type LucideIcon } from "lucide-react";

import { ArticleAnalyticsTracker } from "@/components/analytics/article-analytics-tracker";
import { ArticleMarkdown } from "@/components/articles/article-markdown";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import { MetadataTag, MetadataText } from "@/components/ui/metadata-text";
import { loadArticleBySlug, loadArticles } from "@/lib/load-articles";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { getProjectIdentityMedia } from "@/lib/project-identity";
import { getProjectHref } from "@/lib/project-paths";
import { SITE_DESCRIPTION } from "@/lib/site-metadata";
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

function getSeriesHref(series: string): string {
  const searchParams = new URLSearchParams({ q: `series:${series}` });
  return `/articles?${searchParams.toString()}`;
}

function getProjectCardMedia(project: Project) {
  return getProjectIdentityMedia(project);
}

function CompactMediaSlot({
  src,
  alt,
  fallbackIcon: FallbackIcon,
}: {
  src?: string | null;
  alt: string;
  fallbackIcon: LucideIcon;
}) {
  return (
    <div
      data-testid="compact-content-card-media"
      className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 sm:size-24"
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-full w-full object-contain p-2" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <FallbackIcon className="size-5" />
        </div>
      )}
    </div>
  );
}

function ArticleRecommendationCard({
  title,
  href,
  summary,
  dateLabel,
  coverImage,
}: {
  title: string;
  href: string;
  summary: string;
  dateLabel: string;
  coverImage?: string;
}) {
  return (
    <Link
      href={href}
      data-testid="recommended-article-card"
      className="group flex items-start gap-4 rounded-[1.5rem] border border-border/70 bg-background px-4 py-4 transition-colors hover:border-primary/40"
    >
      <CompactMediaSlot
        src={coverImage}
        alt={`Cover image for ${title}`}
        fallbackIcon={Newspaper}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-medium leading-6 text-foreground transition-colors group-hover:text-primary">{title}</p>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{summary}</p>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>
    </Link>
  );
}

function ConnectedProjectCard({ project }: { project: Project }) {
  const projectCardMedia = getProjectCardMedia(project);

  return (
    <Link
      href={getProjectHref(project)}
      data-testid="article-connected-project-card"
      className="group flex items-start gap-4 rounded-[1.5rem] border border-border/70 bg-card/45 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <CompactMediaSlot
        src={projectCardMedia.projectVisualSrc}
        alt={`${project.title} project visual`}
        fallbackIcon={FolderOpen}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Project</p>
        <p className="font-medium leading-6 text-foreground transition-colors group-hover:text-primary">
          {project.title}
        </p>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{project.oneLiner || project.summary}</p>
      </div>
    </Link>
  );
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

  const hasPostMetadata = Boolean(article.series || article.tags?.length || relatedProjects.length > 0);
  const publishedLabel = formatDate(article.publishedAt ?? article.updatedAt) || article.publishedAt || article.updatedAt;
  const updatedLabel =
    article.updatedAt && article.publishedAt && article.updatedAt !== article.publishedAt
      ? formatDate(article.updatedAt) || article.updatedAt
      : null;

  return (
    <div className="min-h-screen bg-background">
      <PageFrame as="main" data-testid="site-page-frame" className="py-8 md:py-12">
        <ArticleAnalyticsTracker slug={article.slug} title={article.title} />

        <div className="space-y-8">
          <BreadcrumbTrail
            items={[
              { label: "Home", href: "/" },
              { label: "Articles", href: "/articles" },
              { label: article.title },
            ]}
          />

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

          <PageColumn data-testid="article-content-column" className="space-y-8">
            <div
              data-testid="article-header-block"
              className="space-y-4 border-b border-border/70 pb-8 md:pb-10"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{publishedLabel}</span>
                {updatedLabel && <span>Updated {updatedLabel}</span>}
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{article.title}</h1>
                <p className="text-base leading-8 text-muted-foreground md:text-lg">{article.summary}</p>
              </div>
            </div>

            <div className="pt-1">
              <ArticleMarkdown content={content} slug={article.slug} linkPreviews={article.linkPreviews} />
            </div>

            {hasPostMetadata && (
              <section
                data-testid="article-post-metadata"
                className="space-y-6 border-t border-border/70 pt-8"
              >
                {(article.series || article.tags?.length) && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {article.series ? (
                      <MetadataText
                        href={getSeriesHref(article.series)}
                        tone="interactive"
                        className="underline decoration-border/70 underline-offset-4"
                        data-testid="article-series-link"
                      >
                        Series: {article.series}
                      </MetadataText>
                    ) : (
                      <div />
                    )}

                    {article.tags?.length ? (
                      <div
                        data-testid="article-tag-list"
                        className="flex flex-wrap gap-x-3 gap-y-1 sm:justify-end"
                      >
                        {article.tags.map((tag) => (
                          <MetadataTag key={`${article.slug}-${tag}`} tag={tag} size="sm" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {relatedProjects.length > 0 && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {relatedProjects.map((project) => (
                      <ConnectedProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </PageColumn>
        </div>

        {recommendedArticles.length > 0 && (
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

            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Related and recent articles
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendedArticles.map((recommendedArticle) => (
                  <ArticleRecommendationCard
                    key={recommendedArticle.slug}
                    href={recommendedArticle.href}
                    title={recommendedArticle.title}
                    summary={recommendedArticle.oneLiner ?? recommendedArticle.summary}
                    coverImage={recommendedArticle.coverImage}
                    dateLabel={
                      formatDate(recommendedArticle.updatedAt ?? recommendedArticle.publishedAt) ||
                      recommendedArticle.updatedAt ||
                      recommendedArticle.publishedAt ||
                      "Undated"
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </PageFrame>
    </div>
  );
}
