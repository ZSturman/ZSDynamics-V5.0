"use client";

/**
 * UTM capture & forwarding.
 *
 * On first browser load, captures any utm_* params from the URL into
 * sessionStorage and strips them from the address bar via history.replaceState
 * so users can share clean URLs. Subsequent analytics events read from the
 * cached value via getStoredUtm() and forward the params with every event.
 *
 * Convention (see docs/utm-conventions.md):
 *   utm_source   = linkedin | bluesky | twitter | threads | instagram | email | github | ...
 *   utm_medium   = social | email | referral | ...
 *   utm_campaign = kebab-case project or post slug
 *   utm_term     = optional keyword
 *   utm_content  = optional A/B variant
 */

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_referrer?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const STORAGE_KEY = "zs_utm_v1";
const CAPTURE_FLAG = "zs_utm_captured_v1";

let cachedUtm: UtmParams | null = null;

function canUseBrowser(): boolean {
  return typeof window !== "undefined";
}

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy mode */
  }
}

function pickUtmFromSearch(search: string): UtmParams {
  const params = new URLSearchParams(search);
  const out: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      out[key] = value.slice(0, 200);
    }
  }
  return out;
}

function stripUtmFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    let mutated = false;
    for (const key of UTM_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        mutated = true;
      }
    }
    if (mutated) {
      const query = url.searchParams.toString();
      const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
      window.history.replaceState(null, "", next);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Run once on app mount. Idempotent within a session.
 */
export function captureUtmOnLoad(): void {
  if (!canUseBrowser()) return;

  try {
    if (window.sessionStorage.getItem(CAPTURE_FLAG)) {
      cachedUtm = readSession<UtmParams>(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(CAPTURE_FLAG, "1");
  } catch {
    /* continue without persistence */
  }

  const fromUrl = pickUtmFromSearch(window.location.search);
  const referrer = (() => {
    try {
      if (!document.referrer) return undefined;
      const r = new URL(document.referrer);
      if (r.origin === window.location.origin) return undefined;
      return r.hostname.replace(/^www\./, "").slice(0, 200);
    } catch {
      return undefined;
    }
  })();

  if (Object.keys(fromUrl).length > 0) {
    if (referrer) fromUrl.utm_referrer = referrer;
    cachedUtm = fromUrl;
    writeSession(STORAGE_KEY, fromUrl);
    stripUtmFromUrl();
  } else if (referrer) {
    // Soft attribution: keep a referrer for context, but no source/medium/campaign.
    const soft: UtmParams = { utm_referrer: referrer };
    cachedUtm = soft;
    writeSession(STORAGE_KEY, soft);
  }
}

export function getStoredUtm(): UtmParams {
  if (!canUseBrowser()) return {};
  if (cachedUtm) return cachedUtm;
  cachedUtm = readSession<UtmParams>(STORAGE_KEY) ?? {};
  return cachedUtm;
}
