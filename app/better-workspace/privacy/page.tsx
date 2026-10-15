import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Better Workspace Privacy Policy",
  description: "How Better Workspace handles files, iCloud sync and optional integrations.",
  alternates: { canonical: "/better-workspace/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <Link href="/projects/better-workspace" className="underline">Better Workspace</Link>
        <h1 className="text-3xl font-semibold">Better Workspace Privacy Policy</h1>
        <p className="text-muted-foreground">Effective October 15, 2026 · Developer: Zachary Sturman</p>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Files and private storage</h2>
          <p>The shared personal workspace preview stores projects, tasks, ideas and documents in a private local SwiftData database. Its editable sample uses memory only; sample records are discarded on close. In the new candidate, personal records synchronize through your private iCloud account when available; records save locally and remain usable offline. The app displays account and transfer status. The advanced Mac edition also works with folders you control. Workspace files and portable Markdown plans stay in your filesystem. Tags, settings, indexes, sync drafts and action receipts are stored in private app storage. The app includes no advertising, cross-app tracking or developer-operated analytics collection.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">iCloud and device permissions</h2>
          <p>When you enable workspace publishing on Mac, project and work information, tags and selected previews sync to your private CloudKit database. Captures and their attachments sync through iCloud Drive. Mobile planning requests and receipts use CloudKit so your Mac can validate and apply changes. Apple processes this data under its iCloud privacy terms. The app does not provide the developer access to your private iCloud database.</p>
          <p>Photos, camera and file access are used to attach content you choose. Declining a permission does not grant access through another route; you can use other capture methods. Change permissions in system Settings.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Optional Mac integrations</h2>
          <p>Connecting Notion allows chosen project information and attachments to be exchanged with your Notion workspace. Reviewed Send or Archive actions authorize remote changes; optional automatic sync follows your settings. Credentials are stored using macOS Keychain or the local service configuration.</p>
          <p>Agent tasks and AI features send the selected instructions and relevant content to the provider you choose, including local providers when configured. External provider tools operate with their own permissions and privacy terms. Web previews may contact the website you choose to open. These integrations are optional and may disclose content to those services.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Retention and deletion</h2>
          <p>Local caches, logs and receipts remain in app or service storage until removed. You can delete captures and workspace items using the app&apos;s explicit deletion actions; Mac workspace deletion moves the selected item to recoverable Trash. Deleting the app does not delete workspace folders, iCloud documents, private cloud records or remote Notion pages. Manage retained copies separately through Finder, Files, iCloud settings and Notion. Disconnect optional integrations to stop future exchanges.</p>
        </section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Support and policy changes</h2>
          <p>If you contact the developer, the information you voluntarily include is used to answer your request. Avoid sending credentials or private workspace files. This policy may be updated as the app changes; the effective date appears above.</p>
          <p><Link href="/contact" className="underline">Contact Zachary Sturman</Link> · <Link href="/better-workspace/support" className="underline">Setup and support</Link>. This policy covers the app; the portfolio website has separate website privacy practices.</p>
        </section>
      </PageColumn>
    </PageFrame>
  );
}
