import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Better Workspace Setup & Support",
  description: "Requirements, iCloud setup and troubleshooting for Better Workspace on Mac, iPhone and iPad.",
  alternates: { canonical: "/better-workspace/support" },
};

export default function SupportPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <Link href="/projects/better-workspace" className="underline">Better Workspace</Link>
        <h1 className="text-3xl font-semibold">Setup &amp; Support</h1>
        <p>Better Workspace connects your Mac workspace with capture and planning on iPhone and iPad.</p>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Availability and requirements</h2>
          <p>The app is currently in testing. No public App Store listing or Mac download is available yet. Planned distribution: an iPhone/iPad App Store companion and a separate Mac download.</p>
          <p>Mac: macOS 14.4 or later, with Python 3.11 or later for the background service. Mobile: iOS or iPadOS 17 or later. Cross-device features require the same Apple account, iCloud Drive and the Mac companion.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Try it before connecting</h2>
          <p>On iPhone or iPad, open Overview → More workspace views → Explore sample workspace. Browse the built-in garden journal, work plan and ideas using the app’s real screens. The sample is read-only and sends no cloud changes. Use Done to return to your own workspace.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Connect your devices</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>On Mac, select your workspace and inbox locations in Settings → General.</li>
            <li>Install/start the bundled background service in Settings → Services when using service features.</li>
            <li>Enable mobile workspace publishing in Mac Settings and allow the first index to sync.</li>
            <li>On iPhone or iPad, enable iCloud Drive for Better Workspace and open Overview. Pull to refresh.</li>
            <li>Use Ingest or Share → Better Workspace to capture text, links or files. Leave the Mac online to apply filing and planning requests.</li>
          </ol>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">When something does not sync</h2>
          <p>An empty mobile workspace can mean the Mac has not published an index yet. Confirm both devices use the same Apple account, iCloud Drive is enabled and the Mac is online. Cached content can be browsed offline; queued changes need the Mac to validate and acknowledge them. Preserve the error or receipt message before retrying. Do not delete workspace files to fix a sync problem.</p>
          <p>If the background service is unavailable, check Python 3.11 or later and its status in Mac Settings → Services. Optional Notion and agent integrations require separate configuration and are not needed for basic browsing or capture.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Contact</h2>
          <p><Link href="/contact" className="underline">Send a support request to Zachary Sturman</Link>. Include the app version, device, OS version, steps to reproduce and the exact error. Share only screenshots you have checked for private information; never send API keys or passwords.</p>
          <p><Link href="/better-workspace/privacy" className="underline">Privacy policy</Link></p>
        </section>
      </PageColumn>
    </PageFrame>
  );
}
