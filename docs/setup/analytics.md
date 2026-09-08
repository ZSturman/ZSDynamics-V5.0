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

## Synthetic traffic exclusion

Production analytics is deliberately fail-closed. The site only initializes Firebase Analytics when all of the following are true:

- `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true` was present at build time.
- `NEXT_PUBLIC_ANALYTICS_DISABLED` is not true.
- The browser hostname is in `NEXT_PUBLIC_ANALYTICS_ALLOWED_HOSTS` (normally `zacharysturman.com,www.zacharysturman.com`). This excludes localhost, Firebase preview URLs, and any other deployment hostname.
- The browser is not automated (`navigator.webdriver`, a Playwright/Puppeteer/headless/Lighthouse user agent, or the explicit `window.__ZS_DISABLE_ANALYTICS__` flag).

The checks run **before** Firebase is imported, so neither GA4's automatic page/session measurement nor custom portfolio events are sent for excluded browsing. This is more reliable than tagging an `automation_signal` after a page view has already been recorded.

The repository adds a second, caller-side safeguard:

- Local Playwright and media tests normally use a local hostname, which is rejected by the hostname allow-list.
- The production Playwright suite is headless/webdriver and is therefore rejected even though it uses the live URL.
- `scripts/capture-production-previews.mjs` and `scripts/capture-url-preview.mjs` inject `window.__ZS_DISABLE_ANALYTICS__ = true` before every document runs.
- Firebase pull-request previews build with analytics explicitly disabled.

This preserves QA, screenshots, deployment verification, and automated publishing; it only keeps their page loads out of the normal production GA4 property. The older `automation_signal` event may still appear in historical data, but new automated runs no longer send it because they send no analytics at all.

### Verify the exclusion

1. Run `npm run test:unit`. The `analytics-suppression` tests cover local, preview, explicit-flag, webdriver, headless-user-agent, and production-browser cases.
2. In a production Playwright run, inspect the browser network log: there should be no requests to Firebase/Google Analytics collection endpoints from the tested page.
3. In GA4 Realtime/DebugView, open the live site in a normal browser and confirm a visit appears; run the production QA or preview capture and confirm no corresponding analytics event appears. Allow for GA4 reporting delay.
4. In GA4 Admin, optionally create an **Internal traffic** rule/data filter for your own fixed office/VPN IP range. This is an independent last line of defense for manual internal browsing. Do not use it as the only automation safeguard, and do not add IP collection to this site.

## Daily report: what it means

The email starts with **Daily Analytics Summary**, **What Actually Happened**, and **Traffic Quality**, then acquisition, geography, content, high-intent actions, journeys, attention, and technical detail.

Raw GA4 totals are never discarded. The report also calculates cautious aggregate estimates:

- **Likely human sessions** require engagement evidence (GA4 engaged sessions or sessions with a `user_engagement` event). Multi-route browsing is context, not human evidence on its own.
- **Known synthetic/test sessions** come from historical `automation_signal` data when available.
- **Likely automated/test** and **suspicious** sessions are estimates based on multiple signals: near-zero duration, very low engagement, almost all-new identities, unattributed/Direct concentration, mechanically even desktop/mobile counts, excessive event or route counts, and automation markers.
- **Sessions with observed ≥10s engagement** is a `user_engagement` proxy; **multi-route sessions** is a conservative aggregate proxy. GA4's normal Data API does not expose a complete per-session route history, so neither is presented as exact user-level truth.

“Direct” means GA4 did not receive a referrer or campaign. It does **not** establish that someone typed the URL. Percentage changes from baselines below five sessions are rendered as counts instead of exaggerated percentages.

Events are intentionally separated:

- **Diagnostic:** route views, automation markers, and instrumentation.
- **Engagement:** visible time, scroll, article/project opens, and media interaction.
- **High-intent actions:** GitHub/live-project/resource visits, contact, resume, newsletter, and meaningful outbound actions. Only this last group is counted as a report key action.

Geography uses only GA4's country, region, and city dimensions. No IP lookup or raw IP storage is implemented. City/region values and all small counts are directional, not a precise location claim.

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

- Quality-first KPI cards for likely human sessions, raw sessions, engaged sessions, high-intent actions, views, and engagement.
- A deterministic human-readable analyst explanation, with tiny-baseline-safe comparisons and explicit anomaly caveats.
- Traffic quality, acquisition by source/medium/campaign/landing page, and GA4 geography by country/region/city with engagement and high-intent actions.
- Top pages enriched with local content type, title, domain/category/status/series, and tags from `public/projects/projects.json` and `public/articles/articles.json`.
- Top content tags aggregated from page views, so tag insight still works even before GA4 custom dimensions are registered.
- Separate diagnostic, engagement, and high-intent event groups; route/scroll/automation instrumentation is not called a key action.
- Visitor journey transitions, route surfaces, modal/full-page context, viewport category, scroll depth, visible section engagement, project detail/item attention, media/fullscreen activity, and content-to-action flow when the relevant GA4 custom dimensions are registered.
- Device context, data-quality notes, and clear partial-data fallbacks when optional dimensions or individual API calls are unavailable.

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
| `LM_STUDIO_BASE_URL` | unset | Optional loopback LM Studio server, e.g. `http://127.0.0.1:1234`. The script only accepts localhost/loopback endpoints. |
| `LM_STUDIO_MODEL` | `local-model` | Optional loaded LM Studio model identifier. |

Local dry run:

```bash
ANALYTICS_DRY_RUN=true npm run daily-analytics
```

### Local AI narrative (optional)

All calculations, traffic-quality classification, anomaly detection, and the fallback explanation are deterministic local JavaScript. If `LM_STUDIO_BASE_URL` points to a running LM Studio OpenAI-compatible local server, the report sends only a compact JSON summary (key metrics, comparison, quality signals, top acquisition/content/actions) to `http://127.0.0.1` or `localhost` for a more natural 1–4 paragraph interpretation. It never sends the full GA4 response, and non-local endpoints are rejected. If LM Studio is offline or omitted, the deterministic explanation is used and the email says so in Data Quality.

### GA4 API reliability

The report serializes GA4 Data API calls, memoizes identical requests for one run, removes the previous per-custom-dimension query fan-out, retries temporary quota/network failures with exponential backoff, and treats each optional breakdown as independently recoverable. A failed dimension produces a warning and partial email rather than cancelling the daily report.

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
