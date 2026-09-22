"""Sample reviewed vector strokes in the approved glyphs' crop coordinates.

The editable source is clean-stroke-paths.json. Pixel skeletons measure source
fidelity only; they never determine Fino's movement or introduce route vertices.
"""
from __future__ import annotations
import json
import math
import re
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

SOURCE = Path(__file__).resolve().parents[1] / 'design/print-handwriting-reference/clean-stroke-paths.json'

def read_paths():
    return json.loads(SOURCE.read_text())['paths']

def commands(path):
    tokens = re.findall(r'[MLC]|-?(?:\d*\.)?\d+', path)
    if ''.join(tokens) != re.sub(r'\s+', '', path):
        raise ValueError(f'Invalid path: {path}')
    result = []
    index = 0
    while index < len(tokens):
        kind = tokens[index]
        size = {'M': 2, 'L': 2, 'C': 6}[kind]
        result.append((kind, np.array([float(n) for n in tokens[index + 1:index + 1 + size]]).reshape(-1, 2)))
        index += size + 1
    if not result or result[0][0] != 'M' or any(kind == 'M' for kind, _ in result[1:]):
        raise ValueError('Each pen stroke must start with M')
    return result

def sample_commands(items, step=.65):
    route = [items[0][1][0].copy()]
    for kind, points in items[1:]:
        start = route[-1]
        if kind == 'L':
            # Keep exact straight lines, including their intentional corners.
            route.append(points[0].copy())
        else:
            controls = np.vstack([start, points])
            count = max(2, math.ceil(np.linalg.norm(np.diff(controls, axis=0), axis=1).sum() / step))
            t = np.linspace(0, 1, count + 1)[1:, None]
            curve = (1-t)**3*start + 3*(1-t)**2*t*points[0] + 3*(1-t)*t*t*points[1] + t**3*points[2]
            route.extend(curve)
    return [tuple(map(float, p)) for p in route]

def dense_routes(routes, step=.5):
    result = []
    for route in routes:
        result.append(route[0])
        for start, end in zip(route, route[1:]):
            start, end = np.array(start), np.array(end)
            count = max(1, math.ceil(np.linalg.norm(end-start) / step))
            result.extend(start + (end-start)*i/count for i in range(1, count+1))
    return np.array(result)

def extract_clean_routes(character, crop, skeleton):
    paths = read_paths()[character]
    routes = [sample_commands(commands(path)) for path in paths]
    sy, sx = np.where(skeleton)
    points = dense_routes(routes)
    errors = cKDTree(points).query(np.column_stack([sx, sy]))[0]
    route_min = points.min(axis=0)
    route_size = points.max(axis=0)-route_min
    ink_x, ink_y = int(sx.min()), int(sy.min())
    geometry = {
        'inkX': ink_x, 'inkY': ink_y,
        'inkWidth': max(1, int(sx.max())-ink_x), 'inkHeight': max(1, int(sy.max())-ink_y),
        'routeX': round(float(route_min[0]), 3), 'routeY': round(float(route_min[1]), 3),
        'routeWidth': round(max(1., float(route_size[0])), 3),
        'routeHeight': round(max(1., float(route_size[1])), 3),
        'skeletonPixels': len(sx), 'routeCount': len(routes),
        'maximumRouteError': round(float(errors.max()), 3),
        'meanRouteError': round(float(errors.mean()), 3),
    }
    normalized = [[[round((x-ink_x)/900, 6), round((y-ink_y)/620, 6)] for x, y in route] for route in routes]
    return normalized, geometry, routes
