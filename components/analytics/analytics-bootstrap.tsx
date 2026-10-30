"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  initializeAnalytics,
  configureProducts,
  trackProjectResourceClick,
  trackArticleProjectClick,
  trackContentFilter,
  setActiveAnalyticsSection,
  trackContactClick,
  trackOutboundLink,
  trackRouteView,
  trackScrollDepth,
  trackSectionEngaged,
  trackSectionView,
} from "@/lib/firebase-analytics";
import { productForPath, type ProductContext } from "@/lib/product-presentation";
import { AttentionClock, meaningfullyVisible } from "@/lib/attention.mjs";
import { captureUtmOnLoad } from "@/lib/analytics-utm";

const SCROLL_MILESTONES = [25, 50, 75, 90, 100] as const;
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

function isContactAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href") || "";
  if (href.startsWith("mailto:")) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.pathname.replace(/\/$/, "") === "/contact";
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

export function AnalyticsBootstrap({ products }: { products: ProductContext[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const previousFilters = useRef({ pathname, search });
  const routeKey = `${pathname || "/"}:${pathname === "/" ? searchParams.get("project") || "" : ""}`;

  useEffect(() => {
    configureProducts(products);
    captureUtmOnLoad();
    initializeAnalytics();

    // Delegated outbound-link tracker. Specific trackers (social, project
    // resource, article source, resume) opt out via data-analytics-skip="true".
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (anchor.dataset.analyticsSkip === "true") return;
      if (isContactAnchor(anchor)) {
        // Intent only; a delivered message is recorded separately as contact_submit.
        trackContactClick(inferSurface(anchor));
        return;
      }
      const articleProject = anchor.dataset.articleProject;
      if (articleProject) {
        const article = anchor.closest<HTMLElement>("[data-analytics-article-slug]")?.dataset.analyticsArticleSlug;
        if (article) trackArticleProjectClick(article, articleProject, anchor.dataset.projectId);
        return;
      }
      const slug = anchor.closest<HTMLElement>("[data-analytics-project-slug]")?.dataset.analyticsProjectSlug;
      const product = products.find((p) => p.slug === slug) || productForPath(products, window.location.pathname);
      if (product && (!anchor.closest('nav[aria-label="Primary"]') && !anchor.closest("header[data-site-header]"))) {
        const url = new URL(anchor.href);
        const meaningful = ["http:", "https:"].includes(url.protocol) && (url.origin !== window.location.origin || url.pathname.endsWith("/demo") || anchor.hasAttribute("download"));
        if (meaningful) {
          trackProjectResourceClick({ projectSlug: product.slug, projectTitle: product.title, resourceUrl: anchor.href, resourceLabel: anchor.textContent?.trim() || "Product action", isInternal: url.origin === window.location.origin, surface: inferSurface(anchor) });
          return;
        }
      }
      if (!isExternalAnchor(anchor)) return;
      trackOutboundLink({
        destinationUrl: anchor.href,
        surface: inferSurface(anchor),
        label: anchor.textContent?.trim().slice(0, 200),
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, [products]);

  useEffect(() => {
    const previous = previousFilters.current;
    if (previous.pathname === pathname && previous.search !== search && ["/articles", "/work-logs"].includes(pathname || "")) {
      const before = new URLSearchParams(previous.search);
      const after = new URLSearchParams(search);
      for (const key of ["q", "series", "tag", "project", "sort", "view", "vis", "type", "tab"]) {
        if (before.get(key) !== after.get(key)) trackContentFilter(pathname!, key, key === "q" ? (after.get(key) ? "provided" : "cleared") : after.get(key) || "all");
      }
    }
    previousFilters.current = { pathname, search };
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
    const states = new Map<HTMLElement, { key: string; clock: AttentionClock }>();
    const seenViews = new Set<string>();
    let frameId = 0;
    let exited = false;

    const check = () => {
      frameId = 0;
      const now = performance.now();
      for (const [element, state] of states) {
        if (!element.isConnected) { observer.unobserve(element); states.delete(element); continue; }
        const key = getVisibilityKey(element);
        if (key !== state.key) { state.key = key; state.clock = new AttentionClock(); }
        const active = !exited && document.visibilityState === "visible" &&
          meaningfullyVisible(element.getBoundingClientRect(), window.innerWidth, window.innerHeight);
        const payload = getVisibilityPayload(element);
        if (active) {
          setActiveAnalyticsSection(payload);
          if (!seenViews.has(key)) { seenViews.add(key); trackSectionView(payload); }
        }
        for (const seconds of state.clock.update(now, active)) {
          trackSectionEngaged({ ...payload, engagementBucket: `${seconds}s`, visibleTimeSec: seconds });
        }
      }
    };
    const schedule = () => { if (!frameId) frameId = window.requestAnimationFrame(check); };
    // IntersectionObserver supplies candidates; scroll/resize checks measure their
    // viewport-relative area because whole-element ratios miss long sections.
    const observer = new IntersectionObserver(schedule, { threshold: [0, 0.35, 1] });
    const observeTargets = () => {
      for (const element of queryVisibilityTargets()) {
        if (states.has(element)) continue;
        states.set(element, { key: getVisibilityKey(element), clock: new AttentionClock() });
        observer.observe(element);
      }
      schedule();
    };
    const mutationObserver = new MutationObserver(observeTargets);
    const onExit = () => { exited = true; check(); };
    const onShow = () => { exited = false; check(); };
    observeTargets();
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    const engagementTimer = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pagehide", onExit);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect(); mutationObserver.disconnect();
      window.clearInterval(engagementTimer);
      if (frameId) window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pagehide", onExit);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [routeKey]);

  return null;
}
