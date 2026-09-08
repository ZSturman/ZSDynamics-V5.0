# Project Instructions

## Purpose

`zacharysturman.com` is a statically exported Next.js portfolio. It publishes project and article content, tracks privacy-conscious aggregate analytics, and produces a daily GA4 email report.

## Repository map

- Application: `app/`, `components/`, `lib/`
- Analytics/reporting: `lib/firebase-analytics.ts`, `components/analytics/`, `scripts/daily-analytics-summary.mjs`
- Tests: `tests/`, `tests_python/`
- Documentation: `README.md`, `docs/`
- Release tooling: `scripts/`, `.github/workflows/`, `playwright*.ts`
- Content manifests: `public/projects/projects.json`, `public/articles/articles.json`

## Standard commands

- Install: `npm ci`
- Run: `npm run dev`
- Targeted analytics tests: `npm run test:unit -- tests/daily-analytics-summary.test.mjs`
- Unit tests: `npm run test:unit`
- Lint: `npm run lint`
- Build: `npm run build`

## Change discipline

- Preserve the static-export build and existing analytics events unless a replacement is documented.
- Keep analytics privacy-conscious: never add raw IP collection, session replay, or user-level identifiers.
- Automated browsing must not send production GA4 data; update both client safeguards and the automation caller.
- Prefer deterministic analytics calculations. Local LLMs may only turn compact findings into prose and must have a deterministic fallback.
- Keep the daily report useful under partial GA4 Data API failures; show a warning instead of failing the whole email.
- Document new analytics environment variables and GA4 custom definitions in `.env.example` and `docs/setup/analytics.md`.
- Record known issues, uncommitted work, and try-it steps in `docs/NEXT_STEPS.md` at the end of a session; it feeds automated Notion project tracking.
