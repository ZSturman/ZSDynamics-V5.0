import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { PageFrame } from "@/components/layout/page-frame";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Contact — Zachary Sturman",
  description:
    "Send me a message about a project, role, or collaboration. Optionally opt in to be notified when I publish new writing.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact — Zachary Sturman",
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageFrame as="main" data-testid="site-page-frame" className="py-8 md:py-12">
        <div className="space-y-2">
          <BreadcrumbTrail items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Contact</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Project, role, collaboration, or feedback — all welcome. I read every message and reply within a few days.
          </p>
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section
            data-analytics-section="contact_page_main"
            className="rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8"
          >
            <h2 className="text-lg font-semibold tracking-tight">Send a message</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Your email goes only to me. No newsletter sign-up unless you opt in below.
            </p>
            <ContactForm variant="contact" />
          </section>

          <aside
            data-analytics-section="contact_page_newsletter"
            className="rounded-2xl border border-border/60 bg-card/30 p-6 md:p-8"
          >
            <h2 className="text-lg font-semibold tracking-tight">Get notified about new writing</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Optional. I&apos;ll email you when I publish a new article — no other use of your address, ever.
            </p>
            <ContactForm variant="newsletter" />
          </aside>
        </div>
      </PageFrame>
    </div>
  );
}
