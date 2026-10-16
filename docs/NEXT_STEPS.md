## Apple submission complete — October 16, 2026

Both iPhone/iPad and native Mac **1.0 (8)** are **Waiting for Review**, with
automatic release after approval. The prior Connect authentication blocker is
resolved. Reviewer notes include the verified advanced Mac download/setup links;
all screenshot sets are COMPLETE. No public Store installation action is shown
because Apple's listing still returns 404. Current live copy says release is in
progress, which remains accurate. Submission receipts live in the app repository's
`docs/app-store/evidence/public-submission-20261016.json`.

Next: check Apple's review result, verify the public listing after approval, then
add verified Store actions. Optional capture-widget deployment remains blocked by
Firebase Hosting storage quota; the functioning public launch at `2a29cc1` remains
live. Do not retry that deployment until the storage condition changes.

## Final launch checkpoint — October 15, 2026

The functional public launch is live at `2a29cc1`; eight full live browser checks
and two post-follow-up-failure Chromium/WebKit rechecks passed. The optional
capture-widget image/docs follow-up `a38c72d` is committed and pushed but not live:
Firebase run `38856644818` failed before version creation with HTTP 429 Hosting
storage quota exceeded. Current public functionality is unaffected. No retained
history was deleted and no paid plan was enabled. After a deliberate Firebase
retention decision/space cleanup, rerun `gh run rerun 38856644818 --failed` and
verify the live marker/browser checks. Apple submission still needs Connect sign-in.
See [release evidence](evidence/better-workspace-public-release-20261015.json).

## Better Workspace public release — October 15, 2026

- Added live advanced Mac download/source actions, a product/getting-started page,
  edition comparison and a no-account browser demo with real sample screenshots.
- Canonical project content remains in `content/projects/better-workspace/`; cached
  public manifests/endpoints were refreshed through `python3 lib/local_projects.py`.
- `lib/better-workspace.ts` owns verified release destinations and Store status.
  Update its Store copy/add installation actions only after a public Apple listing
  exists. Apple submission currently needs the owner's expired Connect sign-in.
- TypeScript, static production build and two exported-site browser tests passed;
  product desktop and demo mobile captures were inspected. Firebase deployment
  `38856283460` succeeded; all eight live responsive Chromium/WebKit tests passed.
  The current release checkpoint supersedes historical availability holds below.
- All pre-existing uncommitted audit artifacts, Python test and continuation edits
  were preserved. They are not part of this launch commit.
- Recheck: `npx playwright test -c playwright.production.config.ts tests/production/better-workspace.spec.ts`.
  Expected: eight Chromium/WebKit desktop/mobile checks pass without sending GA4.

# Visitor-facing project actions — October 15, 2026

Better Workspace and Recallable now use Visit links to public product overviews.
Support/privacy remain secondary. Both products are explicitly unreleased. The other
40 project entries were checked for administrative primary actions; none found.
Build, typecheck, scoped lint, 41 unit tests and desktop/mobile production-export
browser checks pass. Screenshots are in `docs/images/better-workspace/`.

Production deployment of `12dc519` passed (workflow `38800504675`); the live marker matches. Four live Chromium/WebKit checks passed at desktop/mobile widths. A test follow-up waits for pending prefetches before navigation, preserving all runtime-error assertions. Evidence: `docs/evidence/visitor-actions-20261015.json`.

Next: keep availability and primary actions aligned with the app release status.
Do not add App Store, download or private repository actions until public destinations
exist. App submission and advanced Mac download publication remain pending approval.
See [portfolio verification](BETTER_WORKSPACE.md) for exact local commands.

## Better Workspace public page refresh — October 15, 2026

The personal workspace is now the hero, with refreshed real Release screenshots from
native Mac and isolated iPhone/iPad simulators. Privacy/support/README explain private
iCloud sync, local offline saves, account/transfer status and optional advanced services.
Production Mac–physical iPhone sync passed in the app project; final distribution,
iPad/offline and clean-user Mac service acceptance remain open. No app download link
or App Store availability claim is published before those gates pass.

Validation: static build passed, 41 unit tests passed, and two responsive Better Workspace
page checks passed at 1280/390px, including all six images. The scoped refresh deployed
from 3cc4685a00aab7e8e2ecc4bc2efe32de4f8b8e51 through successful workflow 38773890291;
the live marker matched, required media smoke passed (33/5 optional skips), and four
live Chromium/WebKit checks passed. App release evidence records this result.
Next: add verified public app/download links only after the app project's remaining
physical-device and clean-user Mac service gates pass. Preserve the original dirty
checkouts and unrelated main changes. This documentation-only checkpoint does not
change the deployed pages.

