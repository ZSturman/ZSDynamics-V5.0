"""Loopback-only photo picker for this collection; run with the portfolio venv."""
import hashlib
import html
import io
import json
import subprocess
import sys
import tempfile
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import os

from PIL import Image, ImageOps, UnidentifiedImageError

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
PORTFOLIO = Path(__file__).resolve().parents[2]

def models():
    return {m['id']:m for m in json.loads((ROOT/'catalog/models.json').read_text())['models']
            if m['section'] in {'selected','wip'}}

def save_photo(model_id, data, filename, caption):
    if model_id not in models():
        raise ValueError('Choose a model from this collection')
    digest = hashlib.sha256(data).hexdigest()
    folder = ROOT/'media/photos'/model_id
    folder.mkdir(parents=True,exist_ok=True)
    suffix = Path(filename).suffix.lower()
    if suffix not in {'.jpg','.jpeg','.png','.webp','.heic','.heif'}:
        raise ValueError('Use JPG, PNG, WebP or HEIC photos')
    original = folder/(digest+suffix)
    # Decode first, so invalid uploads never become registered photo records.
    try:
        image = Image.open(io.BytesIO(data))
    except UnidentifiedImageError:
        if suffix not in {'.heic','.heif'}:
            raise
        with tempfile.TemporaryDirectory() as temp:
            source=Path(temp)/('photo'+suffix);source.write_bytes(data)
            converted=Path(temp)/'photo.jpg'
            subprocess.run(['sips','-s','format','jpeg',str(source),'--out',str(converted)],check=True,capture_output=True)
            image=Image.open(converted).copy()
    image=ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((2400,2400))
    output=folder/f'{model_id}-photo-{digest[:12]}-optimized.webp'
    image.save(output,'WEBP',quality=88,exif=b'')
    original.write_bytes(data)
    manifest=ROOT/'catalog/photos.json'
    doc=json.loads(manifest.read_text()) if manifest.exists() else {'photos':[]}
    key=f'{model_id}-{digest[:12]}'
    doc['photos']=[p for p in doc['photos'] if p['id']!=key]
    doc['photos'].append({'id':key,'model_id':model_id,'original':str(original.relative_to(ROOT)),
                          'webp':str(output.relative_to(ROOT)),'caption':caption[:1000]})
    manifest.write_text(json.dumps(doc,indent=2)+'\n')

class Handler(BaseHTTPRequestHandler):
    def reply(self, text, status=200):
        body=('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collection photos</title>'
              '<style>body{font:17px system-ui;max-width:700px;margin:40px auto;padding:20px;background:#10151d;color:#edf2fa}label{display:block;margin:20px 0}input,select,textarea,button{font:inherit;max-width:100%;padding:10px}a{color:#9bd4ff}</style>'+text).encode()
        self.send_response(status);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        options=''.join(f'<option value="{html.escape(key)}">{html.escape(m["title"])}</option>' for key,m in models().items())
        self.reply('<h1>Add photos of your designs</h1><p>Choose an item and photos showing it in use. Originals stay in the collection; optimized copies appear in the portfolio’s In use tab. This does not deploy the site.</p>'
                   '<form action="/upload" method="post" enctype="multipart/form-data">'
                   f'<label>Item <select name="model_id">{options}</select></label>'
                   '<label>Photos <input type="file" name="photos" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" multiple required></label>'
                   '<label>Caption <textarea name="caption" rows="3"></textarea></label><button>Add to local portfolio</button></form>')
    def do_POST(self):
        origin=self.headers.get('Origin')
        if self.path!='/upload' or origin not in {None,'http://127.0.0.1:8767','http://localhost:8767'}:
            self.reply('Unsupported request',403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=64*1024*1024:raise ValueError('Choose fewer photos (64 MB maximum per upload)')
            message=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+self.headers.get('Content-Type','')+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+self.rfile.read(size))
            parts=list(message.iter_parts());fields={p.get_param('name',header='content-disposition'):p.get_payload(decode=True).decode('utf-8') for p in parts if not p.get_filename()}
            files=[p for p in parts if p.get_filename()]
            if not 1<=len(files)<=10:raise ValueError('Choose between 1 and 10 photos')
            for part in files:save_photo(fields.get('model_id',''),part.get_payload(decode=True),part.get_filename(),fields.get('caption',''))
            subprocess.run([sys.executable,str(TOOL_DIR/'stage_portfolio.py')],check=True,capture_output=True)
            subprocess.run([sys.executable,str(PORTFOLIO/'lib/local_projects.py')],cwd=PORTFOLIO,check=True,capture_output=True)
            self.reply('<h1>Photos added locally</h1><p>Reload the portfolio and open In use.</p><p><a href="http://127.0.0.1:3100/projects/3d-models-collection">Open portfolio</a> · <a href="/">Add more photos</a></p>')
        except Exception as exc:self.reply('<h1>Could not finish</h1><p>'+html.escape(str(exc))+'</p><p>Any successfully saved originals remain in media/photos. See catalog/photos.json before retrying.</p><a href="/">Back</a>',400)

if __name__=='__main__':
    print('Photo picker: http://127.0.0.1:8767',flush=True)
    HTTPServer(('127.0.0.1',8767),Handler).serve_forever()
