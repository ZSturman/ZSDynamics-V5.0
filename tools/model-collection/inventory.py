"""Hash source assets and extract saved Blender thumbnails without opening scenes.

Standard-library only. Existing sources are read-only; generated output is excluded.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import struct
import zlib
from collections import Counter, defaultdict
from pathlib import Path
import os

try:
    from compression import zstd
except ImportError:
    zstd = None

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
EXTENSIONS = {'.blend', '.blend1', '.stl', '.glb', '.obj', '.fbx', '.mov', '.bin', '.png', '.jpg'}
EXCLUDED = {'catalog', 'docs', 'scripts', 'releases', '.git', '__pycache__'}


def png_rgba(width: int, height: int, pixels: bytes) -> bytes:
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    stride = width * 4
    # Blender stores the bottom row first.
    rows = b''.join(b'\0' + pixels[y*stride:(y+1)*stride] for y in reversed(range(height)))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def saved_thumbnail(path: Path) -> bytes | None:
    with path.open('rb') as raw:
        magic = raw.read(4)
    # Python 3.14 can read newer Blender compression without another dependency.
    if magic == b'(\xb5/\xfd' and zstd is None:
        return None
    opener = zstd.open if magic == b'(\xb5/\xfd' else gzip.open if magic[:2] == b'\x1f\x8b' else open
    with opener(path, 'rb') as source:
        header = source.read(12)
        if not header.startswith(b'BLENDER'):
            return None
        pointer_size = 8 if header[7:8] == b'-' else 4
        endian = '<' if header[8:9] == b'v' else '>'
        # TEST normally follows REND. Bound work so no large scenes are parsed.
        for _ in range(8):
            block = source.read(16 + pointer_size)
            if len(block) != 16 + pointer_size:
                return None
            code, length = struct.unpack(endian + '4sI', block[:8])
            if code == b'TEST':
                data = source.read(length)
                width, height = struct.unpack(endian + 'II', data[:8])
                if 0 < width <= 2048 and 0 < height <= 2048 and len(data[8:]) == width*height*4:
                    return png_rgba(width, height, data[8:])
                return None
            if code in {b'DNA1', b'ENDB'} or length > 1024*1024:
                return None
            source.seek(length, 1)
    return None


def classify(path: Path) -> str:
    text = path.as_posix().lower()
    if 'third party models/' in text or 'stackable storage box - 1997048/' in text or '/assets/models/' in text:
        return 'third-party'
    if 'remix' in text:
        return 'remix-review'
    if path.suffix.lower() == '.blend1':
        return 'backup'
    if any(k in path.stem.lower() for k in ('tutorial', 'geometry-nodes', 'geo-nodes', '_blender_cycles')):
        return 'tutorial-or-library-review'
    return 'ownership-unreviewed'


def main():
    out = ROOT / 'catalog'
    thumbs = ROOT / 'docs' / 'images' / 'saved-previews'
    out.mkdir(exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)
    assets = []
    hashes = defaultdict(list)
    for path in sorted(ROOT.rglob('*')):
        rel = path.relative_to(ROOT)
        if set(rel.parts) & EXCLUDED or not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            continue
        with path.open('rb') as stream:
            if hasattr(hashlib, 'file_digest'):
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            else:
                hasher = hashlib.sha256()
                for block in iter(lambda: stream.read(1024*1024), b''):
                    hasher.update(block)
                digest = hasher.hexdigest()
        record = {'path': rel.as_posix(), 'bytes': path.stat().st_size,
                  'sha256': digest, 'extension': path.suffix.lower(), 'review': classify(rel)}
        hashes[digest].append(rel.as_posix())
        if path.suffix.lower() == '.blend' and record['review'] != 'third-party':
            try:
                preview = saved_thumbnail(path)
                if preview:
                    dest = thumbs / f'{digest[:16]}.png'
                    dest.write_bytes(preview)
                    record['saved_preview'] = dest.relative_to(ROOT).as_posix()
                else:
                    record['saved_preview_status'] = 'no supported embedded thumbnail; use Blender inspection'
            except (ValueError, OSError, struct.error) as exc:
                record['saved_preview_status'] = str(exc)
        assets.append(record)
    groups = [paths for paths in hashes.values() if len(paths) > 1]
    summary = {'asset_count': len(assets), 'bytes': sum(a['bytes'] for a in assets),
               'extensions': dict(Counter(a['extension'] for a in assets)),
               'review_counts': dict(Counter(a['review'] for a in assets)),
               'duplicate_groups': len(groups),
               'redundant_bytes': sum(next(a['bytes'] for a in assets if a['sha256'] == digest) * (len(paths)-1)
                                      for digest, paths in hashes.items() if len(paths)>1),
               'saved_previews': sum('saved_preview' in a for a in assets)}
    (out / 'inventory.json').write_text(json.dumps({'summary': summary, 'assets': assets, 'exact_duplicates': groups}, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
