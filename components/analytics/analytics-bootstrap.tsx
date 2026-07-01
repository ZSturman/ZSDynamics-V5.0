"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  initializeAnalytics,
  setActiveAnalyticsSection,
  trackAutomationSignal,
  trackOutboundLink,
  trackRouteView,
  trackScrollDepth,
  trackSectionEngaged,
  trackSectionView,
} from "@/lib/firebase-analytics";
import { captureUtmOnLoad } from "@/lib/analytics-utm";

const SCROLL_MILESTONES = [25, 50, 75, 90, 100] as const;
const ENGAGEMENT_BUCKETS = [
  { seconds: 5, label: "5s" },
  { seconds: 15, label: "15s" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "60s" },
] as const;

function getAutomationSignalReason(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const reasons: string[] = [];
  const userAgent = navigator.userAgent.toLowerCase();

  if (navigator.webdriver) {
    reasons.push("webdriver");
  }

  if (
    userAgent.includes("headless") ||
    userAgent.includes("playwright") ||
    userAgent.includes("puppeteer") ||
    userAgent.includes("phantomjs")
  ) {
    reasons.push("headless_user_agent");
  }

  return reasons.length > 0 ? reasons.join(",") : null;
}

function isExternalAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return false;
  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function inferSurface(anchor: HTMLAnchorElement): string {
  const explicit = anchor.dataset.analyticsSurface;
  if (explicit) return explicit;
  const testId = anchor.dataset.testid;
  if (testId) return testId;
  const closest = anchor.closest<HTMLElement>("[data-analytics-section],[data-testid]");
  if (closest) {
    return closest.dataset.analyticsSection || closest.dataset.testid || "unknown";
  }
  return "unknown";
}

function findAnalyticsContext(element: Element): HTMLElement | null {
  return element.closest<HTMLElement>(
    "[data-analytics-project-slug],[data-analytics-project-title],[data-analytics-article-slug],[data-analytics-article-title],[data-analytics-surface]",
  );
}

function getElementLabel(element: HTMLElement): string | undefined {
  return (
    element.dataset.analyticsSectionLabel ||
    element.dataset.analyticsItemLabel ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent?.trim().replace(/\s+/g, " ").slice(0, 120)
  );
}

function getVisibilityPayload(element: HTMLElement) {
  const context = findAnalyticsContext(element);
  const sectionKey =
    element.dataset.analyticsSection ||
    element.dataset.analyticsItem ||
    element.dataset.testid ||
    "unknown";

  return {
    sectionKey,
    sectionLabel: getElementLabel(element),
    projectSlug: element.dataset.analyticsProjectSlug || context?.dataset.analyticsProjectSlug,
    projectTitle: element.dataset.analyticsProjectTitle || context?.dataset.analyticsProjectTitle,
    articleSlug: element.dataset.analyticsArticleSlug || context?.dataset.analyticsArticleSlug,
    articleTitle: element.dataset.analyticsArticleTitle || context?.dataset.analyticsArticleTitle,
    itemId: element.dataset.analyticsItemId || element.dataset.collectionItemId || element.dataset.assetId,
    itemType: element.dataset.analyticsItemType || element.dataset.collectionItemType,
    collectionKey: element.dataset.analyticsCollectionKey,
    mediaRole: element.dataset.analyticsMediaRole || element.dataset.mediaRole,
    surface: element.dataset.analyticsSurface || context?.dataset.analyticsSurface,
  };
}

function getVisibilityKey(element: HTMLElement): string {
  const payload = getVisibilityPayload(element);
  return [
    payload.surface,
    payload.projectSlug,
    payload.articleSlug,
    payload.sectionKey,
    payload.collectionKey,
    payload.itemId,
    payload.mediaRole,
  ].filter(Boolean).join(":");
}

function queryVisibilityTargets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-analytics-section],[data-analytics-item]"));
}

