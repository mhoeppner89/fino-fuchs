"""Choose abstention thresholds on validation data only, never the test set."""
import gzip
import json
from pathlib import Path
import zipfile
import numpy as np
import torch
from train import InkNet, predict

root = Path('/tmp/fino-ink-data')
torch.set_num_threads(4)
policies = {}
for mode, classes, seed in [('numbers', 10, 141), ('letters', 26, 142), ('symbols', 5, 143)]:
    data = np.load(root/('shapes.npz' if mode == 'symbols' else 'characters.npz'))
    if mode == 'symbols':
        x, y = data['validation_x'], data['validation_y']
    else:
        x, y = data[mode+'_train_x'], data[mode+'_train_y']
        if mode == 'letters':
            with zipfile.ZipFile(root/'emnist.zip') as z:
                raw = gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-train-labels-idx1-ubyte.gz'))))
            labels = np.frombuffer(raw, np.uint8, offset=8)
            mask = labels[data['letters_train_id']] < 36
            x, y = x[mask], y[mask]
        rng = np.random.default_rng(seed)
        order = rng.permutation(len(x))
        validation = order[int(len(x)*.9):]
        training_length = int(len(x)*.9)
        x, y = x[validation], y[validation]
        if mode == 'letters':
            from prepare import raster
            from skimage.morphology import skeletonize
            rng.permutation(training_length)  # same training-style selection
            indexes = rng.permutation(len(x))[:5000]
            rendered = []
            for index in indexes:
                yy, xx = np.where(skeletonize(x[index] > 64))
                rendered.append(raster([[[int(a),int(b)]] for a,b in zip(xx,yy)]))
            x, y = np.concatenate([x, np.array(rendered)]), np.concatenate([y,y[indexes]])
    model = InkNet(classes)
    model.load_state_dict(torch.load(root/(mode+'.pt'), weights_only=True))
    probabilities = predict(model, torch.from_numpy(x.copy()).unsqueeze(1).float()/255)
    labels = probabilities.argmax(1)
    ordered = np.sort(probabilities, axis=1)
    confidence, margin = ordered[:, -1], ordered[:, -1]-ordered[:, -2]
    targets = [1, 2, 3, 4] if mode == 'numbers' else [0, 1, 2, 3]
    positive = np.isin(y, targets)
    winner, best = None, -1
    for threshold in [.35, .45, .5, .55, .6, .65, .7, .75, .8, .85, .9]:
        for gap in [0, .05, .1, .15]:
            accepted = np.isin(labels, targets) & (confidence >= threshold) & (margin >= gap)
            correct = accepted & (labels == y)
            recall = float(correct[positive].mean())
            specificity = float((~accepted[~positive]).mean())
            balanced = (recall+specificity)/2
            if balanced > best:
                best = balanced
                winner = {'confidence': threshold, 'margin': gap, 'validationRecall': recall, 'validationSpecificity': specificity, 'validationSamples': len(x)}
    policies[mode] = {**winner, 'templateConfidence': .93, 'disagreementConfidence': .7}
    print(mode, winner, flush=True)
path = Path('assets/ink-models/models.json')
metadata = json.loads(path.read_text())
metadata['policies'] = policies
path.write_text(json.dumps(metadata, separators=(',', ':'))+'\n')
(root/'policies.json').write_text(json.dumps(policies, indent=2)+'\n')
