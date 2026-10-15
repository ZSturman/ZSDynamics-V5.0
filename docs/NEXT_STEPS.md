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
