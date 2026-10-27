"""Fine-tune a larger shape model on expanded native Quick Draw ink."""
import importlib.util,json,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from train import augment

root=Path('/tmp/fino-ink-v3');data=np.load(root/'shapes.npz')
spec=importlib.util.spec_from_file_location('letters_v2',Path(__file__).with_name('letters-v2.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
torch.set_num_threads(4);torch.manual_seed(3101)
model=module.LetterNet();model.load_state_dict(torch.load('/tmp/fino-ink-data/letters-v2.pt',weights_only=True));model.output=nn.Linear(128,5)
x=torch.from_numpy(data['train_x'].copy()).unsqueeze(1);y=torch.from_numpy(data['train_y'].copy())
vx=torch.from_numpy(data['validation_x'].copy()).unsqueeze(1);vy=data['validation_y']
optimizer=torch.optim.AdamW(model.parameters(),lr=.0007,weight_decay=.01)
generator=torch.Generator().manual_seed(3101);best=-1;log=[];start=time.time()
for epoch in range(8):
    model.train()
    if epoch==5:
        for group in optimizer.param_groups:group['lr']=.00025
    for indexes in torch.randperm(len(x),generator=generator).split(256):
        images=augment(x[indexes].float()/255,True,generator)
        optimizer.zero_grad(set_to_none=True);loss=F.cross_entropy(model(images),y[indexes]);loss.backward();optimizer.step()
    model.eval()
    with torch.no_grad():probabilities=torch.cat([model(batch.float()/255).softmax(1) for batch in vx.split(512)]).numpy()
    p=probabilities.argmax(1);recalls=[float((p[vy==label]==label).mean()) for label in range(4)];specificity=float((p[vy==4]==4).mean())
    metric=.8*min(recalls)+.2*specificity
    record={'epoch':epoch+1,'recalls':recalls,'specificity':specificity,'minimum':min(recalls),'seconds':round(time.time()-start)};log.append(record);print(record,flush=True)
    if metric>best:
        best=metric;torch.save(model.state_dict(),root/'symbols-v3.pt');np.savez_compressed(root/'symbols-v3-validation.npz',probabilities=probabilities,labels=vy)
(root/'symbols-v3-training.json').write_text(json.dumps({'seed':3101,'uniqueTraining':len(x),'validation':len(vx),'log':log},indent=2)+'\n')
