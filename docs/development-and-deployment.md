# Run, build, test, and publish the portfolio

This is the practical guide for changing `zacharysturman.com` safely—from a fresh clone to a verified production release. The normal site is a static Next.js export hosted by Firebase. Dynamic services (forms, mail, analytics reporting, and media hosting) are separate and opt in through configuration.

## Before you begin

| You need | Why |
| --- | --- |
| Node.js 20 or newer | Required by the project; CI uses Node 22. |
| npm | Installs the lockfile-pinned JavaScript dependencies. |
| Python 3 | Runs the optional content and media build pipeline, plus Python tests. |
| Git + access to `origin` | Required to push to GitHub. |
| Playwright Chromium | Required for browser and media tests. |
| Service credentials | Needed only for the integration or full content workflow you choose to run. |

Clone and install dependencies:

```bash
git clone https://github.com/ZSturman/ZSDynamics-V5.0.git
cd ZSDynamics-V5.0
cp .env.example .env.local
npm ci
```

`.env.example` is safe to copy: it disables analytics by default and contains no secrets. Put private values only in `.env.local`, GitHub Actions secrets/variables, or Cloudflare Worker secrets as appropriate. Do not add `.env.local` to Git.

## Run locally

For the normal site preview:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). This uses the public content already committed to the repository and does not require Notion, Firebase Analytics, Cloudflare, Resend, or R2 credentials.

Use `npm run dev:full` only when you intentionally need to regenerate articles, synchronize Notion projects, optimize media, and post-process the public data before starting Next.js. It can change generated files under `public/`, so start with a clean working tree and review the changes afterward.

### Optional local services

| Service | Command | Local address | When to use it |
| --- | --- | --- |
| Firebase Hosting emulator | `npx firebase-tools emulators:start --only hosting` | `http://127.0.0.1:5033` | Check the static `out/` export against Hosting rules. Run `npm run build` first. |
| Cloudflare Worker | `cd worker && npm ci && npm run dev` | `http://localhost:8787` | Develop or test contact/newsletter APIs. |

