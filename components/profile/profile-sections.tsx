import Link from "next/link";

import { FooterAnalyticsLink } from "@/components/analytics/footer-analytics-link";
import { Button } from "@/components/ui/button";
import { getProjectHref } from "@/lib/project-paths";
import { portfolioData, profile, type TagGroup, type TimelineItem } from "@/lib/site-content";
import type { Project } from "@/types";

const SECTION_HEADING = "mb-5 text-xl font-semibold text-foreground md:text-2xl";

function RoleEntry({ role, projects, compact }: { role: TimelineItem; projects: Project[]; compact?: boolean }) {
  const project = role.projectSlug ? projects.find((item) => item.slug === role.projectSlug) : undefined;

  return (
    <li data-testid="experience-role" className="border-l-2 border-border/60 pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-semibold text-foreground">{role.title}</h3>
        {role.period ? <span className="text-sm text-muted-foreground">{role.period}</span> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {role.subtitle}
        {role.engagement ? <span data-testid="experience-engagement"> · {role.engagement}</span> : null}
      </p>
      {!compact && role.details?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90">
          {role.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {!compact && role.technologies?.length ? (
        <p className="mt-2 text-xs text-muted-foreground">{role.technologies.join(" · ")}</p>
      ) : null}
      {project ? (
        <Link href={getProjectHref(project)} className="mt-2 inline-block text-sm text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
          Related project: {project.title} →
        </Link>
      ) : null}
    </li>
  );
}

export function ExperienceList({ projects, compact = false }: { projects: Project[]; compact?: boolean }) {
  const { roles, otherRoles = [] } = portfolioData.experience;
  return (
    <section aria-labelledby="experience-heading" className="mb-12">
      <h2 id="experience-heading" className={SECTION_HEADING}>Professional experience</h2>
      <ul className="space-y-7">
        {roles.map((role) => (
          <RoleEntry key={`${role.title}-${role.subtitle}`} role={role} projects={projects} compact={compact} />
        ))}
      </ul>
      {otherRoles.length > 0 ? (
        <>
          <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Other work</h3>
          <ul className="space-y-4">
            {otherRoles.map((role) => (
              <RoleEntry key={role.title} role={role} projects={projects} compact={compact} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export function EducationAndCertifications() {
  const { education, certifications } = portfolioData.skills;
  return (
    <section aria-labelledby="education-heading" className="mb-12">
      <h2 id="education-heading" className={SECTION_HEADING}>Education & certifications</h2>
      <ul className="space-y-4">
        {education.map((item) => (
          <li key={item.title}>
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="text-sm text-muted-foreground">
              {item.subtitle}
              {item.period ? ` · ${item.period}` : ""}
            </p>
            {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
          </li>
        ))}
      </ul>
      <ul className="mt-5 flex flex-wrap gap-2">
        {certifications.map((cert) => (
          <li key={cert.name} className="rounded-md border border-border/60 px-3 py-1.5 text-sm">
            {cert.name}
            {cert.year ? <span className="text-muted-foreground"> · {cert.year}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TagGroups({ id, title, groups }: { id: string; title: string; groups: TagGroup[] }) {
  return (
    <section aria-labelledby={id} className="mb-12">
      <h2 id={id} className={SECTION_HEADING}>{title}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.category}>
            <dt className="text-sm font-medium text-foreground">{group.category}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{group.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ResumeActions({ testIdPrefix = "resume" }: { testIdPrefix?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <FooterAnalyticsLink
          href={profile.resumeUrl}
          download={profile.resumeFileName}
          data-testid={`${testIdPrefix}-download`}
          data-analytics-skip="true"
          data-analytics-surface={testIdPrefix}
          analytics={{ type: "resume_download", url: profile.resumeUrl }}
        >
          Download résumé (PDF)
        </FooterAnalyticsLink>
      </Button>
      <Button asChild variant="outline">
        <FooterAnalyticsLink
          href={profile.resumeUrl}
          target="_blank"
          rel="noreferrer"
          data-testid={`${testIdPrefix}-view`}
          data-analytics-skip="true"
          data-analytics-surface={testIdPrefix}
          analytics={{ type: "resume_view", url: profile.resumeUrl }}
        >
          View PDF
        </FooterAnalyticsLink>
      </Button>
      <Button asChild variant="outline">
        <Link href="/contact" data-analytics-surface={testIdPrefix}>Contact me</Link>
      </Button>
    </div>
  );
}
