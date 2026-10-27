"""Train small, fully local CNNs on EMNIST / Quick Draw; export plain tensors."""
import argparse
import hashlib
import gzip
import json
import math
from pathlib import Path
import time
import zipfile

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F


class InkNet(nn.Module):
    def __init__(self, classes):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 12, 3, padding=1)
        self.conv2 = nn.Conv2d(12, 24, 3, padding=1)
        self.dense = nn.Linear(24*7*7, 64)
        self.output = nn.Linear(64, classes)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)
        x = F.relu(self.dense(x.flatten(1)))
        return self.output(F.dropout(x, .15, training=self.training))


def augment(x, symbols, generator):
    n = len(x)
    r = torch.rand((n, 7), generator=generator)
    angle = (r[:, 0]-.5) * (2*math.pi if symbols else .65)
    scale = .8 + r[:, 1] * .4
    width = .85 + r[:, 2] * .3
    shear = (r[:, 3]-.5) * .3
    c, s = angle.cos() * scale, angle.sin() * scale
    matrix = torch.zeros((n, 2, 3))
    matrix[:, 0, 0] = c * width
    matrix[:, 0, 1] = -s + shear
    matrix[:, 1, 0] = s
    matrix[:, 1, 1] = c
    matrix[:, :, 2] = (r[:, 4:6]-.5) * .2
    result = F.grid_sample(x, F.affine_grid(matrix, x.size(), align_corners=False), align_corners=False)
    # Vary the apparent pen thickness in addition to slant, position and size.
    thick = r[:, 6] < .2
    if thick.any():
        result[thick] = F.max_pool2d(result[thick], 3, stride=1, padding=1)
    return result


@torch.no_grad()
def predict(model, x):
    model.eval()
    return torch.cat([model(batch).softmax(1) for batch in x.split(512)]).numpy()


