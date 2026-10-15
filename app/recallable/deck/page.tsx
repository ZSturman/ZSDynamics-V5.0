import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { OpenDeck } from "./open-deck";

// Every https://zacharysturman.com/recallable/deck/<id> link serves this page (a Firebase rewrite).
// With Recallable installed, iOS and macOS open the app instead (Associated Domains); this page is
// for everyone else.
export const metadata: Metadata = {
  title: "A Recallable deck",
  description: "Someone shared a flashcard deck with you. Open it in Recallable, or get Recallable on the App Store.",
  itunes: { appId: "6822919785" },
  robots: { index: false },
  openGraph: {
    title: "A Recallable deck",
    description: "Someone shared a flashcard deck with you. Open it in Recallable, or get Recallable on the App Store.",
    url: "/recallable/deck",
  },
};

export default function RecallableDeckPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <Link href="/projects/recallable" className="underline">Recallable</Link>
        <h1 className="text-3xl font-semibold">Someone shared a deck with you</h1>
        <p>This link opens a flashcard deck in Recallable, the flashcard app for iPhone, iPad, Mac and Apple Watch. Open it in the app to see the cards, add the deck to your library and start studying.</p>
        <OpenDeck appStoreURL="https://apps.apple.com/app/id6822919785" />
        <p className="text-sm text-muted-foreground">Recallable needs iOS or iPadOS 26, or macOS 26. Questions? See <Link href="/recallable/support" className="underline">Recallable support</Link>.</p>
      </PageColumn>
    </PageFrame>
  );
}
