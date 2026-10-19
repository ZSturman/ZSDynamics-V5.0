> Authoring checkpoint before portfolio publication. The owner subsequently authorized
> the showcase release; see `docs/3D_MODELS.md` for current release status.

# Curated collection — October 19, 2026

The first scene-wide exports were superseded. The current portfolio has **14
entries: 11 interactive models and three still studies**, selected after inspecting
objects, hierarchy, saved visibility, animation actions and nearby STL exports.

All 204 unique non-library candidate Blender scenes were audited. Duplicate copies
share an audit by source hash. Known library/demo assets were excluded from this
candidate pass. Four legacy files reported damaged shape keys on loading; their
warnings were retained in the audit and their source files were not saved.
Reports: `docs/scene-audit/`. The original source hashes remain unchanged.

## Decisions

| Item | Chosen export |
| --- | --- |
| Robot | `Robot/Robot.blend`: only `RobotPlayerMesh` and its armature; Walking, frames 1–25. No Everything timeline, second rig, or spare body parts. |
| Main Character | One skinned Character and matching armature; Walking.001, frames 1–25. Kept as WIP. |
| Belt Holder | Existing September 23 STL, matching Cube.001 in both triangle count and bounds. |
| Purse Holder | October 15 `Short Top.stl`, excluding the tall predecessor and clearance coupon. |
| Microscope Holder | One final mount mesh, excluding Cylinder and Cube reference geometry. |
| Small Under Desk Drawer | Four matching October 14 STLs. Their coordinates and topology match the four saved Small objects. Drawer is offset only for the partly-open display. |
| Arduino Case | Only the final saved active `Cube.002`; no joystick, peg or old base studies. |
| Sensor Drawer | Latest September 25 labeled-drawer STL, rather than overlapping storage-box variants. |
| Keyboard Riser | Existing complete single-part STL. |
| iPad Wall Mount | Latest October 14 full-bottom v2 STL; explicitly labeled a remix. |
| Grumpy Old Man | Primary Character and matching InnerEye, with older body/eyes excluded; neutral still. |
| Terror Bird | One coarse creature mesh; moved to WIP, shown as a still. |
| Mushroom Study | One coherent named object. |
| Mansion Study | Coherent visible architectural assembly; still preview while missing textures remain. |

Deferred after visual inspection: the isolated whiteboard-easel bar lacks context;
`Triceratops.blend` currently contains a flat disc-like model rather than the
expected creature; the selected Standard Model scene has an incomplete diagram.
The bouncy-balls video has dark/compressed imagery and was not added to this selection.

Each active entry records its exact source, object allowlist or STL set, animation
clip, selection rationale and display offsets in `catalog/models.json`.
`scripts/prepare_previews.py` now invokes `export_curated.py` and invalidates caches
when the source, selection or exporter changes. Content-hashed public media names
prevent the browser from reusing the old overlapping exports.

## What the dates establish

`catalog/print-exports.json` records all 30 original STLs, modification dates, bounds,
triangle counts, connected components and welded-edge checks. No G-code, 3MF print
projects or printer-job logs were found in the collection. The chosen files are
the latest coherent **exports**, not confirmed recent prints. STL units remain
unconfirmed. The selected Small Drawer top has six edges flagged by the basic
welded-edge check and needs mesh/slicer inspection before download release.

## Add actual photos

Open **http://127.0.0.1:8767**. Pick an item, choose up to ten photos, add a caption
and click **Add to local portfolio**. Reload the portfolio and open **In use**.
The tab appears after the first photo. JPG, PNG, WebP and HEIC/HEIF are accepted;
HEIC uses macOS `sips`. The upload is limited to 64 MB per request.

Originals stay in `media/photos/<model-id>/`; optimized WebPs are capped at 2400 px
and saved without EXIF. Captions and associations live in `catalog/photos.json`.
The uploader stages and syncs locally; it never commits or deploys.

Restart the picker from the collection directory if needed:

```sh
"/Users/zacharysturman/Workspace/Projects/zacharysturman/.venv/bin/python" scripts/photo_upload.py
```

Validation: all 11 active GLBs loaded in Three.js. Each walking export contains
exactly one clip of one second, and sampled skinned vertices move visibly. The
photo importer passed an isolated image/metadata fixture test; the form loads in
the browser. No synthetic photograph was added to the portfolio. Actual HEIC
uploads, print fit, a production build and public publishing remain untested.

## Remaining work, in order

1. Add real photographs and identify which versions were actually printed/used.
2. Check authorship/remix sources and choose a license for each release.
3. Confirm millimeter dimensions, inspect the Small Drawer top, and slice/print
   the selected final parts. Record orientation, material, hardware and fit notes.
4. Optionally restore missing character/building textures and repair the four
   legacy shape-key files. These are not necessary for the first functional release.
5. Publish reviewed printable files on Printables first; mirror on Thingiverse if
   useful. Consider MakerWorld for print-profile sharing. Keep matching versions,
   real photos and source/remix information on every destination.
6. Run the portfolio production build and deployment checks, then deploy and add
   the real listing URLs. Nothing in this run has been deployed or externally uploaded.
