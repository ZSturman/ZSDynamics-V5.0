# Setup: Email (Resend)

Contact-form, newsletter-interest, and daily analytics summary emails are all delivered by [Resend](https://resend.com).

## Why Resend

- Free tier (3,000 emails/month, 100/day) is enough for this site by orders of magnitude.
- Domain verification is straightforward (DKIM + SPF + return-path TXT records).
- HTTP API works from a Cloudflare Worker without an SDK or SMTP.

## Domain verification

1. Resend dashboard → **Domains → Add Domain** → `zacharysturman.com`.
2. Add the listed `TXT` and `CNAME` records to the domain's DNS (managed at the registrar / Cloudflare).
3. Wait for verification (usually a few minutes).
4. Pick a `From:` address on the verified domain — `contact@zacharysturman.com` is the default in `wrangler.toml`.

## API key

1. Resend dashboard → **API Keys → Create API Key**. Limit to "Sending" if available.
2. Add as a Worker secret: `wrangler secret put RESEND_API_KEY`.

## Worker integration

The Worker calls `POST https://api.resend.com/emails` directly. See `worker/src/index.ts` (`sendEmail`). On `4xx` / `5xx` from Resend the contact endpoint returns `502 send_failed`; the user sees a friendly error and the form remains usable.

## Reply-to

Contact-form submissions set `reply_to` to the visitor's email address, so replying from your inbox goes back to them — not to `CONTACT_FROM_EMAIL`.
