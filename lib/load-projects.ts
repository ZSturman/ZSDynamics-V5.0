import fs from "node:fs/promises";
import path from "node:path";

import type { Project } from "@/types";

export function getProjectsManifestPath(): string {
  return path.join(process.cwd(), "public", "projects", "projects.json");
}

function isProjectLike(value: unknown): value is Project {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { id?: unknown }).id === "string" &&
      typeof (value as { title?: unknown }).title === "string"
  );
}

export async function loadProjectsManifest(): Promise<Project[]> {
  const manifestPath = getProjectsManifestPath();

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.warn(`Expected an array in ${manifestPath}, received ${typeof parsed}.`);
      return [];
    }

    return parsed.filter(isProjectLike);
  } catch (error) {
    console.error(`Failed to load projects manifest at ${manifestPath}.`, error);
    return [];
  }
}
