import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { resolveArticleHref } from "@/lib/article-paths";

interface ArticleMarkdownProps {
  content: string;
  slug: string;
}

export function ArticleMarkdown({ content, slug }: ArticleMarkdownProps) {
  return (
    <div className="article-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, href, children, ...props }) => {
            const resolvedHref = resolveArticleHref(href, slug);
            if (!resolvedHref) {
              return <span {...props}>{children}</span>;
            }

            if (resolvedHref.startsWith("/")) {
              return (
                <Link href={resolvedHref} className="font-medium text-primary underline underline-offset-4">
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
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const resolvedSrc = resolveArticleHref(typeof src === "string" ? src : undefined, slug);
            if (!resolvedSrc) return null;

            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedSrc}
                alt={alt || ""}
                className="my-6 w-full rounded-2xl border border-border/70 object-cover"
              />
            );
          },
          code: ({ node: _node, className, children, ...props }) => {
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
