import fs from "node:fs";
import path from "node:path";

export type ProjectImages = Record<string, unknown>;

export interface CanonicalProject {
  id: string;
  title: string;
  folderName?: string;
  featured?: boolean;
  images?: ProjectImages;
  [key: string]: unknown;
}

export interface ProjectMediaEntry {
  projectId: string;
  projectTitle: string;
  folderName: string;
  mediaKey: string;
  rawValue: string | undefined;
  resolvedUrl: string;
  isExternal: boolean;
  absolutePublicPath: string | null;
}

export interface RepresentativeProjects {
  hero?: CanonicalProject;
  poster?: CanonicalProject;
  banner?: CanonicalProject;
  icon?: CanonicalProject;
  "thumbnail-only"?: CanonicalProject;
  "no-images"?: CanonicalProject;
}

export function getProjectsJsonPath(): string {
  return path.join(process.cwd(), "public", "projects", "projects.json");
}

export function loadCanonicalProjects(): CanonicalProject[] {
  const projectsPath = getProjectsJsonPath();
  const raw = fs.readFileSync(projectsPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected projects JSON array at ${projectsPath}`);
  }

  return parsed
    .filter((item): item is CanonicalProject => {
      return Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.title === "string");
    })
    .map((project) => ({
      ...project,
      images: isObject(project.images) ? (project.images as ProjectImages) : {},
    }));
}

export function enumerateProjectMediaEntries(projects: CanonicalProject[]): ProjectMediaEntry[] {
  const entries: ProjectMediaEntry[] = [];

  for (const project of projects) {
    const folderName = getProjectFolderName(project);
    const folderPath = `/projects/${folderName}`;
    const images = isObject(project.images) ? project.images : {};

    for (const [mediaKey, mediaValue] of Object.entries(images)) {
      const rawValue = extractPathValue(mediaValue);
      const resolvedUrl = getOptimizedMediaPath(mediaValue, folderPath);
      const isExternal = isExternalUrl(resolvedUrl);
      const absolutePublicPath =
        !isExternal && resolvedUrl.startsWith("/")
          ? path.join(process.cwd(), "public", resolvedUrl.replace(/^\//, ""))
          : null;

      entries.push({
        projectId: project.id,
        projectTitle: project.title,
        folderName,
        mediaKey,
        rawValue,
        resolvedUrl,
        isExternal,
        absolutePublicPath,
      });
    }
  }

  return entries;
}

export function getRepresentativeProjects(projects: CanonicalProject[]): RepresentativeProjects {
  const result: RepresentativeProjects = {};

  result.hero = projects.find((project) => hasProjectImage(project, "hero"));
  result.poster = projects.find((project) => hasProjectImage(project, "poster"));
  result.banner = projects.find((project) => hasProjectImage(project, "banner"));
  result.icon = projects.find((project) => hasProjectImage(project, "icon"));
  result["thumbnail-only"] = projects.find((project) => {
    const keys = getProjectImageKeys(project);
    return keys.length === 1 && keys[0] === "thumbnail";
  });
  result["no-images"] = projects.find((project) => getProjectImageKeys(project).length === 0);

  return result;
}

export function getProjectFolderName(project: CanonicalProject): string {
  return typeof project.folderName === "string" && project.folderName.trim() ? project.folderName : project.id;
}

export function getProjectImageKeys(project: CanonicalProject): string[] {
  if (!isObject(project.images)) return [];
  return Object.keys(project.images).filter((key) => {
    const value = project.images?.[key];
    return extractPathValue(value) !== undefined;
  });
}

export function hasProjectImage(project: CanonicalProject, mediaKey: string): boolean {
  if (!isObject(project.images)) return false;
  return extractPathValue(project.images[mediaKey]) !== undefined;
}

export function pickDefaultProject(projects: CanonicalProject[]): CanonicalProject {
  const preferred = projects.find((project) => hasProjectImage(project, "thumbnail"));
  if (preferred) return preferred;

  if (projects.length === 0) {
    throw new Error("projects.json does not contain any projects");
  }

  return projects[0];
}

function extractPathValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (!isObject(value)) {
    return undefined;
  }

  const candidates = ["path", "filePath", "relativePath", "url", "href"];
  for (const key of candidates) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }

  return undefined;
}

function getOptimizedMediaPath(filename: unknown, folderPath: string): string {
  const resolvedFilename = extractPathValue(filename);
  if (!resolvedFilename) return "/placeholder.svg";

  if (isExternalUrl(resolvedFilename)) {
    return resolvedFilename;
  }

  if (resolvedFilename.startsWith("/")) {
    return resolvedFilename;
  }

  const stem = resolvedFilename.substring(0, resolvedFilename.lastIndexOf(".")) || resolvedFilename;

  if (isVideoFile(resolvedFilename)) {
    return `${folderPath}/${stem}-optimized.mp4`;
  }

  if (isImageFile(resolvedFilename)) {
    return `${folderPath}/${stem}-optimized.webp`;
  }

  return `${folderPath}/${resolvedFilename}`;
}

function isExternalUrl(pathValue: string): boolean {
  return pathValue.startsWith("http://") || pathValue.startsWith("https://");
}

function isVideoFile(pathValue: string): boolean {
  const ext = pathValue.split(".").pop()?.toLowerCase() ?? "";
  return ["mov", "mp4", "webm", "mkv", "avi", "flv", "ogv", "wmv", "mpg", "mpeg"].includes(ext);
}

function isImageFile(pathValue: string): boolean {
  const ext = pathValue.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "svg", "gif", "webp", "bmp", "tiff", "heic", "avif"].includes(ext);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
