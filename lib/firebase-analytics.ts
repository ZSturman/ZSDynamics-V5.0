"use client";

import type { Analytics } from "firebase/analytics";
import type { FirebaseApp } from "firebase/app";

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
const automationSignalSessionKey = "portfolio.analytics.automation-signal.v1";

let appInstance: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let lastRouteViewKey = "";
let missingConfigWarned = false;

function canUseBrowser(): boolean {
  return typeof window !== "undefined";
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

  if (normalizedPath === "/") {
    return {
      page_group: "home",
      page_slug: searchParams.get("project") || "home",
      has_query: toStringFlag(searchParams.size > 0),
      page_path: normalizedPath,
    };
  }

  if (segments[0] === "articles") {
    return {
      page_group: segments[1] ? "article" : "articles",
      page_slug: segments[1] || "articles",
      has_query: toStringFlag(searchParams.size > 0),
      page_path: normalizedPath,
    };
  }

  if (segments[0] === "projects") {
    return {
      page_group: "project",
      page_slug: segments[1] || "projects",
      has_query: toStringFlag(searchParams.size > 0),
      page_path: normalizedPath,
    };
  }

  if (segments[0] === "work-logs") {
    return {
      page_group: "work_logs",
      page_slug: searchParams.get("project") || "work-logs",
      has_query: toStringFlag(searchParams.size > 0),
      page_path: normalizedPath,
    };
  }

  return {
    page_group: "other",
    page_slug: segments.join("/") || "other",
    has_query: toStringFlag(searchParams.size > 0),
    page_path: normalizedPath,
  };
}

async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!canUseBrowser()) {
    return null;
  }

  if (!analyticsEnabled || !hasCompleteConfig()) {
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
  const analytics = await getAnalyticsInstance();
  if (!analytics) {
    return;
  }

  const analyticsModule = await import("firebase/analytics");
  analyticsModule.logEvent(analytics, name, sanitizeParams(params));
}

export function initializeAnalytics(): void {
  void getAnalyticsInstance();
}

export function trackRouteView(input: RouteViewInput): void {
  const routeKey = `${input.pathname}?${input.search}`;
  if (routeKey === lastRouteViewKey) {
    return;
  }

  lastRouteViewKey = routeKey;
  void logAnalyticsEvent("portfolio_route_view", getRouteDetails(input));
}

export function trackProjectOpen(input: ProjectOpenInput): void {
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

export function trackResumeDownload(resumeUrl: string): void {
  void logAnalyticsEvent("resume_download", {
    destination_domain: normalizeDomain(resumeUrl),
    resume_url: resumeUrl,
  });
}

export function trackAutomationSignal(signalReason: string): void {
  if (!canUseBrowser()) {
    return;
  }

  try {
    if (window.sessionStorage.getItem(automationSignalSessionKey) === signalReason) {
      return;
    }

    window.sessionStorage.setItem(automationSignalSessionKey, signalReason);
  } catch {
    // Ignore storage failures and continue logging once.
  }

  void logAnalyticsEvent("automation_signal", {
    signal_reason: signalReason,
  });
}
