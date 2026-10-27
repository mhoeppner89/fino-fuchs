"""Reserve another untouched EMNIST test set after the first digit diagnosis.
The native writer audit is reported separately; those writers cannot be new twice.
"""
import argparse,gzip,importlib.util,json,zipfile
from pathlib import Path
import numpy as np
from prepare import normalize_bitmap
parser=argparse.ArgumentParser();parser.add_argument('--final',action='store_true');args=parser.parse_args()
root=Path('/tmp/fino-ink-v3');cache=Path('/tmp/fino-ink-data');z=zipfile.ZipFile(cache/'emnist.zip')
used=set(np.load(cache/'characters.npz')['numbers_test_id'].tolist())
used.update(int(r['id'].split('-')[-1]) for r in json.loads((root/'audit-numbers.json').read_text()) if r['source']=='EMNIST fresh official test')
if args.final:
 used.update(int(r['id'].split('-')[-1]) for r in json.loads((root/'audit-numbers-confirmation.json').read_text()))
def read(kind):return gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-test-'+kind+'.gz'))))
labels=np.frombuffer(read('labels-idx1-ubyte'),np.uint8,offset=8);images=np.frombuffer(read('images-idx3-ubyte'),np.uint8,offset=16).reshape(-1,28,28).transpose(0,2,1)
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
rows=[]
for label in range(10):
 ids=[int(i) for i in np.where(labels==label)[0] if int(i) not in used];np.random.default_rng(271029+label if args.final else 271028+label).shuffle(ids)
 for i in ids[:1000 if label in [1,2,3,4] else 200]:rows.append({'id':'confirmation-'+str(i),'source':'EMNIST fresh confirmation','mode':'numbers','sourceLabel':str(label),'value':label if label in [1,2,3,4] else None,'strokes':m.paths_from_bitmap(normalize_bitmap(images[i]))})
(root/('audit-numbers-final.json' if args.final else 'audit-numbers-confirmation.json')).write_text(json.dumps(rows,separators=(',',':')));print('Fresh confirmation',len(rows))
