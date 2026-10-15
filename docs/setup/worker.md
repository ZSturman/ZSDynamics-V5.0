# Setup: Cloudflare Worker

The existing `zacharysturman-api` Worker serves the static portfolio's contact and writing-update forms, synchronizes private Notion trackers, and relays internal report emails. Setup, credentials, daily use, recovery, and tests are documented in [Contact messages and writing updates](contact-intake.md).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/contact` | Validate and durably save a contact message. |
| POST | `/newsletter-interest` | Request a confirmation email, with explicit consent. |
| GET / POST | `/confirm` | Preview / confirm a signed subscription link. |
| GET / POST | `/unsubscribe` | Preview / unsubscribe via a signed link. |
| GET | `/health` | Liveness and configuration flags, no secrets or records. |
| GET | `/internal/intake-status` | Bearer-protected aggregate queue counts. |
| POST | `/internal/daily-summary` | Existing bearer-protected report relay, including image attachments. |

Browser form requests require an allowed Origin, a valid Turnstile hostname/action, and D1 rate-limit capacity. Subscription links are signed and their confirmation forms submit on the API origin. `/internal/*` uses the existing `INTERNAL_TOKEN`. `worker/wrangler.toml` binds D1 and schedules five-minute delivery jobs plus hourly article discovery. No public endpoint lists visitor records.

```sh
npm ci --prefix worker
cd worker
npx wrangler login
npm run setup:intake
# Add required secrets as described in contact-intake.md.
npm run typecheck
npm test
npm run deploy
```

Expected: `https://api.zacharysturman.com/health` returns `ok: true`, `intakeConfigured: true`, and `notionConfigured: true`. The latter flags check bindings/secrets; use the documented human form check to establish actual delivery.
