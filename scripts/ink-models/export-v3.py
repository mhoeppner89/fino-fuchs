"""Export selected validation-only checkpoints to local JavaScript tensors."""
import argparse,base64,hashlib,importlib.util,json
from pathlib import Path
import numpy as np
import torch
from torch import nn
parser=argparse.ArgumentParser();parser.add_argument('--letters',type=int,default=5);parser.add_argument('--numbers',type=int,default=7);parser.add_argument('--symbols',type=int,default=7);args=parser.parse_args()
root=Path('/tmp/fino-ink-v3');destination=root/'export';destination.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
torch.set_num_threads(2);buffer=bytearray();models={};policies={};checkpoints={};parity=json.loads(Path('tests/fixtures/ink-network-parity.json').read_text())
ensemble=args.letters==508
parity=[row for row in parity if row['mode']!='letterAux']
if ensemble:parity.append({**next(row for row in parity if row['mode']=='letters'),'mode':'letterAux'})
for mode in ['numbers','letters','symbols']+(['letterAux'] if ensemble else []):
 epoch=26 if mode=='letterAux' else getattr(args,mode);checkpoint=Path('/tmp/fino-ink-data/letters-v2.pt') if mode=='letterAux' else root/f'{mode}-v3-epoch{8 if mode=="letters" and ensemble else epoch}.pt';state=torch.load(checkpoint,weights_only=True)
 model=module.LetterNet();model.output=nn.Linear(128,26 if mode=='letterAux' else 5);model.load_state_dict(state);model.eval()
 labels=[chr(i+65) for i in range(26)] if mode=='letterAux' else ['1','2','3','4','other'] if mode=='numbers' else ['A','B','C','D','other'] if mode=='letters' else ['circle','triangle','square','star','other']
 description={'labels':labels,'channels':[24,48,48],'hidden':128,'weights':{}}
 for name,tensor in state.items():
  array=tensor.numpy().astype('<f4');description['weights'][name]={'offset':len(buffer)//4,'shape':list(array.shape),'length':array.size};buffer.extend(array.tobytes())
 models[mode]=description
 if mode!='letterAux':policies[mode]=json.loads((root/f'{mode}-epoch{epoch}-policy.json').read_text())['policy']
 if mode=='letters' and ensemble:policies[mode]['views']=[{'model':'letters','thickness':1.8},{'model':'letterAux','thickness':1.2}]
 checkpoints[mode]={'epoch':epoch,'sha256':hashlib.sha256(checkpoint.read_bytes()).hexdigest()}
 for row in parity:
  if row['mode']!=mode:continue
  x=np.frombuffer(base64.b64decode(row['pixels']),np.uint8).copy().reshape(1,1,28,28)
  with torch.no_grad():row['probabilities']=model(torch.from_numpy(x).float()/255).softmax(1)[0].tolist()
metadata={'format':2,'architecture':'mixed-cnn','size':28,'extent':20,'thickness':1.8,'weightsSha256':hashlib.sha256(buffer).hexdigest(),'models':models,'policies':policies}
(destination/'weights.bin').write_bytes(buffer);(destination/'models.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n');(destination/'checkpoints.json').write_text(json.dumps(checkpoints,indent=2)+'\n');(destination/'parity.json').write_text(json.dumps(parity,separators=(',',':'))+'\n')
print('Exported',len(buffer),'bytes',metadata['weightsSha256'])
