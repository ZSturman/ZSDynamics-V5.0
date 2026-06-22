"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProjectSlug } from "@/lib/project-paths";
import {
  formatWorkLogSessionRange,
  getWorkLogDurationMinutes,
  getWorkLogSummary,
  getWorkLogTimestamp,
  getWorkLogTitle,
} from "@/lib/work-logs";
import { Project } from "@/types";

interface ProjectWorkLogsProps {
  project: Project;
  limit?: number;
}

function formatDuration(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function ProjectWorkLogs({ project, limit }: ProjectWorkLogsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const workLogs = (project.workLogs || []).filter((workLog) => Boolean(workLog.title || workLog.entry));

  const sortedLogs = useMemo(
    () => [...workLogs].sort((a, b) => getWorkLogTimestamp(b) - getWorkLogTimestamp(a)),
    [workLogs]
  );

  const hasOverflow = typeof limit === "number" && limit > 0 && sortedLogs.length > limit;
  const visibleLogs =
    hasOverflow && !isExpanded
      ? sortedLogs.slice(0, limit)
      : sortedLogs;

  if (sortedLogs.length === 0) {
    return null;
  }

  return (
    <section data-testid="project-work-logs" className="min-w-0 max-w-full space-y-4 overflow-x-clip md:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Work Logs</h3>
        <Link
          href={`/work-logs?project=${getProjectSlug(project)}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          See all logs
        </Link>
      </div>

      <div data-testid="project-work-logs-list" className="min-w-0 max-w-full space-y-3">
        {visibleLogs.map((workLog, idx) => {
          const key = workLog.id || `${project.id}-work-log-${idx}`;
          const summary = getWorkLogSummary(workLog);
          const durationLabel = formatDuration(getWorkLogDurationMinutes(workLog));

          return (
            <Card
              key={key}
              data-testid="project-work-log-card"
              className="max-w-full overflow-hidden rounded-lg border-border/35 bg-card/30 shadow-none"
            >
              <CardContent className="min-w-0 space-y-3 p-3 md:space-y-4 md:p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h4 className="min-w-0 max-w-2xl break-words text-sm font-semibold leading-snug text-foreground md:text-base">
                    {getWorkLogTitle(workLog)}
                  </h4>
                  <span className="text-xs text-muted-foreground md:text-sm">
                    {formatWorkLogSessionRange(workLog)}
                  </span>
                </div>

                {summary && (
                  <p className="max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                    {summary}
                  </p>
                )}

                {durationLabel && (
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                    <span>Duration: {durationLabel}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasOverflow ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="project-work-logs-view-more"
          className="h-auto px-0 py-1 text-sm font-medium text-primary hover:bg-transparent hover:text-primary/80"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Show fewer logs" : `View ${sortedLogs.length - visibleLogs.length} more logs`}
        </Button>
      ) : null}
    </section>
  );
}
