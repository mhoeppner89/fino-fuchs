"""Stronger offline letter candidate; train/choose only on EMNIST train data."""
import argparse
import gzip
import json
from pathlib import Path
import time
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
import torch
from torch import nn
from torch.nn import functional as F
from train import augment, predict


class LetterNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 24, 3, padding=1)
        self.conv2 = nn.Conv2d(24, 48, 3, padding=1)
        self.conv3 = nn.Conv2d(48, 48, 3, padding=1)
        self.dense = nn.Linear(48*7*7, 128)
        self.output = nn.Linear(128, 26)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)
        x = F.relu(self.conv3(x))
        x = F.relu(self.dense(x.flatten(1)))
        return self.output(F.dropout(x, .2, training=self.training))


def paths_from_bitmap(image):
    yy, xx = np.where(skeletonize(image > 64))
    nodes = set(zip(xx.tolist(), yy.tolist()))
    adjacent = {p: [(p[0]+dx,p[1]+dy) for dy in [-1,0,1] for dx in [-1,0,1]
                    if (dx or dy) and (p[0]+dx,p[1]+dy) in nodes] for p in nodes}
    visited, result = set(), []
    for start in sorted(nodes, key=lambda p:(len(adjacent[p])==2,p)):
        if not adjacent[start]: result.append([start])
        for neighbor in adjacent[start]:
            edge = frozenset([start,neighbor])
            if edge in visited: continue
            visited.add(edge)
            path = [start,neighbor]
            while len(adjacent[path[-1]])==2:
                nxt = next(p for p in adjacent[path[-1]] if p!=path[-2])
                edge = frozenset([path[-1],nxt])
                if edge in visited: break
                visited.add(edge);path.append(nxt)
            result.append(path)
    return result


def render_style(image, thickness):
    from prepare import raster
    return raster(paths_from_bitmap(image), thickness=thickness)


def prepare(root):
    path = root/'letters-v2-data.npz'
    if path.exists(): return np.load(path)
    source = np.load(root/'characters.npz')
    with zipfile.ZipFile(root/'emnist.zip') as archive:
        name = next(n for n in archive.namelist() if n.endswith('emnist-byclass-train-labels-idx1-ubyte.gz'))
        labels = np.frombuffer(gzip.decompress(archive.read(name)),np.uint8,offset=8)
    mask = labels[source['letters_train_id']] < 36
    images, targets, ids = source['letters_train_x'][mask], source['letters_train_y'][mask], source['letters_train_id'][mask]
    rng = np.random.default_rng(142)
    order = rng.permutation(len(images)); cutoff = int(len(images)*.9)
    output = {}
    for name,indexes in [('train',order[:cutoff]),('validation',order[cutoff:])]:
        x = images[indexes]
        styles = np.empty_like(x)
        for i, image in enumerate(x):
            styles[i] = render_style(image, 1.1+((i*37)%101)/100)
            if i%20000==0: print('prepare',name,i,flush=True)
        output[name+'_raw'], output[name+'_style'] = x, styles
        output[name+'_y'], output[name+'_id'] = targets[indexes], ids[indexes]
    np.savez_compressed(path,**output)
    return np.load(path)


def train(root, epochs):
    data = prepare(root)
    torch.manual_seed(2710)
    torch.set_num_threads(4)
    raw, style, validation = [torch.from_numpy(data[k].copy()).unsqueeze(1).float()/255 for k in ['train_raw','train_style','validation_style']]
    targets = torch.from_numpy(data['train_y'].copy())
    model = LetterNet()
    optimizer = torch.optim.AdamW(model.parameters(),lr=.0015,weight_decay=.01)
    generator = torch.Generator().manual_seed(2710)
    best = -1
    started = time.time()
    class_weights = torch.ones(26);class_weights[:4] = 1.75
    log = []
    for epoch in range(epochs):
        model.train()
        if epoch==8:
            for group in optimizer.param_groups: group['lr'] = .0005
        order = torch.randperm(len(raw),generator=generator)
        for indexes in order.split(256):
            take_style = torch.rand((len(indexes),1,1,1),generator=generator)<.7
            images = torch.where(take_style,style[indexes],raw[indexes])
            images = augment(images,False,generator)
            optimizer.zero_grad(set_to_none=True)
            loss = F.cross_entropy(model(images),targets[indexes],weight=class_weights)
            loss.backward();optimizer.step()
        probabilities = predict(model,validation)
        y = data['validation_y'];p = probabilities.argmax(1); positive = y<4
        # Classifier quality with a balanced cost for target and other letters.
        recall = float((p[positive]==y[positive]).mean())
        specificity = float((p[~positive]>=4).mean())
        balanced = (recall+specificity)/2
        record = {'epoch':epoch+1,'recall':recall,'specificity':specificity,'balanced':balanced,'seconds':round(time.time()-started)}
        log.append(record);print(record,flush=True)
        if balanced>best:
            best = balanced
            torch.save(model.state_dict(),root/'letters-v2.pt')
    model.load_state_dict(torch.load(root/'letters-v2.pt',weights_only=True))
    probabilities = predict(model,validation)
    np.savez_compressed(root/'letters-v2-validation.npz',probabilities=probabilities,labels=data['validation_y'],ids=data['validation_id'])
    (root/'letters-v2-training.json').write_text(json.dumps({'seed':2710,'epochs':epochs,'trainingUniqueImages':len(raw),'validationUniqueImages':len(validation),'log':log},indent=2)+'\n')


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data',type=Path,default=Path('/tmp/fino-ink-data'))
    parser.add_argument('--epochs',type=int,default=12)
    args = parser.parse_args()
    train(args.data,args.epochs)
