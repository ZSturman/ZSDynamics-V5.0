import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentPage } from "@/components/layout/content-page";
import { SelectedWork } from "@/components/home/selected-work";
import { TagGroups } from "@/components/profile/profile-sections";
import { loadProjectsManifest } from "@/lib/load-projects";
import { loadSelectedWorkSlugs } from "@/lib/load-selected-work";
import { getProjectHref } from "@/lib/project-paths";
import {
  FOCUS_AREAS,
  getFocusArea,
  getProjectStage,
  getSelectedWork,
  projectMatchesFocus,
} from "@/lib/project-presentation";
import { hardwareCapabilities } from "@/lib/site-content";
import type { Project } from "@/types";

export function generateStaticParams() {
  return FOCUS_AREAS.map((area) => ({ focus: area.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ focus: string }> }): Promise<Metadata> {
  const area = getFocusArea((await params).focus);
  if (!area) return { title: "Not found", robots: { index: false } };
  return {
    title: `${area.label} projects`,
    description: `${area.description} Selected projects by Zachary Sturman.`,
    alternates: { canonical: `/explore/${area.key}` },
    openGraph: { title: `${area.label} — Zachary Sturman`, url: `/explore/${area.key}` },
  };
}

const STAGE_RANK: Record<string, number> = { archived: 2, paused: 1 };

function timestamp(value: unknown): number {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function orderProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      (STAGE_RANK[getProjectStage(a).key] ?? 0) - (STAGE_RANK[getProjectStage(b).key] ?? 0) ||
      timestamp(b.updatedAt) - timestamp(a.updatedAt)
  );
}

export default async function ExplorePage({ params }: { params: Promise<{ focus: string }> }) {
  const area = getFocusArea((await params).focus);
  if (!area) notFound();

  const projects = (await loadProjectsManifest()).filter((project) => projectMatchesFocus(project, area.key));
  const highlights = getSelectedWork(projects, 3, await loadSelectedWorkSlugs());
  const highlightIds = new Set(highlights.map((project) => project.id));
  const rest = orderProjects(projects.filter((project) => !highlightIds.has(project.id)));

  return (
    <ContentPage title={area.label} intro={area.description} testId="explore-page" wide>
      <nav aria-label="Other focus areas" className="mb-10 flex flex-wrap gap-2 text-sm">
        {FOCUS_AREAS.map((other) => (
          <Link
            key={other.key}
            href={`/explore/${other.key}`}
            aria-current={other.key === area.key ? "page" : undefined}
            className={
              other.key === area.key
                ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                : "rounded-full border border-border/60 px-3 py-1 text-muted-foreground hover:text-foreground"
            }
          >
            {other.shortLabel}
          </Link>
        ))}
      </nav>

      {area.key === "hardware" ? (
        <div className="max-w-3xl">
          <TagGroups id="hardware-capabilities" title="Equipment and methods I've used" groups={hardwareCapabilities} />
          <p className="-mt-8 mb-12 text-sm text-muted-foreground">
            Personal and independent projects; I don&apos;t hold a formal hardware engineering credential.
          </p>
        </div>
      ) : null}

      <SelectedWork projects={highlights} title="Highlights" />

      <section aria-labelledby="explore-all-heading" data-testid="explore-project-list">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <h2 id="explore-all-heading" className="text-xl font-semibold text-foreground md:text-2xl">
            {highlights.length > 0 ? "More projects" : "Projects"} ({rest.length})
          </h2>
          <Link href={`/projects?focus=${area.key}`} className="text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
            Search and filter these →
          </Link>
        </div>
        <ul className="divide-y divide-border/50">
          {rest.map((project) => (
            <li key={project.id} data-testid="explore-project" className="py-3">
              <Link href={getProjectHref(project)} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="font-medium text-foreground group-hover:text-primary">{project.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{getProjectStage(project).label}</span>
                <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
                  {project.oneLiner || project.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ContentPage>
  );
}
