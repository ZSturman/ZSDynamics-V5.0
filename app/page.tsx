
import { PortfolioPageClient } from "@/components/portfolio-page-client";
import { loadProjectsManifest } from "@/lib/load-projects";

export default async function PortfolioPage() {
  const projects = await loadProjectsManifest();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PortfolioPageClient projects={projects} />
    </div>
  );
}
