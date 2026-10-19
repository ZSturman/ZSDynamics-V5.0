"""Inspect the explicit shortlist in isolated Blender processes, with timeouts."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
import os

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
parser = argparse.ArgumentParser()
parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
parser.add_argument('--id', action='append', help='Only process these model IDs')
parser.add_argument('--force', action='store_true', help='Regenerate existing derived files')
args = parser.parse_args()
models = json.loads((ROOT / 'catalog/models.json').read_text())['models']
results = []
for model in models:
    if args.id and model['id'] not in args.id:
        continue
    source = ROOT / model['source']
    out = ROOT / 'docs/inspection' / model['id']
    out.mkdir(parents=True, exist_ok=True)
    report_file = out / 'inspection.json'
    if not args.force and (out / 'preview.png').exists() and report_file.exists():
        report = json.loads(report_file.read_text())
        tool_hash = hashlib.sha256((TOOL_DIR / 'export_curated.py').read_bytes()).hexdigest()
        spec_hash = hashlib.sha256(json.dumps(model, sort_keys=True).encode()).hexdigest()
        sources_match = all(hashlib.sha256((ROOT/s['path']).read_bytes()).hexdigest()==s['sha256']
                            for s in report.get('sources', []))
        if (report.get('tool_sha256')==tool_hash and report.get('spec_sha256')==spec_hash
                and sources_match and (model.get('image_only') or (out/'model.glb').exists())):
            print('CACHED', model['id'], flush=True)
            continue
    cmd = [args.blender, '--background', '--factory-startup', '--disable-autoexec',
           '--python-exit-code', '1', '--python', str(TOOL_DIR / 'export_curated.py'),
           '--', '--id', model['id']]
    try:
        with (out / 'blender.log').open('w') as log:
            result = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, timeout=90)
        status = 'ok' if result.returncode == 0 else f'error:{result.returncode}'
    except subprocess.TimeoutExpired:
        status = 'timeout:90s'
    results.append({'id': model['id'], 'status': status})
    print(model['id'], status, flush=True)
(ROOT / 'catalog/preview-run.json').write_text(json.dumps(results, indent=2) + '\n')
if any(r['status'] != 'ok' for r in results):
    raise SystemExit('Some previews failed; see per-model blender.log files.')
