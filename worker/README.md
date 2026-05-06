# zacharysturman-api worker

Cloudflare Worker backing the contact form, newsletter interest, and daily analytics summary email for `zacharysturman.com`. See [docs/setup/worker.md](../docs/setup/worker.md) for full setup.

```bash
cd worker
npm install
wrangler login
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create NEWSLETTER
# paste returned ids into wrangler.toml
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_TO_EMAIL
wrangler secret put TURNSTILE_SECRET
wrangler secret put INTERNAL_TOKEN
wrangler deploy
```
