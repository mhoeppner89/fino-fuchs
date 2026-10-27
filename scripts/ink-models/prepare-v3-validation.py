"""Build development corpora; native writer audit remains separate."""
import importlib.util,json
from pathlib import Path
import numpy as np

root=Path('/tmp/fino-ink-v3');cache=Path('/tmp/fino-ink-data')
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
native=json.loads((root/'uji-validation.json').read_text())
letters=json.loads((cache/'letter-validation.json').read_text())+[r for r in native if r['mode']=='letters']
(root/'validation-letters.json').write_text(json.dumps(letters,separators=(',',':')))
data=np.load(cache/'characters.npz');x,y,ids=data['numbers_train_x'],data['numbers_train_y'],data['numbers_train_id']
order=np.random.default_rng(141).permutation(len(x));indexes=order[int(len(x)*.9):]
numbers=[]
for i in indexes:
    numbers.append({'source':'emnist-skeleton','id':'digit-train-'+str(ids[i]),'mode':'numbers','value':int(y[i]) if 1<=y[i]<=4 else None,'sourceLabel':int(y[i]),'strokes':module.paths_from_bitmap(x[i])})
numbers.extend(r for r in native if r['mode']=='numbers')
(root/'validation-numbers.json').write_text(json.dumps(numbers,separators=(',',':')))
print('validation letters',len(letters),'numbers',len(numbers),flush=True)
