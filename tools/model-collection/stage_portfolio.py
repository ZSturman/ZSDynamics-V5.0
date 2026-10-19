"""Prepare a local content overlay for the existing portfolio. Does not deploy.

Requires Pillow (available in the portfolio's existing .venv). Full editable
sources, third-party libraries, print files, and review data stay outside public.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
import os

from PIL import Image

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
parser = argparse.ArgumentParser()
parser.add_argument('--portfolio', type=Path, default=Path(__file__).resolve().parents[2])
args = parser.parse_args()
portfolio = args.portfolio.resolve()
manifest = portfolio / 'public/projects/projects.json'
project = next(p for p in json.loads(manifest.read_text()) if p['slug'] == '3d-models-collection')
models = [m for m in json.loads((ROOT / 'catalog/models.json').read_text())['models']
          if m['section'] in {'selected', 'wip'}]
dest = portfolio / 'content/projects/3d-models-collection'
(dest / 'images').mkdir(parents=True, exist_ok=True)
(dest / 'models').mkdir(exist_ok=True)
base_url = f"/projects/{project['folderName']}"
collections = {
    'Selected designs': {'label': 'Selected designs', 'summary': 'Functional design studies. Printing and fit validation are pending.', 'items': []},
    'Characters': {'label': 'Characters', 'summary': 'Selected character and creature studies, including neutral geometry previews.', 'items': []},
    'Scenes & studies': {'label': 'Scenes & studies', 'summary': 'Coherent architectural and object studies selected from the source archive.', 'items': []},
    'Work in progress': {'label': 'Work in progress', 'summary': 'Unfinished designs and character experiments, shown as development studies.', 'items': []},
}
for model in models:
    inspected = ROOT / 'docs/inspection' / model['id']
    report = json.loads((inspected / 'inspection.json').read_text())
    preview_hash = hashlib.sha256((inspected / 'preview.png').read_bytes()).hexdigest()[:8]
    preview_name = f"{model['id']}-{preview_hash}-optimized.webp"
    with Image.open(inspected / 'preview.png') as image:
        image.convert('RGB').save(dest / 'images' / preview_name, quality=88)
    image_only = model.get('image_only') or bool(report['missing_images'])
    if image_only:
        path = f'{base_url}/images/{preview_name}'
    else:
        glb = inspected / 'model.glb'
        if glb.stat().st_size > 15_000_000:
            raise ValueError(f'Display model exceeds 15 MB budget: {model["id"]}')
        glb_name = f"{model['id']}-{hashlib.sha256(glb.read_bytes()).hexdigest()[:8]}.glb"
        shutil.copy2(glb, dest / 'models' / glb_name)
        path = f"{base_url}/models/{glb_name}"
    summary = model['summary']
    if image_only:
        summary += ' Neutral geometry preview; original textures need restoration.'
    item = {'id': model['id'], 'label': model['title'], 'type': 'image' if image_only else '3d-model',
            'path': path, 'thumbnail': f'{base_url}/images/{preview_name}',
            'oneLiner': 'Work in progress' if model['section'] == 'wip' else 'Character study' if model['kind'] == 'character' else 'Functional design study',
            'summary': summary, 'resources': [], 'autoPlay': bool(model.get('action')), 'loop': bool(model.get('action'))}
    section = ('Work in progress' if model['section'] == 'wip' else 'Characters' if model['kind'] == 'character'
               else 'Selected designs' if model['kind'] == 'functional' else 'Scenes & studies')
    item['order'] = len(collections[section]['items'])
    collections[section]['items'].append(item)
photo_manifest = ROOT / 'catalog/photos.json'
if photo_manifest.exists():
    in_use = []
    for photo in json.loads(photo_manifest.read_text()).get('photos', []):
        if not any(m['id']==photo['model_id'] for m in models):
            continue
        photo_name = Path(photo['webp']).name
        shutil.copy2(ROOT/photo['webp'], dest/'images'/photo_name)
        title = next(m['title'] for m in models if m['id']==photo['model_id'])
        in_use.append({'id':photo['id'],'type':'image','label':title+' — in use',
                       'path':f'{base_url}/images/{photo_name}', 'thumbnail':f'{base_url}/images/{photo_name}',
                       'summary':photo.get('caption',''), 'order':len(in_use)})
    if in_use:
        collections['In use']={'label':'In use','summary':'Real photographs of the designs in use.','items':in_use}
collections = {key:value for key,value in collections.items() if value['items']}
preview_urls = {item['id']:item['thumbnail'] for value in collections.values() for item in value['items']}
project.update({
    'subtitle': 'Functional designs, characters, and works in progress.',
    'oneLiner': 'A curated collection of Blender design and character studies.',
    'summary': 'A selection of functional objects, stylized characters, and ongoing Blender experiments. Interactive geometry previews sit alongside development studies, with unfinished work clearly separated.',
    'description': 'Explore the models by opening a preview. Functional objects are design studies; downloadable print releases will be added after dimensions, fit, and release details have been checked.',
    'story': 'This collection follows experiments with form across practical objects and imagined characters. Selected designs focus on storage and organization, while the character work explores silhouette and expression. The work-in-progress section records ideas still being developed.',
    'updatedAt': '2026-10-19', 'category': '3D Design',
    'tags': ['3D Modeling', 'Blender', '3D Printing', 'Character Design', 'Prototyping'],
    'mediums': ['3D'], 'images': {'thumbnail': preview_urls['belt-holder'], 'hero': preview_urls['robot']},
    'collection': collections, 'collections': [], 'assets': [],
})
(dest / 'project.json').write_text(json.dumps(project, indent=2, ensure_ascii=False) + '\n')
# Remove only generated, collection-owned media that is no longer referenced.
used = set()
def collect_paths(value):
    if isinstance(value, str) and value.startswith(base_url+'/'):
        used.add(value.removeprefix(base_url+'/'))
    elif isinstance(value, dict):
        for child in value.values(): collect_paths(child)
    elif isinstance(value, list):
        for child in value: collect_paths(child)
collect_paths(project)
ids = [m['id'] for m in json.loads((ROOT/'catalog/models.json').read_text())['models']]
for root in (dest, portfolio/'public/projects'/project['folderName']):
    for subfolder in ('images', 'models'):
        for media in (root/subfolder).glob('*'):
            if (media.is_file() and media.suffix in {'.webp','.glb'}
                    and any(media.name.startswith(key+'-') or media.name==key+'.glb' for key in ids)
                    and media.relative_to(root).as_posix() not in used):
                media.unlink()
(dest / 'README.md').write_text('''# 3D Models Collection

Functional objects, character studies, and works in progress made with Blender.

## Selected designs

Belt Holder, the shorter Purse Holder, Microscope Holder, the small Under Desk
Drawer assembly, Keyboard Riser and iPad Wall Mount remix are shown as individual
parts or coherent assemblies. Recent STL export dates help select revisions;
they do not establish that a part was printed. Dimensions and fit remain unverified.

## Characters

Robot uses one rigged mesh and only its walking cycle. Grumpy Old Man is a neutral
sculpt render. Extra bodies, alternate rigs and construction geometry are excluded.

## Scenes and studies

Mansion Study and Mushroom Study present coherent subjects from the scene archive.

## Work in progress

Arduino Case, Sensor Drawer, Main Character and Terror Bird remain development
studies. Main Character uses one rig and its isolated walking clip. Their forms
and assembly details may change. Where source textures are missing, previews use
neutral geometry renders.

## Photographs

Real-world photographs appear in an In use tab after they are added. The upload
workflow keeps original photos locally and publishes optimized copies without EXIF.

## Print releases

Model downloads and external listings will be linked here as each release is
reviewed and prepared. Display models use normalized preview scale and are not
printable files with verified dimensions.
''')
print(f'Prepared {len(models)} portfolio entries in {dest}')
print('Run the portfolio local-project sync to preview. No deployment was performed.')
