import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { FlashcardDemo } from "@/components/project-demos/flashcard-demo";
export const metadata: Metadata = { title: "Recallable — Try the demo", description: "Flip a card, rate your recall and keep studying." };
export default function DemoPage() {
 return <PageFrame as="main" className="py-10"><PageColumn className="max-w-3xl space-y-8">
  <header className="space-y-3"><Link className="underline text-sm" href="/projects/recallable">← Recallable</Link><p className="text-sm font-medium text-primary">Interactive browser demo · Fictional data</p><h1 className="text-3xl font-semibold">Try Recallable</h1><p>Flip a card, rate your recall and keep studying.</p><p className="text-sm text-muted-foreground">A simplified walkthrough of the app. Use sample text; entries stay in this page until refresh. No account needed.</p></header>
  <FlashcardDemo />
  <footer className="flex flex-wrap gap-4 border-t pt-6"><Link href="https://apps.apple.com/us/app/id6822919785" className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">Get Recallable</Link><Link href="/projects/recallable" className="rounded-lg border px-5 py-3">Project story</Link></footer>
 </PageColumn></PageFrame>;
}
