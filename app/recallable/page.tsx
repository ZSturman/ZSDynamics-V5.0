import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Recallable — A calmer way to remember",
  description: "A native flashcard app being prepared for the App Store.",
  alternates: { canonical: "/recallable" },
};

export default function RecallablePage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <h1 className="text-4xl font-semibold">Recallable</h1>
        <p className="text-xl">A calmer way to remember.</p>
        <p>A native flashcard app with focused study rounds, rich text and math, widgets and private iCloud sync across your Apple devices.</p>
        <section className="rounded-xl border p-5 space-y-2" aria-label="Release status">
          <h2 className="text-xl font-semibold">Preparing for the App Store</h2>
          <p>Recallable is not available to download yet.</p>
        </section>
        <Link href="/projects/recallable" className="inline-block underline">Explore the project and screenshots</Link>
        <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm text-muted-foreground">
          <Link href="/recallable/support" className="underline">Support</Link>
          <Link href="/recallable/privacy" className="underline">Privacy policy</Link>
        </footer>
      </PageColumn>
    </PageFrame>
  );
}
