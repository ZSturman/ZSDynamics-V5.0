## Bench Lens QR setup — November 12, 2026

`public/iphone-microscope/connect.html` is an analytics-free App Store fallback for the iPhone app's universal link. Pairing credentials remain in the URL fragment; the page sends no analytics or pairing request. `public/apple-app-site-association.json` retains Recallable and adds the exact Bench Lens connect path. Deploy both together before installing companion 1.2 (6), then check the AASA response and Apple's CDN. An uninstalled iPhone goes to the App Store; installed-device QR handling needs physical confirmation. App Store availability still depends on Apple approval. No deferred pairing after install: scan a fresh QR.

# ChewSense research update — November 10, 2026

The authored `chewsense` override in `content/project-updates.json` now links
to the active Chew-Sense repository and its validity study. The case study,
README, research stage, tags and work log distinguish the public collector
from the experimental detector and describe the one-wearer evidence,
resampling issue and pending confound recordings. Existing images are retained.
The override survives cached and Notion builds without freezing imported media
or work history. The generated project detail and list APIs use the same content.

Validation: static build passed, 34 focused portfolio tests passed, and the
output validator passed for 57 projects, 9 articles and 102 canonical routes.
The pre-push media checks accept `PORTFOLIO_MEDIA_TEST_PORT` (default 3100)
so an existing preview can stay running while the checks use another port.
Verify again with `npm run build && npm run validate:portfolio`. After the normal
main-branch deployment, check `/projects/chewsense` for the November 10 date,
Research stage, current source/study links and the one-wearer limitations.

---

# Portfolio refresh — November 9, 2026

Compared the live 52-project API at commit `b80edc0` with local source, recent
work, and release records. The refresh keeps all 52 existing project IDs and
adds five entries through the normal authored-project merge.

| New project | Public evidence |
| --- | --- |
| Grounded Memory | Crops from the real teaching console using a synthetic clip. The research prototype has replay evidence, and physical iPhone acceptance is pending. |
| Finder Workspace Extensions | Two native recordings from the October fixture, with Finder's sidebar cropped out. Current Better Workspace metadata integration is described separately from the recorded build. |
| Opportunity Discovery | Real dashboard captures from an isolated SQLite database populated with a fictional organization. |
| Home Services | A labeled architecture diagram for the private Raspberry Pi deployment and its app clients. |
| Inbox Review | Existing native captures of the review dashboard and sample file and folder flows. |

Better Workspace, Content Manager, Casino Exit, Trackables and Screenshot to Calendar
have refreshed covers or galleries. Content Manager's product pages now describe
the private Mac generation connection. ChewSense documents the encrypted handoff
validated on iPhone. Public Store checks found Better Workspace 1.0.4, Recallable
1.0.4, Trackables 1.0.1 and Better Signals 1.5.2. Home Page and Screenshot to
Calendar still had no public listing. Selected Work now leads with Better Workspace,
Grounded Memory and Content Manager while retaining Recallable and the Hue controller
and adding Screenshot to Calendar.

The API now resolves rooted cover URLs and uses the existing optimized variant when
the original is absent. Authored entries and their optimized media live under
`content/projects/`. Selected Work order lives in `content/selected-work.json`.
The local monitor remains Better Workspace infrastructure. Private service
addresses, workspace data and draft research are excluded from the public media.

Run `npm run build && npm run validate:portfolio` and expect 57 projects and
102 canonical routes. Run `python3 scripts/serve-export.py` and review the
homepage, `/projects/finder-workspace-extensions#asset-finder-status`, and
`/content-manager/demo` on a phone or desktop. When Apple publishes Home Page or
Screenshot to Calendar, verify the listing before adding an install action.

---

# Daily analytics email redesign + Cloudflare observability check — November 6, 2026

The daily GA4 email now opens with an at-a-glance section modeled on Google's console emails. It has a light header, an inbox preview line, and eight KPI tiles (users, new users, sessions, views, engaged sessions, engagement rate, avg. session, high-intent actions) with ▲/▼ day-over-day chips. Below the tiles are the key takeaways and bar lists for top countries (users), cities, sources and pages. All previous detailed sections follow under a "Full report" divider and are unchanged. Table headers are now sentence case and cells wrap, which fixes the earlier sideways scroll on phones. The plain-text email gained an "At a glance" block. Queries, metrics and privacy posture are unchanged. Not yet sent to a real inbox; try it with `ANALYTICS_DRY_RUN=true npm run daily-analytics` (needs the GA4 credentials from `.env.local`; does not send), then let the next scheduled email arrive and check it in Gmail and iOS Mail.

