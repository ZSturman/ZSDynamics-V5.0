"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaDisplay } from "@/components/ui/media-display";
import { Project, CollectionItem } from "@/types";
import CollectionItemCard from "./collection-item";
import { CollectionFullscreen } from "./collection-item-fullscreen";
import { extractPathValue, formatTextWithNewlines, isImageFile, isVideoFile, resolveProjectAssetPath, getOptimizedImageExt } from "@/lib/utils";
import { getProjectCollectionEntries } from "@/lib/project-collections";

interface CollectionProps {
  project: Project;
  inModal?: boolean;
  requestedCollectionItemId?: string;
}

type CollectionShape = CollectionItem[] | { items: CollectionItem[]; [key: string]: unknown };

interface CollectionMeta {
  key: string;
  label: string;
  summary?: string;
  description?: string;
  thumbnail?: string;
  hero?: string;
  items: CollectionItem[];
}

interface RequestedCollectionItem {
  collection: CollectionMeta;
  item: CollectionItem;
  index: number;
}

function findCollectionItem(collections: CollectionMeta[], itemId: string | null): RequestedCollectionItem | null {
  if (!itemId) {
    return null;
  }

  for (const collection of collections) {
    const index = collection.items.findIndex((item) => item.id === itemId);
    if (index >= 0) {
      return {
        collection,
        item: collection.items[index],
        index,
      };
    }
  }

  return null;
}

