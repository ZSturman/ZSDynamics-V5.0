import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";
import { ArrowUpRight, Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { resolveArticleHref } from "@/lib/article-paths";
import type { ArticleLinkPreview } from "@/types";

interface ArticleMarkdownProps {
  content: string;
  slug: string;
  linkPreviews?: ArticleLinkPreview[];
}

function getPreviewForParagraph(
  children: ReactNode,
  previewsByUrl: Map<string, ArticleLinkPreview>
): ArticleLinkPreview | null {
  const nodes = Children.toArray(children).filter((child) => !(typeof child === "string" && child.trim().length === 0));
  if (nodes.length !== 1) {
    return null;
  }

  const node = nodes[0];
  if (!isValidElement(node)) {
    return null;
  }

  const nodeProps = node.props as { href?: unknown; "data-preview-url"?: unknown };

  const previewUrl =
    typeof nodeProps["data-preview-url"] === "string"
      ? nodeProps["data-preview-url"]
      : typeof nodeProps.href === "string"
        ? nodeProps.href
        : null;

  return previewUrl ? previewsByUrl.get(previewUrl) ?? null : null;
}

function ArticleLinkPreviewCard({ preview }: { preview: ArticleLinkPreview }) {
  const title = preview.title || preview.siteName || preview.displayUrl || preview.url;
  const siteName = preview.siteName || preview.provider || preview.hostname || "Link";
  const displayUrl = preview.displayUrl || preview.hostname || preview.url;

  return (
    <a
      data-testid="article-link-preview-card"
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mx-auto flex max-w-3xl items-start gap-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card px-4 py-4 shadow-sm transition-colors hover:border-primary/40 sm:px-5"
    >
      <div
        data-testid="article-link-preview-media"
        className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 sm:size-24"
      >
        {preview.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.image}
              alt={title}
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Globe className="size-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <span>{siteName}</span>
          <span className="h-1 w-1 rounded-full bg-border/80" />
          <span className="truncate">{displayUrl}</span>
        </div>
        <h3 className="text-base font-semibold leading-6 text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        {preview.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{preview.description}</p>
        ) : null}
      </div>
      <span className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-primary">
        <ArrowUpRight className="size-4" />
      </span>
    </a>
  );
}

function YouTubePreview({ preview }: { preview: ArticleLinkPreview }) {
  const title = preview.title || "YouTube video";

  return (
    <div
      data-testid="article-youtube-embed"
      className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm"
    >
      <div className="aspect-video bg-black">
        {preview.embedUrl ? (
          <iframe
            src={preview.embedUrl}
            title={title}
            className="h-full w-full border-0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : preview.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/80">{title}</div>
        )}
      </div>

      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/40"
      >
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {preview.siteName || "YouTube"}
          </p>
          <p className="text-base font-semibold leading-6 text-foreground">{title}</p>
          {preview.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{preview.description}</p>
          ) : null}
        </div>
      </a>
    </div>
  );
}

function ArticleStandaloneLinkPreview({ preview }: { preview: ArticleLinkPreview }) {
  if (preview.kind === "youtube") {
    return <YouTubePreview preview={preview} />;
  }

  return <ArticleLinkPreviewCard preview={preview} />;
}

export function ArticleMarkdown({ content, slug, linkPreviews = [] }: ArticleMarkdownProps) {
  const previewsByUrl = new Map(linkPreviews.map((preview) => [preview.url, preview]));

  return (
    <div className="article-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children, node }) => {
            const preview = getPreviewForParagraph(children, previewsByUrl);
            if (preview) {
              return (
                <div className="article-markdown-embed-wrapper">
                  <ArticleStandaloneLinkPreview preview={preview} />
                </div>
              );
            }

            // If the markdown AST contains an image node inside this paragraph,
            // our custom img renderer produces a <div>, which is invalid inside <p>.
            // Render as <div> instead to avoid the hydration error.
            type HastChild = { type?: string; tagName?: string; children?: HastChild[] };
            const containsImage = (nodes: HastChild[]): boolean =>
              nodes.some(
                (child) =>
                  child.tagName === "img" ||
                  (child.children && containsImage(child.children))
              );
            const hasImage = node?.children && containsImage(node.children as HastChild[]);

            if (hasImage) {
              return <div className="article-markdown-paragraph">{children}</div>;
            }

            return <p>{children}</p>;
          },
          a: ({ href, children, ...props }) => {
            const resolvedHref = resolveArticleHref(href, slug);
            if (!resolvedHref) {
              return <span {...props}>{children}</span>;
            }

            if (resolvedHref.startsWith("/")) {
              return (
                <Link
                  href={resolvedHref}
                  className="font-medium text-primary underline underline-offset-4"
                  data-preview-url={resolvedHref}
                >
                  {children}
                </Link>
              );
            }

            return (
              <a
                {...props}
                href={resolvedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
                data-preview-url={resolvedHref}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const resolvedSrc = resolveArticleHref(typeof src === "string" ? src : undefined, slug);
            if (!resolvedSrc) return null;

            return (
              <div className="article-markdown-image-wrapper">
                <div className="mx-auto my-8 max-w-3xl overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/50 p-2 sm:p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedSrc}
                    alt={alt || ""}
                    className="h-auto max-h-[80vh] w-full rounded-[1.35rem] object-contain"
                  />
                </div>
              </div>
            );
          },
          code: ({ className, children, ...props }) => {
            const isInline = !className && !String(children).includes("\n");
            if (isInline) {
              return (
                <code
                  {...props}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]"
                >
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
