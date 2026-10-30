import type { Metadata } from "next";

export const SITE_NAME = "Zachary Sturman";
export const SITE_URL = "https://zacharysturman.com";
export const SITE_DESCRIPTION =
  "Seattle-area software engineer building Python automation, native Apple apps, AI and data experiments, and ESP32 hardware prototypes.";
export const SITE_OG_IMAGE = "/og-image.jpg";


export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, images: [SITE_OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SITE_OG_IMAGE] },
  };
}
