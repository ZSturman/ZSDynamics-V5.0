import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Mail, PenLine } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { PageFrame } from "@/components/layout/page-frame";
import { BreadcrumbTrail } from "@/components/ui/breadcrumb-trail";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Contact — Zachary Sturman",
  description:
    "Have a project in mind, an opportunity to share, or a question about my work? Send me a message or subscribe to new writing.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { title: "Contact — Zachary Sturman", url: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return (
    <PageFrame
      as="main"
      data-testid="site-page-frame"
      className="py-8 pb-16 md:py-12 md:pb-24"
    >
      <BreadcrumbTrail
        items={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />
      <header className="mt-10 mb-10 max-w-3xl md:mt-14 md:mb-14">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#244468] dark:text-[#8fc6ff]">
          Get in touch
        </p>
        <h1 className="text-4xl font-medium tracking-tight text-balance md:text-6xl">
          Good work starts with
          <br className="hidden sm:block" /> a conversation.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
          A project, an opportunity, a question, or just something worth
          sharing. I&apos;d like to hear about it.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-10">
        <section
          aria-labelledby="message-heading"
          data-analytics-section="contact_page_main"
          className="rounded-2xl border border-border/70 bg-card/50 p-5 sm:p-8"
        >
          <div className="mb-7 flex items-start gap-3">
            <Mail
              aria-hidden="true"
              className="mt-1 size-5 text-[#244468] dark:text-[#8fc6ff]"
            />
            <div>
              <h2
                id="message-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Send me a message
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Straight to my inbox. I&apos;ll reply to the email you leave
                here.
              </p>
            </div>
          </div>
          <ContactForm />
          <p className="mt-6 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
            Your details are used to respond to your message and kept in a
            private contact tracker. Sending a message doesn&apos;t subscribe
            you to updates. Please leave out passwords and sensitive
            information.
          </p>
        </section>
        <aside className="space-y-6">
          <section
            aria-labelledby="writing-heading"
            data-analytics-section="contact_page_newsletter"
            className="rounded-2xl border border-[#244468]/15 bg-[#244468]/[0.04] p-5 sm:p-8 dark:border-[#8fc6ff]/20 dark:bg-[#8fc6ff]/[0.05]"
          >
            <PenLine
              aria-hidden="true"
              className="mb-5 size-6 text-[#244468] dark:text-[#8fc6ff]"
            />
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Occasional writing
            </p>
            <h2
              id="writing-heading"
              className="text-2xl font-medium tracking-tight"
            >
              Something new,
              <br />
              when there&apos;s something to say.
            </h2>
            <p className="mt-3 mb-6 text-sm leading-6 text-muted-foreground">
              Notes on design, engineering, and building things thoughtfully.
              Get an email when a new article goes live.
            </p>
            <ContactForm variant="newsletter" />
            <Link
              href="/articles"
              className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              Read the latest articles{" "}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </section>
          <div className="px-1 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Prefer email?</p>
            <a
              href="mailto:zasturman@gmail.com"
              className="break-all underline underline-offset-4 hover:text-foreground"
            >
              zasturman@gmail.com
            </a>
            <p className="mt-3">
              For app support, include the app name, version, and what happened
              so I can help.
            </p>
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}
