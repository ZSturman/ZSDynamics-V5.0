# Session journeys and traffic quality

GA4's Data API returns aggregates only, so it cannot show what one visit did, in order, or tell a person from a browser left running in a data centre. This document describes the small first-party session stream that fills that gap, how sessions are rebuilt and classified, and what it cannot do.

Related: [event taxonomy](./event-taxonomy.md) · [November 22 anomalies](./anomalies.md) · [GA4 setup](../setup/analytics.md) · [email samples](./samples/).

## Architecture decision

| Option | Verdict |
| --- | --- |
| **GA4 BigQuery export** | Not linked today (the reporting service account has Data API access only, and no Google Cloud project is configured for it). Linking is free for a standard property and the BigQuery sandbox needs no billing, but sandbox tables expire after 60 days, the export **does not backfill** earlier days, it arrives about a day late, and it lacks the evidence this work needs: foreground vs active time, input activity, hosting-network origin and exact window markers. Its `user_pseudo_id` is also a cross-session identifier, which this project avoids. It remains a reasonable later complement, not a replacement. |
| **First-party stream on the existing Worker + D1** (chosen) | Reuses the Worker and D1 database that already handle contact intake. No new service or paid plan: about 50 sessions a day is roughly 1–2 k D1 row writes against a 100 k/day free allowance, and hard caps (20 k events and 3 k sessions a day, 1.5 k events per session) keep fabricated traffic from exhausting it. |

GA4 stays the system of record for long-term aggregates, geography and history. The stream adds individual, short-lived, anonymous timelines.

```
browser ──(GA4 events, unchanged)──────────────▶ Google Analytics 4 ──▶ Data API ─┐
   │                                                                              ├─▶ daily brief + detailed report
   └─(batched beacon, allow-listed fields)─▶ POST api…/collect ─▶ D1 (30 days) ───┘        │
                                                         ▲                                 ▼
                                    admin login ─ /analytics/explorer, /analytics/report ◀┘
```

## What the browser sends

`lib/session-collector.ts`, started by `AnalyticsBootstrap`:

- **Gate.** The same fail-closed check as GA4 (production hostname, build flag, no `navigator.webdriver` or automation user agent, no `__ZS_DISABLE_ANALYTICS__`), plus `NEXT_PUBLIC_SESSION_ANALYTICS_ENABLED=true`. GA4 and the session stream honor **Global Privacy Control**. A WebDriver visit on a production hostname can opt in only to the first-party stream with a `zs_qa=session-qa-…` marker. Those sessions are excluded before daily reporting and traffic classification.
- **Session id.** 128 random bits in `localStorage` (`zs_sess_v1`), shared by tabs, replaced after **30 minutes without foreground input, navigation or interaction**. There is no visitor id, no cookie and no fingerprint. A tab resumed after the timeout starts a new session at the page it shows (`nav=resume`), so each timeline stays coherent. A session that runs past midnight keeps one id and is reported on the day it started.
- **Events.** `page_view` for every load and client-side route change (`nav`: `landing`, `route`, `reload`, `back_forward`, `resume`), the landing referrer host and UTM values, plus a mirror of allow-listed GA4 events (see the taxonomy). Section *exposure* events are not mirrored.
- **Timing.** `page_attention` holds cumulative `fg_ms` (document visible), `active_ms` (visible and within 30 s of an input, or 10 s of becoming visible), tallies of input *moments* (`pointer` and `scrolls` per 1 s / 0.5 s window, `keys`, `touches`), `max_scroll`, `hidden_count` and `first_input_ms`. It is sent when the page is hidden, left or replaced, and as a heartbeat every 30 s while visible (at most 40 per page, and only if something changed). Background tabs accrue nothing, and a foreground tab with no input stops being "active" after 30 s.
- **Automation hints.** Two single bits that are legitimately observable: the window is exactly 800×600 (the default of common automation tools) and the browser reports a zero outer size (no window frame). Nothing else about the device is collected.
- **Delivery.** Events are queued and sent every ~5 s or 20 events, with `sendBeacon` on hide/unload and `fetch(keepalive)` otherwise. Each document has its own random event namespace, including tabs opened from an existing tab. Fetch retries network failures and 5xx responses twice using the same event IDs. Accepted beacons are best effort and closing a browser can lose pending events. At most 400 events per page load.

## What the Worker stores

`worker/src/sessions.ts`, D1 tables from `worker/migrations/0002_sessions.sql`:

- **Validation.** Requests need an allowed `Origin`, a body ≤ 32 KB, ≤ 50 events, well-formed ids and known event names. Parameters are re-sanitised with the shared allow-list, so query strings, titles, URLs and search text are dropped even from a forged request.
- **Clock correction.** Each batch carries `sent_at`. The Worker shifts event times by `server now − sent_at` when that differs by more than 2 s, and clamps them to the last 6 h. The original client time is kept as `client_ts`.
- **Duplicates.** `INSERT OR IGNORE` on `(session_id, event_id)`, and reserves budget atomically in D1, so duplicates do not inflate metrics or consume event quota.
- **Context.** The user agent becomes browser family, OS family, device class and a matched automation token (e.g. `headlesschrome`). Cloudflare's ASN becomes `datacenter` (with the hosting organisation's name) or `consumer_or_unknown`. iCloud Private Relay, Cloudflare WARP, Akamai and Fastly ASNs are deliberately treated as consumer networks. Country is kept as two letters. **No IP address or user-agent string is stored.**
- **Retention.** The hourly cron deletes events and sessions after `SESSION_RETENTION_DAYS` (30), stored reports after 90 days, and counters after 30 days. Retention failures are caught, so they never break contact or subscription jobs.