# Next steps

<!-- WORKSPACE-RECONCILIATION:2026-10-10 -->

Reconciliation 2026-10-10: [current details and actual task links](<WORKSPACE_RECONCILIATION.md>) · [flow plans and scoped results](<APP_FLOWS.md>). Historical audit instructions below retain their dates; the linked current records govern next work.

<!-- WORKSPACE-VERIFICATION:START -->
## Workspace verification continuation — 2026-10-05

Current state: Web application; earlier REVIEW REQUIRED. Startup observations and commands are in [README](<../README.md>).

### Completed

- Reviewed the retained project inventory and earlier validation evidence.
- Added current install/start instructions and preserved existing documentation.
- Saved available real startup screenshots in `docs/images/`; failed targets retain diagnostic evidence.
- Better Workspace task IDs below use its canonical service records.

### Remaining work

- **zacharysturman — Unblock build validation in .** (`31869333-268d-5eec-9b56-1bc56997b9fb`; AGENT).
  Codex: Current startup follow-up: The app UI opened. Prepare and run the isolated candidate flows in docs/NEXT_STEPS.md with success/error/persistence assertions; startup alone does not establish release readiness.
- **zacharysturman — Prepare simulated app flows from startup evidence** (`0ff97fb3-6419-5df5-b1a9-c01ca978ffa3`; AGENT).
  Codex: Use docs/NEXT_STEPS.md and APP_FLOW_CANDIDATES.json to prepare isolated fixtures and explicit assertions for zachary-sturman. Resolve recorded startup/configuration blockers first, then run each candidate success/error/persistence flow and capture results.
- **zacharysturman — Complete timed-out tests validation in .** (`75f11c13-e4cf-5a0f-84cd-2dbff74e4d9d`; AGENT).
  Codex: At ., investigate AUDIT TIMEOUT: process group terminated; rerun the recorded tests command.
- **zacharysturman — Review vulnerable dependency paths for @firebase/firestore, @firebase/firestore-compat, @grpc/grpc-js** (`439a7042-0be4-577e-b93e-7e7c24738aea`; AGENT).
  Codex: Inspect the npm advisory dependency paths and reachability for @firebase/firestore, @firebase/firestore-compat, @grpc/grpc-js, firebase, nanoid, next, postcss, sharp, websocket-driver. Choose the smallest compatible remediation, retain the lockfile, and rerun the affected build/tests; do not apply a blanket upgrade.
- **zacharysturman — Validate the documented primary flow from layout.tsx** (`9b48593f-3970-598d-a1fc-6e92d86cc4f8`; USER + AGENT).
  Codex: Build the current app using the recorded successful command or resolve its build blocker; prepare disposable input and a reproducible flow.
  User: Review each app purpose and screenshot in README.md; choose the intended product, experiment, duplicate/consolidation candidate or archive candidate. No app is marked production-complete by startup alone.

### zachary-sturman / web

Startup: **opened**. Startup evidence only; candidate flows not run. Production acceptance is not established.

Candidate next-run flow: Browse projects/articles, open media and a gallery, verify responsive navigation and broken-asset handling with production analytics suppressed.

Fixture requirements: Synthetic data and isolated storage. Use mock/emulator auth, API, mail and paid-provider endpoints. No live automation, deletion of user data, or external submissions.

Codex: Turn this candidate into a fixture-backed simulated flow with explicit assertions and capture its result.

User: Review the app purpose and screenshot; decide whether to ship it, retain it as an experiment, consolidate it, or nominate it for archival. Supply required account/device judgment after automated fixtures pass.

### Evidence and expected outcomes

- [app startup audit](</Users/zacharysturman/Workspace/Projects/APP_LAUNCH_AUDIT.md>) and [candidate flow plan](</Users/zacharysturman/Workspace/Projects/APP_FLOW_PLAN.md>).
- Rerun the README install/start sequence; expected result is its described UI/service or the same recorded blocker until repaired.
- Then perform the bounded canonical next action, keeping fixtures isolated.
- Product purpose, duplicate/consolidation decisions and any archive request need user judgment; no archive/publication was performed.

<!-- WORKSPACE-VERIFICATION:END -->



<!-- HUE-PUBLICATION:START -->
# Hue Light Control portfolio release — 2026-10-10

## Published release

Hue Light Control is the first hardware entry. Notion and Better Workspace share the existing
project identity and folder binding. Metadata is Complete / Release / Finite, public and in
showcase, with Device / Firmware / Electronics types and hardware medium. Homepage featured
ordering is unchanged. The description uses the existing `summary` interface.

