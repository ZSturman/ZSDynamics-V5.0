import { expect, type ConsoleMessage, type Page } from "@playwright/test";

interface RuntimeIssueTracker {
  pageErrors: string[];
  consoleErrors: string[];
  stop: () => void;
}

interface RouteReadyOptions {
  route: string;
  readinessDescription: string;
  ready: () => Promise<void>;
}

function trackRuntimeIssues(page: Page): RuntimeIssueTracker {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  const onPageError = (error: Error) => {
    pageErrors.push(error.message);
  };

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== "error") {
      return;
    }

    consoleErrors.push(message.text());
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  return {
    pageErrors,
    consoleErrors,
    stop: () => {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    },
  };
}

async function detectKnownFailure(page: Page): Promise<string | null> {
  const candidates = [
    {
      text: "Runtime Error",
      message: "Next.js runtime error overlay detected.",
    },
    {
      text: "Application error",
      message: "Application error overlay detected.",
    },
    {
      text: "Cannot find module './vendor-chunks/lucide-react.js'",
      message: "Missing vendor chunk runtime error detected.",
    },
    {
      text: "Error loading project.",
      message: "Project route rendered the graceful error fallback instead of project content.",
    },
    {
      text: "Project not found.",
      message: "Project route rendered the not-found fallback instead of the requested project.",
    },
  ];

  for (const candidate of candidates) {
    const isVisible = await page.getByText(candidate.text, { exact: false }).first().isVisible().catch(() => false);
    if (isVisible) {
      return candidate.message;
    }
  }

  return null;
}

function formatRuntimeIssues(tracker: RuntimeIssueTracker): string {
  const details: string[] = [];

  if (tracker.pageErrors.length > 0) {
    details.push(`pageerror: ${tracker.pageErrors[0]}`);
  }

  if (tracker.consoleErrors.length > 0) {
    details.push(`console: ${tracker.consoleErrors[0]}`);
  }

  return details.length > 0 ? ` ${details.join(" | ")}` : "";
}

async function gotoRouteReady(page: Page, options: RouteReadyOptions): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const tracker = trackRuntimeIssues(page);

    try {
      await page.goto(options.route);
      await page.waitForLoadState("domcontentloaded");

      const earlyFailure = await detectKnownFailure(page);
      if (earlyFailure) {
        throw new Error(earlyFailure);
      }

      await options.ready();

      const lateFailure = await detectKnownFailure(page);
      if (lateFailure) {
        throw new Error(lateFailure);
      }

      return;
    } catch (error) {
      const knownFailure = await detectKnownFailure(page);
      const reason = knownFailure || (error instanceof Error ? error.message : String(error));

      if (attempt === 2) {
        throw new Error(`${options.readinessDescription} ${reason}${formatRuntimeIssues(tracker)}`.trim());
      }

      await page.reload();
    } finally {
      tracker.stop();
    }
  }
}

export async function gotoHomeReady(page: Page): Promise<void> {
  await gotoRouteReady(page, {
    route: "/",
    readinessDescription: "Home route did not become ready after retry.",
    ready: async () => {
      await expect(page.getByRole("heading", { name: "All Projects" })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText("Loading projects…")).toHaveCount(0);
    },
  });
}

export async function gotoProjectReady(
  page: Page,
  projectId: string,
  projectTitle: string,
  route = `/projects/${projectId}`
): Promise<void> {
  await gotoRouteReady(page, {
    route,
    readinessDescription: `Project route did not become ready for '${projectTitle}' after retry.`,
    ready: async () => {
      await expect(page.getByRole("heading", { name: projectTitle }).first()).toBeVisible({ timeout: 15_000 });
    },
  });
}
