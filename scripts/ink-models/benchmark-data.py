"""Prepare deterministic comparisons. No benchmark samples are used for training."""
import gzip
import json
import argparse
from pathlib import Path
import zipfile
import numpy as np
from skimage.morphology import skeletonize

root = Path('/tmp/fino-ink-data')
parser = argparse.ArgumentParser()
parser.add_argument('--final', action='store_true')
args = parser.parse_args()


def skeleton_paths(image):
    ys, xs = np.where(skeletonize(image > 64))
    nodes = set(zip(xs.tolist(), ys.tolist()))
    adjacent = {p: [(p[0]+dx, p[1]+dy) for dy in [-1, 0, 1] for dx in [-1, 0, 1]
                    if (dx or dy) and (p[0]+dx, p[1]+dy) in nodes] for p in nodes}
    visited, paths = set(), []
    for start in sorted(nodes, key=lambda p: (len(adjacent[p]) == 2, p)):
        if not adjacent[start]:
            paths.append([list(start)])
        for neighbor in adjacent[start]:
            edge = frozenset([start, neighbor])
            if edge in visited:
                continue
            visited.add(edge)
            path = [start, neighbor]
            while len(adjacent[path[-1]]) == 2:
                nxt = next(p for p in adjacent[path[-1]] if p != path[-2])
                edge = frozenset([path[-1], nxt])
                if edge in visited:
                    break
                visited.add(edge)
                path.append(nxt)
            paths.append([list(p) for p in path])
    return paths


rows = json.loads((root/'quickdraw-vectors.json').read_text())
if args.final:
    from prepare import SHAPES, DISTRACTORS
    exploratory = {row['id'] for row in rows}
    rows = []
    for category, name in enumerate(SHAPES+DISTRACTORS):
        all_rows = json.loads((root/'quickdraw'/(name.replace(' ', '_')+'.json')).read_text())
        for row in all_rows[int(len(all_rows)*.9):]:
            if row['id'] not in exploratory:
                rows.append({'source': 'quickdraw', 'split': 'test', 'id': row['id'], 'mode': 'symbols', 'value': category+1 if category < 4 else None, 'strokes': row['strokes']})
characters = np.load(root/'characters.npz')
z = zipfile.ZipFile(root/'emnist.zip')
labels = np.frombuffer(gzip.decompress(z.read(next(n for n in z.namelist() if n.endswith('emnist-byclass-test-labels-idx1-ubyte.gz')))), np.uint8, offset=8)
rng = np.random.default_rng(9081)
for mode in ['numbers', 'letters']:
    y = characters[mode+'_test_y']
    images = characters[mode+'_test_x']
    source_ids = characters[mode+'_test_id']
    indexes = []
    for label in sorted(set(y)):
        candidates = np.where(y == label)[0]
        # The UI shows uppercase letters; evaluate that requirement separately.
        if mode == 'letters':
            candidates = np.array([i for i in candidates if labels[source_ids[i]] < 36])
        rng.shuffle(candidates)
        target = 1 <= label <= 4 if mode == 'numbers' else label < 4
        indexes.extend(candidates[(100 if target else 25):(350 if target else 125)] if args.final else candidates[:100 if target else 25])
    for index in indexes:
        label = int(y[index])
        value = label if mode == 'numbers' else label+1
        target = value if value in [1, 2, 3, 4] else None
        rows.append({'source': 'emnist-skeleton', 'split': 'test', 'id': int(source_ids[index]),
                     'mode': mode, 'value': target, 'sourceLabel': label,
                     'strokes': skeleton_paths(images[index])})
(root/('benchmark-final.json' if args.final else 'benchmark.json')).write_text(json.dumps(rows, separators=(',', ':')))
print('benchmark cases', len(rows))
