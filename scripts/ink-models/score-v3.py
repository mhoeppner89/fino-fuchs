import argparse,importlib.util,json
from pathlib import Path
import numpy as np
import torch
from torch import nn
from train import predict
parser=argparse.ArgumentParser();parser.add_argument('--mode',required=True);parser.add_argument('--epoch',type=int);parser.add_argument('--split',default='validation');args=parser.parse_args()
root=Path('/tmp/fino-ink-v3');mode=args.mode
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
torch.set_num_threads(2);model=module.LetterNet();model.output=nn.Linear(128,5)
checkpoint=mode+'-v3'+('-epoch'+str(args.epoch) if args.epoch else '')+'.pt'
model.load_state_dict(torch.load(root/checkpoint,weights_only=True))
for view in ['normal']+(['thin'] if mode!='symbols' else []):
 images=np.fromfile(root/f'{args.split}-{mode}-{view}.f32',dtype='<f4').reshape(-1,1,28,28)
 probabilities=predict(model,torch.from_numpy(images))
 np.save(root/f'{args.split}-{mode}-epoch{args.epoch or 0}-{view}.npy',probabilities)
 (root/f'{args.split}-{mode}-epoch{args.epoch or 0}-{view}.json').write_text(json.dumps(probabilities.tolist(),separators=(',',':')))
 print('Scored',mode,args.split,view,len(images),flush=True)
