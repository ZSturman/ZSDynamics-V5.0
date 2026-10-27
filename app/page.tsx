import { ExploreByFocus, HowIWork, RecentWriting } from "@/components/home/home-sections";
import { SelectedWork } from "@/components/home/selected-work";
import { PortfolioPageClient } from "@/components/portfolio-page-client";
import { PersonJsonLd } from "@/components/seo/person-json-ld";
import { loadArticles } from "@/lib/load-articles";
import { loadPersonalLinks } from "@/lib/personal-links";
import { loadProjectsManifest } from "@/lib/load-projects";
import { loadSelectedWorkSlugs } from "@/lib/load-selected-work";
import { getSelectedWork } from "@/lib/project-presentation";

export default async function PortfolioPage() {
  const [projects, articles, selectedSlugs] = await Promise.all([
    loadProjectsManifest(),
    loadArticles(),
    loadSelectedWorkSlugs(),
  ]);
  const profileLinks = loadPersonalLinks()
    .links.filter((link) => link.key === "github" || link.key === "linkedin")
    .map(({ key, label, href }) => ({ key, label, href }));

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PersonJsonLd />
      <PortfolioPageClient projects={projects} profileLinks={profileLinks} archiveHeading="Complete project archive">
        <SelectedWork projects={getSelectedWork(projects, undefined, selectedSlugs)} />
        <ExploreByFocus projects={projects} />
        <HowIWork />
        <RecentWriting articles={articles} />
      </PortfolioPageClient>
    </div>
  );
}
