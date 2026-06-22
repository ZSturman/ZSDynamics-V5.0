export interface ProjectRouteLike {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  href?: string;
}

const PROJECTS_PREFIX = "/projects";

export function normalizeProjectSlug(value: string | null | undefined): string {
  const normalized = (value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const ascii = normalized
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || "project";
}

export function getProjectSlug(project: ProjectRouteLike): string {
  return (project.slug || "").trim() || normalizeProjectSlug(project.title || project.name || project.id);
}

export function getProjectHref(project: ProjectRouteLike): string {
  return (project.href || "").trim() || `${PROJECTS_PREFIX}/${getProjectSlug(project)}`;
}

export function normalizeProjectAlias(value: string | null | undefined): string {
  if (!value) return "";

  let candidate = value.trim();
  if (!candidate) return "";

  try {
    if (/^https?:\/\//i.test(candidate)) {
      const url = new URL(candidate);
      candidate = `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Ignore invalid absolute URLs and keep the raw value.
  }

  if (candidate.startsWith(PROJECTS_PREFIX)) {
    candidate = candidate.slice(PROJECTS_PREFIX.length);
  }

  candidate = candidate.replace(/^\/+/, "");
  candidate = candidate.split(/[?#]/, 1)[0] || candidate;

  return decodeURIComponent(candidate).trim();
}

export function projectMatchesAlias(project: ProjectRouteLike, value: string | null | undefined): boolean {
  const candidate = normalizeProjectAlias(value);
  if (!candidate) return false;

  const slug = getProjectSlug(project);
  const href = getProjectHref(project);

  return candidate === project.id || candidate === slug || candidate === href || candidate === normalizeProjectAlias(href);
}

export function findProjectByAlias<T extends ProjectRouteLike>(
  projects: readonly T[],
  value: string | null | undefined
): T | undefined {
  return projects.find((project) => projectMatchesAlias(project, value));
}
