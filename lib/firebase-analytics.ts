"use client";

import type { Analytics } from "firebase/analytics";
import type { FirebaseApp } from "firebase/app";

import { getQaRun, getStoredUtm } from "./analytics-utm";
import { getAnalyticsSuppressionReason as evaluateAnalyticsSuppression } from "./analytics-suppression.mjs";

type AnalyticsValue = string | number | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

type RouteViewInput = {
  pathname: string;
  search: string;
};

type ProjectOpenInput = {
  projectSlug: string;
  projectTitle: string;
  openSurface: string;
};

type ProjectResourceClickInput = {
  projectSlug?: string;
  projectTitle?: string;
  resourceType?: string;
  resourceLabel: string;
  resourceUrl: string;
  isInternal: boolean;
};

type ArticleOpenInput = {
  articleSlug: string;
  articleTitle: string;
};

type ArticleSourceClickInput = {
  articleSlug: string;
  articleTitle: string;
  destinationUrl: string;
};

type SocialClickInput = {
  socialNetwork: string;
  destinationUrl: string;
};

type ContentContextInput = {
  projectSlug?: string;
  projectTitle?: string;
  articleSlug?: string;
  articleTitle?: string;
};

type SectionAnalyticsInput = ContentContextInput & {
  sectionKey: string;
  sectionLabel?: string;
  itemId?: string;
  itemType?: string;
  collectionKey?: string;
  mediaRole?: string;
  surface?: string;
};

type SectionEngagementInput = SectionAnalyticsInput & {
  engagementBucket: string;
  visibleTimeSec: number;
};

type ScrollDepthInput = {
  scrollPercent: number;
};

type ProjectItemOpenInput = ContentContextInput & {
  itemId: string;
  itemType?: string;
  itemLabel?: string;
  collectionKey?: string;
  surface?: string;
  interactionType?: string;
};

