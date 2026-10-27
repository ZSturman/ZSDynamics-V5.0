import type { Project, ProjectCaseStudy as CaseStudy } from "@/types";
import { MediaDisplay } from "@/components/ui/media-display";
import { getOptimizedMediaPath } from "@/lib/utils";

// Rendered in this order; any missing section is skipped.
const SECTIONS: Array<{ key: keyof Omit<CaseStudy, "media">; title: string }> = [
  { key: "problem", title: "Problem" },
  { key: "role", title: "My role" },
  { key: "architecture", title: "Architecture" },
  { key: "decisions", title: "Technical decisions" },
  { key: "challenges", title: "Challenges" },
  { key: "validation", title: "Validation" },
  { key: "results", title: "Results" },
  { key: "limitations", title: "Limitations and next steps" },
];

function toItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

export function hasCaseStudy(project: Project): boolean {
  const caseStudy = project.caseStudy;
  return Boolean(caseStudy && SECTIONS.some((section) => toItems(caseStudy[section.key]).length > 0));
}

/** Optional engineering case study from `caseStudy` metadata; never synthesized. */
export function ProjectCaseStudy({ project }: { project: Project }) {
  const caseStudy = project.caseStudy;
  if (!caseStudy || !hasCaseStudy(project)) return null;

  const sections = SECTIONS.map((section) => ({ ...section, items: toItems(caseStudy[section.key]) })).filter(
    (section) => section.items.length > 0
  );
  const folderPath = `/projects/${project.folderName || project.id}`;
  const media = (caseStudy.media || []).filter((item) => item?.path && item?.alt);

  return (
    <section
      id="case-study"
      data-testid="project-case-study"
      aria-labelledby="case-study-heading"
      className="min-w-0 max-w-full scroll-mt-24 space-y-6"
    >
      <div>
        <h2 id="case-study-heading" className="text-xl font-bold text-foreground md:text-2xl">
          Engineering notes
        </h2>
        <nav aria-label="Engineering notes sections" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {sections.map((section) => (
            <a key={section.key} href={`#case-study-${section.key}`} className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
              {section.title}
            </a>
          ))}
        </nav>
      </div>

      {sections.map((section) => (
        <div key={section.key} id={`case-study-${section.key}`} className="scroll-mt-24">
          <h3 className="mb-2 text-base font-semibold text-foreground md:text-lg">{section.title}</h3>
          {section.items.length === 1 ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 md:text-base">{section.items[0]}</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 md:text-base">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {media.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {media.map((item) => (
            <figure key={item.path} className="space-y-1">
              <div className="relative aspect-video overflow-hidden rounded-md border border-border/40 bg-muted">
                <MediaDisplay
                  src={/^https?:\/\//.test(item.path) ? item.path : getOptimizedMediaPath(item.path, folderPath)}
                  alt={item.alt}
                  fill
                  className="object-contain"
                  sizes="(min-width: 640px) 50vw, 100vw"
                />
              </div>
              {item.caption ? <figcaption className="text-xs text-muted-foreground">{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
