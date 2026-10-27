"""Fresh official-test IDs excluded from every earlier capped EMNIST corpus.
UJI's official test writers are kept disjoint from training and validation.
"""
import gzip,importlib.util,json,zipfile
from pathlib import Path
import numpy as np
from prepare import normalize_bitmap
root=Path('/tmp/fino-ink-v3');cache=Path('/tmp/fino-ink-data')
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
z=zipfile.ZipFile(cache/'emnist.zip')
def read(kind):return gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-test-'+kind+'.gz'))))
labels=np.frombuffer(read('labels-idx1-ubyte'),np.uint8,offset=8)
images=np.frombuffer(read('images-idx3-ubyte'),np.uint8,offset=16).reshape(-1,28,28).transpose(0,2,1)
old=np.load(cache/'characters.npz');native=json.loads((root/'uji-audit.json').read_text());manifest={}
for mode in ['letters','numbers']:
 out=root/('audit-'+mode+'.json')
 if out.exists():continue
 used=set(old[mode+'_test_id'].tolist());rows=[]
 for label in range(10,36) if mode=='letters' else range(10):
  candidates=[int(i) for i in np.where(labels==label)[0] if int(i) not in used]
  np.random.default_rng(271027+label).shuffle(candidates)
  candidates=candidates[:500 if (label in range(10,14) if mode=='letters' else label in range(1,5)) else 100]
  for i in candidates:
   value=label-9 if mode=='letters' and label<14 else label if mode=='numbers' and label in range(1,5) else None
   rows.append({'source':'EMNIST fresh official test','id':'fresh-test-'+str(i),'mode':mode,'value':value,'sourceLabel':chr(label+55) if mode=='letters' else str(label),'strokes':module.paths_from_bitmap(normalize_bitmap(images[i]))})
 rows.extend(r for r in native if r['mode']==mode)
 out.write_text(json.dumps(rows,separators=(',',':')))
 manifest[mode]={'size':len(rows),'targets':{str(v):sum(r['value']==v for r in rows) for v in range(1,5)},'other':sum(r['value'] is None for r in rows)}
print(json.dumps(manifest,indent=2))
