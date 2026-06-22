# Setup: Cloudflare Worker

The `worker/` directory contains a Cloudflare Worker exposing three endpoints used by the static site and the GitHub Actions cron:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/contact` | Contact-form submissions. |
| `POST` | `/newsletter-interest` | Opt-in email collection. |
| `POST` | `/internal/daily-summary` | Bearer-protected; relays a daily GA4 summary email. |
| `GET`  | `/health` | Liveness probe. |

Spam controls: honeypot field (`hp`), Cloudflare Turnstile token verification, per-IP KV rate limit (default 5 / hour).

## One-time setup

```bash
cd worker
npm install
npx wrangler login
```

Create the two KV namespaces and paste the returned ids into `wrangler.toml` (replacing the `REPLACE_WITH_*` placeholders):

```bash
npx wrangler kv:namespace create RATE_LIMIT
npx wrangler kv:namespace create NEWSLETTER
```

Set required secrets:

```bash
npx wrangler secret put RESEND_API_KEY     # from resend.com (verified domain zacharysturman.com)
npx wrangler secret put CONTACT_TO_EMAIL   # where contact submissions are delivered
npx wrangler secret put TURNSTILE_SECRET   # Cloudflare Turnstile server secret
npx wrangler secret put INTERNAL_TOKEN     # random 32+ char token; share with GH Actions
```

Deploy:

```bash
npx wrangler deploy
```

In the Cloudflare dashboard → **Workers & Pages → zacharysturman-api → Triggers**, add the custom domain `api.zacharysturman.com`. Update the `NEXT_PUBLIC_API_BASE_URL` env var in your build environment to point at this URL.

## Local development

```bash
cp .dev.vars.example .dev.vars  # if you keep one; otherwise set vars inline
npx wrangler dev
```

Wrangler runs the Worker on `http://localhost:8787`. Hit `/health` to confirm.

## Allowed origins

Set in `wrangler.toml` under `[vars].ALLOWED_ORIGINS` (comma-separated). Requests with a disallowed `Origin` header are rejected with `403 origin_not_allowed`. The `/internal/*` route bypasses this check (it's bearer-authenticated server-to-server).

## Environment variables (Worker)

| Var | Type | Description |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | var | Comma-separated allow-list. |
| `CONTACT_FROM_EMAIL` | var | `From:` address (must be on Resend's verified domain). |
| `RATE_LIMIT_MAX` | var | Max requests per IP per window. Default `5`. |
| `RATE_LIMIT_WINDOW_SECONDS` | var | Window length. Default `3600`. |
| `RESEND_API_KEY` | secret | Resend API key. |
| `CONTACT_TO_EMAIL` | secret | Inbox for contact submissions. |
| `TURNSTILE_SECRET` | secret | Turnstile server secret. |
| `INTERNAL_TOKEN` | secret | Bearer token for `/internal/*`. |
