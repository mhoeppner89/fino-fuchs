"""Task-specific 4+other heads, with all source classes retained as negatives."""
import argparse,importlib.util,json,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from train import augment

parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['numbers','letters'],required=True);args=parser.parse_args()
root=Path('/tmp/fino-ink-v3');mode=args.mode;data=np.load(root/(mode+'-expanded.npz'))
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
torch.set_num_threads(2);torch.manual_seed(3102 if mode=='letters' else 3103)
model=module.LetterNet();model.load_state_dict(torch.load('/tmp/fino-ink-data/letters-v2.pt',weights_only=True));model.output=nn.Linear(128,5)
def encode(y):return np.where((y>=1)&(y<=4),y-1,4) if mode=='numbers' else np.where(y<4,y,4)
sets=[]
for xkey,ykey in [('raw','y'),('style','style_y'),('native','native_y')]:sets.append((torch.from_numpy(data[xkey].copy()).unsqueeze(1),torch.from_numpy(encode(data[ykey]).copy())))
optimizer=torch.optim.AdamW(model.parameters(),lr=.0005,weight_decay=.01);generator=torch.Generator().manual_seed(3102 if mode=='letters' else 3103)
raw_labels=sets[0][1];class_weights=torch.ones(5);class_weights[:4]=float((raw_labels==4).sum())/max(1,float((raw_labels!=4).sum()))
start=time.time();logs=[]
for epoch in range(8):
    model.train()
    if epoch==5:
        for group in optimizer.param_groups:group['lr']=.00015
    raw,raw_y=sets[0]
    for indexes in torch.randperm(len(raw),generator=generator).split(256):
        x,y=raw[indexes].clone(),raw_y[indexes].clone()
        # Native pen trajectories recur with fresh geometric augmentation.
        for which,fraction in [(1,.25),(2,.2)]:
            mask=torch.rand(len(indexes),generator=generator)<fraction;source,source_y=sets[which]
            choices=torch.randint(len(source),(int(mask.sum()),),generator=generator)
            x[mask]=source[choices];y[mask]=source_y[choices]
        x=augment(x.float()/255,False,generator)
        optimizer.zero_grad(set_to_none=True);loss=F.cross_entropy(model(x),y,weight=class_weights);loss.backward();optimizer.step()
    torch.save(model.state_dict(),root/(mode+'-v3-epoch'+str(epoch+1)+'.pt'))
    record={'epoch':epoch+1,'seconds':round(time.time()-start)};logs.append(record);print(mode,record,flush=True)
(root/(mode+'-v3-training.json')).write_text(json.dumps({'mode':mode,'rawSamples':len(raw),'styleSamples':len(sets[1][0]),'nativeSamples':len(sets[2][0]),'epochs':8,'log':logs},indent=2)+'\n')
