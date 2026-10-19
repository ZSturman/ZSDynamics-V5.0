"""Build a local visual review page; no server or dependencies required.

Optionally creates contact sheets if Pillow is available. Reviews stay in this
browser until exported; the inventory is never changed by this page.
"""
import json
from pathlib import Path
import os

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
inventory = json.loads((ROOT / 'catalog/inventory.json').read_text())
assets = [a for a in inventory['assets'] if a['extension'] in {'.blend', '.glb', '.stl', '.obj'}]
shortlist = {m['source']: m for m in json.loads((ROOT / 'catalog/models.json').read_text())['models']}
for asset in assets:
    asset['preview'] = asset.get('saved_preview')
    model = shortlist.get(asset['path'])
    if model:
        rendered = ROOT / 'docs/inspection' / model['id'] / 'preview.png'
        if rendered.exists():
            asset['preview'] = rendered.relative_to(ROOT).as_posix()
data = json.dumps(assets).replace('<', '\\u003c')
page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>3D collection review</title><style>
*{box-sizing:border-box}body{font:15px system-ui;background:#10151d;color:#e8edf4;margin:24px}
header{max-width:1000px}h1{margin-bottom:8px}p{color:#b9c6d6;line-height:1.5}
button,input,select,textarea{font:inherit;color:inherit;background:#192432;border:1px solid #40526b;border-radius:6px;padding:9px}
button{cursor:pointer}a{color:#8ecbff}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0;position:sticky;top:0;background:#10151d;padding:10px 0;z-index:2}
input[type=search]{flex:1;min-width:220px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
article{background:#19212d;border:1px solid #35455a;border-radius:10px;padding:16px;overflow:hidden}
article img{width:100%;height:200px;object-fit:contain;image-rendering:auto;background:#242e3a}
h2{font-size:17px;word-break:break-word}.path{font-size:12px;word-break:break-all;color:#b9c6d6}label{display:block;font-size:13px;margin:10px 0 5px}select,textarea{width:100%}
.placeholder{height:200px;display:grid;place-items:center;color:#a8b8cc;background:#242e3a}.badge{font-size:12px;color:#ffd99b}#count{margin-bottom:20px}
</style><header><h1>3D collection review</h1><p>Saved Blender thumbnails are previews of the last saved viewport, not new renders or evidence of printability. Search names, mark ownership and presentation, then export your decisions. Sources stay untouched. Known downloaded assets are flagged.</p>
<p>Review choices are stored in this browser. Export a backup before switching browsers or clearing browser data. Duplicate files share choices by SHA-256.</p></header>
<nav><input id="search" type="search" placeholder="Search source names or folders" aria-label="Search models"><select id="filter" style="width:auto" aria-label="Filter review"><option value="all">All models</option><option value="pending">Needs ownership review</option><option value="preview">Has saved preview</option><option value="third-party">Known third-party</option></select><button id="export">Export review JSON</button></nav><div id="count"></div><main class="grid" id="grid"></main>
<script>const assets=ASSET_DATA;
let reviews={};try{reviews=JSON.parse(localStorage.getItem('3d-model-review-v1')||'{}')}catch(e){}
const grid=document.getElementById('grid'),search=document.getElementById('search'),filter=document.getElementById('filter');
function save(key,field,value){reviews[key]={...reviews[key],path:assets.find(a=>a.sha256===key).path,[field]:value};try{localStorage.setItem('3d-model-review-v1',JSON.stringify(reviews))}catch(e){alert('Browser storage unavailable. Export your review before closing this page.')}}
function selectField(card,a,label,field,options){const l=document.createElement('label');l.textContent=label;const s=document.createElement('select');for(const [v,t] of options){const o=new Option(t,v);s.add(o)}s.value=reviews[a.sha256]?.[field]||options[0][0];s.onchange=()=>save(a.sha256,field,s.value);l.append(s);card.append(l)}
function render(){grid.replaceChildren();const query=search.value.toLowerCase();const list=assets.filter(a=>a.path.toLowerCase().includes(query)&&(filter.value==='all'||filter.value==='pending'&&!reviews[a.sha256]?.ownership||filter.value==='preview'&&a.saved_preview||filter.value==='third-party'&&a.review==='third-party'));document.getElementById('count').textContent=list.length+' files · '+Object.keys(reviews).length+' files with review decisions';for(const a of list){const c=document.createElement('article');if(a.saved_preview){const im=document.createElement('img');im.src='../'+a.saved_preview;im.alt='Saved viewport: '+a.path;im.loading='lazy';c.append(im)}else{const p=document.createElement('div');p.className='placeholder';p.textContent='Open in Blender for a preview';c.append(p)}const h=document.createElement('h2');h.textContent=a.path.split('/').pop();c.append(h);const p=document.createElement('p');p.className='path';p.textContent=a.path;c.append(p);const b=document.createElement('div');b.className='badge';b.textContent=a.review+' · '+(a.bytes/1e6).toFixed(1)+' MB';c.append(b);const link=document.createElement('a');link.textContent='Source file';link.href='../'+a.path.split('/').map(encodeURIComponent).join('/');c.append(link);selectField(c,a,'Ownership','ownership',[['','Unreviewed'],['original','My original work'],['remix','Remix — needs source/credit'],['third-party','Third-party — exclude']]);selectField(c,a,'Presentation','presentation',[['','Unreviewed'],['selected','Selected work'],['wip','Work in progress'],['archive','Archive / exclude']]);selectField(c,a,'Print validation','print_status',[['','Unknown / not tested'],['tested','Successfully printed and used'],['needs-test','Needs print or fit test'],['not-applicable','Not a printable model']]);const l=document.createElement('label');l.textContent='Notes / source URL';const t=document.createElement('textarea');t.rows=2;t.value=reviews[a.sha256]?.notes||'';t.onchange=()=>save(a.sha256,'notes',t.value);l.append(t);c.append(l);grid.append(c)}}
search.oninput=render;filter.onchange=render;document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify({schema_version:1,reviews},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='3d-model-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};render();</script></html>'''.replace('ASSET_DATA', data)
page = page.replace('a.saved_preview', 'a.preview')
page = page.replace('Saved viewport: ', 'Model preview: ')
page = page.replace('Has saved preview', 'Has preview')
page = page.replace('Saved Blender thumbnails are previews', 'Shortlisted models may show fresh studio geometry renders. Saved Blender thumbnails are previews')
page = page.replace('search.oninput=render;', "search.value=new URLSearchParams(location.search).get('q')||'';search.oninput=render;")
(ROOT / 'catalog/review.html').write_text(page)
print('Review page: catalog/review.html')

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print('Pillow unavailable: contact sheets skipped; review page is ready.')
else:
    seen = set()
    previews = []
    for a in assets:
        if a.get('preview') and a['sha256'] not in seen:
            seen.add(a['sha256'])
            previews.append(a)
    sheets = ROOT / 'docs/images/contact-sheets'
    sheets.mkdir(parents=True, exist_ok=True)
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font = ImageFont.truetype(font_path, 13) if Path(font_path).exists() else ImageFont.load_default()
    for start in range(0, len(previews), 30):
        sheet = Image.new('RGB', (1200, 1260), '#e6e9ef')
        draw = ImageDraw.Draw(sheet)
        for i, a in enumerate(previews[start:start+30]):
            x,y=(i%6)*200,(i//6)*252
            im=Image.open(ROOT / a['preview']).convert('RGBA')
            im.thumbnail((190,190))
            sheet.paste(im,(x+(200-im.width)//2,y),im)
            name=Path(a['path']).name
            lines=[name[j:j+25] for j in range(0,min(len(name),75),25)]
            draw.text((x+5,y+194),'\n'.join(lines),fill='#142033',font=font)
        sheet.save(sheets / f'sheet-{start//30+1:02}.jpg',quality=90)
    print(f'{len(previews)} unique previews in {(len(previews)+29)//30} contact sheets.')