The Worker has its own local variables and secrets. Follow [Worker setup](setup/worker.md#local-development) rather than placing Worker secrets in the frontend environment.

## Build the right thing

There are two intentionally different build paths.

| Command | Intended use | Reads remote content? | Can change tracked generated content? |
| --- | --- | ---: | ---: |
| `npm run build` | Build the current committed portfolio for CI or a normal code-only change. | No | Only updates the deployment marker before the static export. |
| `npm run build:full` | Refresh articles/projects, optimize media, create API output, then build. | Yes—Notion when configured | Yes. |
| `npm run build:full:hosted` | Same full refresh, plus upload changed media to R2. | Yes | Yes, and it writes to configured R2. |

For a normal code or design change, use:

```bash
npm run build
```

The static site is written to `out/`. To test that output with Firebase’s rules rather than the Next development server:

```bash
npx firebase-tools emulators:start --only hosting
```

Then open `http://127.0.0.1:5033`.

For a content refresh, first configure the required Notion values in `.env.local`; then use `npm run build:full`. See [the daily publisher guide](setup/portfolio-daily-publish.md) for the six required database IDs, local safeguards, and the automated Notion-to-production flow. R2 is optional—if its five `R2_*` variables are absent, the pipeline retains local media paths and does not upload anything.

## Testing

Install the browsers once before running Playwright-based checks. The local
post-deployment verifier uses both Chromium and WebKit:

```bash
npx playwright install chromium webkit
```

Run the smallest useful check first:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:python
npm run test:e2e
```

For media-specific checks, use `npm run test:media:smoke`; it exercises desktop and mobile smoke coverage. The complete local suite is:

```bash
npm run test:all
```

`test:all` includes unit tests, Python pipeline tests, local browser tests, and the Playwright media matrix, so it is slower and needs the relevant browsers installed. After Firebase deploys, the local Hammerspoon publisher uses Chromium and WebKit against the live custom domain.

## Publish to GitHub and production

This is the standard release path for a reviewed change:

```bash
# Optional but recommended once per clone: enables the repository hooks.
npm run hooks:install

# Check exactly what will be included; do not commit generated or unrelated work by accident.
git status
git add <the-files-you-intend-to-publish>
git commit -m "Describe the portfolio update"
git push origin main
```

Before pushing, make sure `main` is current with `origin/main` and that you have already run the relevant checks. The installed **pre-push hook** runs `npm run test:media:smoke` and refuses a push when the canonical media sources have uncommitted changes. It protects the media pipeline; it does not replace the broader test suite.

The non-blocking **post-push hook** probes the live Worker’s health, CORS, origin allow-list, and internal-auth guard. It is informational; a failed post-push probe does not undo the GitHub push.

### What happens after a `main` push

The `Deploy to Firebase Hosting on merge` GitHub Actions workflow runs automatically:

```text
push to main
  → install exact lockfile dependencies
  → npm run build
  → deploy that commit to Firebase Hosting (live)
  → local publisher confirms Firebase + custom-domain deployment markers
  → local publisher runs live Playwright QA at https://zacharysturman.com
  → local publisher captures production previews and emails the dashboard report
```

The workflow locks production deployments into a queue. The local publisher waits for the deployed marker before it starts cross-browser live tests, then retains its JSON/HTML reports, screenshots, traces, previews, and deployment evidence under `artifacts/hammerspoon-runs/` for 30 days.

For a pull request opened from this repository, GitHub also creates a Firebase Hosting preview. A feature-branch push alone does not publish the live site.

### Verify the release

1. Open the GitHub Actions run named **Deploy to Firebase Hosting on merge** for the pushed commit and confirm all jobs are green.
2. Visit [zacharysturman.com](https://zacharysturman.com) and check the changed route on the custom domain.
3. Open the matching directory under `artifacts/hammerspoon-runs/` for the local QA report, screenshots, trace, and visual evidence.
4. Check the dashboard deployment email; it includes the locally captured screenshots as attachments.

## Configure the connected services

### Firebase Hosting and analytics

Firebase Hosting serves the `out/` directory with clean URLs, redirects, and JSON API cache headers defined in `firebase.json`. The production deployment uses the Firebase service-account secret configured in GitHub Actions.

Analytics is optional. To enable Firebase Analytics/GA4, add the public `NEXT_PUBLIC_FIREBASE_*` values and set `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true`. Because the site is statically exported, these public values are read at build time. The full setup, tracked events, UTM behavior, GA4 custom dimensions, and daily-report secrets are in [Analytics setup](setup/analytics.md).

### Forms, security, and Resend email

The static frontend sends form requests to `NEXT_PUBLIC_API_BASE_URL`, normally `https://api.zacharysturman.com`. The Cloudflare Worker supplies:

- `POST /contact` for contact-form delivery;
- `POST /newsletter-interest` for opt-in collection;
- `GET /health` for liveness checks; and
- `POST /internal/daily-summary` for authenticated deployment and analytics reports.

It rejects disallowed origins, uses a honeypot and Cloudflare Turnstile for form spam defense, and rate-limits with Cloudflare KV. Set it up with [Worker setup](setup/worker.md), then configure Resend using [Email setup](setup/email.md). Resend’s verified domain and Worker secrets (`RESEND_API_KEY`, recipient address, Turnstile secret, and internal token) stay in Cloudflare—they never belong in the repository.

### Which emails are sent

| Email | Trigger | Delivery path |
| --- | --- | --- |
| Contact-form notification | A visitor successfully submits the contact form. | Browser → Worker → Resend → configured contact inbox. |
| Newsletter-interest notification | A visitor submits the newsletter-interest form. | Browser → Worker → Resend. |
| Daily analytics summary | GitHub Actions schedule at 14:00 UTC. | GA4 Data API → GitHub Action → Worker → Resend. |
| Production deployment report | A `main` push is visible on Firebase and local production QA finishes, or a deploy/QA stage fails. | This Mac → authenticated Worker endpoint → Resend. |

Successful deployment reports wait until the static release, exact-release confirmation, local live Playwright QA, and local preview capture all succeed. Failure reports identify the failing stage and include retained evidence where available. A mail-delivery failure creates a visible warning/artifact but does not hide or alter the actual deployment status.

### Optional R2 media

Local files remain the default source for portfolio media. To serve versioned media from `media.zacharysturman.com`, configure the five `R2_*` variables described in [R2 media setup](setup/r2-media.md) and run `npm run build:full:hosted` or `npm run upload-media`. Uploaded objects use content-hashed paths and immutable caching, so a changed asset receives a new URL without stale-cache collisions.

## Troubleshooting

| Symptom | First check |
| --- | --- |
| `next build` fails after a content refresh | Confirm the six Notion IDs and token are set in `.env.local`; use `npm run build` if you do not intend to refresh content. |
| Browser/media tests cannot start | Run `npx playwright install chromium`; CI installs Chromium and WebKit itself. |
| Contact form fails locally | Start the Worker, set `NEXT_PUBLIC_API_BASE_URL`, and configure its local variables/secrets. |
| Contact form fails in production | Check the Worker `/health` endpoint, allowed origins, Turnstile keys, Worker secrets, and Resend domain verification. |
| Push is blocked by a media error | Review `git status` for `public/projects` or `public/image-hostnames.json`, resolve the intended media changes, then re-run `npm run test:media:smoke`. |
| Deployment workflow fails | Read the matching GitHub Actions logs and download its `portfolio-*` artifacts. The live site may remain healthy if deployment failed before Firebase’s release switch. |

For the complete reference set, return to the [README](../README.md#documentation-map).
