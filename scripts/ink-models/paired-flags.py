"""Balanced, training-only analytic 1/7 examples; no test trajectories."""
from pathlib import Path
import numpy as np
from prepare import raster
root=Path('/tmp/fino-ink-v3');rng=np.random.default_rng(3121);ones=np.load(root/'synthetic-ones-v2.npz')['x'];images=[]
for _ in range(10000):
 width=0;bottom=0
 while width/max(1,np.hypot(width-bottom,100))<.75:
  width=rng.uniform(85,120);bottom=rng.uniform(width*.15,width*.6)
 rise=rng.uniform(-3,4)
 top=np.array([[0,rise],[width,0]])
 t=np.linspace(0,1,28)[:,None];a=np.array([width,0]);b=np.array([width*.93,23]);c=np.array([bottom+10,75]);d=np.array([bottom,100]);leg=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
 path=np.vstack([top,leg[1:]])+rng.normal(0,.3,(29,2));strokes=[path.tolist()]
 if rng.random()<.2:strokes.append([[bottom-15,55],[width*.8,55]])
 images.append(raster(strokes,thickness=rng.uniform(1.1,2.1)))
np.savez_compressed(root/'synthetic-one-seven-pairs-v2.npz',x=np.concatenate([ones,np.stack(images)]),y=np.r_[np.zeros(len(ones),dtype=np.int64),np.full(len(images),4,dtype=np.int64)])
print('Prepared 20000 paired 1/7 examples')
