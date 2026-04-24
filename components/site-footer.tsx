import Image from "next/image";
import Link from "next/link";

import { PageFrame } from "@/components/layout/page-frame";
import { loadPersonalLinks, type PersonalLinkEntry } from "@/lib/personal-links";
import { SITE_DESCRIPTION } from "@/lib/site-metadata";
import { portfolioData } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Projects", href: "/#projects" },
  { label: "Articles", href: "/articles" },
  { label: "Work Logs", href: "/work-logs" },
] as const;

function isExternalLink(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

function FooterChipLink({
  href,
  label,
  iconSrc,
  dataTestId,
  download,
  openInNewTab,
}: {
  href: string;
  label: string;
  iconSrc: string;
  dataTestId: string;
  download?: string;
  openInNewTab?: boolean;
}) {
  const external = isExternalLink(href);
  const target = external || openInNewTab ? "_blank" : undefined;
  const rel = external || openInNewTab ? "noreferrer" : undefined;

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      download={download}
      data-testid={dataTestId}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-foreground/90 transition-colors",
        "hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Image
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={16}
        height={16}
        className="size-4 shrink-0 opacity-80 dark:invert"
      />
      <span>{label}</span>
    </a>
  );
}

function FooterProfileLinkList({ links }: { links: PersonalLinkEntry[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <FooterChipLink
          key={link.key}
          href={link.href}
          label={link.label}
          iconSrc={link.iconSrc}
          dataTestId={`site-footer-profile-link-${link.key}`}
        />
      ))}
    </div>
  );
}

export function SiteFooter() {
  const { links } = loadPersonalLinks();
  const resumeUrl = portfolioData.experience.resumeUrl;
  const currentYear = new Date().getFullYear();

  return (
    <footer data-testid="site-footer" className="border-t border-border/70 bg-background/95">
      <PageFrame className="py-10 md:py-12">
        <div className="rounded-[2rem] border border-border/60 bg-card/40 p-6 shadow-sm sm:p-7 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Zachary Sturman
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                Design, engineering, and writing in one shared portfolio.
              </h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">{SITE_DESCRIPTION}</p>
            </section>

            <section data-testid="site-footer-quick-nav" className="space-y-3">
              <nav className="flex flex-col gap-3 text-sm" aria-label="Footer">
                {QUICK_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-9 w-fit items-center rounded-md px-2 py-1 font-medium text-foreground/90 transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </section>

            <section data-testid="site-footer-profiles" className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Profiles
              </h3>
              <FooterProfileLinkList links={links} />
            </section>

            <section data-testid="site-footer-resume" className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Resume
              </h3>
              <div className="flex flex-wrap gap-2">
                <FooterChipLink
                  href={resumeUrl}
                  label="View Resume"
                  iconSrc="/icons/personal-resume.svg"
                  dataTestId="site-footer-resume-view"
                  openInNewTab
                />
                <FooterChipLink
                  href={resumeUrl}
                  label="Download PDF"
                  iconSrc="/icons/pdf.svg"
                  dataTestId="site-footer-resume-download"
                  download="Zachary Sturman Resume.pdf"
                />
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-border/60 pt-4 text-sm text-muted-foreground">
            <p>© {currentYear} Zachary Sturman. Built to keep projects, articles, and work logs in one consistent frame.</p>
          </div>
        </div>
      </PageFrame>
    </footer>
  );
}