Validation: 67 unit tests pass (`npm run test:unit`), including new at-a-glance assertions. Lint shows 0 errors (6 existing warnings). A rendered sample has no horizontal overflow at 390 px.

## Cloudflare Observability pricing (effective December 1, 2026)

The Worker `zacharysturman-api` has `[observability] enabled = true` (`worker/wrangler.toml`). Under the new pricing, Free accounts get 0.5 GB/day of ingestion with "Additional usage: Not available", so there is no metered overage on Free. Workers Paid includes 50 GB ingest plus 10 GB-month storage, then $0.25/GB ingested and $0.10/GB-month stored. The Worker writes roughly 312 cron invocations per day plus contact/subscribe requests (about a few MB/day), far below either allowance. The repo cannot show which Workers plan the account is on (the wrangler token has no billing scope).

Owner check: Cloudflare dashboard → Workers & Pages → Plans (expect "Free"), and Manage Account → Billing → Subscriptions (expect none). If both are empty/free, no bill can come due.

**Applied November 6, 2026 (owner-approved):** steps 1–2 are done. `[observability] enabled = false` was deployed as Worker version `c95029a4-aa12-41ba-86b0-f8dc986aa43c`. The deployed source matched the repo apart from Worker tests, and Worker tests pass (12/12). `https://api.zacharysturman.com/health` returns 200, and both cron triggers and the custom domain are intact. Workers Logs no longer ingests, so use `npx wrangler tail` for live debugging. On November 6, 2026 the owner confirmed in the dashboard that the account is on **Workers Free**, with no paid subscription (Billing offers the $5 upgrade). Steps 3–4 are therefore not needed: Free has no metered overage, so Cloudflare Observability cannot produce a bill. Keep the Worker's Observability tab and R2/AI Gateway logging off unless a future change needs them.

Zero-cost hardening plan, applied only if the account is on Workers Paid or the owner wants a belt-and-braces guarantee:
1. Set `[observability] enabled = false` (or `head_sampling_rate = 0.01`) in `worker/wrangler.toml`. Contact/subscription failures are already persisted in D1 and emailed, so dashboard logs are not required.
2. Redeploy with `cd worker && npx wrangler deploy`, then confirm the Worker's Observability tab stops ingesting.
3. If the account is on Workers Paid only for this Worker, downgrade to Free under Workers & Pages → Plans. Free limits (100k requests/day, 10 ms CPU, 5 cron triggers, D1 free tier) cover this Worker's load; confirm CPU time in the dashboard metrics first.
4. Check that R2 Data Access Logs and AI Gateway logs are not enabled. `media.zacharysturman.com` R2 stays within its separate free tier unless storage exceeds 10 GB.

---

# Screenshot to Calendar addition — November 1, 2026

Added a curated native iPhone project and Apps entry, real simulator screenshots with invented appointments, and dedicated support/privacy routes. Source content is in `content/projects/screenshot-to-calendar/` and survives the local/Notion merge. Images are optimized derivatives of actual app captures and its existing icon. The source app now has a native launch screen, first-launch introduction and four contextual TipKit stages.

The owner requested App Store publication and this production portfolio update. Version 1.0 (4) is VALID and both its version and submission are WAITING_FOR_REVIEW, with automatic release after Apple approval. All five App Store screenshots are COMPLETE. No public installation is claimed. After approval, verify the public listing and add its installation resource to the curated entry. The daily publisher remains paused and the Worker is unchanged.

Validation: static build and 52-project/97-route output checks pass; eight focused project-presentation tests pass. Native source has 13 passing core tests and a passing simulator onboarding flow. Physical iPhone permission/import and accessibility acceptance remain manual.

Run `npm run build && npm run validate:portfolio` to refresh and verify the static export. Expected: 52 projects and 97 canonical routes. Published commit `3590ce290bdda9b48ae08f339c34fadbf6752b15` through the existing main/Firebase workflow; [workflow 41371249743](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/41371249743) succeeded. Both hosting-domain deployment markers and all changed app routes were verified. Live product image bytes match their reviewed source. [Release evidence](evidence/screenshot-calendar-20261101.json). For future updates verify `/projects/screenshot-to-calendar`, `/apps`, `/screenshot-to-calendar/support` and `/screenshot-to-calendar/privacy` against the exact `/deployment.json` commit marker.

---

