"""Evaluate the existing 26-class letter model with the new decoder fairly."""
import importlib.util,json
from pathlib import Path
import numpy as np
import torch
from train import predict
root=Path('/tmp/fino-ink-v3');spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
torch.set_num_threads(2);model=m.LetterNet();model.load_state_dict(torch.load('/tmp/fino-ink-data/letters-v2.pt',weights_only=True))
for view in ['normal','thin']:
 x=np.fromfile(root/f'validation-letters-{view}.f32',dtype='<f4').reshape(-1,1,28,28);p=predict(model,torch.from_numpy(x));p=np.column_stack([p[:,:4],p[:,4:].sum(1)])
 (root/f'validation-letters-epoch26-{view}.json').write_text(json.dumps(p.tolist(),separators=(',',':')))
print('Scored previous 26-class model with the same inputs')