- Project: https://zacharysturman.com/projects/hue-light-control
- Notion: https://app.notion.com/p/3f5aec944d3c811699d5c9752bb4af87
- Local source/artwork: `/Users/zacharysturman/Workspace/Projects/Hue Light Control`
- Release checkout: `/tmp/hue-portfolio-release-20261010`

Six authored technical illustrations have editable SVG originals and PNG exports. Better
Workspace registered them with project-relative storage, uploaded Notion previews, and set
all five primary media roles. The wiring diagram is a gallery asset. Two curated public
work logs preserve the October 9 and October 10 recorded dates. The project has no source
repository; `no repo needed` is set in Notion.

The importer now preserves `mediums` and falls back to `Type` when the legacy category is
empty. Nonempty legacy categories retain precedence. Generated project/article refreshes,
shared manifests, API entries and preview assets are included. Unrelated pending README,
startup documentation and project files in the primary checkout are preserved.

## Validation

- Firmware: `~/.platformio/penv/bin/platformio run` passed. Physical operation is builder-reported.
- Importer/pipeline: 141 tests and 10 subtests passed across `test_notion_projects_export.py`
  and `test_projects_pipeline.py`.
- `npm run build:full:hosted` passed; media was optimized. R2 upload was skipped because
  account/key/bucket credentials are blank. Firebase's existing local-media fallback is used.
- Clean release `npm run build` and `npm run validate:portfolio` passed: 40 projects, 9 articles.
- `npm run test:media:smoke`: 33 passed, 5 suite-defined skips, desktop and mobile.
- Hue-specific static-output checks cover homepage card, Complete status, hardware medium,
  description, primary media roles, wiring gallery, two work logs, lightbox and viewport overflow.
  Automated browsers use the explicit analytics-disable flag and block GA endpoints.

## Verified production and continuation

Published SHA: `b70af8653ed38e28835aec4080090fbc5bed4d52`.
[Firebase workflow](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/38044685449)
completed successfully. Both production domains expose the exact SHA. Live desktop/mobile
Hue checks passed with zero page errors, horizontal overflow and analytics requests.
All six deployed artwork URLs return HTTP 200. Notion's page icon and cover use verified
default Firebase URLs to avoid custom-domain bot filtering. Better Workspace's Portfolio
view displays all six assets, curated logs, Complete / Release status and hardware types/tags.

The primary `main` checkout is advanced to the published commit. Unrelated pending README,
startup images and Project.betterproject were preserved byte-for-byte. Prior startup notes
above remain available; these publication checks establish acceptance for this release.
Release checkout `/tmp/hue-portfolio-release-20261010` is clean and retained for recovery.

Evidence: `artifacts/hue-deployment-metadata.json`, `artifacts/hue-local-qa/`,
`artifacts/hue-live-qa/`. Rerun from this checkout:

```sh
node scripts/confirm-production.mjs --commit b70af8653ed38e28835aec4080090fbc5bed4d52
HUE_QA_BASE_URL=https://zacharysturman.com HUE_QA_OUTPUT=artifacts/hue-live-qa node artifacts/hue-publication-check.cjs
```

Expect the published marker and passing desktop/mobile reports. No further action is needed
for the live page. Physical device operation remains builder-reported.

The unfinished plan item is R2 upload: account/key/bucket variables are blank. Optimized
media is served successfully by Firebase. Configure the five `R2_*` values locally as
in `docs/setup/r2-media.md`; next Codex should load that environment, run `npm run upload-media`,
verify URLs, rebuild/validate and publish the URL/lock manifests. Never paste or commit keys.

<!-- HUE-PUBLICATION:END -->


## Better Workspace cohesive update — October 15, 2026

Source content, README, support and privacy explain the shared local personal workspace
and optional advanced Mac workflow. Three actual private-sample screenshots were added
alongside the connected-workspace gallery. The new Mac package includes Python and has
passed notarization/Gatekeeper plus an isolated launchd service check; it is not yet a
public download. Personal live sync and clean-user installation remain acceptance gates.

Keep downloads unavailable until the app repository's release gates pass. Production
build, 41 unit tests and two responsive page checks passed. Deployment uses the existing
main-branch workflow; verify `/deployment.json` against the pushed SHA and repeat the
analytics-suppressed `tests/production/better-workspace.spec.ts` in Chromium and WebKit.
Preserve the newer Recallable routes and Firebase association configuration on main.

