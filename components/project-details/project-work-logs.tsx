"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Project, WorkLog } from "@/types";

interface ProjectWorkLogsProps {
  project: Project;
  limit?: number;
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getStartTime(workLog: WorkLog): string | undefined {
  return workLog.startTime || workLog.sessionStart || workLog.date;
}

function getEndTime(workLog: WorkLog): string | undefined {
  return workLog.endTime || workLog.sessionEnd || getStartTime(workLog);
}

function getDurationMinutes(workLog: WorkLog): number {
  if (typeof workLog.durationMinutes === "number" && workLog.durationMinutes > 0) {
    return workLog.durationMinutes;
  }

  const start = toTimestamp(getStartTime(workLog));
  const end = toTimestamp(getEndTime(workLog));
  if (!start || !end || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function formatDuration(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatSessionDate(workLog: WorkLog): string {
  const start = getStartTime(workLog);
  if (!start) return "Date not set";
  const day = formatDate(start, { month: "short", day: "numeric", year: "numeric" }) || "Date not set";
  const time = formatDate(start, { hour: "numeric", minute: "2-digit" });
  return time ? `${day} · ${time}` : day;
}

export function ProjectWorkLogs({ project, limit }: ProjectWorkLogsProps) {
  const workLogs = (project.workLogs || []).filter((workLog) => Boolean(workLog.title || workLog.entry));

  const projectLogs = useMemo(
    () =>
      [...workLogs]
        .sort((a, b) => toTimestamp(getStartTime(b)) - toTimestamp(getStartTime(a)))
        .slice(0, typeof limit === "number" ? limit : workLogs.length),
    [limit, workLogs]
  );

  if (workLogs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Work Logs</h3>
        <Link href={`/work-logs?project=${project.id}`} className="text-xs text-primary hover:underline">
          See all logs
        </Link>
      </div>

      <div className="space-y-4">
        {projectLogs.map((workLog, idx) => {
          const key = workLog.id || `${project.id}-work-log-${idx}`;
          const isLast = idx === projectLogs.length - 1;
          const summary = workLog.whatHappened || workLog.entry || "";
          const durationLabel = formatDuration(getDurationMinutes(workLog));
          const sourceUrl = workLog.url;

          return (
            <div key={key} className="relative pl-8">
              <span className="absolute left-[0.55rem] top-2.5 h-3 w-3 rounded-full border border-primary/50 bg-primary/70" />
              {!isLast && <span className="absolute bottom-[-1rem] left-[0.88rem] top-6 w-px bg-border/80" />}

              <Card className="border-border/70 shadow-sm">
                <CardContent className="space-y-3 p-3 md:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold leading-snug">{workLog.title || workLog.entry || "Work log"}</h4>
                    <span className="text-xs text-muted-foreground">{formatSessionDate(workLog)}</span>
                  </div>

                  {summary && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>}

                  {(durationLabel || sourceUrl) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {durationLabel && <span>Duration: {durationLabel}</span>}
                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          Session source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
