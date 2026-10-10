# Hue Light Control portfolio release — 2026-10-10

## Prepared release

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

## Publication and continuation

Publish this reviewed release through `main` and the existing Firebase workflow. Then confirm
the exact deployed SHA on both production domains using:

```sh
node scripts/confirm-production.mjs --commit <published-sha>
HUE_QA_BASE_URL=https://zacharysturman.com HUE_QA_OUTPUT=artifacts/hue-live-qa node artifacts/hue-publication-check.cjs
```

The local verification script and screenshots remain in ignored `artifacts/`. Append actual
deployment and live QA results to the primary checkout continuation document after publication.
Set the Notion page icon and cover to the verified, durable deployed image URLs.

R2 remains an optional hosting follow-up. Configure the five `R2_*` variables documented in
`docs/setup/r2-media.md`, then run `npm run upload-media` with those values exported in the shell,
rebuild, validate and publish the resulting URL/lock manifests. Never commit credentials.

No new physical-device testing was performed. Real photographs or a filmed demo can be added
later; the current public media is explicitly identified as technical illustration.
