"use client";
import { useRef } from "react";
import { trackProductDemo } from "@/lib/firebase-analytics";
/** Milestones contain no user-entered content; each attempt emits once. */
export function useDemoAnalytics(slug: string) {
  const progress = useRef({ started: false, completed: false });
  const start = () => {
    if (progress.current.started) return;
    progress.current.started = true;
    trackProductDemo(slug, "start");
  };
  return {
    start,
    complete: () => {
      start();
      if (progress.current.completed) return;
      progress.current.completed = true;
      trackProductDemo(slug, "complete");
    },
    reset: () => { progress.current = { started: false, completed: false }; },
  };
}
