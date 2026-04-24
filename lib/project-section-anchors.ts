import type { CollectionItem } from "@/types";

export function toProjectSectionId(...parts: Array<number | string | null | undefined>): string {
  const raw = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("-");
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
}

export function getProjectAssetSectionId(item: CollectionItem, index: number): string {
  return `asset-${toProjectSectionId(item.id || item.label || index + 1)}`;
}
