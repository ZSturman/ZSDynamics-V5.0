import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";

const routeMetadata: Metadata = { title: "Website Privacy", alternates: { canonical: "/privacy" } };
export const metadata: Metadata = {
  ...routeMetadata,
  ...pageMetadata("Website Privacy", "How zacharysturman.com measures visits and what it keeps.", "/privacy"),
};

export default function WebsitePrivacyPage() {
  return (
    <PageFrame as="main" className="py-10">
      <PageColumn className="space-y-6 leading-relaxed">
        <h1 className="text-3xl font-semibold">Website privacy</h1>
        <p>Effective November 23, 2026 · zacharysturman.com · Operated by Zachary Sturman</p>
        <p>
          This page covers the portfolio website. Each app has its own privacy policy, linked from that app&apos;s page.
          The site does not show ads, sell data, or try to identify who you are.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Google Analytics</h2>
          <p>
            The site uses Google Analytics 4 (through Firebase) to count visits and interactions such as page views, project and
            article opens, scrolling, and clicks on project resources, profiles, the résumé, and contact links. Google sets its own
            browser identifier and derives an approximate location (country, region, city) from your connection; this site does
            not receive or store your IP address. No names, email addresses, form contents, or typed search text are sent.
            Search terms are reduced to short keywords.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Anonymous session measurement</h2>
          <p>
            To understand how visits move through the portfolio, and to tell people apart from automated traffic, the site also
            sends a small anonymous record of each visit to its own server (api.zacharysturman.com). It contains:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>A random session ID kept in your browser&apos;s local storage. It is replaced after 30 minutes without activity, and no long-term visitor ID is kept.</li>
            <li>The pages you open, in order, with timestamps; how long each page was in the foreground and actively used; how far you scrolled.</li>
            <li>Counts of moments with scrolling, pointer, keyboard or touch activity. Never what you typed, where you clicked, or anything you entered in a form.</li>
            <li>Which project resources or external links you opened, recorded as a category and domain (for example &ldquo;GitHub repository&rdquo;), not the full address.</li>
            <li>On arrival, the referring site&apos;s name and any campaign tags in the link.</li>
            <li>Coarse context derived by the server: browser and operating-system family, device type, country, and whether the connection comes from a hosting or cloud network.</li>
          </ul>
          <p>
            IP addresses and full browser user-agent strings are not stored, and browser characteristics are not combined to
            recognise you across visits. Records are deleted after 30 days. Only the site owner can view them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your choices</h2>
          <p>
            If your browser sends a Global Privacy Control signal, the anonymous session measurement is turned off. Content
            blockers, private browsing, or clearing site data also stop or reset both kinds of measurement. The site works the
            same either way.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Messages and subscriptions</h2>
          <p>
            Messages sent through the contact form and requests for writing updates are stored so they can be answered or
            delivered. They are not linked to the measurement above. Each subscription email includes an unsubscribe link.
          </p>
        </section>

        <p>
          Questions: <Link href="/contact" className="underline">contact Zachary Sturman</Link>. This page may change as the
          site changes; the effective date above will be updated.
        </p>
      </PageColumn>
    </PageFrame>
  );
}
