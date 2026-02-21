import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { WorkLog } from "@/types";

export type WorkLogWithProject = WorkLog & {
  projectId?: string;
  projectTitle?: string;
  projectHref?: string;
};

interface WorkLogTimelineProps {
  logs: WorkLogWithProject[];
  emptyText?: string;
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatRange(log: WorkLogWithProject): string {
  const start = log.startTime || log.date;
  const end = log.endTime || log.startTime || log.date;

  if (!start && !end) return "Time not set";
  if (!start) return `Ends ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  if (!end || end === start) {
    return formatDate(start, { month: "short", day: "numeric", year: "numeric" }) || "Time not set";
  }

  const startLabel = formatDate(start, { month: "short", day: "numeric", year: "numeric" });
  const endLabel = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
  if (startLabel === endLabel) return startLabel || "Time not set";
  return `${startLabel} - ${endLabel}`;
}

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function WorkLogTimeline({ logs, emptyText = "No work logs available." }: WorkLogTimelineProps) {
  const sortedLogs = [...logs].sort(
    (a, b) => toTimestamp(b.startTime || b.date) - toTimestamp(a.startTime || a.date)
  );

  if (sortedLogs.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {sortedLogs.map((log, idx) => {
        const duration = formatDuration(log.durationMinutes);
        const key = `${log.id || "work-log"}-${log.projectId || "project"}-${idx}`;
        return (
          <div key={key} className="relative pl-7">
            <span className="absolute left-[0.43rem] top-2 h-3 w-3 rounded-full bg-primary/80" />
            {idx < sortedLogs.length - 1 && <span className="absolute left-2 top-5 bottom-[-1.2rem] w-px bg-border" />}

            <Card className="border-border/70">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold leading-snug">{log.title || log.entry || "Work log"}</h4>
                    <p className="text-xs text-muted-foreground">{formatRange(log)}</p>
                  </div>
                  {duration && (
                    <Badge variant="outline" className="text-[11px] pointer-events-none cursor-default bg-muted/20">
                      {duration}
                    </Badge>
                  )}
                </div>

                {log.projectHref && log.projectTitle && (
                  <Link href={log.projectHref} className="inline-flex text-xs text-primary hover:underline">
                    {log.projectTitle}
                  </Link>
                )}

                {(log.whatHappened || log.entry) && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.whatHappened || log.entry}</p>
                )}

                {(log.problems || log.nextStep) && (
                  <div className="space-y-1">
                    {log.problems && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                        Problem: {log.problems}
                      </p>
                    )}
                    {log.nextStep && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap">
                        Next: {log.nextStep}
                      </p>
                    )}
                  </div>
                )}

                {log.sessionType && log.sessionType.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {log.sessionType.map((sessionType) => (
                      <Badge
                        key={`${key}-${sessionType}`}
                        variant="outline"
                        className="text-[10px] pointer-events-none cursor-default bg-muted/20"
                      >
                        {sessionType}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