def train(mode, root, output, epochs, uppercase=False, ink_style=False):
    seed = {'numbers': 141, 'letters': 142, 'symbols': 143}[mode]
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    source = np.load(root / ('shapes.npz' if mode == 'symbols' else 'characters.npz'))
    if mode == 'symbols':
        x, y = source['train_x'], source['train_y']
        vx, vy = source['validation_x'], source['validation_y']
        tx, ty = source['test_x'], source['test_y']
    else:
        x, y = source[mode+'_train_x'], source[mode+'_train_y']
        tx, ty = source[mode+'_test_x'], source[mode+'_test_y']
        if mode == 'letters' and uppercase:
            with zipfile.ZipFile(root/'emnist.zip') as archive:
                for split in ['train', 'test']:
                    name = next(n for n in archive.namelist() if n.endswith(f'emnist-byclass-{split}-labels-idx1-ubyte.gz'))
                    labels = np.frombuffer(gzip.decompress(archive.read(name)), np.uint8, offset=8)
                    mask = labels[source[mode+'_'+split+'_id']] < 36
                    if split == 'train': x, y = x[mask], y[mask]
                    else: tx, ty = tx[mask], ty[mask]
        # Validation comes exclusively from the source training partition.
        order = rng.permutation(len(x))
        cutoff = int(len(x)*.9)
        vx, vy = x[order[cutoff:]], y[order[cutoff:]]
        x, y = x[order[:cutoff]], y[order[:cutoff]]
    if ink_style:
        from skimage.morphology import skeletonize
        from prepare import raster
        def render_styles(images, labels, count):
            indexes = rng.permutation(len(images))[:count]
            rendered = []
            for index in indexes:
                yy, xx = np.where(skeletonize(images[index] > 64))
                rendered.append(raster([[[int(a), int(b)]] for a, b in zip(xx, yy)]))
            return np.array(rendered), labels[indexes]
        sx, sy = render_styles(x, y, 25000)
        svx, svy = render_styles(vx, vy, 5000)
        x, y = np.concatenate([x, sx]), np.concatenate([y, sy])
        vx, vy = np.concatenate([vx, svx]), np.concatenate([vy, svy])
        print('Added public-data ink renderings',len(sx),len(svx),flush=True)
    x, vx, tx = [torch.from_numpy(a.copy()).unsqueeze(1).float()/255 for a in [x, vx, tx]]
    y = torch.from_numpy(y.copy())
    classes = 5 if mode == 'symbols' else 10 if mode == 'numbers' else 26
    model = InkNet(classes)
    if ink_style:
        model.load_state_dict(torch.load(root/(mode+'.pt'), weights_only=True))
    optimizer = torch.optim.AdamW(model.parameters(), lr=.0005 if ink_style else .002, weight_decay=.005)
    generator = torch.Generator().manual_seed(seed)
    best = -1
    started = time.time()
    for epoch in range(epochs):
        model.train()
        order = torch.randperm(len(x), generator=generator)
        loss_sum = 0
        for indexes in order.split(256):
            images = augment(x[indexes], mode == 'symbols', generator)
            optimizer.zero_grad(set_to_none=True)
            loss = F.cross_entropy(model(images), y[indexes])
            loss.backward()
            optimizer.step()
            loss_sum += loss.item()*len(indexes)
        probabilities = predict(model, vx)
        accuracy = float((probabilities.argmax(1) == vy).mean())
        print(mode, epoch+1, 'loss', round(loss_sum/len(x), 4), 'validation', round(accuracy, 4), 'seconds', round(time.time()-started), flush=True)
        if accuracy > best:
            best = accuracy
            torch.save(model.state_dict(), root / (mode+'.pt'))
    model.load_state_dict(torch.load(root/(mode+'.pt'), weights_only=True))
    probabilities = predict(model, tx)
    np.savez_compressed(root/(mode+'-predictions.npz'), probabilities=probabilities, labels=ty)
    info = {
        'mode': mode, 'seed': seed, 'epochs': epochs, 'trainingSamples': len(x),
        'case': 'uppercase' if uppercase else 'mixed',
        'inkStyleFinetuning': ink_style,
        'validationSamples': len(vx), 'testSamples': len(tx), 'validationAccuracy': best,
        'testAccuracy': float((probabilities.argmax(1) == ty).mean()),
        'labels': ['circle', 'triangle', 'square', 'star', 'other'] if mode == 'symbols' else list('0123456789' if mode == 'numbers' else 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    }
    (root/(mode+'-metrics.json')).write_text(json.dumps(info, indent=2)+'\n')
    print(info, flush=True)
    return model, info


def export(root, output):
    output.mkdir(exist_ok=True, parents=True)
    buffer, models = bytearray(), {}
    for mode, classes in [('numbers', 10), ('letters', 26), ('symbols', 5)]:
        model = InkNet(classes)
        model.load_state_dict(torch.load(root/(mode+'.pt'), weights_only=True))
        weights = {}
        for name, tensor in model.state_dict().items():
            a = tensor.numpy().astype('<f4')
            weights[name] = {'offset': len(buffer)//4, 'shape': list(a.shape), 'length': a.size}
            buffer.extend(a.tobytes())
        labels = ['circle', 'triangle', 'square', 'star', 'other'] if mode == 'symbols' else list('0123456789' if mode == 'numbers' else 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
        models[mode] = {'weights': weights, 'labels': labels}
    (output/'weights.bin').write_bytes(buffer)
    metadata = {'format': 1, 'architecture': 'conv12-pool-conv24-pool-dense64', 'size': 28, 'extent': 20, 'thickness': 1.8,
                'weightsSha256': hashlib.sha256(buffer).hexdigest(), 'models': models}
    (output/'models.json').write_text(json.dumps(metadata, separators=(',', ':'))+'\n')
    print('exported', len(buffer), 'bytes', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=Path('/tmp/fino-ink-data'))
    parser.add_argument('--output', type=Path, default=Path('assets/ink-models'))
    parser.add_argument('--mode', choices=['numbers', 'letters', 'symbols', 'export'], required=True)
    parser.add_argument('--epochs', type=int, default=8)
    parser.add_argument('--uppercase', action='store_true')
    parser.add_argument('--ink-style', action='store_true')
    args = parser.parse_args()
    torch.set_num_threads(4)
    if args.mode == 'export':
        export(args.data, args.output)
    else:
        train(args.mode, args.data, args.output, args.epochs, args.uppercase, args.ink_style)
