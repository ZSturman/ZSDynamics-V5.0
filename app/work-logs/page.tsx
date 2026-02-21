import type { Project } from "@/types";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { WorkLogWithProject } from "@/components/work-logs/work-log-timeline";
import { WorkLogsPageClient } from "@/components/work-logs/work-logs-page-client";

export const dynamic = "force-static";

export default async function WorkLogsPage() {
  const projects = await loadPublicJsonRecursively<Project>("projects");

  const allWorkLogs: WorkLogWithProject[] = [];
  for (const project of projects) {
    for (const workLog of project.workLogs || []) {
      allWorkLogs.push({
        ...workLog,
        projectId: project.id,
        projectTitle: project.title,
        projectHref: `/projects/${project.id}`,
      });
    }
  }

  const projectMeta = projects.map((project) => ({ id: project.id, title: project.title }));
  return <WorkLogsPageClient logs={allWorkLogs} projects={projectMeta} />;
}
