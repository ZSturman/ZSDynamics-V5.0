import Link from "next/link";
import { Project } from "@/types";
import { WorkLogTimeline, WorkLogWithProject } from "@/components/work-logs/work-log-timeline";

interface ProjectWorkLogsProps {
  project: Project;
  limit?: number;
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ProjectWorkLogs({ project, limit = 6 }: ProjectWorkLogsProps) {
  const workLogs = (project.workLogs || []).filter((workLog) => Boolean(workLog.title || workLog.entry));
  if (workLogs.length === 0) {
    return null;
  }

  const projectLogs: WorkLogWithProject[] = [...workLogs]
    .sort((a, b) => toTimestamp(b.startTime || b.date) - toTimestamp(a.startTime || a.date))
    .slice(0, limit)
    .map((workLog) => ({
      ...workLog,
      projectId: project.id,
      projectTitle: project.title,
      projectHref: `/projects/${project.id}`,
    }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Work Logs</h3>
        <Link href={`/work-logs?project=${project.id}`} className="text-xs text-primary hover:underline">
          View timeline
        </Link>
      </div>
      <WorkLogTimeline logs={projectLogs} />
    </section>
  );
}
