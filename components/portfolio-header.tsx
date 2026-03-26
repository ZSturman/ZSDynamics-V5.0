"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import SocialLinks from "./social-links";
// import PersonalTabs from "./personal-tabs";

const ThemeToggle = dynamic(() =>
  import("@/components/global-ui/theme-toggle").then((m) => m.ThemeToggle)
);

export function PortfolioHeader() {
  const name = "Zachary Sturman";
  const title =
    "I think a lot about how design influences trust, and how AI can support human judgment instead of replacing it.";

  return (
    <header className="mb-8 md:mb-12 text-center md:text-left max-w-full overflow-x-hidden">
      <div className="flex items-center justify-end">
        <ThemeToggle />
      </div>

{/*       <h1 className="text-4xl font-light tracking-tight text-foreground transition-colors group-hover:text-muted-foreground md:text-5xl"> */}
<h1 className="text-3xl md:text-4xl lg:text-5xl font-light dark:text-[#4a9eff] text-[#244468] uppercase tracking-wide break-words">
        {name}
      </h1>

      <h2 className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-4 text-balance break-words">
        {title}
      </h2>

      <SocialLinks />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground md:justify-start">
        <Link href="/articles" className="hover:text-foreground transition-colors">
          Articles
        </Link>
        <Link
          href="/work-logs"
          className="hover:text-foreground transition-colors"
        >
          Work Logs
        </Link>
      </div>
{/*       <PersonalTabs /> */}
    </header>
  );
}