## Reconstruction (`lib/session-journeys.mjs`)

1. De-duplicate by event id, then sort by corrected timestamp, then tab and sequence.
2. Attach each page instance's attention using the **maximum** of each cumulative counter, so late, duplicated or out-of-order snapshots cannot inflate time.
3. Derive elapsed time (first to last event), foreground and active totals, active time by page, time to first input, time to first meaningful action, time from opening a project to acting on it, navigation gaps, landing and exit pages, and projects seen.
4. Build a timeline of navigation, meaningful actions, attention milestones (≥ 15 s in view, ≥ 75 % scrolled) and engagement. Identical consecutive actions collapse to `×n`. The final line is always **"Last observed activity — not proof of when reading stopped."**
5. Engagement tier: **sustained** (≥ 60 s active, or ≥ 30 s across two or more pages), **short** (≥ 10 s), **glance**, or **no attention data**.

## Traffic-quality classification

Each session gets evidence items. Positive weights point towards automation and negative weights towards a person. The total gives the category.

| Category | Rule |
| --- | --- |
| Internal test | The session carried a `zs_qa` run id. |
| Known automated | The user agent declares automation (headless, bot, crawler, monitor, HTTP library…). |
| Suspected automated | Score ≥ 3 with a supporting automation pattern. |
| Likely human | Score ≤ −2. |
| Uncertain | Anything else, including too little evidence. |

| Evidence | Weight |
| --- | --- |
| ≥ 8 page loads within 60 s | +3 |
| ≥ 3 pages with a median gap < 2 s | +2 |
| No scroll, pointer, key or touch activity across ≥ 5 s in the foreground | +2 (+1 if shorter) |
| Click events with no pointer, touch or key input at all (a synthetic `element.click()` pattern) | +2 |
| Same page sequence as ≥ 2 other sessions that day, none with input | +2 |
| Window exactly 800×600 | +2 |
| No window frame (outer size 0) | +2 |
| No attention report ever arrived | +1 |
| Hosting/cloud network | +1 (weak on its own, by design) |
| Pointer, touch or key activity in ≥ 3 separate moments | −2 |
| Scrolling in ≥ 2 separate moments (and no other input) | −1 |
| ≥ 60 s active | −2 (≥ 20 s: −1) |
| ≥ 2 pages with realistic gaps (median ≥ 3 s) | −1 |
| An action taken ≥ 3 s into the session, after input | −1 |

Example outputs (from the synthetic scenarios): *"Likely automated — 10 page loads within 15 s; no scroll, pointer, key or touch activity during 14 s in the foreground; window exactly 800×600, the default of common browser-automation tools."* and *"Likely human — pointer, touch or keyboard activity in 22 separate moments; 1 min 7 s of active foreground time; 3 pages with realistic gaps (median 8 s)."* The explorer shows the full evidence list with weights.

**Deliberately not used:** city, region or state (Iowa, Virginia…), a cloud provider on its own, device type, browser brand, or GA4's "engaged session" flag. Hosting-network origin can add at most +1, so it can never make a session automated by itself. A test in `tests/session-journeys.test.mjs` enforces this.

**Limitations.** Automation that scrolls, moves a pointer and waits will look human. A person who opens a link and closes it within seconds looks uncertain. Browsers that block the stream or send Global Privacy Control are invisible to it, and automation that is suppressed before analytics starts (our own tests, self-declared `navigator.webdriver`) never appears. GA4 and the stream therefore count different sets of sessions; the brief shows both totals and never subtracts one from the other.

## Reporting and the explorer

- The daily job (`scripts/daily-analytics-summary.mjs`) reads the reporting day by **session start time in `ANALYTICS_TIME_ZONE`**, plus the previous day for comparison, from `GET /internal/analytics/sessions` (bearer token). It rebuilds and classifies sessions locally. If the stream is unreachable or not deployed, the brief says so and uses GA4 aggregates only.
- The daily email links to the detailed report and explorer after the private login is configured. Both require HTTP Basic authentication over HTTPS with the username `portfolio-admin` and a separately provisioned random password. The URL has no authorization material, and the automation bearer does not grant browser access. Cloudflare Access was investigated. This account does not currently have Access enabled.
- Browser pages use `no-store`, `noindex`, `Referrer-Policy: no-referrer` and a restrictive Content Security Policy. The administrative job reads data and writes reports through separate bearer-protected routes. The public GitHub repository does not publish private report HTML or journey logs.
- The explorer filters by date range, classification, engagement, landing page, project, source and whether a meaningful action happened. Selecting a session shows its timeline, timings and classification evidence. A list of observed same-document route changes sits underneath.
- The email is idempotent: it sends with the Resend idempotency key `daily-analytics-<date>`, the report upload is an upsert, and `ANALYTICS_REPORT_DATE=YYYY-MM-DD` re-runs a past day.

