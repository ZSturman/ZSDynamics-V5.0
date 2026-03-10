import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaDisplay } from "@/components/ui/media-display";
import { Project, CollectionItem } from "@/types";
import CollectionItemCard from "./collection-item";
import { extractPathValue, formatTextWithNewlines, isImageFile, isVideoFile, resolveProjectAssetPath } from "@/lib/utils";
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

  return {
    key: collectionName,
    label,
    summary,
    description,
    thumbnail: toCollectionMediaPath(thumbnailPath, folderName, collectionName),
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
    return rawPath.replace(/\.[^.]+$/, "-optimized.webp");
  }

  if (isVideoFile(rawPath)) {
    return rawPath.replace(/\.[^.]+$/, "-optimized.mp4");
  }

  return rawPath;
}

function CollectionHeader({ label, summary, description, thumbnail }: Omit<CollectionMeta, "key" | "items">) {
  return (
    <div className="space-y-3">
      {thumbnail && (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <div className="relative aspect-[16/7] w-full">
            <MediaDisplay
              src={thumbnail}
              alt={`${label} thumbnail`}
              fill
              className="object-cover"
              autoPlay={false}
              loop={false}
            />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">{label}</h3>
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

  if (collections.length === 1) {
    const collection = collections[0];
    return (
      <div className="space-y-6">
        <CollectionHeader
          label={collection.label}
          summary={collection.summary}
          description={collection.description}
          thumbnail={collection.thumbnail}
        />
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
      </div>
    );
  }

  return (
    <Tabs defaultValue={collections[0].key} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {collections.map((collection) => (
          <TabsTrigger key={collection.key} value={collection.key} className="gap-2">
            {collection.label}
            <span className="text-xs text-muted-foreground">({collection.items.length})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {collections.map((collection) => (
        <TabsContent key={collection.key} value={collection.key} className="space-y-6">
          <CollectionHeader
            label={collection.label}
            summary={collection.summary}
            description={collection.description}
            thumbnail={collection.thumbnail}
          />
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
        </TabsContent>
      ))}
    </Tabs>
  );
}
