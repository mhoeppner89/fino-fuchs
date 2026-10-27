"""Expand EMNIST training and add only training-writer UJI examples."""
import gzip,json,zipfile
from pathlib import Path
import numpy as np
from prepare import normalize_bitmap,raster

root=Path('/tmp/fino-ink-v3');cache=Path('/tmp/fino-ink-data');z=zipfile.ZipFile(cache/'emnist.zip')
labels=np.frombuffer(gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-train-labels-idx1-ubyte.gz')))),np.uint8,offset=8)
images=np.frombuffer(gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-train-images-idx3-ubyte.gz')))),np.uint8,offset=16).reshape(-1,28,28).transpose(0,2,1)
old=np.load(cache/'characters.npz');letter_styles=np.load(cache/'letters-v2-data.npz')
uji=json.loads((root/'uji-train.json').read_text())
for mode in ['numbers','letters']:
    out=root/(mode+'-expanded.npz')
    if out.exists():continue
    previous_ids=old[mode+'_train_id'];previous_y=old[mode+'_train_y'];previous_x=old[mode+'_train_x']
    if mode=='letters':
        mask=labels[previous_ids]<36;previous_ids=previous_ids[mask];previous_y=previous_y[mask];previous_x=previous_x[mask]
    order=np.random.default_rng(142 if mode=='letters' else 141).permutation(len(previous_ids));cut=int(len(order)*.9)
    validation_ids=set(previous_ids[order[cut:]].tolist());known=set(previous_ids.tolist())
    selected=[]
    for label in range(10) if mode=='numbers' else range(10,36):
        ids=np.where(labels==label)[0];np.random.default_rng(10000+label).shuffle(ids)
        ids=ids[:16000] if mode=='numbers' else ids
        for index in ids:
            if index in validation_ids:continue
            if index not in known and index%10==0:continue # reserve new source-training validation
            selected.append(index)
    xs=np.stack([normalize_bitmap(images[i]) for i in selected]);ys=np.array([labels[i] if mode=='numbers' else labels[i]-10 for i in selected],dtype=np.int64)
    if mode=='letters':sx,sy=letter_styles['train_style'],letter_styles['train_y']
    else:sx,sy=old['numbers_train_x'][order[:cut]],old['numbers_train_y'][order[:cut]]
    native=[row for row in uji if row['mode']==mode]
    nx=np.stack([raster(row['strokes']) for row in native]);ny=np.array([int(row['label']) if mode=='numbers' else ord(row['label'])-65 for row in native],dtype=np.int64)
    np.savez_compressed(out,raw=xs,y=ys,style=sx,style_y=sy,native=nx,native_y=ny,ids=np.array(selected))
    print(mode,'raw',len(xs),'style',len(sx),'native',len(nx),flush=True)
