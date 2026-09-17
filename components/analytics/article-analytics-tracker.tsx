"use client";

import { useEffect } from "react";

import { trackArticleOpen } from "@/lib/firebase-analytics";

interface ArticleAnalyticsTrackerProps {
  slug: string;
  title: string;
}

export function ArticleAnalyticsTracker({ slug, title }: ArticleAnalyticsTrackerProps) {
  useEffect(() => {
    trackArticleOpen({
      articleSlug: slug,
      articleTitle: title,
    });
  }, [slug, title]);

  return null;
}
