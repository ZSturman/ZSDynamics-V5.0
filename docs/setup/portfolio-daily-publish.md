# Setup: Hammerspoon daily portfolio publishing

## Mac/Pi coordination (October 25, 2026)

The installed Mac entry point now claims its UTC daily job through the private
SSH authority in `~/Workspace/Projects/Publishing Coordinator`. A Pi worker can
claim that same job from 14:05 UTC if the Mac has not claimed it. Known completed
or failed daily attempts are not silently repeated, and uncertain running work
is never automatically stolen. The Mac retains the pipeline below; the Pi uses
a dedicated `origin/main` checkout and Linux dependency image. Uncommitted Mac
source is never implicitly deployed to the Pi.

Private `.env.local` sets `PUBLISH_COORDINATOR_CLIENT`,
`PUBLISH_COORDINATOR_CONFIG` and `PUBLISH_COORDINATOR_PYTHON`. Once configured,
authority loss blocks publishing before pipeline work. Check-only uses its own
job identity and the same mutex. Existing GitHub Firebase deployment ownership
is unchanged. Both publication policies currently remain paused during Content
Manager testing; see the coordinator's README for status, audited recovery and
the explicit per-workflow resume commands. Its offline Pi dependency/browser
checks do not substitute for a complete portfolio quality/resource run.

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
                 this Mac confirms exact marker → local Playwright → previews → email
