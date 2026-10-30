import { pageMetadata } from "@/lib/site-metadata";
import { ProductActions } from "@/components/products/product-sections";
import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

const routeMetadata: Metadata = {
  title: "Recallable — A calmer way to remember",
  description: "A native flashcard app for focused study, widgets and private iCloud sync.",
  alternates: { canonical: "/recallable" },
};
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Recallable — A calmer way to remember', routeMetadata.description || 'Product information, availability, and ways to explore.', '/recallable') };

export default function RecallablePage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <h1 className="text-4xl font-semibold">Recallable</h1>
        <p className="text-xl">A calmer way to remember.</p>
        <p>A native flashcard app with focused study rounds, rich text and math, widgets and private iCloud sync across your Apple devices.</p>
        <section className="rounded-xl border p-5 space-y-2" aria-label="Release status">
          <h2 className="text-xl font-semibold">Released for iPhone and iPad</h2>
          <a href="https://apps.apple.com/us/app/id6822919785" className="inline-block rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">Get Recallable on the App Store</a>
          <p className="text-sm text-muted-foreground">Apple accepted the iOS release on October 24. Store availability may take time to reach every region. The separate Mac release is still in review.</p>
        </section>
        <section className="space-y-3" aria-label="Recallable screenshots">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/gallery-iphone-study-optimized.webp" alt="Recallable on iPhone: a question, its answer, and a focused study round" width={1600} height={900} className="h-auto w-full rounded-xl border object-contain" />
          <p className="text-sm text-muted-foreground">Actual iPhone app captures. Try three sample reviews in the browser demo.</p>
        </section>
        <Link href="/projects/recallable" className="inline-block underline">Explore the project and screenshots</Link>
        <ProductActions slug="recallable" />
        <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm text-muted-foreground">
          <Link href="/recallable/support" className="underline">Support</Link>
          <Link href="/recallable/privacy" className="underline">Privacy policy</Link>
        </footer>
      </PageColumn>
    </PageFrame>
  );
}