type ProjectMediaProgressInput = ContentContextInput & {
  mediaKind: "image" | "video" | "3d_model" | "audio" | "game" | "text" | "other";
  mediaRole?: string;
  mediaUrl?: string;
  progressPercent?: number;
  itemId?: string;
  itemType?: string;
  collectionKey?: string;
  surface?: string;
  interactionType: string;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfigEntries = Object.entries(firebaseConfig);
const analyticsEnabled = process.env.NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED === "true";

let appInstance: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let lastRouteViewKey = "";
let routeStep = 0;
let activePageContext: AnalyticsParams = {};
let activeAttentionContext: AnalyticsParams = {};
let missingConfigWarned = false;

function canUseBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * A fail-closed production guard.  It runs before Firebase Analytics is
 * imported, which prevents automatic GA4 page_view/session events as well as
 * the portfolio's custom events from automated and preview browsing.
 */
export function getAnalyticsSuppressionReason(): string | null {
  if (!canUseBrowser()) return "not_a_browser";
  return evaluateAnalyticsSuppression({
    enabled: analyticsEnabled,
    disabled: process.env.NEXT_PUBLIC_ANALYTICS_DISABLED,
    automationFlag: (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__,
    hostname: window.location.hostname,
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver,
    allowedHosts: process.env.NEXT_PUBLIC_ANALYTICS_ALLOWED_HOSTS,
  });
}

function hasCompleteConfig(): boolean {
  return requiredConfigEntries.every(([, value]) => Boolean(value));
}

function warnMissingConfigOnce(): void {
  if (missingConfigWarned || !canUseBrowser() || process.env.NODE_ENV === "production") {
    return;
  }

  missingConfigWarned = true;
  const missingKeys = requiredConfigEntries
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length === 0) {
    console.warn("Firebase analytics is disabled. Set NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true to enable it.");
    return;
  }

  console.warn("Firebase analytics is disabled because config is incomplete.", missingKeys);
}

function toStringFlag(value: boolean): string {
  return value ? "true" : "false";
}

function sanitizeAnalyticsText(value: string | undefined, maxLength = 100): string | undefined {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function getViewportCategory(): string {
  if (!canUseBrowser()) {
    return "unknown";
  }

  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function normalizeDomain(url: string): string {
  if (!canUseBrowser()) {
    return "unknown";
  }

  if (url.startsWith("mailto:")) {
    return "email";
  }

  if (url.startsWith("tel:")) {
    return "phone";
  }

  try {
    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.hostname.replace(/^www\./, "") || "local";
  } catch {
    return "unknown";
  }
}

function sanitizeParams(params: AnalyticsParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number>;
}

function getRouteDetails({ pathname, search }: RouteViewInput): AnalyticsParams {
  const normalizedPath = pathname || "/";
  const searchParams = new URLSearchParams(search);
  const segments = normalizedPath.split("/").filter(Boolean);
  const hasQuery = toStringFlag(searchParams.size > 0);
  const modalProjectSlug = normalizedPath === "/" ? searchParams.get("project") || undefined : undefined;
  const baseDetails = {
    has_query: hasQuery,
    page_path: normalizedPath,
    viewport_category: getViewportCategory(),
    route_surface: modalProjectSlug ? "home_project_modal" : "page",
    modal_context: modalProjectSlug ? "project_modal" : "none",
  };

  if (normalizedPath === "/") {
    return {
      ...baseDetails,
      page_group: "home",
      page_slug: modalProjectSlug || "home",
      project_slug: modalProjectSlug,
    };
  }

  if (segments[0] === "articles") {
    return {
      ...baseDetails,
      page_group: segments[1] ? "article" : "articles",
      page_slug: segments[1] || "articles",
      article_slug: segments[1],
    };
  }

  if (segments[0] === "projects") {
    return {
      ...baseDetails,
      page_group: "project",
      page_slug: segments[1] || "projects",
      project_slug: segments[1],
    };
  }

  if (segments[0] === "work-logs") {
    return {
      ...baseDetails,
      page_group: "work_logs",
      page_slug: searchParams.get("project") || "work-logs",
      project_slug: searchParams.get("project") || undefined,
    };
  }

  return {
    ...baseDetails,
    page_group: "other",
    page_slug: segments.join("/") || "other",
  };
}

async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!canUseBrowser()) {
    return null;
  }

  if (getAnalyticsSuppressionReason() || !hasCompleteConfig()) {
    warnMissingConfigOnce();
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const [{ getApps, initializeApp }, analyticsModule] = await Promise.all([
        import("firebase/app"),
        import("firebase/analytics"),
      ]);

      const supported = await analyticsModule.isSupported().catch(() => false);
      if (!supported) {
        return null;
      }

      appInstance = getApps()[0] ?? initializeApp(firebaseConfig);
      const analytics = analyticsModule.getAnalytics(appInstance);
      analyticsModule.setAnalyticsCollectionEnabled(analytics, true);
      // Controlled QA sessions carry GA4's internal-traffic marker on every
      // hit, including automatic page views, so reports can exclude them.
      const qaRun = getQaRun();
      if (qaRun) {
        analyticsModule.setDefaultEventParameters({ traffic_type: "internal", qa_run: qaRun });
      }

      return analytics;
    })().catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to initialize Firebase analytics.", error);
      }
      return null;
    });
  }

  return analyticsPromise;
}

async function logAnalyticsEvent(name: string, params: AnalyticsParams = {}): Promise<void> {
  const utm = getStoredUtm();
  const qaRun = getQaRun();
  const merged: AnalyticsParams = {
    ...utm,
    ...(qaRun ? { traffic_type: "internal", qa_run: qaRun } : {}),
    ...activePageContext,
    ...activeAttentionContext,
    ...params,
  };

  // Test-only observer: browser tests define this array to verify which
  // events fire (analytics stays suppressed for them). Absent in production.
  const observer = canUseBrowser()
    ? (window as Window & { __ZS_ANALYTICS_LOG__?: Array<{ name: string; params: AnalyticsParams }> }).__ZS_ANALYTICS_LOG__
    : undefined;
  if (Array.isArray(observer)) {
    observer.push({ name, params: sanitizeParams(merged) });
  }

  const analytics = await getAnalyticsInstance();
  if (!analytics) {
    return;
  }

  const analyticsModule = await import("firebase/analytics");
  analyticsModule.logEvent(analytics, name, sanitizeParams(merged));
}

