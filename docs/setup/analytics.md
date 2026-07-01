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
  | `portfolio_scroll_depth` | First time a route reaches 25%, 50%, 75%, 90%, and 100% vertical depth. |
  | `portfolio_section_view` | First meaningful exposure of tagged sections and items. |
  | `portfolio_section_engaged` | Tagged sections/items visible for 5s, 15s, 30s, or 60s. |
  | `project_item_open` | Collection/fullscreen project artifacts opened or navigated. |
  | `project_media_progress` | Video/audio progress and fullscreen media/model/game/link/text interactions. |

Every event automatically merges the captured UTM dimensions, so attribution is preserved across the session.

The enriched journey events stay aggregate and privacy-conscious. They do not collect screenshots, typed content, form messages, email addresses, raw IPs, session replay, or a per-user playback ID.

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

## Daily analytics email

See [worker.md](./worker.md) and the cron in `.github/workflows/daily-analytics.yml`. The script `scripts/daily-analytics-summary.mjs` queries GA4 via the Data API, enriches page rows with the local project/article manifests, renders a dashboard-style HTML + text email, and POSTs the rendered content to the Worker, which mails it via Resend.

The Worker contract is intentionally unchanged:

```json
{
  "subject": "zacharysturman.com analytics - Jun 28, 2026 - 42 sessions / 11 key actions",
  "html": "...",
  "text": "..."
}
```

The report includes:

- KPI scorecards for users, new users, sessions, engaged sessions, engagement rate, views, views/session, average session duration, and event count.
- Previous-day and prior 7-day daily-average deltas.
- Acquisition breakdowns by channel group, source/medium, campaign, and available manual UTM dimensions.
- Top pages enriched with local content type, title, domain/category/status/series, and tags from `public/projects/projects.json` and `public/articles/articles.json`.
- Top content tags aggregated from page views, so tag insight still works even before GA4 custom dimensions are registered.
- Portfolio event groups with professional labels and key-action counts.
- Visitor journey transitions, route surfaces, modal/full-page context, viewport category, scroll depth, visible section engagement, project detail/item attention, media/fullscreen activity, and content-to-action flow when the relevant GA4 custom dimensions are registered.
- Audience and tech context for country, city, device, browser, and operating system.
- Data-quality notes and clear fallback messages when optional custom dimensions are unavailable.

GitHub Actions secrets:

| Secret | Description |
| --- | --- |
| `GA_PROPERTY_ID` | Numeric GA4 property id. |
| `GA_SERVICE_ACCOUNT_JSON` | Full JSON for a service account with `Viewer` access to the GA4 property. |
| `API_BASE_URL` | Worker base URL (e.g. `https://api.zacharysturman.com`). |
| `INTERNAL_TOKEN` | Bearer token shared with the Worker. |

Optional env vars:

| Variable | Default | Description |
| --- | --- | --- |
| `SITE_NAME` | `zacharysturman.com` | Display name used in the subject/header. |
| `ANALYTICS_TIME_ZONE` | `America/Los_Angeles` | Time zone used to select "yesterday" for the report. |
| `ANALYTICS_DRY_RUN` | `false` | Set to `true` to render and log the email without POSTing to the Worker. |

Local dry run:

```bash
ANALYTICS_DRY_RUN=true npm run daily-analytics
```

## Recommended GA4 custom dimensions

The site forwards event parameters with every custom analytics event, but GA4 Data API can only break them out if they are registered as event-scoped custom dimensions. Register these parameter names in GA4 Admin -> Custom definitions for the richest daily email:

| Parameter | Why it helps |
| --- | --- |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `utm_referrer` | Campaign and referrer attribution on custom events. |
| `page_group`, `page_slug` | Route-view grouping for home, project, article, work-log, and other surfaces. |
| `project_slug`, `article_slug` | Project/article action detail. |
| `resource_type`, `destination_domain`, `surface`, `open_surface` | Resource clicks, outbound clicks, and UI surface analysis. |
| `social_network`, `status`, `media_kind` | Social, form-result, and media-interaction breakdowns. |
| `previous_page_group`, `previous_page_slug`, `route_step`, `viewport_category`, `route_surface`, `modal_context` | Aggregate visitor journey paths and modal/full-page browsing context. |
| `section_key`, `section_label`, `item_id`, `item_type`, `item_label`, `collection_key`, `media_role` | Section, collection item, asset, work-log, related article, and media exposure. |
| `scroll_percent`, `engagement_bucket`, `visible_time_sec`, `progress_percent`, `interaction_type` | Scroll depth, dwell-time buckets, media progress, and action-flow detail. |

If these dimensions are missing, the daily email still sends. It will show built-in acquisition, local content tags, and a data-quality note listing the unavailable custom dimensions.
