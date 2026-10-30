import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/layout/content-page";
import {
  EducationAndCertifications,
  ExperienceList,
  ResumeActions,
  TagGroups,
} from "@/components/profile/profile-sections";
import { loadProjectsManifest } from "@/lib/load-projects";
import { portfolioData } from "@/lib/site-content";

const routeMetadata: Metadata = {
  title: "Experience",
  description: "Professional software, data, and engineering experience, education, and certifications.",
  alternates: { canonical: "/experience" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Experience', routeMetadata.description || "Portfolio information.", "/experience") };

export default async function ExperiencePage() {
  const projects = await loadProjectsManifest();
  return (
    <ContentPage
      title="Experience"
      testId="experience-page"
      intro={
        <>
          Professional and contract roles from my résumé. Independent projects are listed separately under{" "}
          <Link href="/projects" className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Projects</Link>.
        </>
      }
    >
      <div className="mb-10">
        <ResumeActions testIdPrefix="experience-resume" />
      </div>
      <ExperienceList projects={projects} />
      <EducationAndCertifications />
      <TagGroups id="skills-heading" title="Technical skills" groups={portfolioData.skills.tagGroups} />
    </ContentPage>
  );
}
