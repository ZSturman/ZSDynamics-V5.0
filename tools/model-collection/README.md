# Local 3D collection tools

These tools manage the authoring archive and prepare its portfolio overlay. They
are local utilities, not a public upload service. Editable models and original
photos stay outside the web repository.

Set `MODEL_COLLECTION_ROOT` to the archive containing `catalog/models.json` and its
source assets. The default is the existing sibling `_Collections/3D Models Collection`
directory. `models.json` here records the release's exact selections and rationales;
the archive's catalog remains the editable working copy.

From the portfolio root, with Blender installed in `/Applications/Blender.app` and
Pillow in the existing Python environment:

```sh
python3 tools/model-collection/prepare_previews.py --id robot
.venv/bin/python tools/model-collection/stage_portfolio.py
npm run sync:local-projects
.venv/bin/python tools/model-collection/photo_upload.py
```

The photo picker opens at http://127.0.0.1:8767. Pick an item and real photographs;
the tool retains originals in the archive, strips EXIF from optimized WebPs, and
syncs a captioned **In use** collection. It never commits or deploys. HEIC/HEIF uses
macOS `sips`. See `CURATION.md` for remaining print-release checks.

Source scenes are never saved. Curated Blender exports require explicit object
allowlists, and static print previews use explicit STL sets. Animation exports use
only the chosen action and frame range. Display GLBs have normalized scale and
must not be used as dimensionally verified print files.
