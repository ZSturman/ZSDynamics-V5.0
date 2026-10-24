import Link from "next/link";
import { workspaceRelease as release } from "@/lib/better-workspace";

export function ReleaseActions() {
  return <nav aria-label="Get Better Workspace" className="flex flex-wrap gap-3">
    <a href={release.store} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Install for iPhone &amp; iPad</a>
    <a href={release.download} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Download for Mac</a>
    <Link href={release.demo} className="rounded-lg border px-5 py-3 font-medium hover:bg-accent">Try Demo</Link>
    <a href={release.source} className="rounded-lg border px-5 py-3 font-medium hover:bg-accent">View Source</a>
  </nav>;
}
