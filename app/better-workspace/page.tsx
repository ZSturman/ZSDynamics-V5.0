import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Better Workspace — Projects, ideas and next steps",
  description: "A native personal workspace for Mac, iPhone and iPad. Currently in private testing.",
  alternates: { canonical: "/better-workspace" },
};

export default function BetterWorkspacePage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <p className="text-sm text-muted-foreground">Mac · iPhone · iPad</p>
        <h1 className="text-4xl font-semibold">Better Workspace</h1>
        <p className="text-xl">Projects, ideas and a useful next step.</p>
        <p>Keep projects, tasks, ideas and documents together in a native personal workspace. Work locally, with private iCloud synchronization when available. The optional advanced Mac edition adds real folders, portable Markdown plans, capture and reviewed automation.</p>
        <section className="rounded-xl border p-5 space-y-2" aria-label="Release status">
          <h2 className="text-xl font-semibold">In private testing</h2>
          <p>Better Workspace is being prepared for release. There is no public App Store listing or Mac download yet.</p>
        </section>
        <Image src="/projects/better_workspace_210b2324-2bdf-5751-a101-9c334db91f8c/images/mac-personal-sample.webp" alt="Better Workspace on Mac with private sample projects and tasks" width={1280} height={800} className="h-auto w-full rounded-xl border" />
        <Link href="/projects/better-workspace" className="inline-block underline">Explore the project and screenshots</Link>
        <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm text-muted-foreground">
          <Link href="/better-workspace/support" className="underline">Setup &amp; support</Link>
          <Link href="/better-workspace/privacy" className="underline">Privacy policy</Link>
        </footer>
      </PageColumn>
    </PageFrame>
  );
}
