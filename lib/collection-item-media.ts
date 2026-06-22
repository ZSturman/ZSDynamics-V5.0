import type { CollectionItem, Resource } from "@/types";
import {
  extractPathValue,
  getOptimizedImageExt,
  getRenderableProjectPreviewPath,
  isImageFile,
  isVideoFile,
  resolveProjectAssetPath,
} from "@/lib/utils";
import { preferHostedUrl } from "@/lib/media-url-map";

interface CollectionItemPathOptions {
  folderName?: string;
  collectionName?: string;
}

function getPathOptions(item: CollectionItem, options?: CollectionItemPathOptions) {
  return {
    folderName: options?.folderName,
    collectionName: options?.collectionName,
    itemId: item.id,
  };
}

function trimText(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function isLinkLikeItem(item: CollectionItem): boolean {
  return item.type === "url-link" || item.type === "local-link" || item.type === "folio";
}

function isExternalUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

export function getCollectionItemTextContent(item: CollectionItem): {
  oneLiner?: string;
  summary?: string;
} {
  return {
    oneLiner: trimText(item.oneLiner),
    summary: trimText(item.summary),
  };
}

export function getCollectionItemResources(item: CollectionItem): Resource[] {
  const resources: Resource[] = [];

  if (Array.isArray(item.resources)) {
    resources.push(...item.resources);
  }

  if (item.resource) {
    resources.push(item.resource);
  }

  const deduped: Resource[] = [];
  const seen = new Set<string>();

  for (const resource of resources) {
    if (!resource?.url || !resource.label) {
      continue;
    }

    const dedupeKey = `${resource.url}::${resource.label}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(resource);
  }

  return deduped;
}

export function getCollectionItemResolvedPath(
  item: CollectionItem,
  options?: CollectionItemPathOptions,
): string | undefined {
  const pathOptions = getPathOptions(item, options);

  if (item.path) {
    const resolvedPath = resolveProjectAssetPath(item.path, pathOptions);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  if (item.filePath) {
    const resolvedPath = resolveProjectAssetPath(item.filePath, pathOptions);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  if (item.relativePath) {
    const resolvedPath = resolveProjectAssetPath(item.relativePath, pathOptions);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  if (isLinkLikeItem(item)) {
    const recordItem = item as Record<string, unknown>;
    const candidateUrl = trimText(typeof recordItem.url === "string" ? recordItem.url : undefined);
    const candidateHref = trimText(typeof recordItem.href === "string" ? recordItem.href : undefined);
    if (candidateUrl) {
      return candidateUrl;
    }
    if (candidateHref) {
      return candidateHref;
    }

    const firstResource = getCollectionItemResources(item)[0];
    if (firstResource?.url) {
      return firstResource.url;
    }
  }

  const thumbnailPath = extractPathValue(item.thumbnail);
  if (thumbnailPath) {
    const resolvedThumbnail = resolveProjectAssetPath(thumbnailPath, pathOptions);
    if (resolvedThumbnail) {
      return resolvedThumbnail;
    }
  }

  return undefined;
}

export function getCollectionItemOptimizedPath(
  item: CollectionItem,
  options?: CollectionItemPathOptions,
): string | undefined {
  const resolvedPath = getCollectionItemResolvedPath(item, options);
  if (!resolvedPath || isExternalUrl(resolvedPath)) {
    return resolvedPath;
  }

  if (
    resolvedPath.includes("-optimized") ||
    resolvedPath.includes("-thumb") ||
    resolvedPath.includes("-placeholder")
  ) {
    return preferHostedUrl(resolvedPath);
  }

  if (isVideoFile(resolvedPath)) {
    return preferHostedUrl(resolvedPath.replace(/\.[^.]+$/, "-optimized.mp4"));
  }

  if (resolvedPath.match(/\.(obj|gltf)$/i)) {
    return preferHostedUrl(resolvedPath.replace(/\.[^.]+$/, ".glb"));
  }

  if (isImageFile(resolvedPath)) {
    const ext = getOptimizedImageExt(resolvedPath);
    return preferHostedUrl(resolvedPath.replace(/\.[^.]+$/, `-optimized${ext}`));
  }

  return preferHostedUrl(resolvedPath);
}

function toVideoPosterPath(path: string | undefined): string | undefined {
  if (!path || isExternalUrl(path)) {
    return undefined;
  }

  const normalizedPath = path.replace(/-optimized(?=\.[^.]+$)/, "");
  return preferHostedUrl(normalizedPath.replace(/\.[^.]+$/, "-thumb.jpg"));
}

function getCollectionItemResolvedThumbnail(
  item: CollectionItem,
  options?: CollectionItemPathOptions,
): string | undefined {
  const thumbnailPath = extractPathValue(item.thumbnail);
  if (!thumbnailPath) {
    return undefined;
  }

  return resolveProjectAssetPath(thumbnailPath, getPathOptions(item, options)) || thumbnailPath;
}

export function getCollectionItemPosterPath(
  item: CollectionItem,
  options?: CollectionItemPathOptions,
): string | undefined {
  const resolvedThumbnail = getCollectionItemResolvedThumbnail(item, options);
  if (resolvedThumbnail) {
    if (isVideoFile(resolvedThumbnail)) {
      return toVideoPosterPath(resolvedThumbnail);
    }

    return getRenderableProjectPreviewPath(resolvedThumbnail);
  }

  const resolvedPath = getCollectionItemResolvedPath(item, options);
  if (!resolvedPath) {
    return undefined;
  }

  if (isVideoFile(resolvedPath)) {
    return toVideoPosterPath(resolvedPath);
  }

  if (isImageFile(resolvedPath)) {
    return getRenderableProjectPreviewPath(resolvedPath);
  }

  return undefined;
}

export function getCollectionItemPreviewFrames(
  item: CollectionItem,
  options?: CollectionItemPathOptions,
): string[] {
  if (!Array.isArray(item.previewFrames)) {
    return [];
  }

  return item.previewFrames
    .map((frame) => resolveProjectAssetPath(frame, getPathOptions(item, options)) || extractPathValue(frame))
    .filter((frame): frame is string => Boolean(frame));
}

export function getCollectionItemPreviewIntervalMs(item: CollectionItem): number {
  const interval = typeof item.previewIntervalMs === "number" ? item.previewIntervalMs : 650;
  return Math.min(Math.max(interval, 180), 2000);
}
