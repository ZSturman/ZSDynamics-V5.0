# Portfolio API Worker

Durable contact intake, confirmed writing subscriptions, Notion trackers, and the existing report email relay for `zacharysturman.com`.

Start with [contact setup and operations](../docs/setup/contact-intake.md) and the [endpoint map](../docs/setup/worker.md).

```sh
npm ci
npm run typecheck
npm test
npx wrangler login
npm run setup:intake
# Set secrets; see the setup guide. Existing secrets are preserved.
npm run deploy
```

Local emulator: `npm run migrate:local`, then `npm run dev`. Automated tests use a real ephemeral D1 database and mock every external service; they send no email and change no Notion records.
