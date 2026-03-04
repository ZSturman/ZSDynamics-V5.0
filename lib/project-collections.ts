import type { CollectionItem, Project } from "@/types";

type CollectionMapValue =
  | CollectionItem[]
  | {
      label?: string;
      summary?: string;
      description?: string;
      images?: Record<string, unknown>;
      items?: CollectionItem[];
      assets?: CollectionItem[];
      [key: string]: unknown;
    };

export interface ProjectCollectionEntry {
  key: string;
  data: CollectionMapValue;
}

function normalizeCollectionObject(value: unknown): Record<string, CollectionMapValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, CollectionMapValue>;
}

function normalizeCollectionArray(value: unknown): ProjectCollectionEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index): ProjectCollectionEntry | null => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const key =
        (typeof record.id === "string" && record.id) ||
        (typeof record.name === "string" && record.name) ||
        (typeof record.label === "string" && record.label) ||
        `collection-${index + 1}`;

      return {
        key,
        data: {
          label: typeof record.label === "string" ? record.label : undefined,
          summary: typeof record.summary === "string" ? record.summary : undefined,
          description: typeof record.description === "string" ? record.description : undefined,
          images: (record.images as Record<string, unknown> | undefined) || {},
          items: Array.isArray(record.items) ? (record.items as CollectionItem[]) : undefined,
          assets: Array.isArray(record.assets) ? (record.assets as CollectionItem[]) : undefined,
        },
      };
    })
    .filter((entry): entry is ProjectCollectionEntry => Boolean(entry));
}

export function getProjectCollectionEntries(project: Project): ProjectCollectionEntry[] {
  const out: ProjectCollectionEntry[] = [];
  const seen = new Set<string>();

  const pushEntry = (key: string, data: CollectionMapValue) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ key, data });
  };

  const collectionMap = normalizeCollectionObject(project.collection);
  Object.entries(collectionMap).forEach(([key, value]) => pushEntry(key, value));

  const collectionArray = normalizeCollectionArray(project.collections);
  collectionArray.forEach(({ key, data }) => pushEntry(key, data));

  if (Array.isArray(project.assets) && project.assets.length > 0) {
    const key = seen.has("assets") ? `assets-${project.assets.length}` : "assets";
    pushEntry(key, {
      label: "Assets",
      summary: "Ungrouped project assets",
      images: {},
      items: project.assets,
    });
  }

  return out;
}

export function hasProjectCollectionItems(project: Project): boolean {
  return getProjectCollectionEntries(project).some(({ data }) => {
    if (Array.isArray(data)) return data.length > 0;

    if (!data || typeof data !== "object") return false;
    const record = data as { items?: unknown; assets?: unknown };
    if (Array.isArray(record.items) && record.items.length > 0) return true;
    if (Array.isArray(record.assets) && record.assets.length > 0) return true;
    return false;
  });
}
