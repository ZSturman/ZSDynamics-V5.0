# Setup: Hammerspoon daily portfolio publishing

The daily schedule for `zacharysturman.com` is owned by this Mac's
Hammerspoon configuration, not by a GitHub Actions cron. At **14:00 UTC** each
day (about 7:00 AM PDT / 6:00 AM PST), Hammerspoon starts the portfolio's
local publisher. If the Mac wakes or Hammerspoon reloads after that time, it
catches up once for that UTC date.

The publisher preserves the existing architecture:

```text
Hammerspoon → Notion/article sync → generation/validation → normal git push
                                                       ↓
                                      GitHub push workflow → Firebase Hosting
                                                       ↓
                         exact deployment marker → live Playwright QA → email
```

GitHub remains responsible for the existing Firebase deployment, exact-SHA
confirmation, production Playwright runs, previews, and the final live-site
email. It no longer schedules or performs the Notion/content generation.

## What the local publisher does

1. Refuses to start if the portfolio checkout is dirty, not on `main`, or not
   fast-forwarded to `origin/main`.
2. Loads `.env.local` (without printing its values), fetches the six Notion
   databases, synchronizes `ZSturman/Articles`, generates projects and media,
   post-processes API output, and writes a semantic change summary.
3. Runs the production build, generated-output validation, lint, unit tests,
   Python tests, browser tests, and media matrix before it can commit.
4. Retries once from a safely fast-forwarded `main` if `origin/main` advances
   during generation; it refuses a second race.
5. Commits only approved generated `public/` paths as `Portfolio Publisher`.
   A normal credentialed `git push` triggers the existing Firebase workflow.
6. Sends a no-change, check-only, or pre-deployment-failure report through the
   existing Worker/Resend endpoint. Successful publish reports are sent later
   by the GitHub deployment workflow, after live QA and preview capture.

The Hammerspoon menu and a local artifact-directory lock prevent overlapping
Mac-side executions. Hammerspoon applies a two-hour ceiling; the command also
refuses a second simultaneous process.

## One-time local setup

1. Rotate any credential that was exposed in local terminal history before
   enabling this automation. Update every owner together: portfolio
   `.env.local`, relevant GitHub secret, and/or Cloudflare Worker secret.
2. In the portfolio checkout, set these server-side values in `.env.local`:

   | Value | Purpose |
   | --- | --- |
   | `NOTION_API_KEY` | Notion integration token. |
   | `NOTION_PROJECTS_DB_ID` | Projects database ID. |
   | `NOTION_COLLECTIONS_DB_ID` | Collections database ID. |
   | `NOTION_ASSETS_DB_ID` | Assets database ID. |
   | `NOTION_RESOURCES_DB_ID` | Resources database ID. |
   | `NOTION_CONFIG_DB_ID` | Config database ID. |
   | `NOTION_WORK_LOGS_DB_ID` | Work Logs database ID. |
   | `API_BASE_URL` | Worker base URL, normally `https://api.zacharysturman.com`. |
   | `INTERNAL_TOKEN` | Bearer token shared with the Worker. |

   Keep optional R2 and public Firebase values in the same local file when
   they are used by this checkout. Hammerspoon never contains credentials.

3. Confirm the local checkout can use the normal GitHub remote credentials:

   ```bash
   git -C /Users/zacharysturman/Projects/zacharysturman.com/zacharysturman fetch origin main
   ```

4. Enable the Hammerspoon module in
   `/Users/zacharysturman/.hammerspoon/config.local.lua`:

   ```lua
   return {
     modules = {
       portfolio_publish = { enabled = true },
     },
   }
   ```

   Then reload Hammerspoon:

   ```bash
   hs -c 'hs.reload()'
   ```

`PP` appears in the menu bar once enabled. Its timer starts automatically,
shows **Daily at 14:00 UTC**, and retains the last attempted UTC date across
reloads. The Mac must be powered on and Hammerspoon running; missed runs catch
up after wake/reload later that same UTC day.

## Manual operation and disabling

- **PP → Publish Now** asks for confirmation, then runs the complete local
  generation/validation/push flow.
- **PP → Run Check Only** performs generation and validation, emails the
  semantic result, and restores generated files without committing or
  deploying.
- **PP → Disable Daily Timer** stops scheduling until Hammerspoon reloads.
- For a persistent disable, set
  `modules.portfolio_publish.enabled = false` in `config.local.lua` and reload
  Hammerspoon. A disabled module creates no menu, timer, watcher, or task.

There is intentionally no GitHub Actions schedule or manual-dispatch workflow
for content publishing. The only GitHub entry point is the normal `main` push
deployment workflow.

## Reports, evidence, and failures

The local publisher keeps redacted pipeline logs, change summary, validation
output, and run metadata in `artifacts/hammerspoon-runs/` for 30 days. The
`PP` menu opens both that directory and the current log at
`~/Library/Logs/portfolio-publish.log`.

After a push, GitHub Actions retains deployment-marker evidence, live
Playwright HTML/JSON reports, traces, screenshots, previews, and email-delivery
status for 30 days. Find them under the `Deploy to Firebase Hosting on merge`
run that corresponds to the pushed SHA.

- No meaningful public change: generated timestamp/format-only output is
  restored; there is no commit, Firebase deployment, or live QA; a short
  no-change email is sent.
- Local sync, build, validation, Git, or push failure: the local report is
  emailed as **HIGH** when the current site responds, or **CRITICAL** when it
  does not. An email-delivery problem is retained in local run metadata and
  does not hide the original failure.
- Firebase, marker confirmation, live QA, or preview failure after a push: the
  GitHub deployment workflow sends the prioritized report and retains its
  evidence. A custom-domain/live QA failure is **CRITICAL**; a user-visible QA
  problem after the exact deployment is confirmed is **MEDIUM**.

## One-time Worker update

The Worker supports optional Base64 JPEG/PNG preview attachments and an
idempotency key for these reports. Deploy it once after reviewing the code:

```bash
cd /Users/zacharysturman/Projects/zacharysturman.com/zacharysturman/worker
npm ci
npm run typecheck
npx wrangler login
npm run deploy
```

`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `INTERNAL_TOKEN` remain Cloudflare
Worker secrets. Do not put them in Hammerspoon configuration or commit them.
