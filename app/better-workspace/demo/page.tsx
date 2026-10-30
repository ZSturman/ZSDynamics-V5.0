import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { WorkspaceDemo } from "@/components/better-workspace/workspace-demo";
import { workspaceRelease as release } from "@/lib/better-workspace";
import { ReleaseActions } from "@/components/better-workspace/release-actions";

const routeMetadata: Metadata = {
  title: "Try Better Workspace — Interactive Demo",
  description: "Explore real Better Workspace screens and fictional sample workflows without installing an app or connecting an account.",
  alternates: { canonical: "/better-workspace/demo" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Try Better Workspace — Interactive Demo', routeMetadata.description || 'Product information, availability, and ways to explore.', '/better-workspace/demo') };

export default function DemoPage() {
  return <PageFrame as="main" className="py-10"><PageColumn className="space-y-8">
    <header className="space-y-3"><Link href="/better-workspace" className="text-sm underline">← Better Workspace</Link><p className="text-sm font-medium text-primary">Browser demonstration · Fictional data</p><h1 className="text-3xl font-semibold md:text-4xl">A little workspace. A next step.</h1><p className="text-muted-foreground">Follow the garden journal from a project to a task, a fresh idea and a quick capture. Real application screenshots anchor the walkthrough; the practice controls below are a simplified web demonstration.</p></header>
    <WorkspaceDemo />
    <section className="space-y-4 border-t pt-6"><h2 className="text-xl font-semibold">Make room for your own projects</h2><p className="text-muted-foreground">{release.storeStatus}</p><ReleaseActions /></section>
  </PageColumn></PageFrame>;
}