export function initializeAnalytics(): void {
  void getAnalyticsInstance();
}

export function trackRouteView(input: RouteViewInput): void {
  const routeKey = `${input.pathname}?${input.search}`;
  if (routeKey === lastRouteViewKey) {
    return;
  }

  const previousPageGroup = activePageContext.page_group;
  const previousPageSlug = activePageContext.page_slug;
  const routeDetails = getRouteDetails(input);
  routeStep += 1;
  lastRouteViewKey = routeKey;
  activePageContext = routeDetails;
  activeAttentionContext = {};

  void logAnalyticsEvent("portfolio_route_view", {
    ...routeDetails,
    previous_page_group: typeof previousPageGroup === "string" ? previousPageGroup : "entry",
    previous_page_slug: typeof previousPageSlug === "string" ? previousPageSlug : "entry",
    route_step: routeStep,
  });
}

// A click (card, list, Selected Work) is followed by the project page's own
// load event; record one open per project per visit to it, not two.
const PROJECT_OPEN_DEDUPE_MS = 10_000;
let lastProjectOpen: { slug: string; at: number } | null = null;

export function trackProjectOpen(input: ProjectOpenInput): void {
  const now = Date.now();
  if (
    input.openSurface === "project_page" &&
    lastProjectOpen?.slug === input.projectSlug &&
    now - lastProjectOpen.at < PROJECT_OPEN_DEDUPE_MS
  ) {
    return;
  }
  lastProjectOpen = { slug: input.projectSlug, at: now };

  void logAnalyticsEvent("project_open", {
    project_slug: input.projectSlug,
    project_title: input.projectTitle,
    open_surface: input.openSurface,
  });
}

export function trackProjectResourceClick(input: ProjectResourceClickInput): void {
  void logAnalyticsEvent("project_resource_click", {
    project_slug: input.projectSlug,
    project_title: input.projectTitle,
    resource_type: input.resourceType?.toLowerCase(),
    resource_label: input.resourceLabel,
    destination_domain: normalizeDomain(input.resourceUrl),
    is_internal: toStringFlag(input.isInternal),
  });
}

export function trackArticleOpen(input: ArticleOpenInput): void {
  void logAnalyticsEvent("article_open", {
    article_slug: input.articleSlug,
    article_title: input.articleTitle,
  });
}

export function trackArticleSourceClick(input: ArticleSourceClickInput): void {
  void logAnalyticsEvent("article_source_click", {
    article_slug: input.articleSlug,
    article_title: input.articleTitle,
    destination_domain: normalizeDomain(input.destinationUrl),
  });
}

export function trackSocialClick(input: SocialClickInput): void {
  void logAnalyticsEvent("social_click", {
    social_network: input.socialNetwork.toLowerCase(),
    destination_domain: normalizeDomain(input.destinationUrl),
  });
}

/** A download link was activated; browsers do not report whether the file finished saving. */
export function trackResumeDownload(resumeUrl: string, surface?: string): void {
  void logAnalyticsEvent("resume_download", {
    destination_domain: normalizeDomain(resumeUrl),
    resume_url: resumeUrl,
    surface,
  });
}

/** The PDF was opened for viewing (new tab), not saved. */
export function trackResumeView(resumeUrl: string, surface?: string): void {
  void logAnalyticsEvent("resume_view", {
    destination_domain: normalizeDomain(resumeUrl),
    resume_url: resumeUrl,
    surface,
  });
}

export function trackAutomationSignal(signalReason: string): void {
  // Kept as a no-op compatibility export. Automated browsers are now
  // suppressed before Firebase initializes, so recording a diagnostic event
  // can no longer contaminate the production property.
  void signalReason;
}

// ---------------------------------------------------------------------------
// Additional events (contact, newsletter, outbound, demo/github clicks)
// ---------------------------------------------------------------------------

type OutboundLinkInput = {
  destinationUrl: string;
  surface: string;
  label?: string;
};

