# Setup: Analytics

Google Analytics 4 (via Firebase Analytics SDK) plus first-party UTM capture.

## What gets captured

- Standard GA4 page views and engagement.
- UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) on first visit, persisted in `sessionStorage` under `zs_utm_v1`. Stripped from the URL via `history.replaceState`.
- Referrer hostname (`utm_referrer`) when no UTM is present.
- Custom events:

  | Event | Trigger |
  | --- | --- |
  | `outbound_click` | Any anchor to an external host (delegated capture-phase listener). |
  | `social_click` | Footer profile chips (LinkedIn, X, GitHub, etc.). |
  | `resume_view` / `resume_download` | Footer resume buttons. |
  | `contact_click` | Any "contact me" affordance. |
  | `contact_submit` | Contact form result (`success` / `error` / `rate_limited`). |
  | `newsletter_interest` | Newsletter form result. |
  | `project_open`, `project_demo_click`, `project_github_click` | Project surface interactions. |
  | `project_media_play` | Image/video/3D model interaction. |
  | `article_open` | Article surface interactions. |

Every event automatically merges the captured UTM dimensions, so attribution is preserved across the session.

## Configuration

Required public env vars (build-time, baked into the static export):

```
NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

When `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED` is `false` (default in `.env.example`) the SDK never initializes — useful for local development.

## Daily summary email

See [worker.md](./worker.md) and the cron in `.github/workflows/daily-analytics.yml`. The script `scripts/daily-analytics-summary.mjs` queries GA4 via the Data API and POSTs the rendered HTML to the Worker, which mails it via Resend.

GitHub Actions secrets:

| Secret | Description |
| --- | --- |
| `GA_PROPERTY_ID` | Numeric GA4 property id. |
| `GA_SERVICE_ACCOUNT_JSON` | Full JSON for a service account with `Viewer` access to the GA4 property. |
| `API_BASE_URL` | Worker base URL (e.g. `https://api.zacharysturman.com`). |
| `INTERNAL_TOKEN` | Bearer token shared with the Worker. |
