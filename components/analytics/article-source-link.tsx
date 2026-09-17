"use client";

import type { ReactNode } from "react";

import { trackArticleSourceClick } from "@/lib/firebase-analytics";

interface ArticleSourceLinkProps {
  articleSlug: string;
  articleTitle: string;
  href: string;
  className?: string;
  children: ReactNode;
}

export function ArticleSourceLink({
  articleSlug,
  articleTitle,
  href,
  className,
  children,
}: ArticleSourceLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        trackArticleSourceClick({
          articleSlug,
          articleTitle,
          destinationUrl: href,
        });
      }}
    >
      {children}
    </a>
  );
}
