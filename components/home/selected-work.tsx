"use client";

import Link from "next/link";

import { MediaDisplay } from "@/components/ui/media-display";
import { trackProjectOpen } from "@/lib/firebase-analytics";
import { getProjectHref } from "@/lib/project-paths";
import {
  getFocusArea,
  getProjectCardSummary,
  getProjectEvidence,
  getProjectFocusAreas,
  getProjectStage,
} from "@/lib/project-presentation";
import { getOptimizedMediaPath } from "@/lib/utils";
import type { Project } from "@/types";

function evidenceLabels(project: Project): string[] {
  const evidence = getProjectEvidence(project);
  return [
    evidence.download && "Install",
    evidence.demo && "Demo",
    evidence.liveSite && "Website",
    evidence.source && "Source",
    project.caseStudy && "Case study",
    evidence.workLogs > 0 && "Dev history",
  ].filter((label): label is string => Boolean(label));
}

export function SelectedWork({ projects, title = "Selected work" }: { projects: Project[]; title?: string }) {
  if (projects.length === 0) return null;

  return (
    <section
      id="selected-work"
      aria-labelledby="selected-work-heading"
      data-testid="selected-work"
      data-analytics-section="selected_work"
      data-analytics-section-label="Selected work"
      className="mb-14 scroll-mt-24"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h2 id="selected-work-heading" className="text-xl font-semibold text-foreground md:text-2xl">
          {title}
        </h2>
        <Link href="/projects" className="text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
          Browse all projects →
        </Link>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => {
          const folderPath = `/projects/${project.folderName || project.id}`;
          const image = project.images?.featured || project.images?.thumbnail || project.images?.hero || project.images?.banner;
          const stage = getProjectStage(project);
          const focus = getProjectFocusAreas(project)
            .map((key) => getFocusArea(key)?.shortLabel)
            .filter(Boolean)
            .slice(0, 3);
          const href = getProjectHref(project);

          return (
            <li key={project.id} data-testid="selected-work-item" data-project-slug={project.slug}>
              <Link
                href={href}
                onClick={() =>
                  trackProjectOpen({
                    projectSlug: project.slug || project.id,
                    projectTitle: project.title,
                    openSurface: "selected_work",
                  })
                }
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/40 bg-card/40 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {image ? (
                    <MediaDisplay
                      src={getOptimizedMediaPath(image, folderPath)}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                      priority={index < 3}
                      autoPlay={false}
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {focus.join(" · ")}
                    {focus.length > 0 ? " — " : ""}
                    <span data-testid="selected-work-stage">{stage.label}</span>
                  </p>
                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary md:text-lg">
                    {project.title}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {getProjectCardSummary(project)}
                  </p>
                  <p className="mt-auto pt-2 text-xs text-muted-foreground">
                    {evidenceLabels(project).join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
