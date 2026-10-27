import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { SiteNav } from "@/components/layout/site-nav";

/** Shared frame for profile pages: site navigation, page heading, readable column. */
export function ContentPage({
  title,
  intro,
  children,
  testId,
  wide = false,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  testId?: string;
  wide?: boolean;
}) {
  return (
    <PageFrame data-testid="site-page-frame" className="overflow-x-hidden py-6 md:py-8">
      <SiteNav className="mb-10 md:mb-14" />
      <main data-testid={testId} className={wide ? "" : "max-w-3xl"}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {intro ? <div className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </main>
    </PageFrame>
  );
}
