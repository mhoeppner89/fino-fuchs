"""Improve pen-style robustness and teach rejection of non-character doodles.
All examples come from training partitions; no test or validation examples.
"""
import argparse,importlib.util,json,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from prepare import raster,SHAPES,DISTRACTORS
from train import augment
p=argparse.ArgumentParser();p.add_argument('--mode',required=True);args=p.parse_args();mode=args.mode
root=Path('/tmp/fino-ink-v3');spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
torch.set_num_threads(2);torch.manual_seed({'numbers':3113,'letters':3112,'symbols':3111}[mode]);g=torch.Generator().manual_seed(3111)
model=m.LetterNet();model.output=nn.Linear(128,5);model.load_state_dict(torch.load(root/f'{mode}-v3-epoch{7 if mode=="symbols" else 8}.pt',weights_only=True))
if mode=='symbols':
 data=np.load(root/'shapes.npz');sets=[(data['train_x'],data['train_y'])];weights=None
else:
 data=np.load(root/(mode+'-expanded.npz'))
 def encode(y):return np.where((y>=1)&(y<=4),y-1,4) if mode=='numbers' else np.where(y<4,y,4)
 sets=[(data[a],encode(data[b])) for a,b in [('raw','y'),('style','style_y'),('native','native_y')]]
 labels=sets[0][1];weights=torch.ones(5);weights[:4]=float((labels==4).sum())/max(1,float((labels!=4).sum()))
 extra=root/(mode+'-doodles.npz')
 if not extra.exists():
  images=[]
  for name in DISTRACTORS:
   if name=='line':continue
   rows=json.loads((root/'quickdraw'/(name.replace(' ','_')+'.json')).read_text())
   for row in rows[1800:2800]:images.append(raster(row['strokes']))
  np.savez_compressed(extra,x=np.stack(images))
 sets.append((np.load(extra)['x'],np.full(len(np.load(extra)['x']),4,dtype=np.int64)))
 if mode=='numbers':
  style=root/'numbers-pen-style.npz'
  if not style.exists():
   rng=np.random.default_rng(3113);indexes=rng.permutation(len(data['raw']))[:24000]
   raw_images=data['raw'];raw_labels=data['y']
   images=np.stack([raster(m.paths_from_bitmap(raw_images[i])) for i in indexes]);np.savez_compressed(style,x=images,y=encode(raw_labels[indexes]))
  d=np.load(style);sets[1]=(d['x'],d['y'])
sets=[(torch.from_numpy(x.copy()).unsqueeze(1),torch.from_numpy(y.copy())) for x,y in sets]
opt=torch.optim.AdamW(model.parameters(),lr=.00012,weight_decay=.01);start=time.time()
for epoch in range(9,13):
 model.train();raw,raw_y=sets[0]
 for idx in torch.randperm(len(raw),generator=g).split(256):
  x,y=raw[idx].clone(),raw_y[idx].clone()
  if mode!='symbols':
   for which,fraction in [(1,.3),(2,.2),(3,.12)]:
    mask=torch.rand(len(idx),generator=g)<fraction;s,sy=sets[which];choices=torch.randint(len(s),(int(mask.sum()),),generator=g);x[mask]=s[choices];y[mask]=sy[choices]
  x=augment(x.float()/255,mode=='symbols',g)
  if mode=='symbols':
   # Broader slant/proportion variation without introducing rotated letters.
   shear=(torch.rand(len(x),generator=g)-.5)*.45;matrix=torch.zeros((len(x),2,3));matrix[:,0,0]=1;matrix[:,1,1]=1;matrix[:,0,1]=shear
   x=F.grid_sample(x,F.affine_grid(matrix,x.size(),align_corners=False),align_corners=False)
  opt.zero_grad(set_to_none=True);loss=F.cross_entropy(model(x),y,weight=weights);loss.backward();opt.step()
 torch.save(model.state_dict(),root/f'{mode}-v3-epoch{epoch}.pt');print(mode,epoch,round(time.time()-start),flush=True)
