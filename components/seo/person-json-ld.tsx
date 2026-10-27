import { loadPersonalLinks } from "@/lib/personal-links";
import { SITE_URL } from "@/lib/site-metadata";
import { portfolioData, profile } from "@/lib/site-content";

/** schema.org Person data so search engines can associate profiles and work. */
export function PersonJsonLd() {
  const sameAs = loadPersonalLinks()
    .links.filter((link) => link.href.startsWith("https://"))
    .map((link) => link.href);
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: SITE_URL,
    jobTitle: "Software Engineer",
    description: profile.intro,
    address: { "@type": "PostalAddress", addressLocality: "Seattle", addressRegion: "WA", addressCountry: "US" },
    alumniOf: portfolioData.skills.education
      .filter((item) => item.period !== "Current")
      .map((item) => ({ "@type": "CollegeOrUniversity", name: item.subtitle })),
    knowsAbout: portfolioData.skills.tagGroups.flatMap((group) => group.items).slice(0, 20),
    sameAs,
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped for "<" to keep the script inert.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
