# 3D collection maintenance

The October 19 collection release contains 14 curated entries: six functional
designs, two characters, two scene/object studies, and four works in progress.
Eleven entries are interactive GLBs; three use still geometry renders while source
textures remain incomplete. Robot and Main Character each contain one isolated
one-second walking cycle. Extra rigs, spare bodies and construction geometry are
excluded from the curated exports.

The owner authorized portfolio publication on October 19. This publishes the
showcase only. No printable release license, print-success claim, or third-party
model-sharing listing has been created. The iPad mount is explicitly labeled a
remix. Print dimensions, fit, source credits and release licenses remain per-model
work before publishing print packages.

## Content and source relationships

`content/projects/3d-models-collection/` is the authored overlay, retaining the
existing project ID and folder name. `lib/local_projects.py` merges it into cached
content and copies its `images/` and optional `models/` directory. The overlay also
survives Notion rebuilds. Content-hashed media URLs avoid old scene exports remaining
in browser caches. Source Blender/STL files and original photos are not public assets.

The authoring archive is normally at the sibling
`_Collections/3D Models Collection` directory. Versioned management utilities live
in [tools/model-collection](../tools/model-collection/README.md); set
`MODEL_COLLECTION_ROOT` when the archive is elsewhere. Its catalog controls exact
object selections, animation actions, frame ranges and STL revision choices.

## Add photographs

```sh
.venv/bin/python tools/model-collection/photo_upload.py
```

Open http://127.0.0.1:8767, choose an item, photos and a caption, then reload the
portfolio. An **In use** tab appears after the first real photo. Originals remain
in the archive; public WebPs are limited to 2400 pixels and omit EXIF. Supported
uploads are JPG, PNG, WebP and HEIC/HEIF; HEIC uses macOS `sips`. The limit is ten
files and 64 MB per request. This local tool stages and syncs; it does not deploy.

## Validate and publish

```sh
.venv/bin/python -m pytest -q tests_python/test_local_projects.py
npx eslint components/project-details/collection/content-viewer.tsx components/project-details/collection/collection-item-fullscreen.tsx tests/3d-models-release.spec.ts playwright.3d-models.config.ts
npm run build
npx playwright test -c playwright.3d-models.config.ts
```

Expected: overlay tests pass, the static export builds, and desktop/mobile checks
verify all 14 previews, selected GLB parts, both animation clips, and viewer controls.
The release tests explicitly suppress production analytics. To verify a deployed
site, set `PORTFOLIO_RELEASE_BASE_URL=https://zacharysturman.com` for the same command.
The standard pre-push media smoke checks remain required.

## Remaining print-release work

- Add real print/use photos and identify the versions actually printed. File dates
  establish export recency; no printer-job history was found in the source archive.
- Confirm authorship/remix sources and choose a license per downloadable release.
- Verify millimeter dimensions and fit. Inspect the six edges flagged by the basic
  welded-edge check on the selected Small Drawer top before releasing its STL.
- Optionally restore missing textures and repair four legacy shape-key files;
  those files are not required for the current functional showcase.
- Publish reviewed print packages on Printables, optionally mirror on Thingiverse
  or MakerWorld, and add the real listing URLs to the corresponding item's resources.
