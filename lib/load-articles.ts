import * as fs from "node:fs/promises";
import * as path from "node:path";

import { resolveArticleHref } from "@/lib/article-paths";
import type { Article } from "@/types";

const ARTICLES_ROOT = path.join(process.cwd(), "public", "articles");
const ARTICLES_MANIFEST = path.join(ARTICLES_ROOT, "articles.json");
const STANDALONE_MARKDOWN_IMAGE_RE = /^\s*!\[[^\]]*\]\(([^)\s]+(?:\s+"[^"]*")?)\)\s*$/gm;
const COVER_HINT_RE = /(cover|hero|banner|thumbnail|poster)/i;
const COVER_IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeArticle(raw: unknown): Article | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.slug !== "string" ||
    typeof record.title !== "string" ||
    typeof record.summary !== "string" ||
    typeof record.updatedAt !== "string" ||
    typeof record.sourceUrl !== "string" ||
    typeof record.href !== "string"
  ) {
    return null;
  }

  return {
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    updatedAt: record.updatedAt,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [],
    projectIds: Array.isArray(record.projectIds)
      ? record.projectIds.filter((projectId): projectId is string => typeof projectId === "string" && projectId.trim().length > 0)
      : [],
    sourceUrl: record.sourceUrl,
    href: record.href,
    coverImage: typeof record.coverImage === "string" && record.coverImage.trim().length > 0 ? record.coverImage : undefined,
  };
}

function getMarkdownImageTarget(rawTarget: string): string {
  const trimmed = rawTarget.trim();
  const titleIndex = trimmed.search(/\s+"/);
  return titleIndex === -1 ? trimmed : trimmed.slice(0, titleIndex).trim();
}

function getImageCandidateScore(target: string): number {
  let score = 0;
  if (COVER_HINT_RE.test(target)) score += 10;
  if (target.startsWith("/")) score += 2;
  return score;
}

export function extractArticleCover(content: string, slug: string): { coverImage?: string; content: string } {
  const candidates = Array.from(content.matchAll(STANDALONE_MARKDOWN_IMAGE_RE))
    .map((match) => {
      const rawTarget = match[1];
      if (!rawTarget) return null;

      const markdownTarget = getMarkdownImageTarget(rawTarget);
      if (!COVER_IMAGE_EXT_RE.test(markdownTarget)) return null;

      const resolvedTarget = resolveArticleHref(markdownTarget, slug);
      if (!resolvedTarget || !COVER_IMAGE_EXT_RE.test(resolvedTarget)) return null;

      return {
        matchedText: match[0],
        resolvedTarget,
        score: getImageCandidateScore(markdownTarget),
        index: match.index ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((candidate): candidate is { matchedText: string; resolvedTarget: string; score: number; index: number } => Boolean(candidate));

  if (candidates.length === 0) {
    return { content };
  }

  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  const cover = candidates[0];
  const contentWithoutCover = content.replace(cover.matchedText, "").replace(/^\s+/, "");
  return {
    coverImage: cover.resolvedTarget,
    content: contentWithoutCover,
  };
}

export async function loadArticles(): Promise<Article[]> {
  try {
    const raw = await fs.readFile(ARTICLES_MANIFEST, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeArticle)
      .filter((article): article is Article => Boolean(article))
      .sort((a, b) => {
        const updatedDiff = toTimestamp(b.updatedAt ?? b.publishedAt ?? undefined) - toTimestamp(a.updatedAt ?? a.publishedAt ?? undefined);
        if (updatedDiff !== 0) return updatedDiff;
        return a.title.localeCompare(b.title);
      });
  } catch {
    return [];
  }
}

export async function loadArticleBySlug(slug: string): Promise<{ article: Article; content: string } | null> {
  const articles = await loadArticles();
  const article = articles.find((entry) => entry.slug === slug);
  if (!article) return null;

  const markdownPath = path.join(ARTICLES_ROOT, slug, "index.md");
  try {
    const content = await fs.readFile(markdownPath, "utf8");
    const extracted = extractArticleCover(content, slug);
    return {
      article: {
        ...article,
        coverImage: article.coverImage ?? extracted.coverImage,
      },
      content: extracted.content,
    };
  } catch {
    return null;
  }
}
