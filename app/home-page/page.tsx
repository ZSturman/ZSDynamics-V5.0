import { pageMetadata } from "@/lib/site-metadata";
import { ProductActions } from "@/components/products/product-sections";
import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
const routeMetadata: Metadata = { title: "Home Page: App Dashboard", description: "A quiet Mac dashboard for apps, attention, and Shortcuts.", alternates: { canonical: "/home-page" } };
export const metadata: Metadata = { ...routeMetadata, ...pageMetadata('Home Page: App Dashboard', routeMetadata.description || 'Product information, availability, and ways to explore.', '/home-page') };
export default function HomePage() {
  return <PageFrame as="main" className="py-10 md:py-16"><PageColumn className="space-y-8 leading-relaxed">
    <header className="space-y-5"><p className="text-sm text-muted-foreground">Native Mac app · macOS 14.4+</p><h1 className="text-4xl font-semibold">Home Page</h1><p className="text-2xl">Your apps. One place to begin.</p><p>Open apps, run configured actions, and see relevant updates in one quiet dashboard. Keep it in the menu bar, open it at login, or add a desktop widget.</p><p className="font-medium">App Store release pending approval</p><p className="text-sm text-muted-foreground">The App Store listing becomes available when Apple approves the first release.</p></header>
    <section className="space-y-3"><h2 className="text-2xl font-semibold">Bring your apps together</h2><p>Add any installed application or website. Favorite and reorder launchers. Connect named Shortcuts to use actions that other apps expose through App Intents, and display their returned text on a card. Home Page does not enumerate private intents or embed another app&apos;s widgets.</p><p>Participating native Mac apps can share optional local status summaries without selecting a shared folder. Their settings include a Home Page download link. Third-party apps work through Shortcuts independently of this sharing feature.</p></section>
    <section className="space-y-3"><h2 className="text-2xl font-semibold">Attention without extra banners</h2><p>Connected apps supply relevant reviews, failures, sessions, and reminders. Pause, dismiss, or snooze the carousel. Freshness and connection errors stay visible. Home Page sends no system notification banners and never installs or starts backend services.</p></section>
    <ProductActions slug="home-page" />
        <footer className="flex flex-wrap gap-5 border-t pt-5"><Link href="/home-page/support" className="underline">Setup &amp; support</Link><Link href="/home-page/privacy" className="underline">Privacy policy</Link><Link href="/contact" className="underline">Contact</Link></footer>
  </PageColumn></PageFrame>;
}
