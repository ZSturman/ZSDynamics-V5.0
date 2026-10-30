import Link from "next/link";
import { loadProjectsManifest } from "@/lib/load-projects";
import { applicationResources } from "@/lib/product-presentation";

/** All actions and platforms come from the same Workspace-generated record as the archive. */
export async function ProductActions({ slug }: { slug: string }) {
  const project = (await loadProjectsManifest()).find((p) => p.slug === slug);
  if (!project) return null;
  return <section aria-label={`${project.title} actions`} data-analytics-project-slug={project.slug} data-analytics-project-id={project.id} data-analytics-surface="product_actions" className="space-y-4 rounded-xl border border-border p-5">
    <h2 className="text-xl font-semibold">Explore {project.title}</h2>
    <p className="text-sm text-muted-foreground">{project.application?.platforms?.join(" · ")}</p>
    <div className="flex flex-wrap gap-3">
      {applicationResources(project).map((r) => <Link key={r.url} href={r.url} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">{r.label}</Link>)}
      <Link href={`/projects/${project.slug}`} className="inline-flex min-h-11 items-center px-2 text-sm underline">How it was built</Link>
      <Link href={`/work-logs?project=${project.slug}`} className="inline-flex min-h-11 items-center px-2 text-sm underline">Development updates</Link>
    </div>
  </section>;
}
