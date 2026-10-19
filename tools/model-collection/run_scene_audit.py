"""Audit unique non-library scenes in small, isolated Blender batches."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
import os

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
parser = argparse.ArgumentParser()
parser.add_argument('--shortlist', action='store_true')
args = parser.parse_args()
out = ROOT / 'docs/scene-audit'
out.mkdir(parents=True, exist_ok=True)
inventory = json.loads((ROOT / 'catalog/inventory.json').read_text())['assets']
seen = set()
paths = []
short = {m['source'] for m in json.loads((ROOT / 'catalog/models.json').read_text())['models']}
short.update({'Robot/Robot.blend', 'Blender/GO THROUGH - determine if they should be exported and added to portfolio/Unnamed Main Character.blend'})
for record in inventory:
    if record['extension'] != '.blend' or record['review'] in {'third-party', 'tutorial-or-library-review'}:
        continue
    if args.shortlist and record['path'] not in short:
        continue
    if record['sha256'] in seen:
        continue
    seen.add(record['sha256'])
    if (out / (record['sha256'][:20] + '.json')).exists():
        continue
    paths.append(str(ROOT / record['path']))
print(f'Auditing {len(paths)} uncached unique scenes', flush=True)
for offset in range(0, len(paths), 8):
    batch = out / 'inputs.json'
    batch.write_text(json.dumps(paths[offset:offset+8]))
    log = out / f'batch-{offset//8:03}.log'
    with log.open('w') as stream:
        try:
            result = subprocess.run(['/Applications/Blender.app/Contents/MacOS/Blender', '--background',
                                     '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
                                     '--python', str(TOOL_DIR / 'audit_scenes.py'), '--',
                                     '--inputs', str(batch), '--output', str(out)], stdout=stream,
                                    stderr=subprocess.STDOUT, timeout=110)
            status = result.returncode
        except subprocess.TimeoutExpired:
            status = 'timeout'
    print(f'Batch {offset//8}: {status}; {min(offset+8,len(paths))}/{len(paths)} submitted', flush=True)
