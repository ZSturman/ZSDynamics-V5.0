import fs from "node:fs";

import { expect, test } from "@playwright/test";

import {
  enumerateProjectMediaEntries,
  loadCanonicalProjects,
} from "./helpers/project-media-fixtures";
import { attachMediaContext, buildRuntimeContext } from "./helpers/media-diagnostics";

const canonicalProjects = loadCanonicalProjects();
const mediaEntries = enumerateProjectMediaEntries(canonicalProjects);

test.describe("@smoke @matrix media contract", () => {
  test("all project media entries resolve to canonical local/remote paths", async ({ page }, testInfo) => {
    expect(canonicalProjects.length).toBeGreaterThan(0);
    expect(mediaEntries.length).toBeGreaterThan(0);

    for (const entry of mediaEntries) {
      const context = buildRuntimeContext(page, testInfo, {
        scenario: "media-contract-shape",
        route: "/projects/projects.json",
        projectId: entry.projectId,
        projectTitle: entry.projectTitle,
        mediaKey: entry.mediaKey,
        resolvedUrl: entry.resolvedUrl,
        environment: process.env.NODE_ENV || "test",
      });

      try {
        expect(entry.rawValue, "raw media value must be non-empty").toBeTruthy();
        expect(entry.resolvedUrl, "resolved media URL must be non-empty").toBeTruthy();
        expect(entry.resolvedUrl, "resolved media URL should not fall back to placeholder").not.toBe("/placeholder.svg");

        if (!entry.isExternal) {
          expect(entry.absolutePublicPath, "local media path should resolve under public/").not.toBeNull();
          expect(
            fs.existsSync(entry.absolutePublicPath as string),
            `local media file does not exist: ${entry.absolutePublicPath}`
          ).toBeTruthy();
        }
      } catch (error) {
        await attachMediaContext(testInfo, "media-context", context);
        throw error;
      }
    }
  });

  test("media URLs are reachable and return expected payloads", async ({ page, request }, testInfo) => {
    for (const entry of mediaEntries) {
      const context = buildRuntimeContext(page, testInfo, {
        scenario: "media-contract-request",
        route: "/projects/projects.json",
        projectId: entry.projectId,
        projectTitle: entry.projectTitle,
        mediaKey: entry.mediaKey,
        resolvedUrl: entry.resolvedUrl,
        environment: process.env.NODE_ENV || "test",
      });

      try {
        const response = await request.get(entry.resolvedUrl);
        expect(response.status(), `unexpected status for ${entry.resolvedUrl}`).toBeLessThan(400);

        const payload = await response.body();
        expect(payload.byteLength, "media response payload should be non-empty").toBeGreaterThan(0);

        const contentType = (response.headers()["content-type"] || "").toLowerCase();
        if (isImageLike(entry.resolvedUrl)) {
          expect(contentType, `expected image content-type for ${entry.resolvedUrl}`).toContain("image");
        } else if (isVideoLike(entry.resolvedUrl)) {
          expect(contentType, `expected video content-type for ${entry.resolvedUrl}`).toContain("video");
        }
      } catch (error) {
        await attachMediaContext(testInfo, "media-context", context);
        throw error;
      }
    }
  });
});

function isImageLike(url: string): boolean {
  const value = url.toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".tiff", ".bmp", ".heic"].some((ext) =>
    value.includes(ext)
  );
}

function isVideoLike(url: string): boolean {
  const value = url.toLowerCase();
  return [".mp4", ".mov", ".webm", ".avi", ".mkv", ".ogv", ".wmv", ".mpg", ".mpeg"].some((ext) =>
    value.includes(ext)
  );
}
