"""Score the exact JS-rendered pen images with the trained candidate."""
import argparse
import importlib.util
from pathlib import Path
import json
import numpy as np
import torch
from train import predict

parser=argparse.ArgumentParser();parser.add_argument('--audit',action='store_true');parser.add_argument('--thin',action='store_true');args=parser.parse_args()
root=Path('/tmp/fino-ink-data');name=('letter-audit-v2' if args.audit else 'letter-validation')+('-thin' if args.thin else '')
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
torch.set_num_threads(4)
model=module.LetterNet();model.load_state_dict(torch.load(root/'letters-v2.pt',weights_only=True))
images=np.fromfile(root/(name+'-images.f32'),dtype='<f4').reshape(-1,1,28,28)
probabilities=predict(model,torch.from_numpy(images))
(root/(name+'-probabilities.json')).write_text(json.dumps(probabilities.tolist(),separators=(',',':')))
print('Scored',len(images),name,'examples')
