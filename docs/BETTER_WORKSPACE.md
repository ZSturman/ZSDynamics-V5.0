# Better Workspace portfolio entry

Updated October 15, 2026. The project page is live at https://zacharysturman.com/projects/better-workspace, with deployed support and privacy pages at `/better-workspace/support` and `/better-workspace/privacy`.

## Visitor actions — final integration pass

Better Workspace and Recallable were the two entries whose primary resources were
only Support/Privacy. Each now has a public product overview (`/better-workspace`,
`/recallable`) and a single **Visit** action. Both pages state that the applications
are unreleased; no private TestFlight, private repository or unpublished download is
advertised. Support and privacy remain in the project READMEs and product-page footers.
The other 40 entries had no administrative primary actions.

Use **Download**, **Install**, **Visit**, **Demo** or **Repo** for primary project
actions, choosing only destinations visitors can actually use. Keep administrative
links in documentation or a secondary legal footer. Do not add install/download/repo
actions before their destinations become publicly available.

Validated: build, typecheck, scoped ESLint, 41 unit tests, and two responsive browser
checks against the production export. Tests click Visit, verify its destination and
all product links, preserve legal routes, and capture desktop/390px screenshots.
The export preview supports the same clean URLs as Firebase Hosting:

```bash
npm run build
npx playwright test -c playwright.release-verification.config.ts tests/better-workspace.spec.ts
python3 scripts/serve-export.py
```

Expected: two passing checks; local preview at `http://127.0.0.1:3001`.
Production deploy `38800504675` succeeded for `12dc519`; its live marker matches. Four live Chromium/WebKit checks passed. Rapid WebKit route changes initially cancelled an unrelated footer prefetch; the test now allows in-flight prefetches to settle before navigation and still asserts no page errors. Evidence: `docs/evidence/visitor-actions-20261015.json`.

## Source and publishing

- `.gitignore`: only this authored content folder is included; generated/other content remains ignored.
- `content/projects/better-workspace/project.json`: public description, status, resources and screenshot gallery.
- `content/projects/better-workspace/README.md`: public project README shown in the portfolio; copied as a downloadable Markdown resource.
- `content/projects/better-workspace/images/`: actual Mac, iPhone and iPad sample-workspace captures, the app icon, and optimized variants. Sources came from the Better Workspace repository's documented UI captures, not generated mockups. The gallery retains the October 13 connected-workspace captures and adds refreshed October 15 shared personal-workspace screenshots: a window-only native Mac capture and isolated iPhone/iPad simulator Release captures. The sample is editable and memory-only. Production native Mac–physical iPhone personal sync passed with disposable records; distribution/iPad/offline acceptance remain open.
- `lib/local_projects.py`: merges local entries by ID/slug and copies assets. Existing unrelated exported records are preserved. This runs during the normal cached build and the staging step of the Notion prebuild, so a sync cannot erase the local entry. Static project API entries and site counts are kept current without changing article endpoints or the hosted URL map.
- `app/better-workspace/{privacy,support}/page.tsx`: public pages linked from inside the app. They are deployed and return 200 in production browser checks.

The app is described as in testing, with no download or App Store button until the signed/notarized Mac package and approved mobile listing actually exist. The advanced Mac build 4 includes its offline Python runtime and has passed notarization, stapling and quarantined Gatekeeper checks. A unique temporary launchd job also passed service health/save/restart/readback checks without touching the installed service. Actual clean-user login installation and cross-device acceptance still gate publication.

## October 15 cohesive experience update

The public copy now explains local personal planning, connected mobile workflows and
optional advanced Mac services separately. The README and support page describe first
use, installation and storage with precise private iCloud, offline and transfer-status explanations. Live Production Mac–iPhone sync passed; the copy keeps the remaining distribution/iPad/offline gates explicit. Privacy text
includes the local SwiftData database and memory-only sample. No unverified download
or App Store button is added. All six gallery images are checked for loading at both
1280px and 390px. The source checkout preserves the newer Recallable changes on main.

Validation: production static build; 41 unit tests; focused local-project Python tests;
two desktop/mobile Better Workspace browser checks. The configured pre-push media
smoke and post-deploy live checks must also pass. Automation suppresses production
analytics. The new images are format-compressed real screenshots, not mockups.

