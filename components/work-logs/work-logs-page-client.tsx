"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  WorkLogTimeline,
  WorkLogWithProject,
  WorkLogProjectOption,
} from "@/components/work-logs/work-log-timeline";

interface WorkLogsPageClientProps {
  logs: WorkLogWithProject[];
  projects: WorkLogProjectOption[];
}

export function WorkLogsPageClient({ logs, projects }: WorkLogsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project") || undefined;

  const filteredProject = projectFilter
    ? projects.find((project) => project.id === projectFilter)
    : null;

  const handleProjectFilterChange = (projectId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (projectId) {
      params.set("project", projectId);
    } else {
      params.delete("project");
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              {" / "}Work Logs
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {filteredProject ? `${filteredProject.title} Work Logs` : "All Work Logs"}
            </h1>
          </div>
          {filteredProject && (
            <Link href="/work-logs" className="text-xs md:text-sm text-primary hover:underline">
              Show all
            </Link>
          )}
        </div>

        <WorkLogTimeline
          logs={logs}
          showControls
          projectOptions={projects}
          initialProjectId={projectFilter}
          initialViewMode="project-chart"
          onProjectFilterChange={handleProjectFilterChange}
          emptyText={filteredProject ? "No work logs for this project yet." : "No work logs found yet."}
        />
      </main>
    </div>
  );
}
