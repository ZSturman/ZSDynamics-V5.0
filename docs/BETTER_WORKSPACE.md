# Better Workspace portfolio entry

Updated October 14, 2026. Maintained local content is prepared for `/projects/better-workspace`; support and privacy pages are at `/better-workspace/support` and `/better-workspace/privacy`.

## Source and publishing

- `.gitignore`: only this authored content folder is included; generated/other content remains ignored.
- `content/projects/better-workspace/project.json`: public description, status, resources and screenshot gallery.
- `content/projects/better-workspace/README.md`: public project README shown in the portfolio; copied as a downloadable Markdown resource.
- `content/projects/better-workspace/images/`: actual Mac, iPhone and iPad sample-workspace captures, the app icon, and optimized variants. Sources came from the Better Workspace repository's documented UI captures, not generated mockups. The refreshed images come from the October 13 Store screenshot set: disposable Mac and public read-only mobile sample mode.
- `lib/local_projects.py`: merges local entries by ID/slug and copies assets. Existing unrelated exported records are preserved. This runs during the normal cached build and the staging step of the Notion prebuild, so a sync cannot erase the local entry. Static project API entries and site counts are kept current without changing article endpoints or the hosted URL map.
- `app/better-workspace/{privacy,support}/page.tsx`: public pages linked from inside the app. They must be deployed before store submission.

The app is described as in testing, with no download or App Store button until the signed/notarized Mac package and approved mobile listing actually exist. The Mac download requires Python 3.11+ for its service; do not market it as a self-contained installer before clean-Mac acceptance.

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

Publication follows the existing [development/deployment guide](development-and-deployment.md). The release candidate is rebased onto origin/main `2645537`, preserving Recallable and Hue. The production build, 41 unit tests, 168 Python tests (plus 10 subtests), and 41 browser tests passed; one browser test was skipped because its optional dataset was unavailable. The candidate checkout is `/tmp/better-workspace-portfolio-release-20261013`; publication is authorized and in progress. An initial overlapping preview/build run failed with missing generated `_document`; the serial production build passed. Run builds and preview tests sequentially. Only the scoped Better Workspace changes are committed from this isolated checkout. The original checkout retains its unrelated dirty work. Live deployment evidence is recorded here after verification.

## Update images or release availability

Replace only this entry's source images with verified app captures, then generate their variants without deleting originals:

```bash
.venv/bin/python lib/media-optimizer.py content/projects/better-workspace/images
npm run sync:local-projects
```

Use rooted public paths for standalone assets; gallery paths already point to actual optimized files. Keep the READMEs, support page, status and resource buttons consistent when the release is available. App Store submission and distribution signing live in the app repository's `docs/APP_STORE_RELEASE.md`.

![Desktop portfolio preview](images/better-workspace/portfolio-desktop.png)

![Phone portfolio preview](images/better-workspace/portfolio-mobile.png)