# Native app thumbnails — October 31, 2026

Added recognizable thumbnails and identity icons to Home Page, Trackables, iPhone Microscope, Camera Monitor, Files & Backups and Casino Exit. ChewSense already has its published thumbnail. Artwork comes from the actual app icon assets; no screenshots or source activity were fabricated. The icon and title stay within the center square of a 16:9 canvas for both project grid and square list crops.

Curated originals and derivatives live under each `content/projects/<slug>/images/` and are copied by the normal local-project merge into `public/projects/`. To refresh after replacing an icon: `node scripts/generate-native-app-thumbnails.mjs`, then `npm run build && npm run validate:portfolio`. The generator uses the existing Sharp dependency. Project identities, release status and source app files are unchanged.

Validation: build and 51-project/94-route checks pass; all seven relevant project/API thumbnail fields resolve, including existing ChewSense media. Safari preview confirms Camera Monitor renders beside its project in square list view and in landscape grid view. The same generated layout and embedded PNG format is used for all six additions. The Apps index now explicitly renders each app’s icon beside its title, using the same optimized project-image resolver. The normal pre-push media gate and Firebase workflow publish the change; inspect `/projects` and `/apps`. The previous native release/deployment record below remains dated evidence.

---

# Native app portfolio release — October 31, 2026

The owner explicitly authorized this production release. This supersedes the earlier local-only hold for the completed reliability cycle below; it does not resume the paused daily publisher or redeploy the Worker.

Added curated Trackables, iPhone Microscope, Camera Monitor, Files & Backups and Casino Exit entries. Updated Home Page's workspace/setup/privacy/real preview image, ChewSense's research collector/beta scope, Recallable Mac and Transactions public availability, and current app review/beta versions. The portfolio now has 51 projects, 12 Apps entries and 94 canonical routes. Curated content survives the existing cached/Notion merge.

All 15 relevant platform builds are VALID / IN_BETA_TESTING. Six public version/platform submissions (Home Page, Recallable iOS/Mac, Trackables iOS, Better Signals and Better Workspace mobile) are WAITING_FOR_REVIEW with automatic release after approval. ChewSense Collect and the Microscope companion stay in private beta pending their documented physical checks. No public beta invitations or unapproved public download claims were added. [Current native release table](NATIVE_APP_RELEASES.md). Full signed/archive/Apple receipts are in Home Page `docs/RELEASE_AUDIT_2026-10-31.md` and `docs/RELEASE_RECEIPT_2026-10-31.json`.

Validation: static build, output/link/metadata checks, 67 unit tests and all 36 Chromium/WebKit desktop/phone export regressions pass. A local preview startup hang was traced to reverse DNS in mDNS; `serve-export.py` now uses its explicit loopback address without a DNS lookup. The mandatory push gate passed 35 media checks with three explicit existing skips.

Exact local refresh: `npm run build && npm run validate:portfolio`; expected 51 projects and 94 canonical routes. Browser regression: `npm run test:export`; expected 36 passes. Check `/apps`, `/home-page` and `/projects/iphone-microscope` after deployment. Native device installation/Watch/widget/camera/collector acceptance and Apple review remain separate. The existing daily publisher remains paused.

## Verified production deployment

Published source commit **`29a06c61edd35fa8341e8b978dd6e2f3376114c7`** through the existing `main` → Firebase workflow. [GitHub run 41205145522](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/41205145522) succeeded. The custom-domain `/deployment.json` reports that exact commit and workflow ID. Ten changed routes, all 51 public project API entries, and the new Home Page JPEG returned the expected live content. HTTP verification did not execute browser JavaScript or production analytics. [Machine-readable receipt](evidence/native-app-release-20261031.json).

The following documentation-only receipt commit uses `[skip ci]`; production intentionally remains on the verified source commit above. No code or content rebuild is required for that receipt. Accept the ChewSense/Bench Lens personal TestFlight invitations, update in place, perform the source-specific device checks, and await Apple review. No repeat upload or site deployment is needed.

---

# Portfolio reliability cycle — October 29, 2026

Current checkout: `codex/portfolio-content-analytics`, based on `fb9468f`. Implementation commits: `9a28e3a` (report accuracy) and `8260087` (site, content, tracking and quality gates). No production deployment is authorized by this cycle.

## Implemented

