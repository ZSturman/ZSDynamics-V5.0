import fs from "node:fs/promises";
import path from "node:path";

/** Reads the ordered Selected Work slugs; a missing or malformed file means "use Notion Featured". */
export async function loadSelectedWorkSlugs(): Promise<string[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "content", "selected-work.json"), "utf8"));
    const projects = Array.isArray(raw?.projects) ? raw.projects : [];
    return projects.filter((slug: unknown): slug is string => typeof slug === "string" && slug.trim() !== "");
  } catch {
    return [];
  }
}
