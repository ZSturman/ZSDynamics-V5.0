# Contact messages and writing updates

The contact page is a static Next.js export. All writes go to the existing Cloudflare Worker. Cloudflare D1 saves submissions before the browser sees success. Cron jobs then deliver email through Resend and mirror records into private Notion trackers. No secrets or visitor records are included in the static export.

## Daily use

- [Website Messages](https://www.notion.so/72ce9e577255443a85a9abda87af675b): one row per message, including email, topic, received time, and a stable request ID. Open the row to read the full message. Use **Needs a reply** for New/Waiting messages, or **Triage** to move cards between New, Replied, Waiting, and Closed. Set **Follow-up** and **Notes** as needed. Sync never resets your triage fields.
- [Writing Subscribers](https://www.notion.so/88bed1f1b2724213b96b2ea8644687db): one row per address, with Pending, Active, or Unsubscribed consent and relevant dates. **Confirmed readers** shows active subscriptions. This is a mirror: changing Consent in Notion does not change email delivery. Use the unsubscribe link or the D1 operation below to stop delivery.
- Contact alerts and confirmed-subscriber alerts arrive at the existing `CONTACT_TO_EMAIL` inbox. Reply to a contact alert normally; its Reply-To is the visitor. Saved contact messages remain available when mail delivery fails.

Contact messages do not enroll anyone in updates. A subscriber must check the consent box and confirm their address using the email link. Confirmation links expire after 48 hours. Merely opening a link does not change consent; both confirmation and unsubscribe pages require a button press, so email link scanners cannot silently change consent.

Every five minutes the Worker processes up to two saved messages, two subscriber records, and five writing emails. A separate hourly job fetches the published article manifest. Its first successful run establishes a baseline without emailing existing articles. Later, newly discovered slugs generate one delivery per currently confirmed reader. Editing an existing article does not send another notification. An unsubscribed reader is excluded from queued deliveries, including after rejoining with a new confirmation.

## Article publishing and subscriber delivery

Content Manager owns editorial review and final approval; it does not send subscriber email. The Articles backend prepares approved `published/<slug>/` bundles. After publication is explicitly resumed, the portfolio ingestion/deployment pipeline must import those bundles into the live site, including `/articles/articles.json` and each article page. Cross-posting to DEV, Hashnode or Medium alone does not notify subscribers.

The deployed Worker discovers that **live manifest hourly**, then its five-minute job sends queued updates through Resend (five recipients per run). Allow roughly 65 minutes for the first batch after a deployment, plus additional batches/retries for larger lists. No app session needs to remain open. Do not add a separate Content Manager mailer: D1 owns consent and delivery deduplication. Only Active, email-confirmed subscriptions are eligible; Pending and Unsubscribed addresses are excluded. Rejoining does not revive deliveries queued for an earlier subscription generation. Updating an existing slug does not resend an announcement.

Keep the existing D1 database and `articles_initialized` state across deployments. The first discovery deliberately baselines existing articles without mail, so resetting this state can suppress announcements. Before the next real article release, verify the Worker cron configuration, aggregate intake status below, and the live manifest after the portfolio deploy. No article was approved, published, or emailed as part of this repair; the Content Manager publication pause remains in force.

Confirmation and unsubscribe pages use `Referrer-Policy: same-origin`: `no-referrer` makes browser form POSTs send `Origin: null`, which the API correctly rejects. Signed GET links remain previews; a button press performs the consent change. After deploying this fix, an unexpired confirmation email can be reopened; links older than 48 hours require a fresh signup.

## Configuration and activation

The production public API URL and Turnstile **site key** are versioned in `lib/contact-config.json`. These are public configuration, not credentials. `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` can override them at build time. The production workflow checks the resolved configuration before building; preview automation blocks mail/analytics calls and tests use a mock challenge.

The site key must belong to the same Cloudflare Turnstile widget as the Worker secret, with `zacharysturman.com` and `www.zacharysturman.com` allowed as hostnames. The Worker validates the hostname and `contact`/`newsletter` action, in addition to the token. No production verification bypass is provided.

From the repository root:

```sh
npm ci --prefix worker
cd worker
npx wrangler login
npm run setup:intake
```

Setup creates/reuses the `portfolio-intake` D1 database, writes its binding ID to `worker/wrangler.toml`, and applies migrations. It is safe to rerun. Commit that non-secret binding configuration with the implementation.

Worker secrets live in Cloudflare, set using `npx wrangler secret put NAME` from `worker/`:

| Secret | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Existing verified-domain sending key. |
| `CONTACT_TO_EMAIL` | Owner's destination inbox. |
| `TURNSTILE_SECRET` | Secret paired with the public site key. |
| `INTERNAL_TOKEN` | Existing report relay token; also derives signing keys for subscription links and salts temporary rate-limit hashes. Rotating it invalidates outstanding subscription links. |
| `NOTION_API_KEY` | Portfolio integration, connected to both trackers with read/insert/update access. Store as a Worker secret as well as in local `.env.local`; local environment values are not automatically uploaded. |

The tracker database/data-source IDs and public URLs are non-secret Worker vars in `worker/wrangler.toml`. A 404 from Notion means the connection lacks access or an ID is wrong. Changing tracker names is safe; changing the configured property names requires updating `worker/src/intake.ts`.

After validation, from `worker/`, run `npm run deploy`. The normal main-branch Firebase workflow publishes the frontend. Deploy the Worker before exposing the new forms. Existing report-relay secrets and `/internal/daily-summary` remain in use.

## Verification

Run from the repository root:

```sh
npx playwright install chromium # once; real-browser confirmation regression
npm test --prefix worker
npm run typecheck --prefix worker
npm run test:contact
npm run build
```

Expected: isolated Worker tests pass with a real local D1 emulator and mocked Turnstile/Resend/Notion; browser tests pass on mocked endpoints; Next exports `/contact` successfully. Tests send no real messages and disable production analytics. The Worker tests also submit confirmation/unsubscribe forms in Chromium, exercise delivery retries and consent suppression, and check the existing internal report mail relay. Install root and Worker dependencies before running them.

For a final human production check, visit `/contact` in a normal browser. Send a message from your own address and subscribe from that address. Within a few minutes, expect a saved message in Notion, an owner alert with a working Reply-To, and a confirmation email. Confirm with the button; expect an Active subscriber row and owner notification. Use the unsubscribe button from the first writing email when available; D1 takes effect immediately and Notion follows on the next cron. There is no need to publish a fake article to test delivery: emulator tests cover discovery, retries, and unsubscribe suppression.

Local UI only: `npm run dev`. For the Worker emulator, run `npm run migrate:local --prefix worker` then `npm run dev --prefix worker`. `worker/wrangler.local.toml` permits local origins and omits Notion targets. Copy `worker/.dev.vars.example` to `.dev.vars` and provide local-only mail settings and a localhost-enabled Turnstile pair for manual end-to-end work. Automated tests supply all external responses themselves. Never copy production secrets into test fixtures.

## Failure recovery and privacy

- Missing storage or required verification/mail configuration returns 503 without pretending success. Visitors always have a direct-email fallback. No client-side forms are enabled without a site key.
- Queued emails are paced to respect the provider API rate. Contact and writing email failures back off from five minutes to an hour and stop after eight attempts. Notion failures retry after an hour independently. Inspect failures using Cloudflare Worker logs (only generic failure names are logged), D1, and Resend. An API-accepted email is marked sent; actual inbox placement and later bounces require checking Resend.
- A shared D1 lease prevents overlapping cron workers. Each job stops beginning new work after 90 seconds; subsequent jobs drain the backlog. This is for a small portfolio list, not bulk marketing campaigns.
- Rate limiting uses atomic D1 counters (ten attempts/IP/hour, three/address/form/hour). It stores rotating secret-salted hashes, never raw IPs. Expired counter rows are cleaned up by cron. All form fields and tokens have validation, request bodies are capped at 16 KiB, and content is escaped in email and written as plain text in Notion.
- Do not publish the trackers or include them in the portfolio export databases. Keep messages and consent records only as long as needed. Deleting a Notion row does not delete D1, and deleting D1 does not erase mail already delivered.
- Resend idempotency keys protect ordinary retries. Resend's deduplication retention is finite; after an extended outage, inspect provider history before manually requeueing an ambiguous delivery to avoid duplicate email.
- Pending addresses never receive articles. No open/click tracking is added by this code. Disable provider-level email tracking if enabled in Resend.

Authenticated aggregate status (no visitor data) is available at `GET /internal/intake-status` with `Authorization: Bearer INTERNAL_TOKEN`. Do not put the token in URLs or browser code. `GET /health` reports whether intake and Notion bindings/secrets are configured, without exposing their values.

Useful D1 inspections from `worker/`:

```sh
npx wrangler d1 execute portfolio-intake --remote --command "SELECT id,received_at,email_attempts,email_sent_at,notion_page_id FROM messages ORDER BY received_at DESC LIMIT 20"
npx wrangler d1 execute portfolio-intake --remote --command "SELECT status,count(*) FROM subscribers GROUP BY status"
npx wrangler d1 execute portfolio-intake --remote --command "SELECT article_slug,attempts,count(*) FROM article_deliveries WHERE sent_at IS NULL GROUP BY article_slug,attempts"
```

For an owner-requested unsubscribe, use a parameterized D1 console operation or replace the synthetic ID below with the actual subscriber ID:

```sql
UPDATE subscribers SET status='Unsubscribed', unsubscribed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), notion_state=NULL, notion_next_attempt=0 WHERE id='SUBSCRIBER_ID';
```

For erasure, delete the matching Notion page and owner email copies as well as the D1 message/subscriber. Deleting a subscriber cascades its article deliveries. Take care to target the exact record. The old NEWSLETTER KV namespace was never configured in this checkout; no legacy subscribers have been imported or assumed confirmed.
