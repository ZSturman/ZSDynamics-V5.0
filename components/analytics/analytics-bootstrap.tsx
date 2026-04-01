"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  initializeAnalytics,
  trackAutomationSignal,
  trackRouteView,
} from "@/lib/firebase-analytics";

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

export function AnalyticsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    initializeAnalytics();

    const automationSignalReason = getAutomationSignalReason();
    if (automationSignalReason) {
      trackAutomationSignal(automationSignalReason);
    }
  }, []);

  useEffect(() => {
    trackRouteView({
      pathname: pathname || "/",
      search,
    });
  }, [pathname, search]);

  return null;
}
