import type { ConsoleMessage, Page, Request, Response, TestInfo } from "@playwright/test";

export interface MediaAssertionContext {
  projectId?: string;
  projectTitle?: string;
  mediaKey?: string;
  resolvedUrl?: string;
  route?: string;
  scenario: string;
  environment?: string;
  browserProject?: string;
  viewport?: { width: number; height: number };
  baseURL?: string;
  [key: string]: unknown;
}

export interface MediaIssueTracker {
  failedResponses: Array<{ url: string; status: number; resourceType: string }>;
  failedRequests: Array<{ url: string; errorText: string; resourceType: string }>;
  consoleErrors: Array<{ type: string; text: string }>;
  pageErrors: Array<{ message: string; stack?: string }>;
  stop: () => void;
}

export async function attachMediaContext(testInfo: TestInfo, name: string, context: unknown): Promise<void> {
  await testInfo.attach(name, {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(context, null, 2), "utf-8"),
  });
}

export function buildRuntimeContext(page: Page, testInfo: TestInfo, partial: MediaAssertionContext): MediaAssertionContext {
  return {
    ...partial,
    browserProject: testInfo.project.name,
    viewport: page.viewportSize() || undefined,
    baseURL: testInfo.project.use.baseURL,
  };
}

export function trackMediaRuntimeIssues(page: Page): MediaIssueTracker {
  const failedResponses: MediaIssueTracker["failedResponses"] = [];
  const failedRequests: MediaIssueTracker["failedRequests"] = [];
  const consoleErrors: MediaIssueTracker["consoleErrors"] = [];
  const pageErrors: MediaIssueTracker["pageErrors"] = [];

  const onResponse = (response: Response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!isMediaResourceType(resourceType)) return;

    if (response.status() >= 400) {
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        resourceType,
      });
    }
  };

  const onRequestFailed = (request: Request) => {
    const resourceType = request.resourceType();
    if (!isMediaResourceType(resourceType)) return;

    failedRequests.push({
      url: request.url(),
      errorText: request.failure()?.errorText || "unknown_request_failure",
      resourceType,
    });
  };

  const onConsole = (message: ConsoleMessage) => {
    const type = message.type();
    if (type !== "error" && type !== "warning") return;

    const text = message.text();
    if (!looksMediaRelated(text)) return;

    consoleErrors.push({ type, text });
  };

  const onPageError = (error: Error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  };

  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  return {
    failedResponses,
    failedRequests,
    consoleErrors,
    pageErrors,
    stop: () => {
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

function isMediaResourceType(resourceType: string): boolean {
  return resourceType === "image" || resourceType === "media";
}

function looksMediaRelated(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes("image") ||
    value.includes("media") ||
    value.includes("video") ||
    value.includes("failed to load") ||
    value.includes("net::")
  );
}