export function trackOutboundLink(input: OutboundLinkInput): void {
  void logAnalyticsEvent("outbound_click", {
    destination_domain: normalizeDomain(input.destinationUrl),
    destination_url: input.destinationUrl.slice(0, 500),
    surface: input.surface,
    link_label: input.label?.slice(0, 200),
  });
}

export function trackContactClick(surface: string): void {
  void logAnalyticsEvent("contact_click", { surface });
}

type ContactSubmitStatus = "success" | "error" | "rate_limited" | "invalid";

/**
 * `contact_submit` is recorded only after the API accepted the message, so it
 * can be counted as a conversion. Failures use a separate diagnostic event.
 */
export function trackContactSubmit(status: ContactSubmitStatus, errorCode?: string): void {
  void logAnalyticsEvent(status === "success" ? "contact_submit" : "contact_submit_failed", {
    status,
    error_code: errorCode,
  });
}

type NewsletterStatus = "success" | "error" | "duplicate" | "invalid" | "rate_limited";

export function trackNewsletterInterest(status: NewsletterStatus): void {
  void logAnalyticsEvent(status === "success" ? "newsletter_interest" : "newsletter_interest_failed", { status });
}

type ProjectFilterInput = {
  filterType: "search" | "focus" | "evidence" | "domain" | "status" | "tag" | "sort" | "view" | "group";
  filterValue: string;
  resultCount?: number;
};

/**
 * Archive search/filter use. Search terms are normalized and truncated to
 * short keywords (letters, digits, + . # -), never free-form text.
 */
