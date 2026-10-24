import type { Resource } from "@/types";

function resourcePriority(resource: Resource): number {
  const label = (resource.label || "").toLowerCase();
  if (/support|setup|project story/.test(label)) return 4;
  if (/app store|install|download/.test(label) || resource.type === "download" || resource.type === "apple") return 0;
  if (/demo|visit|open|play|watch|read/.test(label) || ["web", "website", "visit"].includes(resource.type)) return 1;
  if (/github|repo|source/.test(label) || resource.type === "github") return 2;
  return 3;
}

/** Use the same order in cards and detail pages, before card truncation. */
export function getProjectResources(resources: Resource[] = []): Resource[] {
  return resources.filter(resource => Boolean(resource.url)).slice().sort((a, b) => resourcePriority(a) - resourcePriority(b));
}
