"""Train on general flagged-1 forms, including rounded heads without feet.
No validation or audit trajectories are included in these generated examples.
"""
import argparse,importlib.util,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from prepare import raster
from train import augment
p=argparse.ArgumentParser();p.add_argument('--prepare-only',action='store_true');p.add_argument('--paired',action='store_true');p.add_argument('--start',type=int,default=9);p.add_argument('--first',type=int,default=13);p.add_argument('--epochs',type=int,default=4);args=p.parse_args()
root=Path('/tmp/fino-ink-v3');rng=np.random.default_rng(3120);cache=root/'synthetic-ones-v2.npz'
if not cache.exists():
 images=[]
 for _ in range(10000):
  width=rng.uniform(18,58);rise=rng.uniform(max(18,width*.5),min(42,np.sqrt(70**2-width**2)));lean=rng.uniform(-12,12);rounding=rng.uniform(0,9)
  if rng.random()<.6:
   a=np.array([-width,rise]);b=np.array([-width*.55,rise*.9]);c=np.array([-rounding,-rounding*.3]);d=np.array([0,rounding]);t=np.linspace(0,1,20)[:,None];head=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
  else:head=np.array([[-width,rise],[0,0]])
  stem=np.array([[lean*t,100*t]for t in np.linspace(max(.02,rounding/100),1,25)])
  path=np.vstack([head,stem]);path+=rng.normal(0,.35,path.shape)
  strokes=[path.tolist()]
  if rng.random()<.2:strokes.append([[lean-25,100],[lean+30,100]])
  images.append(raster(strokes,thickness=rng.uniform(1.1,2.1)))
 np.savez_compressed(cache,x=np.stack(images));print('Prepared 10000 generated flag forms',flush=True)
if args.prepare_only:raise SystemExit
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
torch.set_num_threads(4);torch.manual_seed(3120);g=torch.Generator().manual_seed(3120)
model=m.LetterNet();model.output=nn.Linear(128,5);model.load_state_dict(torch.load(root/f'numbers-v3-epoch{args.start}.pt',weights_only=True))
data=np.load(root/'numbers-expanded.npz')
def encode(y):return np.where((y>=1)&(y<=4),y-1,4)
style=np.load(root/'numbers-pen-style.npz');doodles=np.load(root/'numbers-doodles.npz')['x'];pairs=np.load(root/'synthetic-one-seven-pairs-v2.npz') if args.paired else None;flags=pairs['x'] if args.paired else np.load(cache)['x'];flag_y=pairs['y'] if args.paired else np.zeros(len(flags),dtype=np.int64)
sets=[(data['raw'],encode(data['y'])),(style['x'],style['y']),(data['native'],encode(data['native_y'])),(doodles,np.full(len(doodles),4,dtype=np.int64)),(flags,flag_y)]
sets=[(torch.from_numpy(x.copy()).unsqueeze(1),torch.from_numpy(y.copy()))for x,y in sets];weights=torch.ones(5);weights[:4]=float((sets[0][1]==4).sum())/float((sets[0][1]!=4).sum())
opt=torch.optim.AdamW(model.parameters(),lr=.0001,weight_decay=.01);start=time.time()
for epoch in range(args.first,args.first+args.epochs):
 model.train();raw,raw_y=sets[0]
 for idx in torch.randperm(len(raw),generator=g).split(256):
  x,y=raw[idx].clone(),raw_y[idx].clone()
  for which,fraction in[(1,.3),(2,.2),(3,.12),(4,.14 if args.paired else .07)]:
   mask=torch.rand(len(idx),generator=g)<fraction;s,sy=sets[which];chosen=torch.randint(len(s),(int(mask.sum()),),generator=g);x[mask]=s[chosen];y[mask]=sy[chosen]
  x=augment(x.float()/255,False,g);opt.zero_grad(set_to_none=True);loss=F.cross_entropy(model(x),y,weight=weights);loss.backward();opt.step()
 torch.save(model.state_dict(),root/f'numbers-v3-epoch{epoch}.pt');print('numbers',epoch,round(time.time()-start),flush=True)
