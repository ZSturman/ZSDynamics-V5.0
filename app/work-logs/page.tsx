import type { Project } from "@/types";
import { loadPublicJsonRecursively } from "@/lib/load-public-json";
import { buildWorkLogsDashboardData } from "@/lib/work-logs";
import { WorkLogsPageClient } from "@/components/work-logs/work-logs-page-client";

export const dynamic = "force-static";

export default async function WorkLogsPage() {
  const projects = await loadPublicJsonRecursively<Project>("projects");
  const dashboardData = buildWorkLogsDashboardData(projects);

  return <WorkLogsPageClient {...dashboardData} />;
}
