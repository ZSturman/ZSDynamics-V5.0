# Content and product behavior

## Source relationships

Workspace/Notion generation remains authoritative for projects, media and public work logs. `lib/local_projects.py` merges established authored entries and small reviewed overrides. `application.landingPath` opts a public project into Apps; `application.platforms` describes supported platforms and availability qualifications. `resources` supplies actual demo, store, download and source actions. No download is inferred from a category or development log.

Home Page is registered through the same authored-entry mechanism with a persistent ID. It has no verified public download or screenshot. Other product images reuse existing authentic assets. New case-study sections still require explicit source content; ambiguous projects use the existing generic presentation.

`lib/product-presentation.ts` derives the compact product context passed into the client analytics bootstrap. Product pages, cards and demos use the same stable project ID and slug. Update authored metadata, then run `npm run sync:local-projects`; do not hand-edit generated API records.

## Navigation

Article state: `q`, `series`, `tag`, `project` (stable project ID), `sort`, `view`, `vis`. Legacy `q=series:ChewSense` remains supported. Filters compose with search. Selections push browser history; typing replaces after 250ms. URL state is authoritative, and unrelated/campaign parameters survive edits. Static HTML and the first client render use the same default state; URL-derived controls update after hydration to avoid replacing the exported tree. No saved filter can override a direct link. Session storage retains only view/sort display preferences; old saved searches and visibility filters are discarded.

Work-log state: `project` (canonical slug; UUID aliases normalize), `tab`, `log` (existing log ID), `q`, `type`, `sort`, `view`. Direct session links open details without requiring the log to be visible in the selected tab. In-page opens push history; closing goes back. Closing a direct-link dialog removes only its log parameter. Share links include project and session identity. Unknown links display an unavailable message.

Recently active projects rank by latest actual session time, while counts describe lifetime documentation. Rolling counts recalculate in the browser, including a minute refresh, rather than freezing at export time. Missing durations are unavailable; calculated durations require a valid start/end. An explicit `durationEstimated` marks estimates. Totals disclose incomplete duration coverage.

Public work logs preserve the existing supplied summaries and technical details behind disclosure. Do not add private workspace notes, credentials, or internal URLs to public source records. A session type never proves a release.

## Article semantics and reading

`publishedAt` is source publication chronology; `updatedAt` is a source edit. Dates are never synthesized from ingestion, file modification, or Git. Display Updated only when the edit is later than publication. Optional `createdAt` and `substantiallyRevisedAt` pass through without invention. Historical source dates and article slugs remain intact.

Reading estimates use 220 words/minute. Contents and heading IDs share a parsed Markdown transformation, including Unicode and duplicate headings; fenced-code text cannot become a heading. Contents appears for at least three headings. Existing explicit project relationships and source links remain available.

## Verification

From the repository root:

```sh
npm run test:unit
.venv/bin/python -m pytest -q tests_python --ignore=tests_python/test_notion_integration.py
npm test --prefix worker
npm run test:e2e
npm run test:contact
npm run build
npm run validate:portfolio
npm run test:export
```

Expect passing suites, a static export, and valid routes/assets. Python requires pytest; the local `.venv` includes it. Contact and subscription tests mock providers; they never send real messages. Analytics automation is disabled before Firebase initialization.

The exported-site suite exercises Chromium and WebKit on desktop and phone using the built files, with no Next development server. Use Node 22.18 or later for native TypeScript unit-test imports; the app itself retains its declared runtime requirement.

Routine browser tests do not rewrite tracked screenshots. To intentionally refresh the Better Workspace documentation captures, run `PORTFOLIO_CAPTURE_SCREENSHOTS=true npx playwright test tests/better-workspace.spec.ts`, inspect the outputs, and retain only the frames cited in documentation. The Apps README image was captured from the actual local static export.

The cached build can refresh `public/api/projects.json`'s `generated_at` value even when its data is identical. Review that diff and avoid committing timestamp-only churn; it does not change project identities or public content.
