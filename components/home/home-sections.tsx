import Link from "next/link";

import { FOCUS_AREAS, getProjectFocusAreas } from "@/lib/project-presentation";
import { howIWork } from "@/lib/site-content";
import type { Article, Project } from "@/types";

const SECTION_HEADING_CLASS = "mb-5 text-xl font-semibold text-foreground md:text-2xl";

export function ExploreByFocus({ projects }: { projects: Project[] }) {
  const counts = new Map<string, number>();
  for (const project of projects) {
    for (const key of getProjectFocusAreas(project)) counts.set(key, (counts.get(key) || 0) + 1);
  }

  return (
    <section aria-labelledby="explore-heading" data-testid="explore-by-focus" className="mb-14">
      <h2 id="explore-heading" className={SECTION_HEADING_CLASS}>
        Explore by focus
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FOCUS_AREAS.map((area) => (
          <li key={area.key}>
            <Link
              href={`/explore/${area.key}`}
              data-testid={`explore-link-${area.key}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border/40 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-foreground">{area.label}</span>
              <span className="text-sm leading-snug text-muted-foreground">{area.description}</span>
              <span className="mt-auto pt-2 text-xs text-muted-foreground">
                {counts.get(area.key) || 0} projects →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowIWork() {
  return (
    <section aria-labelledby="how-i-work-heading" data-testid="how-i-work" className="mb-14">
      <h2 id="how-i-work-heading" className={SECTION_HEADING_CLASS}>
        How I work
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {howIWork.map((principle) => (
          <div key={principle.title} className="border-l-2 border-primary/30 pl-4">
            <h3 className="font-medium text-foreground">{principle.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{principle.body}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {principle.examples.map((example) => (
                <Link key={example.href} href={example.href} className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                  {example.label}
                </Link>
              ))}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function articleTime(article: Article): number {
  const parsed = Date.parse(article.publishedAt || article.updatedAt || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function RecentWriting({ articles, limit = 3 }: { articles: Article[]; limit?: number }) {
  const recent = [...articles].sort((a, b) => articleTime(b) - articleTime(a)).slice(0, limit);
  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="writing-heading" data-testid="recent-writing" className="mb-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h2 id="writing-heading" className="text-xl font-semibold text-foreground md:text-2xl">
          Recent writing
        </h2>
        <span className="flex gap-4 text-sm">
          <Link href="/articles" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
            All articles →
          </Link>
          <Link href="/work-logs" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
            Work logs →
          </Link>
        </span>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {recent.map((article) => (
          <li key={article.slug}>
            <Link
              href={article.href}
              className="flex h-full flex-col gap-1 rounded-lg border border-border/40 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium leading-snug text-foreground">{article.title}</span>
              <span className="line-clamp-3 text-sm text-muted-foreground">
                {article.oneLiner || article.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
