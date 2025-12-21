export type ResourceType = string;

export interface Resource {
  id?: string;
  type: ResourceType;
  label: string;
  url: string;
  category?: string;
}

export type CollectionItemType =
  | "image"
  | "video"
  | "3d-model"
  | "game"
  | "text"
  | "audio"
  | "url-link"
  | "folio";

export type CollectionItem = {
  id: string;
  path?: string; // Main path for the item (can be image, video, or other media)
  filePath?: string; // Alternative path structure (simplified from legacy object format)
  label?: string;
  summary?: string;
  thumbnail?: string; // Can be image or video
  resource?: Resource; // Single resource (legacy)
  resources?: Resource[]; // Multiple resources
  type: CollectionItemType;
  loop?: boolean; // Whether video/animation should loop
  autoPlay?: boolean; // Whether video should autoplay (defaults to true for thumbnails/banners/posters)
};



export interface Project {
  id: string;
  folderName?: string;       // The actual folder name in public/projects/ (slug_id)
  filePath?: string;
  title: string;
  subtitle?: string;
  isPublic?: boolean;
  summary: string;
  domain: string;
  category?: string;
  status: string;
  phase?: string;
  featured?: boolean;
  requiresFollowUp?: boolean;
  createdAt: string;           // ISO 8601 or timestamp
  updatedAt: string;           // ISO 8601 or timestamp
  featuredOrder?: number;
  
  assetsFolder?: string;
  
  images?: {
    thumbnail?: string; // Can be image (including GIF) or video
    banner?: string; // Can be image (including GIF) or video
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

  details?: [
    {
      label: string;
      value: string | string[] | Record<string, unknown>;
    }
  ]
}