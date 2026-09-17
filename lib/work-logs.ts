import { getProjectIdentityMedia } from "@/lib/project-identity";
import { getProjectHref, getProjectSlug } from "@/lib/project-paths";
import { formatDate } from "@/lib/utils";
import type { Project, WorkLog } from "@/types";

export type WorkLogWithProject = WorkLog & {
  projectId?: string;
  projectSlug?: string;
  projectTitle?: string;
  projectHref?: string;
  projectFolderName?: string;
  projectIconSrc?: string | null;
  projectThumbnailSrc?: string | null;
};

export interface WorkLogProjectOption {
  id: string;
  slug: string;
  href: string;
  title: string;
  projectIconSrc?: string | null;
  projectThumbnailSrc?: string | null;
}

export interface WorkLogSessionSummary {
  sessionType: string;
  count: number;
}

export interface WorkLogOverviewSummary {
  totalLogs: number;
  totalProjects: number;
  totalDurationMinutes: number;
  mostRecentSessionStart?: string;
  earliestSessionStart?: string;
  latestSessionStart?: string;
  logsLast30Days: number;
  activeProjectsLast30Days: number;
}

export interface WorkLogProjectSummary extends WorkLogProjectOption {
  logCount: number;
  totalDurationMinutes: number;
  latestSessionStart?: string;
  earliestSessionStart?: string;
  latestLogTitle?: string;
  latestLogSummary?: string;
  sessionSummaries: WorkLogSessionSummary[];
}

export interface WorkLogsDashboardData {
  logs: WorkLogWithProject[];
  projectOptions: WorkLogProjectOption[];
  projectSummaries: WorkLogProjectSummary[];
  overviewSummary: WorkLogOverviewSummary;
  sessionSummaries: WorkLogSessionSummary[];
}

export function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getWorkLogStart(log: Pick<WorkLog, "startTime" | "sessionStart" | "date">): string | undefined {
  return log.startTime || log.sessionStart || log.date;
}

export function getWorkLogEnd(
  log: Pick<WorkLog, "endTime" | "sessionEnd" | "startTime" | "sessionStart" | "date">
): string | undefined {
  return log.endTime || log.sessionEnd || getWorkLogStart(log);
}

export function getWorkLogTimestamp(log: Pick<WorkLog, "startTime" | "sessionStart" | "date">): number {
  return toTimestamp(getWorkLogStart(log));
}

