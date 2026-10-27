// Deterministic presentation helpers derived from existing project metadata.
// Nothing here is required in Notion or the authored entries: every value has
// a fallback, and the optional `disciplines` field only overrides derivation.
import type { Project, Resource } from "../types";

export type FocusKey = "software" | "ai-data" | "hardware" | "research" | "creative";

export interface FocusArea {
  key: FocusKey;
  label: string;
  shortLabel: string;
  description: string;
  /** Lower-cased tag, category, or medium values that place a project here. */
  terms: string[];
  domains?: string[];
}

export const FOCUS_AREAS: FocusArea[] = [
  {
    key: "software",
    label: "Software Engineering",
    shortLabel: "Software",
    description: "Native apps, web applications, backend services, developer tools, and infrastructure.",
    terms: [
      "react", "next.js", "typescript", "ts", "javascript", "swift", "swiftui", "python", "flask", "firebase",
      "ios", "ipados", "macos", "watchos", "android", "expo", "react native", "node.js", "rust", "tauri", "cli",
      "developer tools", "debugging", "sqlite", "cloudkit", "swiftdata", "web", "widgets", "widgetkit",
      "app intents", "notion api", "local-first", "watchconnectivity", "tailwind css", "application", "mobile app",
      "tool", "module", "software", "mobile",
    ],
  },
  {
    key: "ai-data",
    label: "AI & Data",
    shortLabel: "AI & Data",
    description: "Machine learning, computer vision, analytics, automation, and experimental AI.",
    terms: [
      "ai", "machine learning", "llm", "computer vision", "data analytics", "data vizualization", "data visualization",
      "charts", "dashboard", "telemetry", "automation", "n8n", "bias auditing", "model comparison", "chat bot",
      "noaa", "data export", "recharts", "ai model", "prompt review", "inspectable memory",
    ],
  },
  {
    key: "hardware",
    label: "Hardware & Electronics",
    shortLabel: "Hardware",
    description: "ESP32 and Raspberry Pi builds, sensors, firmware, 3D printing, and physical prototypes.",
    terms: [
      "hardware", "esp32", "platformio", "c++", "oled", "philips hue", "3d printing", "prototyping", "raspberry pi",
      "arduino", "sensors", "firmware", "electronics", "device",
    ],
  },
  {
    key: "research",
    label: "Research & Experiments",
    shortLabel: "Research",
    description: "Scientific exploration, simulations, cognition experiments, and research prototypes.",
    terms: [
      "research", "physics", "simulation", "science", "theory", "notebook", "experiment", "cognition",
      "psychology", "bias auditing", "social experiment", "location-first",
    ],
  },
  {
    key: "creative",
    label: "Design & Creative Technology",
    shortLabel: "Creative",
    description: "Interactive experiences, visualization, 3D, animation, games, and storytelling.",
    terms: [
      "blender", "3d modeling", "art", "animation", "film", "screenwriting", "story", "illustration", "video game",
      "games", "unity", "character design", "visualization", "3d design", "3d", "novel", "screenplay",
      "short story", "television", "short film", "adult animation",
    ],
    domains: ["artistic", "narrative"],
  },
];

const FOCUS_BY_KEY = new Map(FOCUS_AREAS.map((area) => [area.key, area]));

export function getFocusArea(key: string | null | undefined): FocusArea | undefined {
  return key ? FOCUS_BY_KEY.get(key as FocusKey) : undefined;
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value ? [value] : [];
}