export function trackProjectFilter(input: ProjectFilterInput): void {
  const value =
    input.filterType === "search"
      ? input.filterValue.toLowerCase().replace(/[^a-z0-9+.#\- ]/g, "").replace(/\s+/g, " ").trim().slice(0, 40)
      : input.filterValue.slice(0, 60);
  if (!value) return;
  void logAnalyticsEvent("portfolio_filter_change", {
    filter_type: input.filterType,
    filter_value: value,
    result_count: input.resultCount,
  });
}

type ProjectMediaInput = {
  projectSlug?: string;
  projectTitle?: string;
  mediaKind: "image" | "video" | "3d_model" | "audio" | "other";
  mediaUrl?: string;
  surface?: string;
};

export function trackProjectMediaPlay(input: ProjectMediaInput): void {
  void logAnalyticsEvent("project_media_play", {
    project_slug: input.projectSlug,
    project_title: input.projectTitle,
    media_kind: input.mediaKind,
    destination_domain: input.mediaUrl ? normalizeDomain(input.mediaUrl) : undefined,
    surface: input.surface,
  });
}

export function trackProjectDemoClick(input: { projectSlug?: string; destinationUrl: string }): void {
  void logAnalyticsEvent("project_demo_click", {
    project_slug: input.projectSlug,
    destination_domain: normalizeDomain(input.destinationUrl),
  });
}

export function trackGitHubClick(input: { destinationUrl: string; surface: string }): void {
  void logAnalyticsEvent("github_click", {
    destination_domain: normalizeDomain(input.destinationUrl),
    surface: input.surface,
  });
}

export function setActiveAnalyticsSection(input: SectionAnalyticsInput): void {
  activeAttentionContext = {
    section_key: sanitizeAnalyticsText(input.sectionKey),
    section_label: sanitizeAnalyticsText(input.sectionLabel, 120),
    project_slug: sanitizeAnalyticsText(input.projectSlug),
    project_title: sanitizeAnalyticsText(input.projectTitle, 120),
    article_slug: sanitizeAnalyticsText(input.articleSlug),
    article_title: sanitizeAnalyticsText(input.articleTitle, 120),
    item_id: sanitizeAnalyticsText(input.itemId),
    item_type: sanitizeAnalyticsText(input.itemType),
    collection_key: sanitizeAnalyticsText(input.collectionKey),
    media_role: sanitizeAnalyticsText(input.mediaRole),
    surface: sanitizeAnalyticsText(input.surface),
  };
}

export function trackScrollDepth(input: ScrollDepthInput): void {
  void logAnalyticsEvent("portfolio_scroll_depth", {
    scroll_percent: input.scrollPercent,
  });
}

export function trackSectionView(input: SectionAnalyticsInput): void {
  setActiveAnalyticsSection(input);
  void logAnalyticsEvent("portfolio_section_view", {
    section_key: sanitizeAnalyticsText(input.sectionKey),
    section_label: sanitizeAnalyticsText(input.sectionLabel, 120),
    project_slug: sanitizeAnalyticsText(input.projectSlug),
    project_title: sanitizeAnalyticsText(input.projectTitle, 120),
    article_slug: sanitizeAnalyticsText(input.articleSlug),
    article_title: sanitizeAnalyticsText(input.articleTitle, 120),
    item_id: sanitizeAnalyticsText(input.itemId),
    item_type: sanitizeAnalyticsText(input.itemType),
    collection_key: sanitizeAnalyticsText(input.collectionKey),
    media_role: sanitizeAnalyticsText(input.mediaRole),
    surface: sanitizeAnalyticsText(input.surface),
  });
}

export function trackSectionEngaged(input: SectionEngagementInput): void {
  setActiveAnalyticsSection(input);
  void logAnalyticsEvent("portfolio_section_engaged", {
    section_key: sanitizeAnalyticsText(input.sectionKey),
    section_label: sanitizeAnalyticsText(input.sectionLabel, 120),
    project_slug: sanitizeAnalyticsText(input.projectSlug),
    project_title: sanitizeAnalyticsText(input.projectTitle, 120),
    article_slug: sanitizeAnalyticsText(input.articleSlug),
    article_title: sanitizeAnalyticsText(input.articleTitle, 120),
    item_id: sanitizeAnalyticsText(input.itemId),
    item_type: sanitizeAnalyticsText(input.itemType),
    collection_key: sanitizeAnalyticsText(input.collectionKey),
    media_role: sanitizeAnalyticsText(input.mediaRole),
    surface: sanitizeAnalyticsText(input.surface),
    engagement_bucket: sanitizeAnalyticsText(input.engagementBucket),
    visible_time_sec: input.visibleTimeSec,
  });
}

export function trackProjectItemOpen(input: ProjectItemOpenInput): void {
  void logAnalyticsEvent("project_item_open", {
    project_slug: sanitizeAnalyticsText(input.projectSlug),
    project_title: sanitizeAnalyticsText(input.projectTitle, 120),
    article_slug: sanitizeAnalyticsText(input.articleSlug),
    article_title: sanitizeAnalyticsText(input.articleTitle, 120),
    item_id: sanitizeAnalyticsText(input.itemId),
    item_type: sanitizeAnalyticsText(input.itemType),
    item_label: sanitizeAnalyticsText(input.itemLabel, 120),
    collection_key: sanitizeAnalyticsText(input.collectionKey),
    surface: sanitizeAnalyticsText(input.surface),
    interaction_type: sanitizeAnalyticsText(input.interactionType || "open"),
  });
}

export function trackProjectMediaProgress(input: ProjectMediaProgressInput): void {
  void logAnalyticsEvent("project_media_progress", {
    project_slug: sanitizeAnalyticsText(input.projectSlug),
    project_title: sanitizeAnalyticsText(input.projectTitle, 120),
    article_slug: sanitizeAnalyticsText(input.articleSlug),
    article_title: sanitizeAnalyticsText(input.articleTitle, 120),
    media_kind: input.mediaKind,
    media_role: sanitizeAnalyticsText(input.mediaRole),
    destination_domain: input.mediaUrl ? normalizeDomain(input.mediaUrl) : undefined,
    progress_percent: input.progressPercent,
    item_id: sanitizeAnalyticsText(input.itemId),
    item_type: sanitizeAnalyticsText(input.itemType),
    collection_key: sanitizeAnalyticsText(input.collectionKey),
    surface: sanitizeAnalyticsText(input.surface),
    interaction_type: sanitizeAnalyticsText(input.interactionType),
  });
}
