"""Expand public native-ink shape data; reserve new validation/audit IDs."""
import concurrent.futures
import json
from pathlib import Path
import urllib.parse
import urllib.request
import numpy as np
from prepare import SHAPES,DISTRACTORS,raster

root=Path('/tmp/fino-ink-v3');folder=root/'quickdraw';folder.mkdir(parents=True,exist_ok=True)
def fetch(name):
    path=folder/(name.replace(' ','_')+'.json')
    if path.exists():return
    count=50000 if name in SHAPES else 6000
    url='https://storage.googleapis.com/quickdraw_dataset/full/simplified/'+urllib.parse.quote(name)+'.ndjson'
    examples=[]
    with urllib.request.urlopen(url) as response:
        for line in response:
            row=json.loads(line)
            if not row['recognized']:continue
            examples.append({'id':row['key_id'],'strokes':[list(map(list,zip(*stroke[:2]))) for stroke in row['drawing']]})
            if len(examples)==count:break
    path.write_text(json.dumps(examples,separators=(',',':')));print('downloaded',name,len(examples),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:list(executor.map(fetch,SHAPES+DISTRACTORS))
out=root/'shapes.npz'
if not out.exists():
    sets={name:[[],[],[]] for name in ['train','validation','audit']};vectors={name:[] for name in ['validation','audit']}
    for category,name in enumerate(SHAPES+DISTRACTORS):
        rows=json.loads((folder/(name.replace(' ','_')+'.json')).read_text())
        for i,row in enumerate(rows):
            # Earlier public audit samples remain excluded from training.
            if category<4:
                split='train' if i<8000 or 10000<=i<40000 else 'validation' if 40000<=i<45000 else 'audit' if i>=45000 else None
            else:
                split='train' if i<1440 or 1800<=i<4800 else 'validation' if 4800<=i<5400 else 'audit' if i>=5400 else None
            if split is None:continue
            xs,ys,ids=sets[split];xs.append(raster(row['strokes']));ys.append(min(category,4));ids.append(row['id'])
            if split!='train':vectors[split].append({'source':'quickdraw','id':row['id'],'mode':'symbols','value':category+1 if category<4 else None,'strokes':row['strokes'],'sourceLabel':name})
        print('rendered',name,flush=True)
    data={}
    for split,(x,y,ids) in sets.items():data.update({split+'_x':np.array(x),split+'_y':np.array(y,dtype=np.int64),split+'_id':np.array(ids)})
    np.savez_compressed(out,**data)
    for split,rows in vectors.items():(root/(split+'-symbols.json')).write_text(json.dumps(rows,separators=(',',':')))
