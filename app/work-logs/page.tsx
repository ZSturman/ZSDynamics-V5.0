import type { Project } from "@/types";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { getProjectHref, getProjectSlug } from "@/lib/project-paths";
import type { WorkLogWithProject } from "@/components/work-logs/work-log-timeline";
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
        projectSlug: getProjectSlug(project),
        projectTitle: project.title,
        projectHref: getProjectHref(project),
        projectFolderName: project.folderName || project.id,
      });
    }
  }

  const projectMeta = projects.map((project) => ({
    id: project.id,
    slug: getProjectSlug(project),
    href: getProjectHref(project),
    title: project.title,
  }));
  return <WorkLogsPageClient logs={allWorkLogs} projects={projectMeta} />;
}
