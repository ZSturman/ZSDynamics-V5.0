import type { Project, Resource } from "../types";

export type ProductContext = { id: string; slug: string; title: string; path: string; platforms: string[] };
export function getApplications(projects: Project[]): Project[] {
  return projects.filter((project) => Boolean(project.application?.landingPath) && project.isPublic !== false)
    .sort((a, b) => a.title.localeCompare(b.title));
}
export function productContexts(projects: Project[]): ProductContext[] {
  return getApplications(projects).map((project) => ({ id: project.id, slug: project.slug || project.id, title: project.title,
    path: project.application!.landingPath, platforms: project.application!.platforms || [] }));
}
export function productForPath(products: ProductContext[], pathname: string): ProductContext | undefined {
  return products.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
}
export function resourceAction(resource: Pick<Resource, "url" | "label" | "type">): string {
  if (/^https:\/\/apps\.apple\.com\//i.test(resource.url)) return "store";
  if (/\.(zip|dmg|pkg|exe|apk)(?:[?#]|$)/i.test(resource.url) || resource.type === "download") return "download";
  if (/\/demo(?:[/?#]|$)/.test(resource.url) || /demo/i.test(resource.label)) return "demo";
  if (/github\.com\//.test(resource.url)) return "source";
  if (/^https?:/.test(resource.url)) return "external";
  return "internal";
}
export function applicationResources(project: Project): Resource[] {
  return (project.resources || []).filter((r) => !/support|privacy|admin|appstoreconnect|testflight\.apple/i.test(`${r.label} ${r.url}`));
}

/** Fail closed for new product events while preserving the historical taxonomy. */
export function analyticsEventIssue(name: string, params: Record<string, unknown>, products: ProductContext[]): string | null {
  const required = name.startsWith("product_") ? ["product_id", "product_slug", "surface"] :
    name === "article_project_click" ? ["article_slug", "project_slug", "surface"] :
    name === "work_log_open" ? ["log_id", "project_slug", "surface"] :
    name === "project_resource_click" ? ["resource_label", "action_type", "surface"] : [];
  const missing = required.filter((key) => !params[key]);
  if (missing.length) return `${name}: missing ${missing.join(", ")}`;
  if (params.product_id && !products.some((p) => p.id === params.product_id && p.slug === params.product_slug)) return `${name}: invalid product identity`;
  return null;
}
