"use client";

import Link from "next/link";

import { FooterAnalyticsLink } from "@/components/analytics/footer-analytics-link";
import { SiteNav } from "@/components/layout/site-nav";
import { Button } from "@/components/ui/button";
import { profile } from "@/lib/site-content";

export interface ProfileLink {
  key: string;
  label: string;
  href: string;
}

export function PortfolioHeader({ profileLinks = [] }: { profileLinks?: ProfileLink[] }) {
  return (
    <header className="mb-12 max-w-full overflow-x-hidden md:mb-16">
      <SiteNav className="mb-10 md:mb-14" />

      <div className="max-w-3xl">
        <h1 className="break-words text-3xl font-light uppercase tracking-wide text-[#244468] dark:text-[#4a9eff] md:text-4xl lg:text-5xl">
          {profile.name}
        </h1>

        <p data-testid="profile-headline" className="mt-3 text-base font-medium text-foreground md:text-lg">
          {profile.headline.join(" · ")}
        </p>

        <p className="mt-5 text-lg leading-relaxed text-foreground/90 text-pretty md:text-xl">{profile.intro}</p>
        <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{profile.background}</p>
        <p data-testid="profile-availability" className="mt-3 leading-relaxed text-muted-foreground">
          {profile.location}. {profile.opportunities}
        </p>

        <div className="mt-7 flex flex-wrap gap-3" data-testid="profile-actions">
          <Button asChild>
            <a href="#selected-work">View selected work</a>
          </Button>
          <Button asChild variant="outline">
            <FooterAnalyticsLink
              href={profile.resumeUrl}
              download={profile.resumeFileName}
              data-testid="hero-resume-download"
              data-analytics-skip="true"
              data-analytics-surface="home_hero"
              analytics={{ type: "resume_download", url: profile.resumeUrl }}
            >
              Download résumé (PDF)
            </FooterAnalyticsLink>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact" data-testid="hero-contact">Contact me</Link>
          </Button>
        </div>

        {profileLinks.length > 0 ? (
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profileLinks.map((link) => (
              <FooterAnalyticsLink
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                data-testid={`hero-profile-link-${link.key}`}
                data-analytics-skip="true"
                data-analytics-surface="home_hero"
                analytics={{ type: "social", network: link.key }}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {link.label}
              </FooterAnalyticsLink>
            ))}
          </p>
        ) : null}

        <blockquote
          data-testid="profile-statement"
          className="mt-8 border-l-2 border-primary/30 pl-4 text-base italic text-muted-foreground md:text-lg"
        >
          {profile.statement}
        </blockquote>
      </div>
    </header>
  );
}