## Better Workspace public release — October 14, 2026

The authored project, README/screenshots, privacy and support pages are deployed at
https://zacharysturman.com/projects/better-workspace and `/better-workspace/{privacy,support}`.
Deployment `38648726890` matched commit `21fa407473f2444699ed69054475645b36be8bbc`.
Build, unit/Python/local browser/media checks passed; live Chromium and WebKit each
passed 10 checks. Production screenshots and the analytics-suppressed live project
checks are preserved here. Original unrelated dirty work was not replaced.

App Store Connect has selected processed iOS 1.0/build 3. Mac candidate 3 is Developer ID
signed/notarized/stapled/Gatekeeper accepted; its exact ZIP remains local until clean
installation and full production device workflows pass. No public download or live
App Store button is advertised yet. Next Codex action: after app acceptance, stage the
verified ZIP/checksum in public downloads, add correct project/support/README links,
run `npm run sync:local-projects`, `npm run build` and focused project/live checks, then
commit/push/deploy and verify actual download/checksum. See `docs/BETTER_WORKSPACE.md`
and the app repository's `docs/APP_STORE_RELEASE.md` for artifacts and unresolved gates.


## Contact and writing updates — October 15, 2026

Implemented the redesigned `/contact` route, restored contact navigation, and fixed
production form configuration. Public API/site-key defaults are versioned in
`lib/contact-config.json`; secrets stay in Cloudflare. GitHub's local token cannot
manage repository variables (403), so no variable-management access is needed for
the default production configuration.

The existing Worker now saves messages/subscriptions in D1 before acknowledging
receipt. Scheduled jobs independently sync private Notion trackers and deliver
Resend alerts. Messages have topics, request IDs, and deduplication. Subscribers
require consent and email confirmation; hourly discovery sends new-article updates
only to confirmed readers. Initial discovery baselines existing articles. Every
writing email includes an unsubscribe link. No raw IPs, message bodies, email
addresses, or subscription tokens are logged by application code.

Production resources provisioned: D1 `portfolio-intake`, migration `0001_intake.sql`,
Notion Worker secret, and five-minute/hourly schedules. Worker version
`6849ff1f-ea59-418f-83ce-90df1c6c5b58` is deployed. Live `/health` reports both
intake and Notion configured; authenticated queue inspection succeeds. Both tracker
schemas and access using the portfolio's Notion integration were verified.

- Messages: https://www.notion.so/72ce9e577255443a85a9abda87af675b
- Subscribers: https://www.notion.so/88bed1f1b2724213b96b2ea8644687db
- Full configuration, architecture, recovery, and deletion steps:
  `docs/setup/contact-intake.md`.

Validation: 8 Worker integration tests on an ephemeral D1 database with all external
services mocked; 3 browser form checks; both TypeScript checks; affected-file ESLint;
2 analytics-suppression tests; production static build with empty public environment
overrides (exercises versioned defaults); desktop/mobile export inspection without
horizontal overflow. No real visitor submissions or outbound test emails were sent.
The normal pre-push media smoke hook and Firebase release workflow apply to publishing.

Remaining human acceptance: after the frontend release, open `/contact` in a normal
browser, submit from your own address, and subscribe from that address. Expect a
Notion message, owner email with Reply-To, confirmation email, then Active consent
and an owner subscriber alert. Allow several minutes per cron stage. Real Turnstile
verification and final inbox placement require this human check; the automated tests
use mocks and never claim live delivery. Browser automation disables analytics and
blocks GA endpoints.

Maintenance commands from the repository root:
`npm test --prefix worker`, `npm run typecheck --prefix worker`,
`npm run test:contact`, `npm run build`. For Worker code/config changes, deploy
separately using `npm run deploy --prefix worker`; frontend changes publish through
the existing main-branch workflow. Worker queue status is bearer-protected at
`/internal/intake-status`; no records are exposed publicly.

Known limits: Notion is an organizational mirror, not a delivery control panel.
Triage edits are preserved; consent must be changed through the signed links or D1.
Mail retries stop after 8 attempts; inspect provider history before a manual replay
following an extended outage. Bounces/inbox placement are checked in Resend. Jobs
are bounded for a small portfolio list; use a dedicated bulk-delivery system if the
list grows beyond that workload. Public screenshots show the actual exported UI.

Preserved unrelated untracked work: `docs/evidence/workspace-audit-2026-10-10/`,
`docs/images/startup-bf8f91b825ae.jpg`, and `tests_python/test_published_workspace.py`.
Build-only changes to generated project timestamps were excluded from this fix.
