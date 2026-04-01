"use client";

import { useEffect } from "react";

import { trackProjectOpen } from "@/lib/firebase-analytics";

interface ProjectAnalyticsTrackerProps {
  projectSlug: string;
  projectTitle: string;
}

export function ProjectAnalyticsTracker({
  projectSlug,
  projectTitle,
}: ProjectAnalyticsTrackerProps) {
  useEffect(() => {
    trackProjectOpen({
      projectSlug,
      projectTitle,
      openSurface: "project_page",
    });
  }, [projectSlug, projectTitle]);

  return null;
}
