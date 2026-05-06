"use client";

import {
  trackContactClick,
  trackResumeDownload,
  trackSocialClick,
} from "@/lib/firebase-analytics";

export type FooterAnalyticsKind =
  | { type: "social"; network: string }
  | { type: "resume_download"; url: string }
  | { type: "resume_view"; url: string }
  | { type: "contact" }
  | null
  | undefined;

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "onClick"> & {
  analytics?: FooterAnalyticsKind;
  href: string;
  children: React.ReactNode;
};

export function FooterAnalyticsLink({ analytics, children, ...rest }: Props) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!analytics) return;
    try {
      switch (analytics.type) {
        case "social":
          // Email "social" link is technically a mailto; treat as contact too.
          if (analytics.network === "email") {
            trackContactClick("site_footer_email");
          }
          trackSocialClick({
            socialNetwork: analytics.network,
            destinationUrl: rest.href,
          });
          break;
        case "resume_download":
          trackResumeDownload(analytics.url);
          break;
        case "resume_view":
          trackResumeDownload(analytics.url);
          break;
        case "contact":
          trackContactClick("site_footer");
          break;
      }
    } catch {
      /* analytics failures should never break navigation */
    }
    rest.onClickCapture?.(event);
  };

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
