"""Download public data to a local cache; keep source train/validation/test separate."""
import argparse
import concurrent.futures
import gzip
import json
from pathlib import Path
import struct
import urllib.parse
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageDraw

SHAPES = ['circle', 'triangle', 'square', 'star']
DISTRACTORS = ['hexagon', 'octagon', 'line', 'zigzag', 'squiggle', 'umbrella', 'moon', 'cloud', 'lightning', 'sun', 'eye', 'smiley face']


def raster(strokes, size=28, extent=20, thickness=1.8):
    points = [p for stroke in strokes for p in stroke]
    if not points:
        return np.zeros((size, size), dtype=np.uint8)
    points = np.array(points)
    lo, hi = points.min(0), points.max(0)
    scale = extent / max(1, *(hi - lo))
    center = (hi + lo) / 2
    image = Image.new('L', (size * 4, size * 4))
    draw = ImageDraw.Draw(image)
    radius = thickness * 2
    for stroke in strokes:
        path = [tuple(((np.array(p) - center) * scale + size / 2) * 4) for p in stroke]
        if len(path) > 1:
            draw.line(path, fill=255, width=round(thickness * 4), joint='curve')
        for x, y in path:
            draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=255)
    return np.array(image.resize((size, size), Image.Resampling.BOX))


def normalize_bitmap(image):
    ys, xs = np.where(image > 16)
    if not len(xs):
        return np.zeros((28, 28), dtype=np.uint8)
    crop = Image.fromarray(image).crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
    scale = 20 / max(crop.size)
    crop = crop.resize(tuple(max(1, round(v * scale)) for v in crop.size), Image.Resampling.BILINEAR)
    result = Image.new('L', (28, 28))
    result.paste(crop, ((28-crop.width)//2, (28-crop.height)//2))
    return np.array(result)


def emnist(root):
    output = root / 'characters.npz'
    if output.exists():
        return
    archive = root / 'emnist.zip'
    if not archive.exists():
        urllib.request.urlretrieve('https://biometrics.nist.gov/cs_links/EMNIST/gzip.zip', archive)
    data = {}
    with zipfile.ZipFile(archive) as z:
        for split in ['train', 'test']:
            def read(kind):
                name = next(n for n in z.namelist() if n.endswith(f'emnist-byclass-{split}-{kind}.gz'))
                return gzip.decompress(z.read(name))
            images = np.frombuffer(read('images-idx3-ubyte'), np.uint8, offset=16).reshape(-1, 28, 28).transpose(0, 2, 1)
            labels = np.frombuffer(read('labels-idx1-ubyte'), np.uint8, offset=8)
            for mode in ['numbers', 'letters']:
                xs, ys, ids = [], [], []
                classes = range(10) if mode == 'numbers' else range(10, 62)
                for label in classes:
                    indexes = np.where(labels == label)[0]
                    rng = np.random.default_rng(431 + label)
                    rng.shuffle(indexes)
                    indexes = indexes[:4000 if split == 'train' else 600]
                    xs.extend(normalize_bitmap(images[i]) for i in indexes)
                    ys.extend([label if mode == 'numbers' else (label-10) % 26] * len(indexes))
                    ids.extend(indexes)
                key = f'{mode}_{split}'
                data[key+'_x'] = np.array(xs)
                data[key+'_y'] = np.array(ys, dtype=np.int64)
                data[key+'_id'] = np.array(ids)
                print(key, len(xs), flush=True)
    np.savez_compressed(output, **data)


def quickdraw(root):
    folder = root / 'quickdraw'
    folder.mkdir(exist_ok=True)

    def category(name):
        path = folder / (name.replace(' ', '_')+'.json')
        if path.exists():
            return
        target = 10000 if name in SHAPES else 1800
        url = 'https://storage.googleapis.com/quickdraw_dataset/full/simplified/'+urllib.parse.quote(name)+'.ndjson'
        examples = []
        with urllib.request.urlopen(url) as response:
            for line in response:
                item = json.loads(line)
                if not item['recognized']:
                    continue
                examples.append({'id': item['key_id'], 'strokes': [list(map(list, zip(*stroke[:2]))) for stroke in item['drawing']]})
                if len(examples) == target:
                    break
        path.write_text(json.dumps(examples, separators=(',', ':')))
        print(name, len(examples), flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(category, SHAPES + DISTRACTORS))
    output = root / 'shapes.npz'
    if output.exists():
        return
    sets = {split: [[], [], []] for split in ['train', 'validation', 'test']}
    vectors = []
    for category, name in enumerate(SHAPES + DISTRACTORS):
        rows = json.loads((folder / (name.replace(' ', '_')+'.json')).read_text())
        for index, row in enumerate(rows):
            split = 'train' if index < len(rows)*.8 else 'validation' if index < len(rows)*.9 else 'test'
            xs, ys, ids = sets[split]
            xs.append(raster(row['strokes']))
            ys.append(min(category, 4))
            ids.append(row['id'])
            if split != 'train' and index % (8 if category < 4 else 4) == 0:
                vectors.append({'source': 'quickdraw', 'split': split, 'id': row['id'], 'mode': 'symbols', 'value': category+1 if category < 4 else None, 'strokes': row['strokes']})
    data = {}
    for split, (xs, ys, ids) in sets.items():
        data[split+'_x'], data[split+'_y'], data[split+'_id'] = np.array(xs), np.array(ys), np.array(ids)
    np.savez_compressed(output, **data)
    (root/'quickdraw-vectors.json').write_text(json.dumps(vectors, separators=(',', ':')))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=Path('/tmp/fino-ink-data'))
    args = parser.parse_args()
    args.data.mkdir(exist_ok=True, parents=True)
    emnist(args.data)
    quickdraw(args.data)
