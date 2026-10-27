"""Evaluate the existing DoodleNet weights locally, without modifying them."""
import json
import argparse
from pathlib import Path
import numpy as np
import torch
from torch import nn
from train import predict

root = Path('/tmp/fino-ink-data')
torch.set_num_threads(4)
metadata = json.loads((root/'doodlenet.json').read_text())
weights = np.frombuffer((root/'doodlenet.bin').read_bytes(), dtype='<f4')
parameters, offset = {}, 0
for entry in metadata['weightsManifest'][0]['weights']:
    size = int(np.prod(entry['shape']))
    parameters[entry['name']] = weights[offset:offset+size].reshape(entry['shape'])
    offset += size


class DoodleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList()
        self.kinds = []
        for layer in metadata['modelTopology']['model_config']['config']['layers']:
            kind, config = layer['class_name'], layer['config']
            name = config['name']
            if kind == 'Conv2D':
                kernel = parameters[name+'/kernel']
                module = nn.Conv2d(kernel.shape[2], kernel.shape[3], 3, padding=1)
                module.weight.data.copy_(torch.from_numpy(kernel.transpose(3, 2, 0, 1).copy()))
                module.bias.data.copy_(torch.from_numpy(parameters[name+'/bias'].copy()))
            elif kind == 'Dense':
                kernel = parameters[name+'/kernel']
                module = nn.Linear(*kernel.shape)
                module.weight.data.copy_(torch.from_numpy(kernel.T.copy()))
                module.bias.data.copy_(torch.from_numpy(parameters[name+'/bias'].copy()))
            else:
                module = nn.Identity()
            self.layers.append(module)
            self.kinds.append((kind, config))

    def forward(self, x):
        for module, (kind, config) in zip(self.layers, self.kinds):
            if kind == 'MaxPooling2D':
                x = nn.functional.max_pool2d(x, 2)
            elif kind == 'Flatten':
                x = x.permute(0, 2, 3, 1).flatten(1)
            elif kind in ['Conv2D', 'Dense']:
                x = module(x)
                activation = config['activation']
                if activation == 'relu':
                    x = x.relu()
                elif activation == 'tanh':
                    x = x.tanh()
                # Return logits; predict() applies the final softmax.
        return x


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--final', action='store_true')
    parser.add_argument('--extent', type=int, default=26)
    args = parser.parse_args()
    if args.final:
        from prepare import raster
        rows = [r for r in json.loads((root/'benchmark-final.json').read_text()) if r['mode']=='symbols']
        x = torch.from_numpy(np.stack([raster(r['strokes'], extent=args.extent) for r in rows])).unsqueeze(1).float()/255
        probabilities = predict(DoodleNet(), x)
        names = json.loads((root/'doodlenet-labels.json').read_text())
        values = {name:i+1 for i,name in enumerate(['circle','triangle','square','star'])}
        results = {str(row['id']):values.get(names[index]) for row,index in zip(rows, probabilities.argmax(1))}
        (root/'doodlenet-final.json').write_text(json.dumps(results))
        print('DoodleNet audit',len(rows),'extent',args.extent)
        raise SystemExit(0)
    data = np.load(root/'shapes.npz')
    model = DoodleNet()
    for split in ['validation', 'test']:
        x = torch.from_numpy(data[split+'_x'].copy()).unsqueeze(1).float()/255
        probabilities = predict(model, x)
        np.savez_compressed(root/('doodlenet-'+split+'.npz'), probabilities=probabilities, ids=data[split+'_id'])
        print('DoodleNet', split, len(x), flush=True)
