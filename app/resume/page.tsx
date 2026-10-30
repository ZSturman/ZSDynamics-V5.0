import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";

import { ContentPage } from "@/components/layout/content-page";
import {
  EducationAndCertifications,
  ExperienceList,
  ResumeActions,
  TagGroups,
} from "@/components/profile/profile-sections";
import { loadProjectsManifest } from "@/lib/load-projects";
import { portfolioData, profile } from "@/lib/site-content";

const routeMetadata: Metadata = {
  title: "Résumé",
  description: "Résumé summary and downloadable PDF for Zachary Sturman, software engineer near Seattle, WA.",
  alternates: { canonical: "/resume" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Résumé', routeMetadata.description || "Portfolio information.", "/resume") };

export default async function ResumePage() {
  const projects = await loadProjectsManifest();
  return (
    <ContentPage title="Résumé" testId="resume-page" intro={<>{profile.intro} {profile.background}</>}>
      <div className="mb-10 space-y-3">
        <ResumeActions testIdPrefix="resume-page" />
        <p className="text-sm text-muted-foreground">
          {profile.location} · {profile.email}
        </p>
      </div>
      <ExperienceList projects={projects} compact />
      <EducationAndCertifications />
      <TagGroups id="resume-skills-heading" title="Technical skills" groups={portfolioData.skills.tagGroups} />
    </ContentPage>
  );
}
