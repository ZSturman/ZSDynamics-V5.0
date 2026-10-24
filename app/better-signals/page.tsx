import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

const media = "/projects/better_signals_33baec94-4d3c-805b-aa92-e0d16cc8a3f1/images";
export const metadata: Metadata = {
  title: "Better Signals — Record a moment, keep the context",
  description: "A private recording app for iPhone, iPad, and Apple Watch. Record how your day feels and export your own data.",
  alternates: { canonical: "/better-signals" },
  openGraph: { images: [`${media}/social.jpg`] },
};

export default function BetterSignalsPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-12 leading-relaxed">
        <header className="grid items-center gap-8 rounded-3xl border bg-gradient-to-br from-teal-500/10 via-background to-indigo-500/10 p-6 sm:p-10 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <Image src={`${media}/icon-optimized.webp`} alt="Better Signals icon" width={88} height={88} className="rounded-2xl" />
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">iPhone · iPad · Apple Watch</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Better Signals</h1>
            <p className="text-2xl">Record a moment.<br />Keep the context.</p>
            <p>How focused do you feel? How pleasant is this moment? Record a short, labeled answer and carry on. Your history belongs to you.</p>
            <a href="https://apps.apple.com/us/app/better-signals/id6824696184" className="inline-block rounded-full bg-foreground px-5 py-3 font-medium text-background">Install from App Store</a>
          </div>
          <Image src={`${media}/iphone-home-optimized.webp`} alt="Better Signals Home with three synthetic Signals and their latest labeled answers" width={1320} height={2868} priority className="mx-auto w-full max-w-[260px] rounded-[2rem] border shadow-xl" />
        </header>
        <section className="grid gap-6 sm:grid-cols-3" aria-label="Features">
          {[
            ["One question at a time", "Twelve metrics in four categories, each with five labeled levels. Context and notes are optional."],
            ["A place for the context", "Opt in to location and familiar-place prompts. Review the answer, time, source, and location together."],
            ["Your data, in open formats", "Export CSV, JSON, JSON Lines, or GeoJSON. Connect read-only Shortcuts or keep a copy in Files."],
          ].map(([title, text]) => <article key={title} className="space-y-2"><h2 className="text-xl font-semibold">{title}</h2><p className="text-muted-foreground">{text}</p></article>)}
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">A record you can return to</h2>
          <div className="grid grid-cols-2 items-start gap-5 sm:grid-cols-3">
            {[["record", "Answer with a labeled level"], ["history", "Review your Signals"], ["export", "Take your data with you"]].map(([name, label]) => (
              <figure key={name} className="space-y-3">
                <Image src={`${media}/iphone-${name}-optimized.webp`} alt={label} width={1320} height={2868} className="w-full rounded-2xl border" />
                <figcaption className="text-sm text-muted-foreground">{label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Actual simulator captures with synthetic Signals.</p>
        </section>
        <section className="space-y-3 rounded-2xl border p-6" aria-label="Availability">
          <h2 className="text-xl font-semibold">Available on the App Store</h2>
          <p>The approved public release is version 1.1.0 (build 2), available in the United States. Newer TestFlight and local features are separate. It requires iOS or iPadOS 26; the paired Watch companion requires watchOS 26.</p>
          <p>No account, advertising, or developer analytics. iPad history stays separate; Watch Signals synchronize with the paired iPhone.</p>
        </section>
        <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm">
          <Link href="/better-signals/support" className="underline">Support</Link>
          <Link href="/better-signals/privacy" className="underline">Privacy policy</Link>
          <Link href="/contact" className="underline">Contact the developer</Link>
        </footer>
      </PageColumn>
    </PageFrame>
  );
}
