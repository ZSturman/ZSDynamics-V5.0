import { loadProjectsManifest } from "@/lib/load-projects";
import { productContexts } from "@/lib/product-presentation";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/layout/site-nav";
import { PageFrame } from "@/components/layout/page-frame";
import { Suspense } from "react";
import { AnalyticsBootstrap } from "@/components/analytics/analytics-bootstrap";
import { SiteFooter } from "@/components/site-footer";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "@/lib/site-metadata";
import { INITIAL_THEME_SCRIPT } from "@/lib/theme";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: SITE_OG_IMAGE,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon0.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#151923" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const products = productContexts(await loadProjectsManifest());
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: INITIAL_THEME_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <BreadcrumbProvider>
          <Suspense fallback={null}>
            <AnalyticsBootstrap products={products} />
          </Suspense>
          <div className="flex min-h-screen flex-col">
            <header data-site-header className="py-6 md:py-8"><PageFrame><SiteNav /></PageFrame></header>
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </BreadcrumbProvider>
      </body>
    </html>
  );
}