export function getWorkLogDurationMinutes(
  log: Pick<WorkLog, "durationMinutes" | "endTime" | "sessionEnd" | "startTime" | "sessionStart" | "date">
): number {
  if (typeof log.durationMinutes === "number" && log.durationMinutes > 0) {
    return log.durationMinutes;
  }

  const start = toTimestamp(getWorkLogStart(log));
  const end = toTimestamp(getWorkLogEnd(log));
  if (!start || !end || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function getWorkLogTitle(log: Pick<WorkLog, "title" | "entry">): string {
  return log.title || log.entry || "Work log";
}

export function getWorkLogSummary(log: Pick<WorkLog, "whatHappened" | "entry">): string {
  return log.whatHappened || log.entry || "";
}

export function formatWorkLogSessionRange(
  log: Pick<WorkLog, "endTime" | "sessionEnd" | "startTime" | "sessionStart" | "date">
): string {
  const start = getWorkLogStart(log);
  const end = getWorkLogEnd(log);

  if (!start && !end) return "Session time not set";
  if (!start && end) {
    const endLabel = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
    return endLabel ? `Ends ${endLabel}` : "Session time not set";
  }
  if (!start) return "Session time not set";

  const startTs = toTimestamp(start);
  const endTs = toTimestamp(end);
  const startDay = formatDate(start, { month: "short", day: "numeric", year: "numeric" });
  const startClock = formatDate(start, { hour: "numeric", minute: "2-digit" });

  if (!end || !startTs || !endTs || endTs <= startTs) {
    if (startDay && startClock) return `${startDay} · ${startClock}`;
    return startDay || "Session time not set";
  }

  const endDay = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
  const endClock = formatDate(end, { hour: "numeric", minute: "2-digit" });

  if (startDay && endDay && startDay === endDay && startClock && endClock) {
    return `${startDay} · ${startClock} - ${endClock}`;
  }

  const startPart = [startDay, startClock].filter(Boolean).join(" ");
  const endPart = [endDay, endClock].filter(Boolean).join(" ");

  if (!startPart && !endPart) return "Session time not set";
  if (!startPart) return `Ends ${endPart}`;
  if (!endPart) return startPart;

  return `${startPart} - ${endPart}`;
}

export function buildWorkLogSessionSummaries(logs: Array<Pick<WorkLog, "sessionType">>): WorkLogSessionSummary[] {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const sessionTypes = Array.from(new Set((log.sessionType || []).filter(Boolean)));
    for (const sessionType of sessionTypes) {
      counts.set(sessionType, (counts.get(sessionType) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([sessionType, count]) => ({ sessionType, count }))
    .sort((left, right) => right.count - left.count || left.sessionType.localeCompare(right.sessionType));
}

function buildOverviewSummary(logs: WorkLogWithProject[]): WorkLogOverviewSummary {
  const sortedLogs = [...logs].sort((left, right) => getWorkLogTimestamp(right) - getWorkLogTimestamp(left));
  const totalDurationMinutes = sortedLogs.reduce((sum, log) => sum + getWorkLogDurationMinutes(log), 0);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const logsLast30Days = sortedLogs.filter((log) => getWorkLogTimestamp(log) >= thirtyDaysAgo).length;
  const activeProjectsLast30Days = new Set(
    sortedLogs
      .filter((log) => getWorkLogTimestamp(log) >= thirtyDaysAgo)
      .map((log) => log.projectSlug || log.projectId)
      .filter(Boolean)
  ).size;

  const timestamps = sortedLogs.map((log) => getWorkLogTimestamp(log)).filter((value) => value > 0);
  const latestSessionStart = sortedLogs[0] ? getWorkLogStart(sortedLogs[0]) : undefined;
  const earliestSessionStart =
    timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : undefined;

  return {
    totalLogs: sortedLogs.length,
    totalProjects: new Set(sortedLogs.map((log) => log.projectSlug || log.projectId || log.projectTitle)).size,
    totalDurationMinutes,
    mostRecentSessionStart: latestSessionStart,
    earliestSessionStart,
    latestSessionStart,
    logsLast30Days,
    activeProjectsLast30Days,
  };
}

export function buildWorkLogsDashboardData(projects: Project[]): WorkLogsDashboardData {
  const allLogs: WorkLogWithProject[] = [];
  const projectOptions: WorkLogProjectOption[] = [];
  const projectSummaries: WorkLogProjectSummary[] = [];

  for (const project of projects) {
    const projectSlug = getProjectSlug(project);
    const projectHref = getProjectHref(project);
    const { projectIconSrc, projectThumbnailSrc } = getProjectIdentityMedia(project);
    const projectLogs = (project.workLogs || []).map<WorkLogWithProject>((workLog) => ({
      ...workLog,
      projectId: project.id,
      projectSlug,
      projectTitle: project.title,
      projectHref,
      projectFolderName: project.folderName || project.id,
      projectIconSrc,
      projectThumbnailSrc,
    }));

    projectLogs.sort((left, right) => getWorkLogTimestamp(right) - getWorkLogTimestamp(left));
    allLogs.push(...projectLogs);

    projectOptions.push({
      id: project.id,
      slug: projectSlug,
      href: projectHref,
      title: project.title,
      projectIconSrc,
      projectThumbnailSrc,
    });

    const latestLog = projectLogs[0];
    const latestSessionStart = latestLog ? getWorkLogStart(latestLog) : undefined;
    const earliestSessionStart = projectLogs.length
      ? getWorkLogStart(projectLogs[projectLogs.length - 1])
      : undefined;

    projectSummaries.push({
      id: project.id,
      slug: projectSlug,
      href: projectHref,
      title: project.title,
      projectIconSrc,
      projectThumbnailSrc,
      logCount: projectLogs.length,
      totalDurationMinutes: projectLogs.reduce((sum, log) => sum + getWorkLogDurationMinutes(log), 0),
      latestSessionStart,
      earliestSessionStart,
      latestLogTitle: latestLog ? getWorkLogTitle(latestLog) : undefined,
      latestLogSummary: latestLog ? getWorkLogSummary(latestLog) : undefined,
      sessionSummaries: buildWorkLogSessionSummaries(projectLogs),
    });
  }

  allLogs.sort((left, right) => getWorkLogTimestamp(right) - getWorkLogTimestamp(left));
  projectOptions.sort((left, right) => left.title.localeCompare(right.title));
  projectSummaries.sort((left, right) => {
    const recency = toTimestamp(right.latestSessionStart) - toTimestamp(left.latestSessionStart);
    if (recency !== 0) return recency;
    if (right.logCount !== left.logCount) return right.logCount - left.logCount;
    return left.title.localeCompare(right.title);
  });

  return {
    logs: allLogs,
    projectOptions,
    projectSummaries,
    overviewSummary: buildOverviewSummary(allLogs),
    sessionSummaries: buildWorkLogSessionSummaries(allLogs),
  };
}