export function AnalyticsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = `${pathname || "/"}?${search}`;

  useEffect(() => {
    captureUtmOnLoad();
    initializeAnalytics();

    const automationSignalReason = getAutomationSignalReason();
    if (automationSignalReason) {
      trackAutomationSignal(automationSignalReason);
    }

    // Delegated outbound-link tracker. Specific trackers (social, project
    // resource, article source, resume) opt out via data-analytics-skip="true".
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (anchor.dataset.analyticsSkip === "true") return;
      if (!isExternalAnchor(anchor)) return;
      trackOutboundLink({
        destinationUrl: anchor.href,
        surface: inferSurface(anchor),
        label: anchor.textContent?.trim().slice(0, 200),
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  useEffect(() => {
    trackRouteView({
      pathname: pathname || "/",
      search,
    });
  }, [pathname, search]);

  useEffect(() => {
    const seenMilestones = new Set<number>();
    let frameId = 0;

    const checkScrollDepth = () => {
      frameId = 0;
      const documentElement = document.documentElement;
      const body = document.body;
      const scrollHeight = Math.max(
        documentElement.scrollHeight,
        body?.scrollHeight || 0,
        documentElement.clientHeight,
      );
      const viewportBottom = window.scrollY + window.innerHeight;
      const percent = scrollHeight <= window.innerHeight
        ? 100
        : Math.min(100, Math.round((viewportBottom / scrollHeight) * 100));

      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone && !seenMilestones.has(milestone)) {
          seenMilestones.add(milestone);
          trackScrollDepth({ scrollPercent: milestone });
        }
      }
    };

    const scheduleCheck = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(checkScrollDepth);
    };

    scheduleCheck();
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
    };
  }, [routeKey]);

  useEffect(() => {
    type VisibleState = {
      key: string;
      element: HTMLElement;
      visibleSince: number | null;
      accumulatedMs: number;
      buckets: Set<string>;
    };

    const observedElements = new WeakSet<HTMLElement>();
    const visibleStates = new Map<HTMLElement, VisibleState>();
    const seenViews = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        for (const entry of entries) {
          const element = entry.target;
          if (!(element instanceof HTMLElement)) continue;

          const isMeaningfullyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
          const key = getVisibilityKey(element);
          const payload = getVisibilityPayload(element);
          let state = visibleStates.get(element);
          if (!state) {
            state = {
              key,
              element,
              visibleSince: null,
              accumulatedMs: 0,
              buckets: new Set<string>(),
            };
            visibleStates.set(element, state);
          }

          if (isMeaningfullyVisible) {
            setActiveAnalyticsSection(payload);
            if (!seenViews.has(key)) {
              seenViews.add(key);
              trackSectionView(payload);
            }
            if (state.visibleSince === null) {
              state.visibleSince = now;
            }
            continue;
          }

          if (state.visibleSince !== null) {
            state.accumulatedMs += now - state.visibleSince;
            state.visibleSince = null;
          }
        }
      },
      { threshold: [0, 0.35, 0.65, 1] },
    );

    const observeTargets = () => {
      for (const element of queryVisibilityTargets()) {
        if (observedElements.has(element)) continue;
        observedElements.add(element);
        observer.observe(element);
      }
    };

    const mutationObserver = new MutationObserver(observeTargets);
    observeTargets();
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const engagementTimer = window.setInterval(() => {
      const now = performance.now();
      for (const state of visibleStates.values()) {
        const visibleMs = state.accumulatedMs + (state.visibleSince === null ? 0 : now - state.visibleSince);
        const visibleSec = Math.floor(visibleMs / 1000);
        for (const bucket of ENGAGEMENT_BUCKETS) {
          if (visibleSec < bucket.seconds || state.buckets.has(bucket.label)) continue;
          state.buckets.add(bucket.label);
          trackSectionEngaged({
            ...getVisibilityPayload(state.element),
            engagementBucket: bucket.label,
            visibleTimeSec: bucket.seconds,
          });
        }
      }
    }, 1000);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.clearInterval(engagementTimer);
    };
  }, [routeKey]);

  return null;
}
