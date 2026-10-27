"""Fine-tune outline completeness on separate, generated training negatives."""
import argparse,importlib.util,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from train import augment
p=argparse.ArgumentParser();p.add_argument('--start',type=int,default=12);p.add_argument('--epochs',type=int,default=3);args=p.parse_args()
root=Path('/tmp/fino-ink-v3');torch.set_num_threads(2);torch.manual_seed(3114);g=torch.Generator().manual_seed(3114)
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
model=m.LetterNet();model.output=nn.Linear(128,5);model.load_state_dict(torch.load(root/f'symbols-v3-epoch{args.start}.pt',weights_only=True))
data=np.load(root/'shapes.npz');x=torch.from_numpy(data['train_x'].copy()).unsqueeze(1);y=torch.from_numpy(data['train_y'].copy());partial=torch.from_numpy(np.load(root/'partial-shapes.npz')['x']).unsqueeze(1)
opt=torch.optim.AdamW(model.parameters(),lr=.00008,weight_decay=.01);start=time.time()
for epoch in range(args.start+1,args.start+1+args.epochs):
 model.train()
 for idx in torch.randperm(len(x),generator=g).split(256):
  images,labels=x[idx].clone(),y[idx].clone();mask=torch.rand(len(idx),generator=g)<.12;choices=torch.randint(len(partial),(int(mask.sum()),),generator=g);images[mask]=partial[choices];labels[mask]=4
  images=augment(images.float()/255,True,g);opt.zero_grad(set_to_none=True);loss=F.cross_entropy(model(images),labels);loss.backward();opt.step()
 torch.save(model.state_dict(),root/f'symbols-v3-epoch{epoch}.pt');print('symbols',epoch,round(time.time()-start),flush=True)
