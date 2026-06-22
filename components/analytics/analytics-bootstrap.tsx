"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  initializeAnalytics,
  trackAutomationSignal,
  trackOutboundLink,
  trackRouteView,
} from "@/lib/firebase-analytics";
import { captureUtmOnLoad } from "@/lib/analytics-utm";

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

export function AnalyticsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

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

  return null;
}
