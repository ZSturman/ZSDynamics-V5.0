/**
 * Hosted media URL resolver.
 *
 * The Python build pipeline writes ``public/media-urls.json`` mapping
 * public-relative paths (e.g. ``/projects/foo/icon-optimized.webp``) to fully
 * qualified hosted URLs (e.g. ``https://media.zacharysturman.com/...``).
 *
 * This module reads that map once at server-render time and exposes
 * ``resolveHostedUrl(localPath)``. When a hosted URL is present the renderer
 * prefers it; otherwise the local public path is used as the fallback. Both
 * static export builds and dev mode get a consistent answer.
 */

type MediaUrlMap = Record<string, string>;

let cachedMap: MediaUrlMap | null = null;

function loadMap(): MediaUrlMap {
  if (cachedMap) return cachedMap;
  if (typeof window !== "undefined") {
    cachedMap = {};
    return cachedMap;
  }
  try {
    const { readFileSync, existsSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const filePath = join(process.cwd(), "public", "media-urls.json");
    if (!existsSync(filePath)) {
      cachedMap = {};
      return cachedMap;
    }
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const urls = parsed && typeof parsed === "object" ? parsed.urls : null;
    cachedMap = urls && typeof urls === "object" ? (urls as MediaUrlMap) : {};
  } catch {
    cachedMap = {};
  }
  return cachedMap;
}

/**
 * Return a hosted URL for a local public path if one exists; otherwise undefined.
 * Accepts paths with or without a leading "/".
 */
export function resolveHostedUrl(localPath: string | undefined | null): string | undefined {
  if (!localPath) return undefined;
  if (localPath.startsWith("http://") || localPath.startsWith("https://")) return undefined;
  const map = loadMap();
  if (Object.keys(map).length === 0) return undefined;
  const normalized = localPath.startsWith("/") ? localPath : `/${localPath}`;
  return map[normalized];
}

/**
 * Prefer the hosted URL if available; fall back to the local path. Pass-through
 * for paths that are already absolute external URLs.
 */
export function preferHostedUrl(localPath: string): string {
  if (localPath.startsWith("http://") || localPath.startsWith("https://")) return localPath;
  return resolveHostedUrl(localPath) ?? localPath;
}

/** Return all hosted hostnames (used to extend image-hostnames at build time). */
export function getHostedHostnames(): string[] {
  const map = loadMap();
  const hosts = new Set<string>();
  for (const url of Object.values(map)) {
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      /* ignore */
    }
  }
  return Array.from(hosts);
}
