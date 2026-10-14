import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Recallable Help & Support",
  description: "Getting started, spaced review, Discover, iCloud sync, Apple Watch, widgets, AI drafts and CSV files in Recallable.",
  alternates: { canonical: "/recallable/support" },
  openGraph: {
    title: "Recallable Help & Support",
    description: "Getting started, spaced review, Discover, iCloud sync, Apple Watch, widgets, AI drafts and CSV files in Recallable.",
    url: "/recallable/support",
  },
};

const guidelines =
  "Publish only decks you made or have the right to share. No sexual, hateful, violent, or harassing content, no spam or advertising, and no personal information about other people. There is no tolerance for objectionable content or abusive users: reported decks are reviewed within 24 hours, and decks that break these rules are removed and their publishers blocked.";

export default function RecallableSupportPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <Link href="/projects/recallable" className="underline">Recallable</Link>
        <h1 className="text-3xl font-semibold">Recallable Help &amp; Support</h1>
        <p>Recallable is a flashcard app for iPhone, iPad, Mac and Apple Watch. Open it and answer: your next card is always waiting.</p>

        <section className="space-y-2" aria-labelledby="requirements">
          <h2 id="requirements" className="text-xl font-semibold">Availability and requirements</h2>
          <p>Recallable is being prepared for the App Store and is not available to download yet. It requires iOS or iPadOS 26, macOS 26 on Mac, and watchOS 26 on an Apple Watch paired with an iPhone running Recallable. iCloud sync and Discover publishing need an iCloud account; everything else works without one.</p>
        </section>

        <section className="space-y-2" aria-labelledby="start">
          <h2 id="start" className="text-xl font-semibold">Getting started</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>On first launch, type a subject into the search field on Home (for example, “Roman history”) and choose a deck.</li>
            <li>Tap <strong>Start studying</strong>. Tap <strong>Show answer</strong>, then rate the card <strong>Hard</strong>, <strong>Good</strong> or <strong>Easy</strong>.</li>
            <li>From then on, Home opens on your next card. Use <strong>Study</strong> on a deck for a focused round of 10, and keep going as long as you like.</li>
            <li>Make your own cards with the <strong>+</strong> button: New card, New deck, or Create cards with AI.</li>
          </ol>
        </section>

        <section className="space-y-2" aria-labelledby="spacing">
          <h2 id="spacing" className="text-xl font-semibold">How spaced review works</h2>
          <p>Nothing is ever due. Each rating changes how far apart a card’s reviews are: Easy and Good space it further, Hard and Skip bring it back sooner, always between one day and one year. Recallable shows the cards that need attention first, then everything else, so you can always study and nothing piles up. New cards join a few at a time (20 a day by default). Progress shows each card as New, Learning, Familiar or Strong.</p>
          <p>Settings › Quick study chooses which decks Home, the widget and the Watch draw from. Settings › Cards per round sets the round size.</p>
        </section>

        <section className="space-y-2" aria-labelledby="discover">
          <h2 id="discover" className="text-xl font-semibold">Discover and community guidelines</h2>
          <p>Discover lists the built-in starter decks (they work offline) and decks people publish. To publish your own deck, open it in Library › Deck settings › Share on Discover. You need iCloud, a public name, a category, and at least three cards. Before your first publish you agree to these guidelines:</p>
          <blockquote className="border-l-4 pl-4 italic">{guidelines}</blockquote>
          <p><strong>Report a deck:</strong> open it in Discover, tap More (•••) › Report this deck, and choose a reason. It disappears for you right away, and decks with several reports are hidden for everyone until reviewed. Reports are reviewed within 24 hours.</p>
          <p><strong>Block a publisher:</strong> open one of their decks › More (•••) › Block. Unblock in Settings › Blocked publishers.</p>
          <p><strong>Remove your deck:</strong> Library › the deck › Deck settings › Remove from Discover. Copies others already added stay theirs.</p>
          <p>For an urgent concern about content in Discover, <Link href="/contact" className="underline">contact the developer</Link>.</p>
        </section>

        <section className="space-y-2" aria-labelledby="sync">
          <h2 id="sync" className="text-xl font-semibold">iCloud sync</h2>
          <p>iCloud sync is on by default and keeps cards, pictures and progress the same on all your devices. Settings › Sync and sharing shows its status: Up to date, Syncing…, Waiting for a connection, or a message saying what to do.</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Use the same Apple Account on every device, with iCloud turned on for Recallable.</li>
            <li>Give a new device a few minutes on Wi-Fi with the app open for the first sync.</li>
            <li>Reviews from every device are kept. If a card was edited on two devices while offline, the most recent edit wins.</li>
            <li>Each device backs up its library before its first sync. Turning sync off never deletes your cards.</li>
          </ul>
        </section>

        <section className="space-y-2" aria-labelledby="watch">
          <h2 id="watch" className="text-xl font-semibold">Apple Watch and widgets</h2>
          <p><strong>Apple Watch:</strong> open Recallable on your iPhone once, then open it on the Watch. It goes straight to a card: Flip, then Hard, Good or Easy. Ratings made while the iPhone is out of range are sent when it’s back.</p>
          <p><strong>Home Screen widget:</strong> add the <em>Flashcard</em> widget (small, medium or large) to flip, rate and skip cards without opening the app. Lock Screen widgets show the next question and how many cards you studied today. A Control Center control and Shortcuts actions start a study session.</p>
          <p><strong>Reminders:</strong> optional, at times you choose in Settings › Reminders. They never show card text.</p>
        </section>

        <section className="space-y-2" aria-labelledby="ai">
          <h2 id="ai" className="text-xl font-semibold">AI card drafts</h2>
          <p>Choose <strong>+</strong> › Create cards with AI and enter a topic, or draft from text, a web page, a PDF or a photo of your notes. You review every draft before saving.</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Apple Intelligence</strong> generates drafts on device where it’s available.</li>
            <li><strong>LM Studio:</strong> Settings › AI card drafts › Use LM Studio, with LM Studio’s server running on your Mac.</li>
            <li><strong>Google Gemini:</strong> add your own API key from Google AI Studio in Settings › AI card drafts. Text you draft from is then sent to Google; each screen says so.</li>
          </ul>
        </section>

        <section className="space-y-2" aria-labelledby="csv">
          <h2 id="csv" className="text-xl font-semibold">Importing and exporting CSV files</h2>
          <p>Export a deck from its page, or every card from Settings › Export all cards as CSV. Import with Settings › Import cards from a file, or open a CSV file from Files, Mail or AirDrop. Columns are <code>Question, Answer, Hint, Explanation, Deck, Tags, Topic, Link</code>. Comma-, semicolon- and tab-separated files work, and headers such as Front/Back or Term/Definition are recognized. Duplicates are skipped.</p>
        </section>

        <section className="space-y-2" aria-labelledby="delete">
          <h2 id="delete" className="text-xl font-semibold">Deleting your data</h2>
          <p>Move cards to the Trash and delete them permanently there, or delete a deck in Deck settings. To remove iCloud data, turn off sync and use your device’s Settings › [your name] › iCloud › Manage Storage. See the <Link href="/recallable/privacy" className="underline">privacy policy</Link> for details.</p>
        </section>

        <section className="space-y-2" aria-labelledby="contact">
          <h2 id="contact" className="text-xl font-semibold">Contact</h2>
          <p><Link href="/contact" className="underline">Send a support request to Zachary Sturman</Link>. Include your device, OS version, the app version (Settings › About) and the steps that led to the problem. Never send API keys or passwords.</p>
          <p><Link href="/recallable/privacy" className="underline">Privacy policy</Link></p>
        </section>
      </PageColumn>
    </PageFrame>
  );
}
