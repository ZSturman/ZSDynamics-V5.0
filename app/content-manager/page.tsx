import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

export const metadata: Metadata = {
  title: "Social Posts Content Manager",
  description: "Review LinkedIn and Bluesky drafts on iPhone and iPad. See the exact content, approve deliberately, or reject and move to the next post.",
  alternates: { canonical: "/content-manager" },
};

export default function ContentManagerPage() {
  return <PageFrame as="main" className="py-10 md:py-16">
    <PageColumn className="space-y-12 leading-relaxed">
      <header className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">Native Apple apps · Social editorial review</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Social Posts Content Manager</h1>
        <p className="max-w-2xl text-2xl">Review the exact post.<br />Make a clear decision. Move on.</p>
        <p className="max-w-2xl text-muted-foreground">Read the LinkedIn and Bluesky versions, check the publication image, and choose what is ready. Keep review moving on iPhone and iPad while generation stays on your Mac.</p>
        <div className="flex flex-wrap gap-4"><Link href="/content-manager/support" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">Setup &amp; support</Link><Link href="/projects/content-manager" className="rounded-lg border px-5 py-3 font-medium">Project story</Link></div>
        <p data-testid="beta-status" className="text-sm text-muted-foreground">iOS 17+ · iPhone and iPad · Private TestFlight beta. No public beta invitation or App Store download yet.</p>
      </header>
      <section className="grid items-start gap-8 md:grid-cols-2" aria-labelledby="review-heading">
        <div className="space-y-5"><h2 id="review-heading" className="text-2xl font-semibold">The content comes first</h2><p>The internal title stays separate from the text that will be posted. Each destination has its own preview and a clear “Will post” or “Preview only” label.</p><p>Decision controls stay visible as you scroll. Reject &amp; Next declines the current draft and opens the next one; a confirmed Mark Ready approves the saved version and advances the queue.</p><p className="text-sm text-muted-foreground">Real simulator capture with fictional, in-memory drafts. Platform typography, cropping and link cards may differ from the preview.</p></div>
        <figure><Image src="/content-manager/iphone-review.png" alt="iPhone app showing separate LinkedIn and Bluesky publication previews above persistent Reject and Next and Mark Ready controls" width={1206} height={2622} priority className="mx-auto h-auto max-h-[720px] w-auto max-w-full rounded-2xl border object-contain" /><figcaption className="mt-3 text-center text-sm text-muted-foreground">Mobile review · sample content</figcaption></figure>
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Review features">{[
        ["Approve deliberately", "Confirmation and a content fingerprint bind approval to the reviewed version. Later text edits withdraw approval."],
        ["Keep the queue moving", "Reject a draft and move straight to the next. Restore declined posts from Calendar when you want to reconsider."],
        ["Pick up across devices", "Mac, iPhone and iPad use the same Notion Social Posts data. Changes appear after refresh; no direct Mac connection is needed."],
      ].map(([title, body]) => <article key={title} className="space-y-3 rounded-xl border p-5"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{body}</p></article>)}</section>
      <section className="space-y-4 rounded-xl border p-6"><h2 className="text-2xl font-semibold">Your publishing workflow stays in your hands</h2><p>Mobile review works with an existing Notion Social Posts workspace and its independent publishing automation. Mark Ready authorizes that automation for the saved version; it does not publish immediately or enable a paused publisher. Generation and local Article Studio remain Mac features.</p></section>
      <footer className="flex flex-wrap gap-5 border-t pt-5 text-sm"><Link href="/content-manager/support" className="underline">Setup &amp; support</Link><Link href="/content-manager/privacy" className="underline">Privacy policy</Link><Link href="/contact" className="underline">Contact</Link></footer>
    </PageColumn>
  </PageFrame>;
}
