#!/usr/bin/env python3
"""Read-only comparison of canonical vectors with approved source artwork."""
import json
import hashlib
import numpy as np
from PIL import Image
from scipy import ndimage
from clean_handwriting_paths import SOURCE, commands, sample_commands, dense_routes, extract_clean_routes
from extract_handwriting_templates import SHEETS, REFERENCE, glyph_mask, content_bounds, zhang_suen


def audit():
    data = json.loads(SOURCE.read_text())
    paths = data['paths']
    for file, checksum in data['sourceSheets'].items():
        assert hashlib.sha256((REFERENCE / file).read_bytes()).hexdigest() == checksum, f'{file}: source changed; review the paths again'
    rows = []
    for spec in SHEETS:
        mask = glyph_mask(Image.open(REFERENCE / spec['file']))
        for index, character in enumerate(spec['characters']):
            row, column = divmod(index, spec['columns'])
            box = (round(column*spec['cell_width']), spec['row_tops'][row],
                   round((column+1)*spec['cell_width']), spec['row_tops'][row]+spec['cell_height'])
            x, y, w, h = content_bounds(mask, box)
            crop = mask.crop((x, y, x+w, y+h))
            binary = np.asarray(crop.getchannel('A')) >= 32
            routes = [sample_commands(commands(p)) for p in paths[character]]
            points = dense_routes(routes, .15)
            distance = ndimage.distance_transform_edt(~binary)
            off_ink = ndimage.map_coordinates(distance, points[:, ::-1].T, order=1, mode='constant', cval=100)
            _, geometry, _ = extract_clean_routes(character, crop, zhang_suen(binary))
            assert off_ink.max() <= .75, f'{character}: path leaves source ink by {off_ink.max():.3f}px'
            assert geometry['maximumRouteError'] <= 5.5, (character, geometry)
            assert geometry['meanRouteError'] <= 1, (character, geometry)
            for si, path in enumerate(paths[character]):
                cs = commands(path)
                position = cs[0][1][0]
                incoming = None
                for ci, (kind, pts) in enumerate(cs[1:], 1):
                    outgoing = pts[0]-position
                    if incoming is not None and 'C' in (kind, cs[ci-1][0]):
                        cosine = np.dot(incoming, outgoing)/np.linalg.norm(incoming)/np.linalg.norm(outgoing)
                        corner = [si, ci] in data['corners'].get(character, [])
                        if not corner:
                            assert cosine >= np.cos(np.deg2rad(.5)), f'{character} stroke {si}, command {ci}: non-smooth join'
                    incoming = pts[-1]-(pts[-2] if kind == 'C' else position)
                    position = pts[-1]
            rows.append({'character': character, 'maximumSkeletonDistance': geometry['maximumRouteError'],
                         'meanSkeletonDistance': geometry['meanRouteError'], 'maximumOutsideInk': round(float(off_ink.max()), 3)})
    assert len(rows) == len(paths) == 69
    return rows

if __name__ == '__main__':
    rows = audit()
    print(json.dumps({'characters': len(rows), 'maximumOutsideInk': max(r['maximumOutsideInk'] for r in rows),
                      'maximumMeanSkeletonDistance': max(r['meanSkeletonDistance'] for r in rows),
                      'maximumSkeletonDistance': max(r['maximumSkeletonDistance'] for r in rows)}, indent=2))
