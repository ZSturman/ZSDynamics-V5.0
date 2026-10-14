import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Recallable Privacy Policy",
  description: "How Recallable handles your flashcards, iCloud sync, community decks and optional AI drafting.",
  alternates: { canonical: "/recallable/privacy" },
  openGraph: {
    title: "Recallable Privacy Policy",
    description: "How Recallable handles your flashcards, iCloud sync, community decks and optional AI drafting.",
    url: "/recallable/privacy",
  },
};

export default function RecallablePrivacyPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <Link href="/projects/recallable" className="underline">Recallable</Link>
        <h1 className="text-3xl font-semibold">Recallable Privacy Policy</h1>
        <p className="text-muted-foreground">Effective October 13, 2026 · Developer: Zachary Sturman</p>

        <section className="space-y-2" aria-labelledby="summary">
          <h2 id="summary" className="text-xl font-semibold">Summary</h2>
          <p>Recallable has no account to create, no advertising, no analytics and no tracking. Your cards, pictures and study progress stay on your devices and in your private iCloud. Information leaves your devices only when you publish a deck to Discover, report a deck, or choose an online AI service.</p>
        </section>

        <section className="space-y-2" aria-labelledby="library">
          <h2 id="library" className="text-xl font-semibold">Your library and iCloud</h2>
          <p>Your cards, decks, pictures, review history, reminders and settings are stored on your device. When iCloud sync is on (the default), they are also stored in your private CloudKit database in iCloud so your devices stay the same. Apple processes that data under its iCloud terms; the developer cannot access your private iCloud database. You can turn sync off in Settings › Sync and sharing.</p>
          <p>Your Apple Watch and the Recallable widgets receive a subset of your upcoming cards from your own iPhone, and ratings you make there return to your iPhone. This stays on your devices and in your iCloud.</p>
          <p>Reminders are local notifications scheduled on your device. They never include card text.</p>
        </section>

        <section className="space-y-2" aria-labelledby="community">
          <h2 id="community" className="text-xl font-semibold">Community decks you publish or report</h2>
          <p>If you publish a deck to Discover, the deck&apos;s name, summary, category, and its cards&apos; questions, answers, hints and explanations are stored in Recallable&apos;s public CloudKit database with the public name you choose and an opaque CloudKit user identifier for your account. Published decks are visible to everyone who uses Recallable. Your review history, notes and sources are never included.</p>
          <p>If you report a deck, the report stores the deck&apos;s identifier, the reason you chose, the time, and your opaque CloudKit user identifier, so each person counts once. Reports are used only to moderate Discover.</p>
          <p>Browsing Discover reads public decks; it does not record what you view or download.</p>
        </section>

        <section className="space-y-2" aria-labelledby="ai">
          <h2 id="ai" className="text-xl font-semibold">AI card drafts (optional)</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Apple Intelligence:</strong> on supported devices, drafts are generated on your device.</li>
            <li><strong>LM Studio:</strong> if you turn it on, the topic or source text is sent to the LM Studio server you run on your own computer.</li>
            <li><strong>Google Gemini:</strong> only if you add your own Gemini API key. The topic, source text or card you choose is sent directly from your device to Google under your key and Google&apos;s terms. It is never sent to the developer. Each draft screen says when Gemini will be used, and your key is stored in your device&apos;s Keychain.</li>
          </ul>
          <p>Importing a web page fetches only the address you enter. Drafts are always shown to you for review before they are saved.</p>
        </section>

        <section className="space-y-2" aria-labelledby="third-parties">
          <h2 id="third-parties" className="text-xl font-semibold">Third parties</h2>
          <p>Recallable relies on Apple (iCloud and CloudKit) and, only if you choose it, Google Gemini. It contains no third-party analytics, advertising or tracking SDKs. Any third party used to provide the app&apos;s features provides the same or equal protection of user data as described in this policy and required by the App Store Review Guidelines.</p>
        </section>

        <section className="space-y-2" aria-labelledby="retention">
          <h2 id="retention" className="text-xl font-semibold">Retention, deletion and your choices</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Delete cards (they go to the Trash, where you can delete them permanently) or whole decks in the app at any time.</li>
            <li>Turn off iCloud sync in Settings › Sync and sharing, and delete Recallable&apos;s iCloud data in your device&apos;s Settings › [your name] › iCloud › Manage Storage.</li>
            <li>Remove a deck you published from Discover in Library › the deck › Deck settings › Remove from Discover.</li>
            <li>Remove your Gemini key in Settings › AI card drafts to stop using Gemini.</li>
            <li>To ask for deletion of published decks or reports associated with you, <Link href="/contact" className="underline">contact the developer</Link>.</li>
          </ul>
          <p>Published decks remain in Discover until you remove them or they are removed by moderation. Reports are kept while needed to moderate the deck they concern.</p>
        </section>

        <section className="space-y-2" aria-labelledby="children">
          <h2 id="children" className="text-xl font-semibold">Children</h2>
          <p>Recallable is not directed to children under 13 and does not knowingly collect personal information from them.</p>
        </section>

        <section className="space-y-2" aria-labelledby="changes">
          <h2 id="changes" className="text-xl font-semibold">Changes and contact</h2>
          <p>This policy may be updated as the app changes; the effective date above shows the latest version. If you contact the developer, the information you include is used only to answer your request.</p>
          <p><Link href="/contact" className="underline">Contact Zachary Sturman</Link> · <Link href="/recallable/support" className="underline">Recallable support</Link>. This policy covers the Recallable app; the portfolio website has its own practices.</p>
        </section>
      </PageColumn>
    </PageFrame>
  );
}