```

GitHub remains responsible only for the Firebase Hosting deployment. Once the
new release is visible, this Mac confirms its exact SHA, runs the production
Playwright suite against the live custom domain, captures the previews, and
sends the final dashboard email with those local screenshots attached.

## What the local publisher does

Diagnostics and publishing are deliberately decoupled (see
`scripts/git-workspace-health.mjs`). A dirty tree from ordinary local
development is diagnostic information, not automatically an incident:

- **diagnostics-safe** — Notion sync, article sync, generation, validation,
  lint, and tests run unless the repository itself is in a genuinely broken
  state (a merge/rebase in progress, or unresolved conflicts). Ordinary
  uncommitted source, an unpushed local commit, or being behind
  `origin/main` do **not** stop diagnostics.
- **publish-safe** — committing and pushing generated output additionally
  requires `main` to match `origin/main` exactly and no uncommitted tracked
  source outside the publisher-managed `public/` output (so a release can
  never validate one version of the code and push another). Documentation,
  notes, and scratch files (`docs/`, `README.md`, `AGENTS.md`, `tmp/`,
  `logs/`) are treated as informational and never block a publish.

1. Assesses repository health first. Only an unresolved merge conflict or an
   in-progress merge/rebase aborts the run entirely (reported as a
   **blocking** condition). Everything else proceeds to diagnostics.
2. Loads `.env.local` (without printing its values), fetches the six Notion
   databases, synchronizes `ZSturman/Articles`, generates projects and media,
   post-processes API output, and writes a semantic change summary — this
   step always runs, regardless of local Git cleanliness.
3. Runs the production build, generated-output validation, lint, unit tests,
   Python tests, browser tests, and media matrix.
4. If a publish is intended (`--mode publish`) and the tree is publish-safe,
   retries once from a safely fast-forwarded `main` if `origin/main` advances
   during generation; it refuses a second race. If the tree is **not**
   publish-safe, the run stops here with a **publish-skipped** report: it
   states plainly that diagnostics succeeded and why the publish was
   deferred, at **ATTENTION** severity — not HIGH/CRITICAL, and not treated
   as a failure. No commit, merge, or push is attempted in this case.
5. Commits only approved generated `public/` paths as `Portfolio Publisher`.
   A normal credentialed `git push` triggers the existing Firebase workflow.
6. After a push, waits for Firebase to expose the exact release marker, then
   runs live Playwright QA and preview capture **on this Mac**. It sends the
   final dashboard email only after those local checks and captures finish. The
   marker wait is allowed to span the Firebase deployment queue (up to about
   100 minutes) before it reports a failure.

## Email severity and noise reduction

`scripts/send-portfolio-report.mjs` classifies every report and keeps a
small persisted state file (`artifacts/notification-state.json`, not
cleared between runs) so repeated unresolved low-priority issues don't
spam the inbox:

- **SUCCESS** — release verified, no changes, check-only, or diagnostics
  complete with nothing to report.
- **ATTENTION** — a publish was deferred because of ordinary local
  repository state (see above), or a low-priority finding. Deduplicated: an
  unchanged ATTENTION issue is not re-sent more than once per ~20 hours.
- **LOW / MEDIUM** — a post-deployment check (preview capture, live QA)
  failed while production is otherwise healthy.
- **HIGH / CRITICAL** — a real failure (sync, build, validation, deployment,
  or a broken repository state). Never suppressed or deduplicated,
  regardless of how often it repeats.

An unresolved ATTENTION issue that persists for 3+ days is escalated to
HIGH in the email (with an explicit "unresolved for N days" note) so a
stale, ignored condition cannot stay quiet indefinitely. When a previously
reported issue stops recurring, the next report is sent immediately and
marked **Resolved**, even if it would otherwise have been a routine
success email.

Every report also includes a **Developer state** section (from Git health)
and, when present, a **Needs attention** section (validation warnings, such
as a project missing a description or an article missing an asset) —
independent of whether the run succeeded, was deferred, or failed.

The Hammerspoon menu and a local artifact-directory lock prevent overlapping
Mac-side executions. Hammerspoon applies a two-hour ceiling; the command also
refuses a second simultaneous process.

## One-time local setup

1. Update every owner together: portfolio
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

   The publisher automatically uses `.venv/bin/python3` when that project
   environment exists. Refresh it after dependency changes with
   `.venv/bin/python -m pip install -r requirements.txt`.

4. Confirm the module is enabled. The tracked `config.lua` defaults already
   set `portfolio_publish.enabled = true` and `schedule.start_on_load = true`,
   so on a checkout using those defaults unmodified there is nothing further
   to do here — reloading Hammerspoon is enough to start the timer:

   ```bash
   hs -c 'hs.reload()'
   ```

   To enable (or override) it on a machine/checkout where the tracked default
   has been changed, or to intentionally diverge from the tracked defaults
   without editing them, create
   `/Users/zacharysturman/.hammerspoon/config.local.lua`
   (see `config.local.lua.example` for the template) with:

   ```lua
   return {
     modules = {
       portfolio_publish = { enabled = true },
     },
   }
   ```

   then reload Hammerspoon the same way. `config.local.lua` is optional and
   is not present on every machine — it only needs to exist when you want a
   local override that differs from whatever `config.lua` currently ships
   with.

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
- For a persistent disable, set `modules.portfolio_publish.enabled = false`
  either directly in `config.lua` (if you're editing the tracked defaults) or
  in a local `config.local.lua` override (see step 4 above), then reload
  Hammerspoon. A disabled module creates no menu, timer, watcher, or task.

There is intentionally no GitHub Actions schedule or manual-dispatch workflow
for content publishing. The only GitHub entry point is the normal `main` push
deployment workflow.

## Reports, evidence, and failures

The local publisher keeps redacted pipeline logs, change summary, validation
output, and run metadata in `artifacts/hammerspoon-runs/` for 30 days. The
`PP` menu opens both that directory and the current log at
`~/Library/Logs/portfolio-publish.log`.

After a push, GitHub Actions contains the Firebase deployment only. This Mac
retains the deployment-marker evidence, Playwright HTML/JSON reports, traces,
screenshots, previews, and delivery metadata in the matching directory under
`artifacts/hammerspoon-runs/` for 30 days.

- No meaningful public change: generated timestamp/format-only output is
  restored; there is no commit, Firebase deployment, or live QA; a short
  no-change email is sent.
- Local sync, build, validation, Git, or push failure: the local report is
  emailed as **HIGH** when the current site responds, or **CRITICAL** when it
  does not. Generated output is retained for review or a retry; an
  uncommitted source/configuration edit is the only preflight condition that
  blocks the publisher. An email-delivery problem is retained in local run
  metadata and does not hide the original failure.
- Firebase, marker confirmation, live QA, or preview failure after a push: the
  local publisher sends the prioritized report with any captured local evidence.
  A custom-domain/live QA failure is **CRITICAL**; a user-visible QA problem
  after the exact deployment is confirmed is **MEDIUM**.

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
