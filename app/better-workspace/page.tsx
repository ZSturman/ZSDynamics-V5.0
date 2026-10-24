import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { ReleaseActions } from "@/components/better-workspace/release-actions";
import { workspaceRelease as release } from "@/lib/better-workspace";

export const metadata: Metadata = {
  title: "Better Workspace — Projects, ideas and next steps",
  description: "Projects, tasks and ideas across Mac, iPhone and iPad. Download advanced Mac 1.0 or explore the free browser demo.",
  alternates: { canonical: "/better-workspace" },
};

export default function BetterWorkspacePage() {
  return <PageFrame as="main" className="py-10 md:py-16">
    <PageColumn className="space-y-12 leading-relaxed">
      <header className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">Native Apple apps · Personal, creative &amp; technical projects</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Better Workspace</h1>
        <p className="max-w-2xl text-2xl">Your projects. Your ideas.<br />A useful next step.</p>
        <p className="max-w-2xl text-muted-foreground">Keep tasks, ideas and plans close to the work they belong to. Browse the folders you already use, capture a thought before it disappears, and pick up where you left off.</p>
        <ReleaseActions />
        <p className="text-sm text-muted-foreground">Advanced Mac 1.0 · macOS 14.4+ · Apple silicon &amp; Intel · Free &amp; open source</p>
      </header>
      <figure className="space-y-3">
        <Image src={`${release.images}/mac-personal-sample.webp`} alt="Real native Mac personal workspace showing a fictional garden journal project and its next task" width={1280} height={800} priority className="h-auto w-full rounded-xl border shadow-lg" />
        <figcaption className="text-sm text-muted-foreground">The native personal workspace, shown with private sample content. <Link className="underline" href={release.demo}>Explore the guided demo</Link>.</figcaption>
      </figure>
      <section className="space-y-5" aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-semibold">Less searching. More moving forward.</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Keep the context", "Bring tasks, ideas and documents together around each project."], ["Choose what matters", "Use priorities, progress and work history to find a manageable next action."], ["Capture, then decide", "Save a thought, link or file quickly. Review where it belongs when you are ready."]].map(([title, body]) => <article className="rounded-xl border p-5" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{body}</p></article>)}
        </div>
      </section>
      <section className="space-y-4" aria-labelledby="editions-title">
        <h2 id="editions-title" className="text-2xl font-semibold">Choose your workspace</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border p-6 space-y-3"><p className="text-sm font-medium text-primary">Available now</p><h3 className="text-xl font-semibold">Advanced Mac</h3><p>For existing folders, portable Markdown plans, project and idea scoring, Quick Capture, work history and reviewed automation. Optional Notion and agent tools fit around your workflow.</p><p className="text-sm text-muted-foreground">Signed, notarized and stapled. Includes its runtime; no Terminal setup needed.</p><a className="inline-block underline" href={release.download}>Download advanced Mac</a></article>
          <article className="rounded-xl border p-6 space-y-3"><p className="text-sm font-medium text-muted-foreground">iPhone · iPad</p><h3 className="text-xl font-semibold">Mobile workspace</h3><p>Create projects, tasks, ideas and documents, work offline, and sync through your private iCloud account when available. Connect to the advanced Mac when you need its files and integrations.</p><p className="text-sm text-muted-foreground" data-testid="store-status">{release.storeStatus}</p></article>
        </div>
        <p className="text-sm text-muted-foreground">The optional connected mobile workspace adds access to your advanced Mac’s published folder index and queued captures. Applying its changes needs that Mac online. Personal records use their own private workspace.</p>
      </section>
      <section className="space-y-4" id="getting-started">
        <h2 className="text-2xl font-semibold">From download to your first next step</h2>
        <ol className="list-decimal space-y-3 pl-6">
          <li><strong>Install.</strong> Download BetterWorkspace-1.0-8-mac.zip, open the ZIP, and drag Better Workspace.app to Applications. Open it from there.</li>
          <li><strong>Choose your folders.</strong> In Settings → General, select your workspace and inbox. Start with an empty folder to explore. Allow access to the folders you choose.</li>
          <li><strong>Bring in a project.</strong> Browse an existing project or add a folder under Projects. Review its setup prompt, then add a task or work plan.</li>
          <li><strong>Keep ideas and captures nearby.</strong> Save early possibilities in Ideas. Use Quick Capture / Ingest for thoughts, links or files, then review their destinations.</li>
          <li><strong>Pick a next action.</strong> Set priorities and return to Overview. Use project progress and work history to decide what deserves attention.</li>
          <li><strong>Enable more when needed.</strong> Settings → Services installs the included background service. Mobile publishing, Notion, notifications and agent tools are optional.</li>
        </ol>
        <Link href="/better-workspace/support" className="inline-block underline">Setup, iCloud and troubleshooting</Link>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">At home on every screen</h2>
        <div className="grid items-start gap-5 sm:grid-cols-[1fr_2fr]">
          <figure><Image src={`${release.images}/iphone-personal-sample.webp`} alt="iPhone personal workspace with fictional sample projects and tasks" width={1206} height={2622} className="h-auto max-h-[560px] w-full rounded-xl border object-contain" /><figcaption className="mt-2 text-sm text-muted-foreground">iPhone · capture and keep the next step close</figcaption></figure>
          <figure><Image src={`${release.images}/ipad-personal-sample.webp`} alt="iPad personal workspace with fictional sample projects and tasks" width={2064} height={2752} className="h-auto max-h-[560px] w-full rounded-xl border object-contain" /><figcaption className="mt-2 text-sm text-muted-foreground">iPad · room to plan and explore</figcaption></figure>
        </div>
      </section>
      <section className="space-y-4 rounded-xl border bg-accent/30 p-6"><h2 className="text-2xl font-semibold">Take a look before you install</h2><p>Walk through real sample screens and try completing a task or capturing a fictional idea. No account, installation or personal workspace access.</p><ReleaseActions /></section>
      <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm text-muted-foreground"><Link href="/projects/better-workspace" className="underline">Project story &amp; gallery</Link><a href={release.release} className="underline">Release notes &amp; checksum</a><Link href="/better-workspace/support" className="underline">Support</Link><Link href="/better-workspace/privacy" className="underline">Privacy policy</Link></footer>
    </PageColumn>
  </PageFrame>;
}
