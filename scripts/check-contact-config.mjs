import { readFileSync } from "node:fs";
const defaults = JSON.parse(
  readFileSync(new URL("../lib/contact-config.json", import.meta.url)),
);
const api = process.env.NEXT_PUBLIC_API_BASE_URL || defaults.apiBaseUrl;
const key =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || defaults.turnstileSiteKey;
if (
  !api ||
  !/^https:\/\//.test(api) ||
  !key ||
  /REPLACE|YOUR_|^([123])x0/.test(key)
) {
  console.error(
    "Invalid public contact configuration: update lib/contact-config.json or set NEXT_PUBLIC_API_BASE_URL and a production NEXT_PUBLIC_TURNSTILE_SITE_KEY in the build environment.",
  );
  process.exit(1);
}
console.log("Public contact configuration is present.");
