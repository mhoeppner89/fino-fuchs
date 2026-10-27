"""Replace only the letter tensors, preserving published digits/shapes exactly."""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
import torch

root=Path('/tmp/fino-ink-data'); previous=Path('/tmp/fino-letter-v154')
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
model=module.LetterNet();model.load_state_dict(torch.load(root/'letters-v2.pt',weights_only=True))
old=json.loads((previous/'models.json').read_text()); old_bytes=(previous/'weights.bin').read_bytes()
buffer=bytearray();models={}
for mode in ['numbers','letters','symbols']:
    description={'labels':old['models'][mode]['labels'],'weights':{}}
    if mode=='letters':
        description.update(channels=[24,48,48],hidden=128)
        tensors={name:array.numpy().astype('<f4') for name,array in model.state_dict().items()}
    else:
        description.update(channels=[12,24],hidden=64)
        tensors={name:np.frombuffer(old_bytes,dtype='<f4',count=entry['length'],offset=entry['offset']*4).reshape(entry['shape']) for name,entry in old['models'][mode]['weights'].items()}
    for name,array in tensors.items():
        description['weights'][name]={'offset':len(buffer)//4,'shape':list(array.shape),'length':array.size}
        buffer.extend(array.tobytes())
    models[mode]=description
metadata={**old,'format':2,'architecture':'mixed-cnn','models':models,'weightsSha256':hashlib.sha256(buffer).hexdigest()}
metadata['policies']['letters']={'confidence':.5,'margin':0,'templateConfidence':.98}
destination=root/'letters-v2-export';destination.mkdir(exist_ok=True)
(destination/'weights.bin').write_bytes(buffer)
(destination/'models.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n')
print('Candidate export',len(buffer),'bytes')
