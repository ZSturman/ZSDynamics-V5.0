# Native app portfolio release — October 31, 2026

The owner explicitly authorized this production release. This supersedes the earlier local-only hold for the completed reliability cycle below; it does not resume the paused daily publisher or redeploy the Worker.

Added curated Trackables, iPhone Microscope, Camera Monitor, Files & Backups and Casino Exit entries. Updated Home Page's workspace/setup/privacy/real preview image, ChewSense's research collector/beta scope, Recallable Mac and Transactions public availability, and current app review/beta versions. The portfolio now has 51 projects, 12 Apps entries and 94 canonical routes. Curated content survives the existing cached/Notion merge.

All 15 relevant platform builds are VALID / IN_BETA_TESTING. Six public version/platform submissions (Home Page, Recallable iOS/Mac, Trackables iOS, Better Signals and Better Workspace mobile) are WAITING_FOR_REVIEW with automatic release after approval. ChewSense Collect and the Microscope companion stay in private beta pending their documented physical checks. No public beta invitations or unapproved public download claims were added. [Current native release table](NATIVE_APP_RELEASES.md). Full signed/archive/Apple receipts are in Home Page `docs/RELEASE_AUDIT_2026-10-31.md` and `docs/RELEASE_RECEIPT_2026-10-31.json`.

Validation: static build, output/link/metadata checks, 67 unit tests and all 36 Chromium/WebKit desktop/phone export regressions pass. A local preview startup hang was traced to reverse DNS in mDNS; `serve-export.py` now uses its explicit loopback address without a DNS lookup. Final production/media gate receipts will be recorded below.

Exact local refresh: `npm run build && npm run validate:portfolio`; expected 51 projects and 94 canonical routes. Browser regression: `npm run test:export`; expected 36 passes. Check `/apps`, `/home-page` and `/projects/iphone-microscope` after deployment. Native device installation/Watch/widget/camera/collector acceptance and Apple review remain separate. The existing daily publisher remains paused.

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
