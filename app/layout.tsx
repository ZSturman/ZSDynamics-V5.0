import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { INITIAL_THEME_SCRIPT } from "@/lib/theme";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";

const Banner = dynamic(() =>
  import("@/components/global-ui/banner").then((m) => m.Banner)
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: INITIAL_THEME_SCRIPT }} />

        {/* Basic meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="application-name" content="Zachary Sturman" />
        <meta name="apple-mobile-web-app-title" content="Zachary Sturman" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* SEO */}
        <title>Zachary Sturman</title>
        <meta
          name="description"
          content="Zachary Sturman. I think a lot about how design influences trust, and how AI can support human judgment instead of replacing it."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://zachary-sturman.com" />

        {/* Open Graph (Slack, Discord, LinkedIn, Facebook) */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="Zachary Sturman"
        />
        <meta
          property="og:description"
          content="Software engineer focused on performance, trust, and human-centered AI."
        />
        <meta property="og:url" content="https://zachary-sturman.com" />
        <meta
          property="og:image"
          content="https://zachary-sturman.com/og-image.jpg"
        />
        <meta property="og:site_name" content="Zachary Sturman" />

        {/* Twitter/X Preview */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Zachary Sturman"
        />
        <meta
          name="twitter:description"
          content="Software engineer focused on performance, trust, and human-centered AI."
        />
        <meta
          name="twitter:image"
          content="https://zachary-sturman.com/og-image.jpg"
        />

        {/* Icons */}
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BreadcrumbProvider>
          <Banner />
          {children}
        </BreadcrumbProvider>
      </body>
    </html>
  );
}