## Local preview and checks

```bash
npm run sync:local-projects
npm run dev
```

Open `http://localhost:3000/projects/better-workspace`. Expected: description, story, README, Mac/iPhone/iPad images and functional support/privacy links.

```bash
.venv/bin/python -m pytest -q tests_python/test_local_projects.py tests_python/test_folio_prebuild.py
npx playwright test tests/better-workspace.spec.ts
npm run build
```

Expected: nine focused Python tests, two desktop/mobile browser checks and a static export including all three pages. Use a Python environment with the repo's testing dependencies if `.venv` is absent. Browser checks include image decoding in the screenshot gallery, README presence, release links and no horizontal overflow at 1280px/390px.

Publication follows the existing [development/deployment guide](development-and-deployment.md). The release candidate is rebased onto origin/main `2645537`, preserving Recallable and Hue. The production build, 41 unit tests, 168 Python tests (plus 10 subtests), and 41 browser tests passed; one browser test was skipped because its optional dataset was unavailable. The candidate checkout is `/tmp/better-workspace-portfolio-release-20261013`; publication is authorized and completed for these pages. Commit `21fa407473f2444699ed69054475645b36be8bbc` deployed through successful workflow `38648726890`; deployment metadata matched that commit. An initial overlapping preview/build run failed with missing generated `_document`; the serial production build passed. Run builds and preview tests sequentially. Only the scoped Better Workspace changes are committed from this isolated checkout. The original checkout retains its unrelated dirty work. Live Chromium and WebKit production tests each passed 10 checks; missing WebKit runtime was installed from Playwright's official distribution before the passing run. `tests/production/better-workspace.spec.ts` suppresses analytics before loading the live pages. The screenshots below show the deployed site.

The app has processed iOS 1.0/build 3 and saved its listing, pricing and screenshots. The universal Mac ZIP is Developer ID signed, notarized/stapled and accepted by Gatekeeper, including a quarantined extraction. Clean Mac installation and full TestFlight workflows remain acceptance gates, so the public page correctly keeps app availability in testing and has no unverified download button. Production CloudKit schema and a private unique-tag round trip passed; cross-device command acceptance is still pending. No app-store live link or Mac download is published in this website deployment.

## Update images or release availability

Replace only this entry's source images with verified app captures, then generate their variants without deleting originals:

```bash
.venv/bin/python lib/media-optimizer.py content/projects/better-workspace/images
npm run sync:local-projects
```

Use rooted public paths for standalone assets; gallery paths already point to actual optimized files. Keep the READMEs, support page, status and resource buttons consistent when the release is available. App Store submission and distribution signing live in the app repository's `docs/APP_STORE_RELEASE.md`.

![Desktop portfolio preview](images/better-workspace/portfolio-desktop.png)

![Phone portfolio preview](images/better-workspace/portfolio-mobile.png)


## October 15 refreshed standalone screenshots

The hero now shows the new native personal workspace, and all three personal images
use the actual optimized Release sample captured October 15. Source dimensions are
Mac 1280×800, large iPhone 1320×2868, iPad 2064×2752; WebP conversion preserves the
pixels without fabricated UI. Existing connected-workspace gallery images remain.
The public privacy/support/README copy explains local saves plus private iCloud and
does not claim a public app release. Two responsive page checks passed after this
refresh; final production deployment verification is recorded after publication.

The first refreshed-hero push was correctly blocked by the media contract: its optimized hero variant was missing. The existing optimizer generated the required optimized/thumbnail/placeholder files, and the targeted contract checks passed before retrying the required pre-push smoke suite.


The refreshed page deployed from `3cc4685a00aab7e8e2ecc4bc2efe32de4f8b8e51` through
successful workflow `38773890291`; the live deployment marker matched. Four live
Chromium/WebKit checks passed with production analytics suppressed. Final artifacts
are retained outside the repository in `/tmp/bw-cohesive-portfolio-live-final-20261015`.
The app project now has iOS TestFlight build 5 and native Mac TestFlight build 6; actual
Mac installation found and then verified the fix for a framework runtime-path defect.
Advanced Mac build 5 is notarized and locally verified, but clean-user installation and
physical-device distribution acceptance still gate public app links. This documentation
checkpoint changes no published product behavior.
