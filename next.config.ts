import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Read external image hostnames from the pre-build script output
const remotePatterns: { protocol: "https"; hostname: string }[] = [];

function pushHostname(hostname: string, set: Set<string>) {
  const trimmed = hostname?.trim();
  if (!trimmed || set.has(trimmed)) return;
  set.add(trimmed);
  remotePatterns.push({ protocol: "https" as const, hostname: trimmed });
}

try {
  const seen = new Set<string>();
  const hostnamesPath = join(process.cwd(), "public", "image-hostnames.json");

  if (existsSync(hostnamesPath)) {
    const hostnamesData = JSON.parse(readFileSync(hostnamesPath, "utf-8"));
    const hostnames = (hostnamesData.hostnames || []) as string[];
    for (const hostname of hostnames) pushHostname(hostname, seen);

    console.log(`✓ Loaded ${remotePatterns.length} external image hostname(s) for Next.js Image optimization`);
  } else {
    console.warn("⚠ image-hostnames.json not found. Run the pre-build script first if you have external images.");
  }

  // Also include any hostnames present in the hosted-media URL map. This keeps
  // `<Image>` happy when projects.json points at https://media.zacharysturman.com/...
  const mediaUrlsPath = join(process.cwd(), "public", "media-urls.json");
  if (existsSync(mediaUrlsPath)) {
    const data = JSON.parse(readFileSync(mediaUrlsPath, "utf-8"));
    const urls = data?.urls && typeof data.urls === "object" ? Object.values<string>(data.urls) : [];
    for (const url of urls) {
      try {
        pushHostname(new URL(url).hostname, seen);
      } catch {
        /* ignore malformed entries */
      }
    }
  }

  // Allow R2_PUBLIC_BASE_URL to opt the hostname in even before media-urls.json
  // is populated.
  const r2Public = process.env.R2_PUBLIC_BASE_URL;
  if (r2Public) {
    try {
      pushHostname(new URL(r2Public).hostname, seen);
    } catch {
      /* ignore */
    }
  }
} catch (error) {
  console.error("Error loading image hostnames config:", error);
}

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