function getCollectionMeta(
  collectionName: string,
  collectionData: CollectionShape | { assets?: CollectionItem[]; [key: string]: unknown },
  folderName: string
): CollectionMeta {
  const isArrayShape = Array.isArray(collectionData);
  const data = isArrayShape ? {} : (collectionData as { [key: string]: unknown });
  const items = isArrayShape
    ? (collectionData as CollectionItem[])
    : (data.items as CollectionItem[] | undefined) || (data.assets as CollectionItem[] | undefined) || [];

  const label = typeof data.label === "string" ? data.label : collectionName;
  const summary = typeof data.summary === "string" ? data.summary : undefined;
  const description = typeof data.description === "string" ? data.description : undefined;

  const images = (data.images as { [key: string]: unknown } | undefined) || {};
  const thumbnailPath = extractPathValue(images.thumbnail);
  const heroPath = extractPathValue(images.hero);

  return {
    key: collectionName,
    label,
    summary,
    description,
    thumbnail: toCollectionMediaPath(thumbnailPath, folderName, collectionName),
    hero: toCollectionMediaPath(heroPath, folderName, collectionName),
    items: [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  };
}

function toCollectionMediaPath(mediaPath: string | undefined, folderName: string, collectionName: string): string | undefined {
  if (!mediaPath) return undefined;
  const rawPath = resolveProjectAssetPath(mediaPath, { folderName, collectionName }) || mediaPath;

  if (rawPath.includes("-optimized") || rawPath.includes("-thumb") || rawPath.includes("-placeholder")) {
    return rawPath;
  }

  if (isImageFile(rawPath)) {
    const ext = getOptimizedImageExt(rawPath);
    return rawPath.replace(/\.[^.]+$/, `-optimized${ext}`);
  }

  if (isVideoFile(rawPath)) {
    return rawPath.replace(/\.[^.]+$/, "-optimized.mp4");
  }

  return rawPath;
}

/** Hero/featured image shown at the top of a collection's content area with overlaid text. */
function CollectionHeroImage({
  src,
  label,
  summary,
  description,
}: {
  src: string;
  label: string;
  summary?: string;
  description?: string;
}) {
  return (
    <div className="relative max-w-full overflow-hidden rounded-lg border border-border/35 bg-card/25">
      <div className="relative aspect-[21/9] w-full">
        <MediaDisplay
          src={src}
          alt={`${label} hero`}
          fill
          className="object-cover"
          autoPlay={false}
          loop={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
          <h3 className="text-lg font-semibold tracking-tight text-white drop-shadow-sm md:text-2xl">
            {label}
          </h3>
          {summary && (
            <p className="mt-1.5 text-sm text-white/80 line-clamp-2">
              {formatTextWithNewlines(summary)}
            </p>
          )}
          {description && !summary && (
            <p className="mt-1.5 text-sm text-white/80 line-clamp-2">
              {formatTextWithNewlines(description)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Header for a single collection or for the selected tab in multi-collection. */
function CollectionHeader({
  label,
  summary,
  description,
  thumbnail,
  hero,
  isSingleCollection,
}: Omit<CollectionMeta, "key" | "items"> & { isSingleCollection?: boolean }) {
  const heroImage = hero || (isSingleCollection ? thumbnail : thumbnail);

  // When we have a hero image, overlay text on it
  if (heroImage) {
    return (
      <CollectionHeroImage
        src={heroImage}
        label={label}
        summary={summary}
        description={description}
      />
    );
  }

  // No image — just render text header
  return (
    <div className="max-w-full space-y-1.5">
      <h3 className="break-words text-lg font-semibold tracking-tight md:text-2xl">{label}</h3>
      {summary && (
        <p className="max-w-full whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {formatTextWithNewlines(summary)}
        </p>
      )}
      {description && (
        <p className="max-w-full whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {formatTextWithNewlines(description)}
        </p>
      )}
    </div>
  );
}

function CollectionItemGrid({
  collection,
  project,
  inModal,
  folderName,
}: {
  collection: CollectionMeta;
  project: Project;
  inModal?: boolean;
  folderName: string;
}) {
  return (
    <div
      className="grid min-w-0 max-w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
      data-analytics-section="collection_item_grid"
      data-analytics-section-label={`${collection.label} item grid`}
      data-analytics-collection-key={collection.key}
    >
      {collection.items.map((item, idx) => (
        <CollectionItemCard
          key={item.id || idx}
          item={item}
          project={project}
          inModal={inModal}
          folderName={folderName}
          collectionName={collection.key}
          allItems={collection.items}
          currentIndex={idx}
          openFromQuery={false}
        />
      ))}
    </div>
  );
}

export function Collection({ project, inModal, requestedCollectionItemId: initialRequestedCollectionItemId }: CollectionProps) {
  const collectionEntries = getProjectCollectionEntries(project, { excludeAssets: true });
  const folderName = project.folderName || project.id;
  const collections = collectionEntries
    .map(({ key, data }) => getCollectionMeta(key, data as CollectionShape, folderName))
    .filter((collection) => collection.items.length > 0);
  const [requestedCollectionItemId, setRequestedCollectionItemId] = useState<string | null>(
    initialRequestedCollectionItemId ?? null
  );
  const requestedCollectionItem = useMemo(
    () => findCollectionItem(collections, requestedCollectionItemId),
    [collections, requestedCollectionItemId]
  );
  const requestedCollectionKey = requestedCollectionItem?.collection.key ?? null;
  const requestedCollectionIndex = requestedCollectionItem?.index ?? null;
  const [selectedCollectionKey, setSelectedCollectionKey] = useState(
    () => requestedCollectionKey || collections[0]?.key || ""
  );
  const [queryFullscreenIndex, setQueryFullscreenIndex] = useState(0);

  useEffect(() => {
    setRequestedCollectionItemId(
      initialRequestedCollectionItemId ?? new URLSearchParams(window.location.search).get("collectionItem")
    );
  }, [initialRequestedCollectionItemId]);

  useEffect(() => {
    if (requestedCollectionIndex !== null) {
      setQueryFullscreenIndex(requestedCollectionIndex);
    }
  }, [requestedCollectionItemId, requestedCollectionIndex]);

  useEffect(() => {
    if (requestedCollectionKey && requestedCollectionKey !== selectedCollectionKey) {
      setSelectedCollectionKey(requestedCollectionKey);
      return;
    }

    if (!collections.some((collection) => collection.key === selectedCollectionKey)) {
      setSelectedCollectionKey(collections[0]?.key || "");
    }
  }, [collections, requestedCollectionKey, selectedCollectionKey]);

  if (collections.length === 0) {
    return null;
  }

  const queryFullscreenItem = requestedCollectionItem
    ? requestedCollectionItem.collection.items[queryFullscreenIndex] || requestedCollectionItem.item
    : null;
  const queryFullscreen =
    requestedCollectionItem && queryFullscreenItem && queryFullscreenItem.type !== "folio" && queryFullscreenItem.type !== "local-link" ? (
      <CollectionFullscreen
        item={queryFullscreenItem}
        onClose={() => {
          setRequestedCollectionItemId(null);
          const params = new URLSearchParams(window.location.search);
          params.delete("collectionItem");
          const query = params.toString();
          window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        }}
        project={project}
        inModal={inModal}
        folderName={folderName}
        collectionName={requestedCollectionItem.collection.key}
        allItems={requestedCollectionItem.collection.items}
        currentIndex={queryFullscreenIndex}
        onNavigate={setQueryFullscreenIndex}
      />
    ) : null;

  // Single collection: show hero-style thumbnail + content directly
  if (collections.length === 1) {
    const collection = collections[0];
    return (
      <div
        className="min-w-0 max-w-full space-y-5 overflow-x-clip md:space-y-6"
        data-analytics-section="collection"
        data-analytics-section-label={collection.label}
        data-analytics-collection-key={collection.key}
      >
        <CollectionHeader
          label={collection.label}
          summary={collection.summary}
          description={collection.description}
          thumbnail={collection.thumbnail}
          hero={collection.hero}
          isSingleCollection
        />
        <CollectionItemGrid collection={collection} project={project} inModal={inModal} folderName={folderName} />
        {queryFullscreen}
      </div>
    );
  }

  // Multiple collections: tabs with thumbnail previews in tab triggers
  return (
    <>
      <Tabs value={selectedCollectionKey} onValueChange={setSelectedCollectionKey} className="w-full max-w-full overflow-x-clip">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
          {collections.map((collection) => (
          <TabsTrigger
              key={collection.key}
              value={collection.key}
              data-analytics-section="collection_tab"
              data-analytics-section-label={collection.label}
              data-analytics-collection-key={collection.key}
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
            >
              {collection.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {collections.map((collection) => (
          <TabsContent
            key={collection.key}
            value={collection.key}
            className="mt-4 min-w-0 max-w-full space-y-5 overflow-x-clip md:space-y-6"
            data-analytics-section="collection"
            data-analytics-section-label={collection.label}
            data-analytics-collection-key={collection.key}
          >
            <CollectionHeader
              label={collection.label}
              summary={collection.summary}
              description={collection.description}
              thumbnail={collection.thumbnail}
              hero={collection.hero}
            />
            <CollectionItemGrid collection={collection} project={project} inModal={inModal} folderName={folderName} />
          </TabsContent>
        ))}
      </Tabs>
      {queryFullscreen}
    </>
  );
}