- Shared primary navigation with a keyboard-accessible phone/tablet menu; Apps discovery reads the Workspace-generated manifest.
- URL-authoritative article filters, work-log tabs/filters and stable session links. Campaign parameters survive filter edits.
- Publication dates retain source chronology. Earlier source edits are no longer labelled post-publication updates. Reading estimates, heading anchors and contents use parsed Markdown.
- Foreground-only viewport-relative attention; visit-based event deduplication; stable product context and meaningful demo milestones.
- Report observations no longer infer human/bot counts or session paths. Optional failed queries warn and preserve unavailable values.
- Existing subscription architecture retained; mocked confirmation/retry/unsubscribe checks cover delivery and renewed consent.

## Validation and release

Local validation passed: 67 unit tests; 174 Python tests plus 10 subtests; 12 Worker tests; 73 development browser tests (2 documented skips); 7 contact/campaign browser tests; 59 media matrix checks (17 explicit engine/fixture skips); and all 36 static-export browser checks in Chromium/WebKit desktop/phone. Site and Worker typechecks pass. ESLint has zero errors and five existing warnings. Axe A/AA checks pass in both themes across 12 routes, with phone/tablet/desktop overflow and keyboard checks.

The production static build and export validators pass: 46 projects, 9 articles, 89 canonical routes, valid internal links/assets. All original 45 project identities/URLs, 63 work logs and nine article records are preserved. [Machine-readable evidence](evidence/reliability-cycle-20261029.json).

Initial hydration, fault-injection and layout-test failures were fixed and final relevant checks pass. Live Notion integration, production hosting, GA4 data/configuration, real Turnstile/inbox placement, and native/store installation acceptance were not run. No Worker code changes or Worker deployment are required. All work is committed locally; the existing publisher stays paused. This is local release readiness, not production acceptance.

Existing release process: [development and deployment](development-and-deployment.md). Push/integration to `main` deploys through Firebase; do not do so until the owner approves production deployment. Build and tests run locally without production analytics or real submissions.

## External acceptance

- GA4 Admin: register `product_id`, `product_slug`, `action_type`, `log_id` as Event-scoped custom dimensions, alongside the existing definitions in [analytics setup](setup/analytics.md). Website referrals/download actions measure intent; authoritative installation reporting remains external.
- Real Turnstile and inbox placement require an owner-operated browser journey. Worker integration tests use mocked providers and do not establish live email delivery.
- Home Page remains release-pending; no public download or native app screenshot is claimed. Source app device acceptance remains in each app repository.
- The daily publisher remains paused by its existing policy. This work does not resume the publisher or alter Mac/Pi coordination.

## Review locally

From the repository root, run `python3 scripts/serve-export.py` and open `http://127.0.0.1:3001/apps`. Expect the built site with the new navigation and six application entries. Check a filtered article collection, open a work-log session and copy its Share link, then complete a sample demo. To rebuild after source edits: `npm run build && npm run validate:portfolio && npm run test:export`.

The next agent action after owner approval is integration through the existing documented `main`/Firebase workflow, followed by exact deployment-marker and analytics-suppressed live checks. Until then, do not push to `main`, dispatch production deployment, or resume the paused publisher.

## Historical evidence

Prior release notes and conflict alternatives are preserved in [historical checkpoints](history/NEXT_STEPS-before-reliability-cycle.md). Older hold/release instructions there are not current operational instructions.


## Bench Lens store support — November 12, 2026
Added `/iphone-microscope/privacy` and `/iphone-microscope/support` for the Mac/iPhone app release, using the existing page layout and contact route. These describe encrypted local pairing, Keychain trust, local recordings, keyboard controls and pending store availability. Validate the live routes after deployment; app review status remains owned by the iPhoneMicroscope project.


## Workspace capture refresh — November 12, 2026

Updated the maintained Better Workspace and Finder Workspace Extensions entries and
regenerated their public README/API/manifests. Ownership now correctly identifies
Finder as owner of project metadata. The new capture behavior and development
preview limitations are described without implying a Finder App Store edition.
Finder 0.1.1 preview is notarized/stapled and public. Better Workspace 1.0.5 Mac is notarized/stapled and Gatekeeper accepted; mobile build 57 is VALID, in internal TestFlight and Waiting for Review with automatic release after approval. Production deploy 43266354725 succeeded for content commit 8fdc3f0. Both live product JSON entries/pages and both signed-download URLs were checked successfully. No browser analytics executed.
Validation: 9 local-project/published-workspace Python checks pass using `.venv/bin/python`.
The push hook performs the existing media smoke checks, and main pushes trigger
Firebase production deployment. Preserve unrelated entries and media.
