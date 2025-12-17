import type { Resource, ResourceType } from "@/types";


  // human-friendly labels for common status keys
export const friendlyStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      idea: "Idea",
      draft: "Draft",
      prototype: "Prototype",
      alpha: "Alpha",
      beta: "Beta",
      early_access: "Early Access",
      released_stable: "Released (Stable)",
      maintenance: "Maintenance",
      deprecated: "Deprecated",
      end_of_life: "End of Life",
      editing: "Editing",
      in_review: "In Review",
      released_preview: "Released (Preview)",
      published_provisional: "Published (Provisional)",
      released: "Released",
      definitive_edition: "Definitive Edition",
      submitted: "Submitted",
      preprint: "Preprint",
      under_review: "Under Review",
      final_published: "Final Published",
      living_document: "Living Document",
      finished: "Finished",
      archived: "Archived",
    }
    if (map[s]) return map[s]
    // fallback: prettify snake_case or kebab-case
    return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }


// lib/resourceMap.ts
export const RESOURCE_LABEL: Record<string, string> = {
  "github": "GitHub",
  "repository:github": "GitHub",
  "repository:gitlab": "GitLab",
  "gitlab": "GitLab",
  "overleaf": "Overleaf",
  "gdoc": "Google Doc",
  "gslide": "Google Slides",
  "pdf": "PDF",
  "markdown": "Markdown",
  "video": "Video",
  "audio": "Audio",
  "image": "Image",
  "dataset": "Dataset",
  "download": "Download",
  "website": "Website",
  "blog": "Blog"
};



// Map resource and medium keys to svg file basenames placed under /public/icons/
// Example: key "github" -> /icons/github.svg
const ICON_MAP: Record<ResourceType | string, string> = {
  github: "github",
  "repository:github": "github",
  gitlab: "gitlab",
  "repository:gitlab": "gitlab",
  overleaf: "overleaf",
  gdoc: "googledocs",
  gslide: "googleslides",
  pdf: "pdf",
  markdown: "markdown",
  video: "video",
  audio: "audio",
  image: "image",
  dataset: "dataset",
  download: "download",
  "folio": "portfolio",
  "local-download": "download",
  "local-link": "website",
  website: "website",
  web: "website",
  blog: "blog",
  "iosappstore": "apple",
  "app:iosappstore": "apple", 
  "app:androidplaystore": "google",
  "apple": "apple",
  "google": "google",
  // mediums (legacy, for compatibility)
  code: "code",
  science: "science",
  game: "game",
  film: "film",
  tv: "tv",
  novel: "novel",
  poetry: "poetry",
  music: "music",
  art: "art",
  other: "other",
  // fallback
  placeholder: "placeholder",
  default: "default"
};

export function hasIcon(key: string): boolean {
  const k = (key || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(ICON_MAP, k);
}

export function iconPath(key: string): string | null {
  const k = (key || "").toLowerCase();
  const name = ICON_MAP[k];
  if (!name) return null;
  return `/icons/${name}.svg`;
}

export function bestIconPath(resourceType?: ResourceType | string, medium?: string, resource?: Resource): string {
  // First, try to infer from the resource object itself
  if (resource) {
    const url = (resource as { url?: string; path?: string }).url || (resource as { url?: string; path?: string }).path || "";
    const urlLower = url.toLowerCase();
    
    // Check for video platforms
    if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
      const ytPath = iconPath("youtube");
      if (ytPath) return ytPath;
    }
    if (urlLower.includes("vimeo.com")) {
      const vimeoPath = iconPath("vimeo");
      if (vimeoPath) return vimeoPath;
    }
    
    // Check for code repositories
    if (urlLower.includes("github.com")) {
      return iconPath("github")!;
    }
    if (urlLower.includes("gitlab.com")) {
      return iconPath("gitlab")!;
    }
    
    // Check for Google services
    if (urlLower.includes("docs.google.com/document")) {
      return iconPath("gdoc")!;
    }
    if (urlLower.includes("docs.google.com/presentation")) {
      return iconPath("gslide")!;
    }
    
    // Check for Overleaf
    if (urlLower.includes("overleaf.com")) {
      return iconPath("overleaf")!;
    }
    
    // Check file extensions
    if (urlLower.endsWith(".pdf")) {
      return iconPath("pdf")!;
    }
    if (urlLower.endsWith(".md") || urlLower.endsWith(".markdown")) {
      return iconPath("markdown")!;
    }
    if (urlLower.endsWith(".mp4") || urlLower.endsWith(".mov") || urlLower.endsWith(".avi") || urlLower.endsWith(".webm")) {
      return iconPath("video")!;
    }
    if (urlLower.endsWith(".mp3") || urlLower.endsWith(".wav") || urlLower.endsWith(".ogg") || urlLower.endsWith(".m4a")) {
      return iconPath("audio")!;
    }
    if (urlLower.endsWith(".jpg") || urlLower.endsWith(".jpeg") || urlLower.endsWith(".png") || urlLower.endsWith(".gif") || urlLower.endsWith(".svg") || urlLower.endsWith(".webp")) {
      return iconPath("image")!;
    }
    if (urlLower.endsWith(".csv") || urlLower.endsWith(".json") || urlLower.endsWith(".xml")) {
      return iconPath("dataset")!;
    }
    if (urlLower.endsWith(".zip") || urlLower.endsWith(".tar") || urlLower.endsWith(".gz") || urlLower.endsWith(".rar")) {
      return iconPath("download")!;
    }
  }
  
  // Fall back to resourceType-based detection
  if (!resourceType && !medium) return iconPath("placeholder")!;
  const rt = (resourceType || "").toString();
  const exact = iconPath(rt);
  if (exact) return exact;
  const parts = rt.split(":");
  if (parts.length > 1) {
    const suffix = iconPath(parts[1]);
    if (suffix) return suffix;
  }
  return iconPath(medium || "") || iconPath("placeholder")!;
}




export const MEDIUM_LABEL: Record<string, string> = {
  code: "Code",
  science: "Science",
  game: "Game",
  film: "Film",
  tv: "TV",
  novel: "Novel",
  poetry: "Poetry",
  music: "Music",
  art: "Art",
  other: "Other"
};

export const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  draft: "Draft",
  prototype: "Prototype",
  finished: "Finished",
  released: "Released",
  archived: "Archived"
};

export const STATUS_COLOR: Record<string, string> = {
  idea: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  prototype: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  finished: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  released: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  on_hold: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};