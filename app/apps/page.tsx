import Link from "next/link";
import { ContentPage } from "@/components/layout/content-page";
import { ProductActions } from "@/components/products/product-sections";
import { loadProjectsManifest } from "@/lib/load-projects";
import { getApplications } from "@/lib/product-presentation";
import { pageMetadata } from "@/lib/site-metadata";
export const metadata = pageMetadata("Apps", "Explore native apps and browser demos, with platform and availability information.", "/apps");
export default async function AppsPage() {
  const projects = getApplications(await loadProjectsManifest());
  return <ContentPage title="Apps" intro="Useful applications, their browser demos, and the engineering behind them." wide>
    <div className="grid gap-6 md:grid-cols-2">
      {projects.map((project) => <article key={project.id} data-testid="app-card" className="min-w-0 space-y-4 rounded-2xl border border-border p-5">
        <h2 className="text-2xl font-semibold"><Link href={project.application!.landingPath} className="underline underline-offset-4">{project.title}</Link></h2>
        <p className="text-muted-foreground">{project.oneLiner || project.summary}</p>
        <ProductActions slug={project.slug || project.id} />
      </article>)}
    </div>
    <p className="mt-8 text-muted-foreground">Looking for research, experiments, hardware, or creative projects? <Link href="/projects" className="text-primary underline">Browse the complete project archive</Link>.</p>
  </ContentPage>;
}
