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
        <p>Better Workspace brings projects, tasks, ideas and documents together across Apple devices, with an optional advanced Mac workspace for files and automation.</p>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Availability and requirements</h2>
          <p>The app is currently in testing. No public App Store listing or Mac download is available yet. The shared native Store experience is being prepared for macOS, iPhone and iPad, alongside a separate advanced Mac download. The Mac candidate is signed and notarized; final acceptance is still in progress.</p>
          <p>Mac: macOS 14.4 or later. Mobile: iOS or iPadOS 17 or later. The personal workspace preview works locally without a Mac or service. The new advanced Mac package includes Python and its dependencies; no Terminal or package manager setup is needed. Connected-workspace features require the same Apple account, iCloud Drive and the Mac companion.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Start with your own project</h2>
          <p>In the shared personal workspace preview, choose Create my first project, then add tasks, ideas or documents. Link work to a project, complete tasks, and archive items you want to keep out of the way. No Mac connection is required.</p>
          <p>The welcome screen and workspace options offer a private editable sample. Its records stay in memory and are discarded when you close it. The new candidate stores personal records locally and synchronizes them through your private iCloud account when available. The app explains account restrictions, transfer state and offline availability; transfers can take minutes. Production native Mac–physical iPhone sync passed with isolated records, while final distribution, iPad and offline reconnect acceptance continue.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Try the connected workspace</h2>
          <p>On iPhone or iPad, open Overview → More workspace views → Explore sample workspace. Browse the built-in garden journal, work plan and ideas using the app’s real screens. The sample is read-only and sends no cloud changes. Use Done to return to your own workspace.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Connect the optional advanced workspace</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>On Mac, select your workspace and inbox locations in Settings → General.</li>
            <li>Install/start the bundled background service in Settings → Services when using service features.</li>
            <li>Enable mobile workspace publishing in Mac Settings and allow the first index to sync.</li>
            <li>On iPhone or iPad, enable iCloud Drive for Better Workspace and open Overview. Pull to refresh.</li>
            <li>Use Ingest or Share → Better Workspace to capture text, links or files. Leave the Mac online to apply filing and planning requests.</li>
          </ol>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">When something does not sync</h2>
          <p>For personal records, check that your devices use the same iCloud account and allow time for background transfers. Keep working offline; saves stay on the device. Check the status in My Workspace, your internet connection and available iCloud storage. Do not delete local records to repair a transfer.</p>
          <p>An empty connected mobile workspace can mean the Mac has not published an index yet. Confirm both devices use the same Apple account, iCloud Drive is enabled and the Mac is online. Cached content can be browsed offline; queued changes need the Mac to validate and acknowledge them. Preserve the error or receipt message before retrying. Do not delete workspace files to fix a sync problem.</p>
          <p>If the background service is unavailable, check its status in Mac Settings → Services. The new notarized candidate contains its own runtime; older development builds may still depend on a separately installed Python. Preserve your configuration when updating. Optional Notion and agent integrations require separate configuration and are not needed for basic browsing or capture.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Contact</h2>
          <p><Link href="/contact" className="underline">Send a support request to Zachary Sturman</Link>. Include the app version, device, OS version, steps to reproduce and the exact error. Share only screenshots you have checked for private information; never send API keys or passwords.</p>
          <p><Link href="/better-workspace/privacy" className="underline">Privacy policy</Link></p>
        </section>
      </PageColumn>
    </PageFrame>
  );
}
