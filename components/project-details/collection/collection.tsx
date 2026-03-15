import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaDisplay } from "@/components/ui/media-display";
import { Project, CollectionItem } from "@/types";
import CollectionItemCard from "./collection-item";
import { extractPathValue, formatTextWithNewlines, isImageFile, isVideoFile, resolveProjectAssetPath, getOptimizedImageExt } from "@/lib/utils";
import { getProjectCollectionEntries } from "@/lib/project-collections";

interface CollectionProps {
  project: Project;
  inModal?: boolean;
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

/** Generate initials from a collection name for use as a placeholder thumbnail. */
function getCollectionInitials(name: string): string {
  const words = name.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Placeholder shown when a collection has no thumbnail image. */
function CollectionPlaceholder({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const initials = getCollectionInitials(name);
  if (size === "sm") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground select-none">
        {initials}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-2xl font-bold text-muted-foreground select-none">
      {initials}
    </div>
  );
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
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/30">
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
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
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
    <div className="space-y-1.5">
      <h3 className="text-xl md:text-2xl font-semibold tracking-tight">{label}</h3>
      {summary && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {formatTextWithNewlines(summary)}
        </p>
      )}
      {description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        />
      ))}
    </div>
  );
}

export function Collection({ project, inModal }: CollectionProps) {
  const collectionEntries = getProjectCollectionEntries(project);
  if (collectionEntries.length === 0) {
    return null;
  }

  const folderName = project.folderName || project.id;
  const collections = collectionEntries
    .map(({ key, data }) => getCollectionMeta(key, data as CollectionShape, folderName))
    .filter((collection) => collection.items.length > 0);

  if (collections.length === 0) {
    return null;
  }

  // Single collection: show hero-style thumbnail + content directly
  if (collections.length === 1) {
    const collection = collections[0];
    return (
      <div className="space-y-6">
        <CollectionHeader
          label={collection.label}
          summary={collection.summary}
          description={collection.description}
          thumbnail={collection.thumbnail}
          hero={collection.hero}
          isSingleCollection
        />
        <CollectionItemGrid collection={collection} project={project} inModal={inModal} folderName={folderName} />
      </div>
    );
  }

  // Multiple collections: tabs with thumbnail previews in tab triggers
  return (
    <Tabs defaultValue={collections[0].key} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
        {collections.map((collection) => (
          <TabsTrigger
            key={collection.key}
            value={collection.key}
            className="rounded-md px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
          >
            {collection.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {collections.map((collection) => (
        <TabsContent key={collection.key} value={collection.key} className="mt-4 space-y-6">
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
  );
}
