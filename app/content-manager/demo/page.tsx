import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { EditorialDemo } from "@/components/project-demos/editorial-demo";
const routeMetadata: Metadata = { title: "Content Manager — Try the demo", description: "Review a draft, compare its destination previews and approve or reject the exact text." };
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Content Manager — Try the demo', routeMetadata.description || 'Product information, availability, and ways to explore.', '/content-manager/demo') };
export default function DemoPage() {
 return <PageFrame as="main" className="py-10"><PageColumn className="max-w-3xl space-y-8">
  <header className="space-y-3"><Link className="underline text-sm" href="/projects/content-manager">← Content Manager</Link><p className="text-sm font-medium text-primary">Interactive browser demo · Fictional data</p><h1 className="text-3xl font-semibold">Try Content Manager</h1><p>Review a draft, compare its destination previews and approve or reject the exact text.</p><p className="text-sm text-muted-foreground">A simplified walkthrough of the app. Use sample text; entries stay in this page until refresh. No account needed.</p></header>
  <EditorialDemo />
  <footer className="flex flex-wrap gap-4 border-t pt-6"><Link href="/content-manager" className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">Explore the native app</Link><Link href="/projects/content-manager" className="rounded-lg border px-5 py-3">Project story</Link></footer>
 </PageColumn></PageFrame>;
}
