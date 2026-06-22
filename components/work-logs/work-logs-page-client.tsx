"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { WorkLogsDashboard } from "@/components/work-logs/work-log-timeline";
import { findProjectByAlias, getProjectSlug } from "@/lib/project-paths";
import type {
  WorkLogOverviewSummary,
  WorkLogProjectOption,
  WorkLogProjectSummary,
  WorkLogSessionSummary,
  WorkLogWithProject,
} from "@/lib/work-logs";

interface WorkLogsPageClientProps {
  logs: WorkLogWithProject[];
  projectOptions: WorkLogProjectOption[];
  projectSummaries: WorkLogProjectSummary[];
  overviewSummary: WorkLogOverviewSummary;
  sessionSummaries: WorkLogSessionSummary[];
}

export function WorkLogsPageClient({
  logs,
  projectOptions,
  projectSummaries,
  overviewSummary,
  sessionSummaries,
}: WorkLogsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const projectFilter = searchParams.get("project") || undefined;

  const filteredProject = projectFilter ? findProjectByAlias(projectOptions, projectFilter) : null;
  const canonicalProjectFilter = filteredProject ? getProjectSlug(filteredProject) : undefined;

  useEffect(() => {
    if (!projectFilter) return;

    const params = new URLSearchParams(searchParams.toString());
    if (!filteredProject) {
      params.delete("project");
    } else if (projectFilter !== canonicalProjectFilter) {
      params.set("project", canonicalProjectFilter!);
    } else {
      return;
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [canonicalProjectFilter, filteredProject, pathname, projectFilter, router, searchParams]);

  const handleProjectFilterChange = (projectSlug?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (projectSlug) {
      params.set("project", projectSlug);
    } else {
      params.delete("project");
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageFrame as="main" data-testid="site-page-frame" className="py-8 md:py-12">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-border/70 bg-card/45 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-foreground">
                    Home
                  </Link>
                  {" / "}Work Logs
                </p>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
                    {filteredProject ? `${filteredProject.title} Work Logs` : "Work Logs"}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                    A calmer dashboard for reviewing recent sessions, tracking project momentum, and opening details only
                    when they are useful.
                  </p>
                </div>
              </div>

              {filteredProject ? (
                <Button asChild variant="outline" size="sm" className="self-start rounded-full">
                  <Link href="/work-logs">Show all</Link>
                </Button>
              ) : null}
            </div>
          </section>

          <WorkLogsDashboard
            logs={logs}
            projectOptions={projectOptions}
            projectSummaries={projectSummaries}
            overviewSummary={overviewSummary}
            sessionSummaries={sessionSummaries}
            initialProjectSlug={canonicalProjectFilter}
            onProjectFilterChange={handleProjectFilterChange}
            emptyText={filteredProject ? "No work logs for this project yet." : "No work logs found yet."}
          />
        </div>
      </PageFrame>
    </div>
  );
}