## What is and isn't recoverable for earlier days

| Data | Before the stream was deployed |
| --- | --- |
| GA4 daily aggregates (sessions, engagement, pages, events, geography, devices, registered custom dimensions) | Available as before, within GA4's retention. |
| Where historical clicks happened (`project_slug` × `pagePath`) and device vs window width | Available from GA4 aggregates. See the verification workflow's diagnostic sections. |
| Individual session timelines, active time, input activity, human/automated classification | **Not recoverable.** The evidence was never collected. GA4's *User explorer* (Explore → User explorer) can show raw event sequences per GA4 browser id for spot checks within the property's retention window, but without timing, input or network evidence. The report does not reconstruct or classify those sessions. |
| BigQuery event export | Starts on the day it is linked; GA4 does not backfill. |

## Production operation and recovery

1. From `worker/`, verify production identity with `npx wrangler whoami`, the database with `npx wrangler d1 info INTAKE_DB`, and the current migrations with `npx wrangler d1 migrations list INTAKE_DB --remote`. Capture a Time Travel bookmark with `npx wrangler d1 time-travel info INTAKE_DB`.
2. Apply the additive migration with `npx wrangler d1 migrations apply INTAKE_DB --remote`. Deploy the existing `zacharysturman-api` Worker and preserve its intake secrets and schedules.
3. Verify `/health`, intake preflight, `/collect` validation and separate authenticated and unauthenticated report requests. Set repository variables `NEXT_PUBLIC_SESSION_ANALYTICS_ENABLED=true` and `ANALYTICS_ACCESS_ENABLED=true` and deploy through the existing main/Firebase workflow. Set `ANALYTICS_SESSION_STARTED_AT` to the confirmed first live build timestamp. The launch day is partial.
4. Use `gh workflow run daily-analytics.yml -f dry_run=true` to verify the scheduled code path or `gh workflow run daily-analytics.yml -f test_email=true -f report_date=YYYY-MM-DD` to send to the existing configured inbox. The test send has separate deduplication and does not overwrite the day's detailed report. Use `-f store_only=true -f report_date=YYYY-MM-DD` to check detailed-report storage without emailing.
5. For a tracking-only rollback, set the first-party build flag to false and redeploy Firebase. To remove links from future email, set `ANALYTICS_ACCESS_ENABLED=false`. The prior Worker version was `c95029a4-aa12-41ba-86b0-f8dc986aa43c`. Rolling back Worker code leaves the additive schema and data in place. The pre-migration D1 bookmark is `00002be7-00000000-0000512c-c051e9a8e4cc5230b4ff4bfe11f083dd`. Restoring it would also rewind unrelated intake writes, so preserve the schema and use Worker rollback for ordinary recovery.

On the deployment Mac, copy the administrator password with `pbcopy < ~/.config/portfolio-analytics/admin-password` and paste it into the browser's login prompt. The owner-only file is outside the repository, and the server copy is a Worker secret. Rotate using `npx wrangler secret put ANALYTICS_ADMIN_PASSWORD`, then update the saved copy. The scope is the API's `/analytics/` routes and does not include `/collect` or intake.

### Measurement and privacy limits

The first-party stream keeps random session IDs and provides no cross-session visitor count or returning classification. The daily email labels GA4 browser-level user counts as estimates. The returning-user count uses GA4’s `newVsReturning` dimension. A browser can appear in both new and returning groups during one reporting period. Summed per-page active time can overlap across foreground windows. Session end is the last recorded event. Downloads show click intent unless the browser test independently observes a file download.

The privacy page describes collection, retention and Global Privacy Control. No region-specific consent gate was added, and consent obligations were not established by technical acceptance. Do not put credentials, emails or personal data in campaign tags. Retention in D1 is 30 days for session data and 90 for stored detailed reports. Email copies follow the owner's mailbox retention.

## Validation

- `npm run test:unit` covers the taxonomy, timing clock, session rotation, reconstruction and classification (the ten synthetic scenarios in `tests/fixtures/analytics/synthetic-sessions.mjs`), the brief and the session source.
- `cd worker && npm test` covers ingestion validation and sanitisation, privacy-relay handling, clock correction, de-duplication, caps, bearer and administrator authorisation, the explorer, report storage and retention against a real local D1.
- `npx playwright test -c playwright.contact.config.ts session-stream` drives a real browser with the stream in observe-only mode (`window.__ZS_SESSION_LOG__`; nothing is sent). It checks one session across client-side navigation, deep-link ordering, the background-tab exclusion and card-click attribution.
- `node scripts/render-analytics-sample.mjs` renders the sample brief and detailed report from fixtures.
- No production GA4 data is sent by any of these. Automated browsers stay suppressed, and the stream's observe-only mode never touches the network.
