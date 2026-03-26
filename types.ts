export type ResourceType = string;

export interface Resource {
  id?: string;
  type: ResourceType;
  label: string;
  url: string;
  category?: string;
}

export interface ProjectArticleReference {
  title: string;
  slug: string;
  href: string;
  sourceUrl: string;
}

export interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt?: string | null;
  updatedAt: string;
  tags?: string[];
  projectIds?: string[];
  sourceUrl: string;
  href: string;
  coverImage?: string;
}

export type CollectionItemType =
  | "image"
  | "video"
  | "3d-model"
  | "game"
  | "text"
  | "audio"
  | "url-link"
  | "local-link"
  | "folio";

export type CollectionItem = {
  id: string;
  order?: number;
  path?: string; // Main path for the item (can be image, video, or other media)
  relativePath?: string;
  filePath?: string | { path?: string }; // Alternative path structure (simplified from legacy object format)
  label?: string;
  summary?: string;
  thumbnail?: string | { path?: string }; // Can be image or video
  resource?: Resource; // Single resource (legacy)
  resources?: Resource[]; // Multiple resources
  url?: string;
  type: CollectionItemType;
  loop?: boolean; // Whether video/animation should loop
  autoPlay?: boolean; // Whether video should autoplay (defaults to true for thumbnails/banners/posters)
};

export interface WorkLog {
  id: string;
  title: string;
  entry?: string;
  url?: string;
  assetUrl?: string;
  date?: string;
  sessionStart?: string;
  sessionEnd?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  sessionType?: string[];
  whatHappened?: string;
  problems?: string;
  nextStep?: string;
  feelGoodAboutWork?: number;
  accomplishedWhatYouWanted?: number;
  assets?: Array<{
    id?: string;
    label?: string;
    name?: string;
    type?: string;
    url?: string;
    path?: string;
    filePath?: string | { path?: string };
    relativePath?: string;
    thumbnail?: string | { path?: string };
    summary?: string;
  }>;
  resource?: Resource;
  resources?: Resource[];
}



export interface Project {
  id: string;
  folderName?: string;       // The actual folder name in public/projects/ (slug_id)
  filePath?: string;
  title: string;
  subtitle?: string;
  isPublic?: boolean;
  summary: string;
  oneLiner?: string;
  domain: string;
  category?: string;
  status: string;
  phase?: string;
  featured?: boolean;
  requiresFollowUp?: boolean;
  createdAt: string | null;           // ISO 8601 or timestamp
  updatedAt: string | null;           // ISO 8601 or timestamp
  featuredOrder?: number;
  
  assetsFolder?: string;
  
  images?: {
    thumbnail?: string; // Can be image (including GIF) or video
    banner?: string; // Can be image (including GIF) or video
    hero?: string; // Can be image (including GIF) or video
    poster?: string; // Can be image (including GIF) or video
    posterPortrait?: string; // Can be image (including GIF) or video
    posterLandscape?: string; // Can be image (including GIF) or video
    icon?: string; // Can be image (including GIF) or video
    [k: string]: string | undefined; // Other images/videos
  };
  
  // Video/animation settings for images that are actually videos
  imageSettings?: {
    thumbnail?: { loop?: boolean; autoPlay?: boolean };
    banner?: { loop?: boolean; autoPlay?: boolean };
    hero?: { loop?: boolean; autoPlay?: boolean };
    poster?: { loop?: boolean; autoPlay?: boolean };
    posterPortrait?: { loop?: boolean; autoPlay?: boolean };
    posterLandscape?: { loop?: boolean; autoPlay?: boolean };
    icon?: { loop?: boolean; autoPlay?: boolean };
    [k: string]: { loop?: boolean; autoPlay?: boolean } | undefined;
  };
  
  tags?: string[];
  mediums?: string[];
  genres?: string[];
  topics?: string[];
  subjects?: string[];
  
  description?: string;
  story?: string;
  resources?: Resource[];
  
  collection?: {
    [collectionName: string]: CollectionItem[] | { items: CollectionItem[]; [key: string]: unknown };
  };
  collections?: Array<{
    id?: string;
    name?: string;
    label?: string;
    summary?: string;
    description?: string;
    images?: { [k: string]: string | { path?: string } | undefined };
    items?: CollectionItem[];
    assets?: CollectionItem[];
  }>;
  assets?: CollectionItem[];
  workLogs?: WorkLog[];
  articles?: ProjectArticleReference[];

  details?: [
    {
      label: string;
      value: string | string[] | Record<string, unknown>;
    }
  ]
}
