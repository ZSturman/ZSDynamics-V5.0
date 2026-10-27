"use client";

/**
 * UTM capture & forwarding.
 *
 * On first browser load, captures any utm_* params from the URL into
 * sessionStorage. Subsequent analytics events read the cached value via
 * getStoredUtm() and forward the params with every event.
 *
 * The params are deliberately left in the address bar: GA4 reads campaign
 * attribution from the landing page_view, which Firebase sends only after its
 * script loads. Stripping them first recorded campaign visits as Direct or
 * referral. Next.js navigation drops them on the next route anyway.
 *
 * `?zs_qa=<run-id>` marks a session as controlled QA traffic (see
 * docs/setup/analytics.md); it never identifies a visitor.
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
let capturedThisPage = false;

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

const QA_STORAGE_KEY = "zs_qa_run_v1";

function captureQaRun(): void {
  const raw = new URLSearchParams(window.location.search).get("zs_qa");
  const run = raw?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  if (run) writeSession(QA_STORAGE_KEY, run);
}

/** Identifier of a controlled QA session, or undefined for real visitors. */
export function getQaRun(): string | undefined {
  if (!canUseBrowser()) return undefined;
  captureUtmOnLoad();
  const run = readSession<string>(QA_STORAGE_KEY);
  return typeof run === "string" && run ? run : undefined;
}

/**
 * Run once on app mount. Idempotent within a session.
 */
export function captureUtmOnLoad(): void {
  if (!canUseBrowser() || capturedThisPage) return;
  // Child components' effects can log before the layout's bootstrap effect
  // runs, so the getters below also trigger this (once per page load).
  capturedThisPage = true;
  captureQaRun();

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
  } else if (referrer) {
    // Soft attribution: keep a referrer for context, but no source/medium/campaign.
    const soft: UtmParams = { utm_referrer: referrer };
    cachedUtm = soft;
    writeSession(STORAGE_KEY, soft);
  }
}

export function getStoredUtm(): UtmParams {
  if (!canUseBrowser()) return {};
  captureUtmOnLoad();
  if (cachedUtm) return cachedUtm;
  cachedUtm = readSession<UtmParams>(STORAGE_KEY) ?? {};
  return cachedUtm;
}
