"""Prepare source-training validation vectors and a disjoint final audit."""
import argparse
import gzip
import json
from pathlib import Path
import zipfile
import numpy as np
import importlib.util

root = Path('/tmp/fino-ink-data')
spec = importlib.util.spec_from_file_location('letters_v2', Path(__file__).with_name('letters-v2.py'))
module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
parser = argparse.ArgumentParser();parser.add_argument('--audit',action='store_true');args=parser.parse_args()
source=np.load(root/'characters.npz')
partition='test' if args.audit else 'train'
with zipfile.ZipFile(root/'emnist.zip') as archive:
    name=next(n for n in archive.namelist() if n.endswith(f'emnist-byclass-{partition}-labels-idx1-ubyte.gz'))
    labels=np.frombuffer(gzip.decompress(archive.read(name)),np.uint8,offset=8)
mask=labels[source[f'letters_{partition}_id']]<36
images,y,ids=source[f'letters_{partition}_x'][mask],source[f'letters_{partition}_y'][mask],source[f'letters_{partition}_id'][mask]
if args.audit:
    used=set()
    for path in ['benchmark.json','benchmark-final.json']:
        used.update(int(r['id']) for r in json.loads((root/path).read_text()) if r['mode']=='letters')
    chosen=[]
    rng=np.random.default_rng(27102026)
    for label in range(26):
        indexes=np.array([i for i,v in enumerate(y) if v==label and int(ids[i]) not in used])
        rng.shuffle(indexes)
        chosen.extend(indexes[:250 if label<4 else 100])
else:
    order=np.random.default_rng(142).permutation(len(images))
    chosen=order[int(len(images)*.9):]
rows=[]
for i in chosen:
    rows.append({'id':int(ids[i]),'mode':'letters','source':'emnist-skeleton',
                 'value':int(y[i])+1 if y[i]<4 else None,'sourceLabel':int(y[i]),
                 'strokes':module.paths_from_bitmap(images[i])})
path=root/('letter-audit-v2.json' if args.audit else 'letter-validation.json')
path.write_text(json.dumps(rows,separators=(',',':')))
print(path.name,len(rows),'targets',sum(r['value'] is not None for r in rows))
