# Zachary Sturman Portfolio

This repository showcases my creative, scientific, and technological projects.

## Project Organization

To see the full implementation of this project organization system, check out the **OPE** project, which is featured in my portfolio at [zacharysturman.com](https://zacharysturman.com).

## Architecture

The site is a Next.js 15 static export deployed to Firebase Hosting (free Spark plan). Anything that needs runtime — contact form, daily analytics email, hosted media — runs on free Cloudflare services.

```
┌─────────────────────────────────────────────┐
│  Next.js static export → Firebase Hosting   │  ← zacharysturman.com
│  - GA4 / Firebase Analytics (UTM-aware)     │
│  - /api/*.json read-only API                │
└────────────────┬────────────────────────────┘
                 │ POST /contact, /newsletter-interest
                 ▼
┌─────────────────────────────────────────────┐
│  Cloudflare Worker (api.zacharysturman.com) │
│  - Resend email                             │
│  - Turnstile + KV rate limit                │
└────────────────┬────────────────────────────┘
                 │ POST /internal/daily-summary
                 ▲
┌─────────────────────────────────────────────┐
│  GitHub Actions cron (daily-analytics.yml)  │
│  - GA4 Data API → HTML summary email        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Cloudflare R2 (media.zacharysturman.com)   │  ← optional, opt-in
│  - Long-cached, hash-suffixed media URLs    │
└─────────────────────────────────────────────┘
```

Per-feature setup docs:

- [docs/setup/analytics.md](docs/setup/analytics.md) — GA4 + UTM capture + custom events.
- [docs/setup/worker.md](docs/setup/worker.md) — Cloudflare Worker (contact, newsletter, daily summary relay).
- [docs/setup/email.md](docs/setup/email.md) — Resend domain + API key.
- [docs/setup/r2-media.md](docs/setup/r2-media.md) — opt-in R2 media hosting.
- [docs/api.md](docs/api.md) — read-only `/api/*.json` endpoints.
- [docs/utm-conventions.md](docs/utm-conventions.md) — paste-ready UTM URLs.

## Firebase Analytics

The site includes a client-only Firebase Analytics integration for GA4/Firebase web tracking.

1. Copy `.env.example` to `.env.local`.
2. Run `firebase login --reauth`.
3. Run `firebase apps:list WEB --project zachary-sturman-portfolio`.
4. Run `firebase apps:sdkconfig WEB <APP_ID> --project zachary-sturman-portfolio`.
5. Paste the returned values into `.env.local` and set `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true`.

This setup is intended to stay on Firebase/GA4's no-cost path and does not require BigQuery export, Cloud Functions, or other paid services.

## Prebuild URL Previews

`npm run generate-projects` now captures backup screenshots for embeddable external project links during prebuild. Those screenshots are used on project pages when an iframe cannot be embedded.

If Playwright browsers are not installed yet, run:

```bash
npx playwright install chromium
```

If screenshot capture fails for a given URL, the prebuild still completes and falls back to a metadata-based preview card instead.
