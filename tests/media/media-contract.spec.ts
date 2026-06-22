import fs from "node:fs";
import path from "node:path";

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

  test("collection video items publish preview frame sequences for runtime hover previews", async ({ page }, testInfo) => {
    const videoItems = getCollectionVideoEntries(canonicalProjects);
    expect(videoItems.length).toBeGreaterThan(0);

    for (const item of videoItems) {
      const context = buildRuntimeContext(page, testInfo, {
        scenario: "collection-video-preview-frame-contract",
        route: "/projects/projects.json",
        projectId: item.projectId,
        projectTitle: item.projectTitle,
        mediaKey: item.itemId,
        resolvedUrl: item.previewFrames[0] || "",
        environment: process.env.NODE_ENV || "test",
      });

      try {
        expect(item.previewFrames.length, `collection video ${item.itemId} should have at least two preview frames`).toBeGreaterThan(1);
        expect(item.previewIntervalMs, `collection video ${item.itemId} should define preview timing`).toBeGreaterThan(0);

        for (const frame of item.previewFrames) {
          expect(frame.startsWith("/"), `preview frame should resolve to a public asset path: ${frame}`).toBeTruthy();
          const absolutePath = path.join(process.cwd(), "public", frame.replace(/^\//, ""));
          expect(fs.existsSync(absolutePath), `preview frame file does not exist: ${absolutePath}`).toBeTruthy();
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

function getCollectionVideoEntries(projects: Array<Record<string, unknown>>) {
  const entries: Array<{
    projectId: string;
    projectTitle: string;
    itemId: string;
    previewFrames: string[];
    previewIntervalMs: number;
  }> = [];

  for (const project of projects) {
    const projectId = typeof project.id === "string" ? project.id : undefined;
    const projectTitle = typeof project.title === "string" ? project.title : undefined;
    const folderName = typeof project.folderName === "string" && project.folderName.trim() ? project.folderName : projectId;
    const collections =
      project.collection && typeof project.collection === "object"
        ? (project.collection as Record<string, unknown>)
        : {};

    if (!projectId || !projectTitle || !folderName) {
      continue;
    }

    for (const [collectionName, value] of Object.entries(collections)) {
      const items = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as { items?: unknown[] }).items)
        ? (value as { items: unknown[] }).items
        : [];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        const normalizedItem = item as {
          id?: unknown;
          type?: unknown;
          previewFrames?: unknown;
          previewIntervalMs?: unknown;
        };
        if (normalizedItem.type !== "video" || typeof normalizedItem.id !== "string") {
          continue;
        }

        const previewFrames = Array.isArray(normalizedItem.previewFrames)
          ? normalizedItem.previewFrames
              .map((frame) => {
                if (typeof frame === "string") {
                  return frame.trim();
                }
                if (frame && typeof frame === "object" && typeof (frame as { path?: unknown }).path === "string") {
                  return String((frame as { path: string }).path).trim();
                }
                return "";
              })
              .filter(Boolean)
              .map((frame) =>
                frame.startsWith("/")
                  ? frame
                  : `/projects/${folderName}/${collectionName}/${normalizedItem.id}/${frame}`
              )
          : [];

        entries.push({
          projectId,
          projectTitle,
          itemId: normalizedItem.id,
          previewFrames,
          previewIntervalMs:
            typeof normalizedItem.previewIntervalMs === "number" ? normalizedItem.previewIntervalMs : 0,
        });
      }
    }
  }

  return entries;
}
