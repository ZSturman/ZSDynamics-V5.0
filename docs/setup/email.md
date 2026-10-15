# Setup: Email (Resend)

Contact-form, newsletter-interest, and daily analytics summary emails are all delivered by [Resend](https://resend.com).

## Why Resend

- The existing account provides transactional email for this small site; check the Resend dashboard for current plan limits.
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

The Worker calls `POST https://api.resend.com/emails` directly. See `worker/src/mail.ts` (`sendEmail`). Contact submissions are saved to D1 first, then delivered by a cron job with retries. An email failure does not discard the message or tell a visitor to resubmit an already accepted message. Internal report relays still return `502 send_failed` on delivery failure. See [contact setup and recovery](contact-intake.md).

## Reply-to

Contact-form submissions set `reply_to` to the visitor's email address, so replying from your inbox goes back to them — not to `CONTACT_FROM_EMAIL`.
