"""Training-only missing-contour negatives, made from analytic geometric shapes."""
import argparse
from pathlib import Path
import numpy as np
from prepare import raster
parser=argparse.ArgumentParser();parser.add_argument('--silhouette-only',action='store_true');args=parser.parse_args()
root=Path('/tmp/fino-ink-v3');rng=np.random.default_rng(3114);images=[]
for shape in range(4):
 for example in range(4000):
  if shape==0:
   t=np.linspace(0,2*np.pi,81);path=np.column_stack([np.cos(t),np.sin(t)])
  elif shape==1:path=np.array([[0,-1],[.866,.5],[-.866,.5],[0,-1]])
  elif shape==2:path=np.array([[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]])
  elif example%2 and not args.silhouette_only:
   t=np.arange(6)*4*np.pi/5-np.pi/2;path=np.column_stack([np.cos(t),np.sin(t)])
  else:
   t=np.arange(11)*np.pi/5-np.pi/2;radius=np.where(np.arange(11)%2,.4,1);path=np.column_stack([np.cos(t)*radius,np.sin(t)*radius])
  # Uniform arclength makes the omitted fraction independent of point density.
  lengths=np.linalg.norm(np.diff(path,axis=0),axis=1);cum=np.r_[0,lengths.cumsum()];distance=np.linspace(0,cum[-1],121)
  path=np.column_stack([np.interp(distance,cum,path[:,axis]) for axis in range(2)])[:-1]
  cut=int(rng.uniform(.25,.5)*len(path));start=rng.integers(len(path));path=np.roll(path,start,axis=0)[:-cut]
  a=rng.uniform(0,2*np.pi);matrix=np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
  path=path@matrix;path[:,0]*=rng.uniform(.7,1.3);path+=rng.normal(0,.015,path.shape)
  images.append(raster([path.tolist()]))
np.savez_compressed(root/'partial-shapes.npz',x=np.stack(images));print(len(images),'training-only partial outlines')