function lower(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

/** Optional explicit override: `disciplines: ["hardware", "Software Engineering"]`. */
function getExplicitFocus(project: Project): FocusKey[] {
  const explicit = lower(toList(project.disciplines));
  const keys = new Set<FocusKey>();
  for (const value of explicit) {
    const area = FOCUS_AREAS.find((item) =>
      [item.key, item.label.toLowerCase(), item.shortLabel.toLowerCase()].includes(value)
    );
    if (area) keys.add(area.key);
  }
  return [...keys];
}

export function getProjectFocusAreas(project: Project): FocusKey[] {
  const explicit = getExplicitFocus(project);
  if (explicit.length > 0) return explicit;

  const values = new Set(
    lower([...toList(project.tags), ...toList(project.category), ...toList(project.mediums)])
  );
  const domain = (project.domain || "").trim().toLowerCase();
  const isTechnicalDomain = !["artistic", "narrative"].includes(domain);

  return FOCUS_AREAS.filter((area) => {
    if (area.domains?.includes(domain)) return true;
    // Story/film tags on a narrative project are creative, not software.
    if (area.key === "software" && !isTechnicalDomain) return false;
    return area.terms.some((term) => values.has(term));
  }).map((area) => area.key);
}

export function projectMatchesFocus(project: Project, focus: FocusKey | null | undefined): boolean {
  return !focus || getProjectFocusAreas(project).includes(focus);
}

// ----- Stage labels ----------------------------------------------------------

export type ProjectStageKey =
  | "released" | "complete" | "maintained" | "testing" | "active" | "prototype" | "research" | "paused" | "archived";

export interface ProjectStage {
  key: ProjectStageKey;
  label: string;
}

/** Accurate, visitor-facing stage from the existing status and phase fields. */
export function getProjectStage(project: Pick<Project, "status" | "phase">): ProjectStage {
  const status = (project.status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  const phase = (project.phase || "").trim().toLowerCase();

  if (/archived|deprecated|abandoned|cancel|end of life/.test(status)) return { key: "archived", label: "Archived" };
  if (status === "complete" || status === "completed" || status === "done") return { key: "complete", label: "Complete" };
  if (/released|^release$/.test(phase)) return { key: "released", label: "Released" };
  if (status === "maintained" || phase === "maintenance") return { key: "maintained", label: "Released · maintained" };
  if (/paused|blocked|on hold|dormant/.test(status)) return { key: "paused", label: "Paused" };
  if (/beta|testing/.test(phase)) return { key: "testing", label: "In testing" };
  if (phase === "prototype") return { key: "prototype", label: "Working prototype" };
  if (phase === "research") return { key: "research", label: "Research experiment" };
  return { key: "active", label: "Active development" };
}

// ----- Evidence and actions --------------------------------------------------

function isSource(resource: Resource): boolean {
  return resource.type === "github" || /github\.com/i.test(resource.url) || /\b(repo|source)\b/i.test(resource.label);
}

function isInstall(resource: Resource): boolean {
  return ["apple", "download"].includes(resource.type) || /app store|install|download/i.test(resource.label);
}

function isDemo(resource: Resource): boolean {
  return /demo/i.test(resource.label) || /\/demo(\/|$)/.test(resource.url);
}

export interface ProjectEvidence {
  demo: boolean;
  download: boolean;
  source: boolean;
  liveSite: boolean;
  workLogs: number;
  articles: number;
}

export function getProjectEvidence(project: Project): ProjectEvidence {
  const resources = (project.resources || []).filter((resource) => Boolean(resource?.url));
  return {
    demo: resources.some(isDemo),
    download: resources.some(isInstall),
    source: resources.some((resource) => isSource(resource) && !isInstall(resource)),
    liveSite: resources.some(
      (resource) => ["web", "website", "visit"].includes(resource.type) && !isDemo(resource) && !isSource(resource)
    ),
    workLogs: (project.workLogs || []).length,
    articles: (project.articles || []).length,
  };
}

export type EvidenceFilter = "demo" | "download" | "source";

export const EVIDENCE_FILTERS: Array<{ key: EvidenceFilter; label: string }> = [
  { key: "demo", label: "Has demo" },
  { key: "download", label: "Downloadable" },
  { key: "source", label: "Public source" },
];

/** Primary actions (install, product/demo, source) vs. secondary (support, privacy, story). */
export function isSecondaryResource(resource: Resource): boolean {
  return /support|setup|privacy|project story|documentation|docs|original site/i.test(resource.label || "");
}

// ----- Selected Work ---------------------------------------------------------

export const SELECTED_WORK_LIMIT = 6;

function timestamp(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isPublicProject(project: Project): boolean {
  return (project as Project & { visibility?: string }).visibility !== "private";
}

/**
 * Selected Work has one ranking control: the ordered slug list in
 * `content/selected-work.json`. Unknown or private slugs are skipped. When the
 * list is empty, featured projects are used, ranked by `featuredOrder` (Notion
 * Featured / Featured Order), then by most recent update.
 */
export function getSelectedWork(projects: Project[], limit = SELECTED_WORK_LIMIT, rankedSlugs: string[] = []): Project[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const ranked = rankedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((project): project is Project => Boolean(project) && isPublicProject(project!));
  if (ranked.length > 0) return [...new Set(ranked)].slice(0, limit);

  return projects
    .filter((project) => project.featured === true && isPublicProject(project))
    .sort((left, right) => {
      const leftOrder = typeof left.featuredOrder === "number" ? left.featuredOrder : Number.POSITIVE_INFINITY;
      const rightOrder = typeof right.featuredOrder === "number" ? right.featuredOrder : Number.POSITIVE_INFINITY;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return timestamp(right.updatedAt) - timestamp(left.updatedAt);
    })
    .slice(0, limit);
}

/** Short summary for cards: optional `cardSummary`, then oneLiner, then summary. */
export function getProjectCardSummary(project: Project): string {
  if (project.cardSummary?.trim()) return project.cardSummary.trim();
  return (project.oneLiner || project.summary || "").trim();
}
