import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/layout/content-page";
import { ResumeActions } from "@/components/profile/profile-sections";
import { PersonJsonLd } from "@/components/seo/person-json-ld";
import { aboutSections, profile } from "@/lib/site-content";

const routeMetadata: Metadata = {
  title: "About",
  description: "Background, current focus, and how Zachary Sturman approaches software, data, and hardware projects.",
  alternates: { canonical: "/about" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('About', routeMetadata.description || "Portfolio information.", "/about") };

export default function AboutPage() {
  return (
    <ContentPage title="About" intro={`${profile.intro} ${profile.location}.`} testId="about-page">
      <PersonJsonLd />
      {/* A real photograph can be added here; see docs/CONTENT_REVIEW.md. */}
      <div className="space-y-10">
        {aboutSections.map((section) => (
          <section key={section.heading} aria-labelledby={`about-${section.heading}`}>
            <h2 id={`about-${section.heading}`} className="mb-3 text-xl font-semibold text-foreground">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mb-3 leading-relaxed text-foreground/90">
                {paragraph}
              </p>
            ))}
            {section.links?.length ? (
              <p className="flex flex-wrap gap-x-4 text-sm">
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                    {link.label} →
                  </Link>
                ))}
              </p>
            ) : null}
          </section>
        ))}

        <blockquote className="border-l-2 border-primary/30 pl-4 text-lg italic text-muted-foreground">
          {profile.statement}
        </blockquote>

        <section aria-labelledby="about-next">
          <h2 id="about-next" className="mb-3 text-xl font-semibold text-foreground">Working together</h2>
          <p className="mb-4 leading-relaxed text-foreground/90">{profile.opportunities}</p>
          <ResumeActions testIdPrefix="about-resume" />
        </section>
      </div>
    </ContentPage>
  );
}
