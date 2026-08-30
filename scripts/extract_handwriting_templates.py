#!/usr/bin/env python3
"""Build child-facing masks and exact centre-line routes from approved sheets.

The raster mask is the visual source of truth.  A Zhang-Suen thinning pass
extracts its centre line.  The teaching routes transcribe the approved
Schreibanleitung (`schreib_anleitung.md`): they determine only the stroke
order and direction; every generated route point is constrained to that
centre line.
"""

from __future__ import annotations

import heapq
import json
import math
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from scipy.spatial import cKDTree


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'design' / 'print-handwriting-reference'
OUTPUT = ROOT / 'assets' / 'handwriting-templates'
TEMPLATE_DATA = ROOT / 'js' / 'handwriting-template-data.js'
STROKE_DATA = ROOT / 'js' / 'handwriting-stroke-data.js'
QA_OUTPUT = ROOT / 'qa-stroke-system-2026-07-31'

# Sheets generated from the approved Schulschrift artwork by
# scripts/extract_schulschrift_glyphs.py, which also writes sheet-layout.json
# holding each sheet's cell geometry. Reading it (instead of hardcoding
# cell sizes) keeps slicing correct whenever a glyph grows and the cells
# are re-laid-out.
_SHEET_LAYOUT = json.loads((REFERENCE / 'sheet-layout.json').read_text())
SHEETS = (
    {
        'key': 'uppercase', 'left': 0,
        'characters': 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß', **_SHEET_LAYOUT['uppercase'],
    },
    {
        'key': 'lowercase', 'left': 0,
        'characters': 'abcdefghijklmnopqrstuvwxyzäöü', **_SHEET_LAYOUT['lowercase'],
    },
    {
        'key': 'digits', 'left': 0,
        'characters': '0123456789', **_SHEET_LAYOUT['digits'],
    },
)

NEIGHBOURS = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
ROUTE_COLOURS = ('#e76f51', '#2a9d8f', '#6c63b5', '#e9a23b', '#2679a8', '#c75c7b')


def route_hints(*strokes):
    return [[{'x': x, 'y': y} for x, y in stroke] for stroke in strokes]


# Teaching routes transcribed from the approved Schreibanleitung
# (schreib_anleitung.md).  Every waypoint is normalised to the glyph's ink
# bounding box (y = 0 top, y = 1 baseline zone).  Waypoints inside one stroke
# are followed in order, which is what encodes the retrace moves ("auf
# derselben Linie wieder hoch").  A stroke whose first and last waypoint
# coincide is a closed pen motion and is taught as one loop.
#
# a, d, p, q, g and 9 keep separate round-body and stem/tail hints (their
# junction confuses the waypoint follower), and main() joins the two
# extracted routes into the single taught stroke afterwards.
ONE_STROKE_CHARACTERS = frozenset({'a', 'd', 'p', 'q', 'g', '9', 'G'})

ROUTE_HINTS = {
    'A': route_hints(((0.02, 1), (0.5, 0), (0.98, 1)), ((0.02, 0.6), (0.98, 0.6))),
    'B': route_hints(((0.05, 0), (0.05, 1)),
                     ((0.05, 0.04), (0.55, 0.02), (0.92, 0.18), (0.7, 0.42), (0.1, 0.5),
                      (0.6, 0.56), (0.95, 0.78), (0.6, 0.98), (0.08, 0.96))),
    'C': route_hints(((0.95, 0.15), (0.6, 0.02), (0.2, 0.12), (0.02, 0.45), (0.15, 0.8),
                      (0.55, 0.98), (0.9, 0.85))),
    'D': route_hints(((0.05, 0), (0.05, 1)),
                     ((0.05, 0.03), (0.5, 0.02), (0.9, 0.25), (0.95, 0.5), (0.7, 0.85),
                      (0.3, 0.98), (0.05, 0.97))),
    'E': route_hints(((0.08, 0), (0.08, 1)), ((0.08, 0.02), (0.9, 0.02)),
                     ((0.08, 0.5), (0.75, 0.5)), ((0.08, 0.98), (0.92, 0.98))),
    'F': route_hints(((0.08, 0), (0.08, 1)), ((0.08, 0.02), (0.88, 0.02)),
                     ((0.08, 0.5), (0.72, 0.5))),
    # Two hint strokes that ONE_STROKE_CHARACTERS joins into one pen
    # motion: (1) the C part, ending at the bottom-right; (2) from the
    # right edge, inward bar (right->left), back (left->right), then down
    # the right edge to the bottom.
    'G': route_hints(((0.95, 0.12), (0.55, 0.02), (0.15, 0.15), (0.02, 0.5), (0.2, 0.85),
                      (0.6, 0.98), (0.95, 0.95)),
                     ((0.92, 0.5), (0.55, 0.55), (0.92, 0.5), (0.95, 0.97))),
    'H': route_hints(((0.05, 0), (0.05, 1)), ((0.95, 0), (0.95, 1)), ((0.05, 0.5), (0.95, 0.5))),
    'I': route_hints(((0.5, 0), (0.5, 1))),
    'J': route_hints(((0.55, 0), (0.55, 0.65), (0.3, 0.97), (0.05, 0.8))),
    # 3 strokes: stem top-down; mid -> diagonally up to top-right;
    # mid -> diagonally down to bottom-right.
    'K': route_hints(((0.08, 0), (0.08, 1)), ((0.06, 0.5), (0.9, 0.05)),
                     ((0.06, 0.5), (0.95, 0.97))),
    'L': route_hints(((0.08, 0), (0.08, 0.95), (0.95, 0.95))),
    # "Unten links beginnen": up the left upright, zigzag through the
    # middle valley, then down the right upright -- one stroke, like N.
    'M': route_hints(((0.02, 1), (0.02, 0), (0.5, 0.92), (0.98, 0), (0.98, 1))),
    'N': route_hints(((0.02, 1), (0.02, 0), (0.98, 1), (0.98, 0))),
    'O': route_hints(((0.4, 0.02), (0.05, 0.4), (0.3, 0.9), (0.7, 0.98),
                      (0.97, 0.55), (0.85, 0.2), (0.4, 0.02))),
    'P': route_hints(((0.08, 0), (0.08, 1)),
                     ((0.08, 0.03), (0.55, 0.02), (0.92, 0.2), (0.75, 0.45), (0.3, 0.52),
                      (0.08, 0.5))),
    'Q': route_hints(((0.4, 0.02), (0.05, 0.4), (0.3, 0.9), (0.7, 0.98),
                      (0.97, 0.55), (0.85, 0.2), (0.4, 0.02)),
                     ((0.4, 0.62), (0.9, 0.98))),
    'R': route_hints(((0.08, 0), (0.08, 1)),
                     ((0.08, 0.03), (0.55, 0.02), (0.92, 0.2), (0.75, 0.45), (0.3, 0.52),
                      (0.08, 0.5)),
                     ((0.45, 0.5), (0.95, 0.98))),
    'S': route_hints(((0.88, 0.12), (0.5, 0.02), (0.15, 0.15), (0.12, 0.38), (0.45, 0.52),
                      (0.78, 0.65), (0.85, 0.85), (0.5, 0.98), (0.15, 0.88))),
    'T': route_hints(((0.5, 0), (0.5, 1)), ((0.02, 0.02), (0.98, 0.02))),
    'U': route_hints(((0.05, 0), (0.05, 0.55), (0.3, 0.92), (0.6, 0.98), (0.9, 0.75), (0.95, 0))),
    'V': route_hints(((0.03, 0), (0.5, 1), (0.97, 0))),
    'W': route_hints(((0.02, 0), (0.26, 1), (0.46, 0.03), (0.73, 1), (0.98, 0))),
    'X': route_hints(((0.05, 0), (0.95, 1)), ((0.95, 0), (0.05, 1))),
    'Y': route_hints(((0.05, 0), (0.5, 0.55)), ((0.95, 0), (0.5, 0.55), (0.5, 1))),
    'Z': route_hints(((0.03, 0.02), (0.97, 0.02), (0.03, 0.97), (0.97, 0.97))),
    'a': route_hints(((0.9, 0.25), (0.45, 0.02), (0.05, 0.35), (0.15, 0.8), (0.55, 0.98),
                      (0.9, 0.75), (0.9, 0.25)),
                     ((0.9, 0.02), (0.88, 0.85), (1, 0.97))),
    'b': route_hints(((0.05, 0), (0.05, 1)),
                     ((0.05, 0.42), (0.4, 0.3), (0.75, 0.35), (0.92, 0.6), (0.7, 0.92),
                      (0.3, 0.98), (0.06, 0.78))),
    'c': route_hints(((0.92, 0.2), (0.55, 0.02), (0.15, 0.2), (0.02, 0.55), (0.2, 0.9),
                      (0.6, 1), (0.95, 0.85))),
    'd': route_hints(((0.85, 0.25), (0.4, 0.02), (0.05, 0.35), (0.15, 0.8), (0.55, 0.98),
                      (0.92, 0.75), (0.85, 0.25)),
                     ((0.95, 0), (0.92, 0.85), (1, 0.97))),
    'e': route_hints(((0.03, 0.42), (0.6, 0.4), (0.9, 0.25), (0.6, 0.05), (0.25, 0.08),
                      (0.03, 0.4), (0.1, 0.75), (0.45, 0.98), (0.95, 0.88))),
    'f': route_hints(((0.95, 0.1), (0.6, 0), (0.35, 0.1), (0.28, 0.5), (0.5, 1)),
                     ((0.05, 0.42), (0.85, 0.38))),
    'g': route_hints(((0.85, 0.25), (0.4, 0.02), (0.05, 0.35), (0.15, 0.8), (0.55, 0.98),
                      (0.85, 0.75), (0.85, 0.25)),
                     ((0.88, 0.02), (0.86, 0.6), (0.6, 0.95), (0.05, 0.83))),
    'h': route_hints(((0.08, 0), (0.08, 1), (0.08, 0.42), (0.5, 0.35), (0.85, 0.6),
                      (0.85, 1), (1, 0.97))),
    'i': route_hints(((0.35, 0.22), (0.35, 0.88), (0.6, 0.98)), ((0.3, 0.04),)),
    'j': route_hints(((0.6, 0.15), (0.6, 0.7), (0.35, 0.97), (0.08, 0.82)), ((0.55, 0.03),)),
    'k': route_hints(((0.08, 0), (0.08, 1)), ((0.06, 0.5), (0.85, 0.02)),
                     ((0.06, 0.5), (0.9, 0.97))),
    # Schreibanleitung: "Oben beginnen, gerade nach unten ziehen und unten
    # mit einem kleinen Bogen nach rechts ausschwingen." The stroke starts on
    # the stem top, never on the swung-out hook tip.
    'l': route_hints(((0.17, 0.02), (0.15, 0.85), (0.5, 1), (0.95, 0.83))),
    'm': route_hints(((0.04, 0.1), (0.04, 0.95), (0.04, 0.1), (0.42, 0.08), (0.42, 0.95),
                      (0.42, 0.08), (0.82, 0.08), (0.82, 0.95), (1, 0.97))),
    'n': route_hints(((0.06, 0.1), (0.06, 0.95), (0.06, 0.1), (0.5, 0.08), (0.88, 0.35),
                      (0.88, 0.95), (1, 0.97))),
    'o': route_hints(((0.4, 0.02), (0.05, 0.4), (0.25, 0.9), (0.65, 0.98),
                      (0.95, 0.65), (0.85, 0.25), (0.4, 0.02))),
    'p': route_hints(((0.06, 0.05), (0.06, 1)),
                     ((0.06, 0.08), (0.5, 0.02), (0.88, 0.25), (0.6, 0.55), (0.08, 0.52))),
    'q': route_hints(((0.85, 0.25), (0.4, 0.02), (0.05, 0.35), (0.15, 0.8), (0.55, 0.98),
                      (0.85, 0.75), (0.85, 0.25)),
                     ((0.85, 0.25), (0.9, 1))),
    'r': route_hints(((0.1, 0.1), (0.1, 0.95), (0.1, 0.1), (0.55, 0.05), (0.95, 0.3))),
    's': route_hints(((0.85, 0.18), (0.45, 0.05), (0.12, 0.2), (0.15, 0.45), (0.55, 0.6),
                      (0.85, 0.75), (0.75, 0.95), (0.35, 1), (0.08, 0.85))),
    't': route_hints(((0.4, 0), (0.45, 0.75), (0.6, 0.95), (0.95, 0.9)),
                     ((0.02, 0.35), (0.9, 0.3))),
    'u': route_hints(((0.06, 0.08), (0.12, 0.7), (0.45, 0.97), (0.85, 0.55), (0.9, 0.08),
                      (0.9, 0.7), (1, 0.95))),
    'v': route_hints(((0.03, 0.05), (0.5, 0.97), (0.97, 0.05))),
    'w': route_hints(((0.02, 0.05), (0.26, 0.97), (0.5, 0.1), (0.74, 0.97), (0.98, 0.05))),
    'x': route_hints(((0.05, 0.05), (0.95, 0.95)), ((0.95, 0.05), (0.05, 0.95))),
    # 2 strokes: (1) straight diagonal top-left -> junction (down-right).
    # (2) long diagonal top-right -> through junction -> tail bottom-left.
    'y': route_hints(((0.02, 0.0), (0.5, 0.72)), ((0.98, 0.0), (0.5, 0.72), (0.25, 1), (0.02, 0.88))),
    'z': route_hints(((0.05, 0.08), (0.95, 0.08), (0.05, 0.92), (0.95, 0.92))),
    # Schreibanleitung: "Unten am langen linken Stamm beginnen und gerade nach
    # oben ziehen. Oben rund nach rechts und wieder nach unten zur Mitte
    # führen. Dort nach innen biegen und sofort in den großen unteren Bogen
    # nach rechts und unten weitergehen. Unten rund nach links ziehen und dort
    # enden. Alles in einem Zug." One continuous pen motion: up the long left
    # stem, round the top bowl, down to the middle waist, out around the big
    # lower bowl, curling left along the bottom.
    'ß': route_hints(((0.10, 0.99), (0.11, 0.05), (0.42, 0.0), (0.78, 0.16), (0.80, 0.24),
                      (0.62, 0.33), (0.42, 0.39), (0.60, 0.45), (0.88, 0.51), (0.98, 0.57),
                      (0.90, 0.67), (0.68, 0.73), (0.45, 0.79), (0.40, 0.81))),
    '0': route_hints(((0.55, 0.02), (0.2, 0.18), (0.04, 0.5), (0.3, 0.92), (0.7, 0.98),
                      (0.95, 0.62), (0.8, 0.22), (0.55, 0.02))),
    '1': route_hints(((0.02, 0.5), (0.92, 0.02), (0.88, 0.98))),
    '2': route_hints(((0.05, 0.2), (0.3, 0.03), (0.65, 0.06), (0.9, 0.22), (0.82, 0.45),
                      (0.45, 0.7), (0.05, 0.95), (0.97, 0.95))),
    '3': route_hints(((0.06, 0.12), (0.4, 0.02), (0.75, 0.08), (0.92, 0.25), (0.42, 0.45),
                      (0.78, 0.58), (0.95, 0.78), (0.72, 0.97), (0.35, 0.98),
                      (0.04, 0.85))),
    '4': route_hints(((0.6, 0.02), (0.03, 0.55), (0.97, 0.55)), ((0.72, 0.28), (0.72, 0.98))),
    '5': route_hints(((0.12, 0.02), (0.08, 0.42), (0.5, 0.52), (0.85, 0.45),
                      (0.97, 0.7), (0.75, 0.95), (0.35, 0.98), (0.04, 0.85)),
                     ((0.12, 0.02), (0.9, 0.04))),
    '6': route_hints(((0.9, 0.04), (0.45, 0.35), (0.12, 0.7), (0.15, 0.92), (0.5, 1),
                      (0.85, 0.85), (0.78, 0.55), (0.4, 0.5), (0.12, 0.65))),
    '7': route_hints(((0.02, 0.05), (0.98, 0.02), (0.3, 0.98)), ((0.15, 0.55), (0.78, 0.5))),
    '8': route_hints(((0.62, 0.0), (0.14, 0.13), (0.28, 0.38), (0.6, 0.48), (0.95, 0.62),
                      (0.62, 0.99), (0.2, 0.85), (0.6, 0.48), (0.9, 0.28), (0.62, 0.0))),
    '9': route_hints(((0.9, 0.3), (0.6, 0.04), (0.2, 0.12), (0.04, 0.4), (0.3, 0.62),
                      (0.75, 0.55), (0.9, 0.3)),
                     ((0.88, 0.3), (0.8, 0.75), (0.5, 0.97), (0.15, 0.9))),
}


def luma(red, green, blue):
    return red * 0.2126 + green * 0.7152 + blue * 0.0722


def glyph_mask(source):
    source = source.convert('RGBA')
    output = Image.new('RGBA', source.size)
    pixels = []
    for red, green, blue, alpha in source.getdata():
        darkness = max(0, min(1, (178 - luma(red, green, blue)) / 108))
        pixels.append((42, 51, 57, round(alpha * darkness)))
    output.putdata(pixels)
    return output


def content_bounds(mask, box):
    clipped = mask.crop(box)
    bounds = clipped.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'No glyph pixels found in cell {box}')
    left, top, right, bottom = bounds
    padding = 4
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(clipped.width, right + padding)
    bottom = min(clipped.height, bottom + padding)
    return box[0] + left, box[1] + top, right - left, bottom - top


def zhang_suen(binary):
    """Return a one-pixel skeleton without optional image packages."""
    image = np.pad(binary.astype(bool), 1)
    changed = True
    while changed:
        changed = False
        for second_step in (False, True):
            core = image[1:-1, 1:-1]
            p2 = image[:-2, 1:-1]
            p3 = image[:-2, 2:]
            p4 = image[1:-1, 2:]
            p5 = image[2:, 2:]
            p6 = image[2:, 1:-1]
            p7 = image[2:, :-2]
            p8 = image[1:-1, :-2]
            p9 = image[:-2, :-2]
            around = (p2, p3, p4, p5, p6, p7, p8, p9)
            count = sum(neighbour.astype(np.uint8) for neighbour in around)
            transitions = sum(
                ((~around[index]) & around[(index + 1) % 8]).astype(np.uint8)
                for index in range(8)
            )
            if second_step:
                preserve_a = ~(p2 & p4 & p8)
                preserve_b = ~(p2 & p6 & p8)
            else:
                preserve_a = ~(p2 & p4 & p6)
                preserve_b = ~(p4 & p6 & p8)
            remove = core & (count >= 2) & (count <= 6) & (transitions == 1) & preserve_a & preserve_b
            if np.any(remove):
                core[remove] = False
                changed = True
    return image[1:-1, 1:-1]


def graph_for_skeleton(skeleton):
    nodes = {(int(y), int(x)) for y, x in np.argwhere(skeleton)}
    graph = {}
    for node in nodes:
        y, x = node
        neighbours = []
        for dy, dx in NEIGHBOURS:
            neighbour = (y + dy, x + dx)
            if neighbour not in nodes:
                continue
            # A diagonal pixel beside an orthogonal connection describes the
            # same one-pixel line, not an extra branch.  Keeping both creates
            # tiny triangular loops at every diagonal and makes an otherwise
            # simple stroke look like a graph with hundreds of junctions.
            if dy and dx and ((y + dy, x) in nodes or (y, x + dx) in nodes):
                continue
            neighbours.append(neighbour)
        graph[node] = tuple(neighbours)
    component_ids = {}
    components = []
    for node in sorted(nodes):
        if node in component_ids:
            continue
        component_index = len(components)
        queue = [node]
        component = []
        component_ids[node] = component_index
        while queue:
            current = queue.pop()
            component.append(current)
            for neighbour in graph[current]:
                if neighbour not in component_ids:
                    component_ids[neighbour] = component_index
                    queue.append(neighbour)
        components.append(component)
    return graph, component_ids, components


def densify(points, step=1.35):
    if not points:
        return []
    result = [points[0]]
    for start, end in zip(points, points[1:]):
        length = math.dist(start, end)
        count = max(1, math.ceil(length / step))
        result.extend((
            start[0] + (end[0] - start[0]) * index / count,
            start[1] + (end[1] - start[1]) * index / count,
        ) for index in range(1, count + 1))
    return result


def shortest_path(graph, start, goal, allowed):
    if start == goal:
        return [start]
    queue = [(math.dist(start, goal), 0.0, start)]
    previous = {start: None}
    costs = {start: 0.0}
    while queue:
        _, cost, current = heapq.heappop(queue)
        if current == goal:
            result = []
            while current is not None:
                result.append(current)
                current = previous[current]
            return list(reversed(result))
        if cost > costs[current] + 1e-9:
            continue
        for neighbour in graph[current]:
            if neighbour not in allowed:
                continue
            next_cost = cost + math.dist(current, neighbour)
            if next_cost + 1e-9 < costs.get(neighbour, math.inf):
                costs[neighbour] = next_cost
                previous[neighbour] = current
                heapq.heappush(queue, (next_cost + math.dist(neighbour, goal), next_cost, neighbour))
    return [start, goal]


def edge_key(first, second):
    return tuple(sorted((first, second)))


def weighted_edge_path(graph, start, goal, allowed_edges, hint_tree, used_edges):
    """Follow one connected ink branch while staying near the reviewed hint."""
    if start == goal:
        return [start]
    queue = [(math.dist(start, goal), 0.0, start)]
    previous = {start: None}
    costs = {start: 0.0}
    while queue:
        _, cost, current = heapq.heappop(queue)
        if current == goal:
            result = []
            while current is not None:
                result.append(current)
                current = previous[current]
            return list(reversed(result))
        if cost > costs[current] + 1e-9:
            continue
        for neighbour in graph[current]:
            edge = edge_key(current, neighbour)
            if edge not in allowed_edges:
                continue
            hint_distance = float(hint_tree.query(neighbour)[0])
            reuse_cost = 180.0 if edge in used_edges else 0.0
            next_cost = cost + math.dist(current, neighbour) + .055 * hint_distance ** 2 + reuse_cost
            if next_cost + 1e-9 < costs.get(neighbour, math.inf):
                costs[neighbour] = next_cost
                previous[neighbour] = current
                heapq.heappush(queue, (next_cost + math.dist(neighbour, goal), next_cost, neighbour))
    return []


def edge_component(start, available_edges):
    adjacency = {}
    for first, second in available_edges:
        adjacency.setdefault(first, []).append(second)
        adjacency.setdefault(second, []).append(first)
    if start not in adjacency:
        return set()
    result = set()
    queue = [start]
    while queue:
        node = queue.pop()
        for neighbour in adjacency.get(node, ()):
            edge = edge_key(node, neighbour)
            if edge in result:
                continue
            result.add(edge)
            queue.append(neighbour)
    return result


def ordered_euler_trail(start, edges, hint_points):
    """Consume a remaining line or loop once, in the hinted direction."""
    if not edges:
        return [start]
    adjacency = {}
    for first, second in edges:
        adjacency.setdefault(first, set()).add(second)
        adjacency.setdefault(second, set()).add(first)

    # If this graph has two odd ends, an Euler trail must start at one of
    # them.  Pick the end closest to the reviewed pen-down position.
    odd = [node for node, neighbours in adjacency.items() if len(neighbours) % 2]
    if len(odd) == 2:
        start = min(odd, key=lambda node: math.dist(node, hint_points[0]))
    elif start not in adjacency:
        start = min(adjacency, key=lambda node: math.dist(node, hint_points[0]))

    hint_tree = cKDTree(np.array(hint_points, dtype=float))
    stack = [start]
    trail = []
    remaining = set(edges)
    previous = None
    while stack:
        current = stack[-1]
        candidates = [
            neighbour for neighbour in adjacency.get(current, ())
            if edge_key(current, neighbour) in remaining
        ]
        if not candidates:
            trail.append(stack.pop())
            previous = trail[-1]
            continue
        # Prefer the visible centre-line closest to the reviewed route.  A
        # small turn penalty gives stable, natural movement at intersections.
        def candidate_cost(neighbour):
            distance = float(hint_tree.query(neighbour)[0])
            if len(stack) < 2:
                return distance
            incoming = np.array(current, dtype=float) - np.array(stack[-2], dtype=float)
            outgoing = np.array(neighbour, dtype=float) - np.array(current, dtype=float)
            denominator = np.linalg.norm(incoming) * np.linalg.norm(outgoing)
            cosine = 1.0 if denominator < 1e-9 else float(np.dot(incoming, outgoing) / denominator)
            return distance + (1 - cosine) * 2.5

        neighbour = min(candidates, key=candidate_cost)
        remaining.remove(edge_key(current, neighbour))
        stack.append(neighbour)

    trail.reverse()
    # Match the loop's first movement to the reviewed direction, the same way
    # hinted_cycle does.  Hint distances alone can still start a symmetric
    # loop (O, o) the wrong way round when the start sits between two arcs.
    if len(hint_points) > 1 and len(trail) > 2:
        wanted = np.array(hint_points[1]) - np.array(hint_points[0])
        forward = np.array(trail[1]) - np.array(trail[0])
        backward = np.array(trail[-2]) - np.array(trail[-1])
        if np.dot(backward, wanted) > np.dot(forward, wanted):
            trail = [trail[0], *reversed(trail[1:-1]), trail[-1]]
    return trail


def hinted_cycle(graph, preferred_start, edges, hint_points):
    """Find the visible loop described by a closed teaching stroke."""
    if not edges:
        return []
    hint_tree = cKDTree(np.array(hint_points, dtype=float))
    edge_nodes = {node for edge in edges for node in edge}
    starts = sorted(
        edge_nodes,
        key=lambda node: math.dist(node, preferred_start) + float(hint_tree.query(node)[0]),
    )[:18]
    best = None
    target_length = sum(math.dist(first, second) for first, second in zip(hint_points, hint_points[1:]))
    for start in starts:
        neighbours = [
            neighbour for neighbour in graph[start]
            if edge_key(start, neighbour) in edges
        ]
        for first_index, first in enumerate(neighbours):
            for second in neighbours[first_index + 1:]:
                blocked = {
                    edge for edge in edges
                    if start in edge
                }
                middle = weighted_edge_path(
                    graph, first, second, edges - blocked, hint_tree, set(),
                )
                if len(middle) < 3:
                    continue
                route = [start, *middle, start]
                length = sum(math.dist(a, b) for a, b in zip(route, route[1:]))
                if length < 12:
                    continue
                distances = [float(hint_tree.query(node)[0]) for node in route]
                score = sum(distance ** 2 for distance in distances) / len(distances)
                score += abs(length - target_length) * .08
                score += math.dist(start, preferred_start) * .2
                if best is None or score < best[0]:
                    best = score, route
    if best is None:
        return []
    route = best[1]
    # Match the first movement to the reviewed direction.
    if len(hint_points) > 1 and len(route) > 2:
        wanted = np.array(hint_points[1]) - np.array(hint_points[0])
        forward = np.array(route[1]) - np.array(route[0])
        backward = np.array(route[-2]) - np.array(route[-1])
        if np.dot(backward, wanted) > np.dot(forward, wanted):
            route = [route[0], *reversed(route[1:-1]), route[-1]]
    return route


def rdp(points, epsilon=0.72):
    if len(points) <= 2:
        return points
    start = np.array(points[0], dtype=float)
    end = np.array(points[-1], dtype=float)
    line = end - start
    length = np.linalg.norm(line)
    samples = np.array(points[1:-1], dtype=float)
    if length < 1e-9:
        distances = np.linalg.norm(samples - start, axis=1)
    else:
        offsets = samples - start
        distances = np.abs((line[0] * offsets[:, 1] - line[1] * offsets[:, 0]) / length)
    furthest = int(np.argmax(distances))
    maximum = float(distances[furthest])
    if maximum <= epsilon:
        return [points[0], points[-1]]
    split = furthest + 1
    return rdp(points[:split + 1], epsilon)[:-1] + rdp(points[split:], epsilon)


def remove_reversal_spurs(points, protected=(), minimum_retrace=12.0, protected_spike=5.0):
    """Collapse raster-junction spikes while retaining genuine corners.

    A Schreibanleitung retrace ("auf derselben Linie wieder hoch") travels a
    meaningful distance in the reverse direction, so only short reversal
    spikes from thinned junctions are collapsed.  Reversals that touch a
    reviewed hint waypoint (a vertex tip the pen must reach, such as the W
    apex or the middle of the 3) are usually kept.  Exception: a reversal
    that doubles back on itself within a few pixels (the stem nub of the B,
    the corner nub of the z, the figure-eight crossing of the 8) is a
    junction artifact even at a waypoint and is removed.  Larger reversals
    at a waypoint (the 3's waist, the W peaks) are genuine features and stay.
    """
    protected_points = [np.array(point, dtype=float) for point in protected]

    def is_protected(point):
        candidate = np.array(point, dtype=float)
        return any(
            float(np.linalg.norm(candidate - anchor)) <= 2.5
            for anchor in protected_points
        )

    cleaned = list(points)
    changed = True
    while changed and len(cleaned) >= 3:
        changed = False
        for index in range(1, len(cleaned) - 1):
            first = np.array(cleaned[index], dtype=float) - np.array(cleaned[index - 1], dtype=float)
            second = np.array(cleaned[index + 1], dtype=float) - np.array(cleaned[index], dtype=float)
            denominator = np.linalg.norm(first) * np.linalg.norm(second)
            if denominator < 1e-9:
                continue
            cosine = float(np.dot(first, second) / denominator)
            if cosine >= -0.8:
                continue
            if min(np.linalg.norm(first), np.linalg.norm(second)) >= minimum_retrace:
                continue
            if is_protected(cleaned[index]):
                # A protected waypoint still keeps only real corners: a
                # reversal whose legs are both tiny is an out-and-back nub of
                # a raster junction, not a feature the pen must reach.
                if max(np.linalg.norm(first), np.linalg.norm(second)) >= protected_spike:
                    continue
            del cleaned[index]
            changed = True
            break
    return cleaned


def smooth_route(points, budget=3.0, passes=2):
    """Remove raster stair-stepping from a route's centre line.

    The skeleton routes hug the template ink, but pixel snapping leaves tiny
    alternating zigzags (1-3 px).  Fino's heading follows the route
    direction, so those zigzags make the demo fox twitch, especially on long
    diagonals and loop crossings.  A centred moving average cancels the
    alternation; each pass keeps every interior point inside a small pixel
    budget measured from its original position.  That prevents the route
    from sliding along its own segments (which would clip retrace turnarounds
    like the hook of the u), while still letting the tiny perpendicular
    zigzags average out.  Endpoints never move, so the fox still starts and
    stops exactly where the jump and wait positions expect it to.
    """
    original = [np.array(point, dtype=float) for point in points]
    if len(original) < 4:
        return list(points)
    working = [point.copy() for point in original]
    for _ in range(passes):
        for index in range(1, len(working) - 1):
            incoming = working[index] - working[index - 1]
            outgoing = working[index + 1] - working[index]
            denominator = float(np.linalg.norm(incoming) * np.linalg.norm(outgoing))
            if denominator < 1e-9:
                continue
            cosine = float(np.dot(incoming, outgoing) / denominator)
            if cosine < 0.75:
                # A real corner (the M valley, the W apex, the 3's waist):
                # keep it exactly rather than rounding it off.
                continue
            candidate = (working[index - 1] + 2.0 * working[index] + working[index + 1]) / 4.0
            if float(np.linalg.norm(candidate - original[index])) <= budget:
                working[index] = candidate
    return [(float(point[0]), float(point[1])) for point in working]


def mapped_hint_routes(hints, graph, component_ids, components, skeleton_bounds):
    all_hint_points = [point for stroke in hints for point in stroke]
    hint_min_x = min(point['x'] for point in all_hint_points)
    hint_max_x = max(point['x'] for point in all_hint_points)
    hint_min_y = min(point['y'] for point in all_hint_points)
    hint_max_y = max(point['y'] for point in all_hint_points)
    min_y, min_x, max_y, max_x = skeleton_bounds
    width = max(1, max_x - min_x)
    height = max(1, max_y - min_y)

    def map_point(point):
        x = min_x + (point['x'] - hint_min_x) / max(1e-9, hint_max_x - hint_min_x) * width
        y = min_y + (point['y'] - hint_min_y) / max(1e-9, hint_max_y - hint_min_y) * height
        return y, x

    component_trees = [cKDTree(np.array(component, dtype=float)) for component in components]
    component_edges = []
    component_anchors = []
    for component_index, component in enumerate(components):
        nodes = set(component)
        edges = {
            edge_key(node, neighbour)
            for node in component
            for neighbour in graph[node]
            if neighbour in nodes
        }
        component_edges.append(edges)
        degrees = {
            node: sum(edge_key(node, neighbour) in edges for neighbour in graph[node])
            for node in component
        }
        y_values = [node[0] for node in component]
        x_values = [node[1] for node in component]
        boundary_groups = (
            [node for node in component if node[0] == min(y_values)],
            [node for node in component if node[0] == max(y_values)],
            [node for node in component if node[1] == min(x_values)],
            [node for node in component if node[1] == max(x_values)],
        )
        extrema = set()
        for group in boundary_groups:
            # Keep the corners of a flat extreme, not every pixel on a long
            # vertical or horizontal stem.
            extrema.add(min(group))
            extrema.add(max(group))
        junctions = {node for node, degree in degrees.items() if degree != 2}
        if junctions:
            # Pen-down and pen-up positions occur at visible ends, crossings, or
            # outer extrema.  Restricting endpoint projection to these landmarks
            # prevents an A leg from snapping to its nearby crossbar.
            anchors = junctions | extrema
        else:
            # A pure closed loop (O, o and the round bases) has no ends or
            # crossings: every skeleton node is a legitimate pen-down position.
            # Restricting to extrema would drag the hint's top-right start
            # around the ring to the rightmost point (3 o'clock).
            anchors = nodes
        component_anchors.append(anchors or nodes)

    mapped_strokes = []
    for hint_stroke in hints:
        raw_mapped = [map_point(point) for point in hint_stroke]
        mapped = densify(raw_mapped)
        if not mapped:
            continue
        sample = mapped[::max(1, len(mapped) // 48)]
        component_index = min(
            range(len(components)),
            key=lambda index: sum(float(component_trees[index].query(point)[0]) for point in sample),
        )
        mapped_strokes.append((hint_stroke, mapped, raw_mapped, component_index))

    remaining_counts = Counter(component_index for _, _, _, component_index in mapped_strokes)
    used_edges = set()
    global_node_tree = cKDTree(np.array(sorted(graph), dtype=float))
    global_nodes = sorted(graph)
    all_edges = {
        edge_key(node, neighbour)
        for node, neighbours in graph.items()
        for neighbour in neighbours
    }
    endpoint_cache = {}
    routes = []
    protected_by_route = []
    visited = set()

    def endpoint_key(point, component_index):
        return component_index, round(point['x'], 5), round(point['y'], 5)

    def project_endpoint(raw_point, mapped_point, component_index):
        key = endpoint_key(raw_point, component_index)
        if key not in endpoint_cache:
            endpoint_cache[key] = min(
                component_anchors[component_index],
                key=lambda node: math.dist(node, mapped_point),
            )
        return endpoint_cache[key]

    for hint_stroke, mapped, raw_mapped, component_index in mapped_strokes:
        remaining_counts[component_index] -= 1
        edges = component_edges[component_index]
        if not edges:
            point = components[component_index][0]
            routes.append([point])
            protected_by_route.append([])
            visited.add(point)
            continue

        start = project_endpoint(hint_stroke[0], mapped[0], component_index)
        goal = project_endpoint(hint_stroke[-1], mapped[-1], component_index)
        is_last_for_component = remaining_counts[component_index] == 0
        # A stroke that only returns to its start point at the very end is a
        # closed pen motion (O, o, a bowl).  A stroke that revisits its start
        # in the middle (the figure eight) must instead be chained through
        # every waypoint, because an Euler trail may pick the wrong lobe
        # order.  A hint with more than seven waypoints is never a simple
        # loop either -- the figure eight starts and ends at its top, so it
        # revisits no waypoint yet still needs waypoint chaining.
        revisits_start = any(
            math.dist((point['x'], point['y']), (hint_stroke[0]['x'], hint_stroke[0]['y'])) <= .035
            for point in hint_stroke[1:-1]
        )
        is_closed_hint = (
            math.dist(
                (hint_stroke[0]['x'], hint_stroke[0]['y']),
                (hint_stroke[-1]['x'], hint_stroke[-1]['y']),
            ) <= .035
            and not revisits_start
            and len(hint_stroke) <= 7
        )


        route = []
        available = edges - used_edges
        if is_closed_hint and available:
            if is_last_for_component:
                remaining_piece = edge_component(start, available)
                degrees = Counter(node for edge in remaining_piece for node in edge)
                odd = [node for node, degree in degrees.items() if degree % 2]
                if len(odd) in (0, 2):
                    route = ordered_euler_trail(start, remaining_piece, mapped)
            if not route:
                route = hinted_cycle(graph, start, available, mapped)

        if not route:
            # Follow every waypoint of this stroke in order.  Chaining is what
            # keeps the Schreibanleitung retrace moves ("auf derselben Linie
            # wieder hoch") on the centre line instead of shortcutting from a
            # stroke's start to its end.  Waypoints project onto the whole
            # skeleton and chaining may use every centre-line edge, so a
            # stroke may cross a shared junction (E bars, X crossing, 4
            # upright) and even bridge a detached entry tick (l) instead of
            # falling back to an unshaped straight line.
            hint_tree = cKDTree(np.array(mapped, dtype=float))
            waypoints = []
            for point in raw_mapped:
                node = tuple(int(value) for value in global_nodes[int(global_node_tree.query(point)[1])])
                if not waypoints or waypoints[-1] != node:
                    waypoints.append(node)
            if len(waypoints) == 1:
                route = [waypoints[0]]
            else:
                for first, second in zip(waypoints, waypoints[1:]):
                    if first == second:
                        continue
                    piece = weighted_edge_path(
                        graph, first, second, all_edges, hint_tree, used_edges,
                    )
                    if not piece:
                        piece = [first, second]
                    route.extend(piece if not route else piece[1:])
        protected = [(point[1], point[0]) for point in raw_mapped]

        if not route:
            route = [start] if start == goal else [start, goal]

        compact = [point for index, point in enumerate(route) if index == 0 or point != route[index - 1]]
        for first, second in zip(compact, compact[1:]):
            used_edges.add(edge_key(first, second))
        visited.update(compact)
        routes.append(compact)
        protected_by_route.append(protected)
    return routes, visited, protected_by_route


def residual_routes(graph, components, visited):
    """Add any centre-line pixels the teaching hints did not traverse."""
    if not visited:
        visited_tree = None
    else:
        visited_tree = cKDTree(np.array(tuple(visited), dtype=float))
    covered_small_components = {
        node
        for component in components
        if any(node in visited for node in component)
        and max(node[0] for node in component) - min(node[0] for node in component) <= 14
        and max(node[1] for node in component) - min(node[1] for node in component) <= 14
        for node in component
    }
    uncovered = {
        node for component in components for node in component
        if node not in covered_small_components
        # Junction clusters in a thinned raster can be two or three pixels
        # wide even though the teaching route passes through their centre.
        # Only add a route when a genuinely separate visible section is more
        # than four source pixels from every reviewed route.
        if visited_tree is None or visited_tree.query(node)[0] > 7.0
    }
    routes = []
    while uncovered:
        seed = min(uncovered)
        queue = [seed]
        piece = {seed}
        uncovered.remove(seed)
        while queue:
            current = queue.pop()
            for neighbour in graph[current]:
                if neighbour in uncovered:
                    uncovered.remove(neighbour)
                    piece.add(neighbour)
                    queue.append(neighbour)
        if len(piece) <= 2:
            continue
        endpoints = [node for node in piece if sum(neighbour in piece for neighbour in graph[node]) <= 1]
        start = min(endpoints or piece)
        route = []
        used_edges = set()

        def walk(node):
            route.append(node)
            for neighbour in graph[node]:
                if neighbour not in piece:
                    continue
                edge = tuple(sorted((node, neighbour)))
                if edge in used_edges:
                    continue
                used_edges.add(edge)
                walk(neighbour)
                route.append(node)

        walk(start)
        routes.append(route)
    return routes


def extract_routes(crop, hints):
    alpha = np.asarray(crop.getchannel('A'))
    binary = alpha >= 32
    skeleton = zhang_suen(binary)
    graph, component_ids, components = graph_for_skeleton(skeleton)
    if not graph:
        raise ValueError('Skeleton is empty')
    y_values = [node[0] for node in graph]
    x_values = [node[1] for node in graph]
    bounds = (min(y_values), min(x_values), max(y_values), max(x_values))
    routes, visited, protected_by_route = mapped_hint_routes(
        hints, graph, component_ids, components, bounds,
    )
    # The reviewed hints already describe every teaching stroke. Earlier
    # versions appended uncovered skeleton twigs to the closest route. Those
    # twigs made Fino reverse over junctions (notably A, N, p and u). Keep the
    # exact hint-projected centre lines and use maximumRouteError below to
    # catch any reference whose hints no longer cover the visible template.

    cleaned = []
    for route, protected in zip(routes, protected_by_route):
        if not route:
            continue
        xy = [(float(x), float(y)) for y, x in route]
        simplified = remove_reversal_spurs(rdp(xy), protected=protected)
        if len(route) <= 5:
            center_x = sum(point[0] for point in xy) / len(xy)
            center_y = sum(point[1] for point in xy) / len(xy)
            simplified = [(center_x, center_y)]
        simplified = smooth_route(simplified)
        cleaned.append(simplified)

    route_pixels = [
        (y, x)
        for route in cleaned
        for x, y in densify(route, step=.75)
    ]
    route_tree = cKDTree(np.array(route_pixels, dtype=float))
    measured_nodes = []
    for component in components:
        component_distance = min(route_tree.query(node)[0] for node in component)
        spans = (
            max(node[0] for node in component) - min(node[0] for node in component),
            max(node[1] for node in component) - min(node[1] for node in component),
        )
        if len(component) <= 4 and max(spans) <= 4 and component_distance > 7.0:
            # A detached raster speck (for example the anti-aliased remnant
            # where a closed stroke overlaps itself) is not a teachable
            # stroke; no pen path could ever reach it.
            continue
        measured_nodes.extend(component)
    maximum_error = max(route_tree.query(node)[0] for node in measured_nodes)
    route_x_values = [x for route in cleaned for x, _ in route]
    route_y_values = [y for route in cleaned for _, y in route]
    min_y, min_x, max_y, max_x = bounds
    geometry = {
        'inkX': min_x, 'inkY': min_y,
        'inkWidth': max(1, max_x - min_x), 'inkHeight': max(1, max_y - min_y),
        'routeX': round(min(route_x_values), 3), 'routeY': round(min(route_y_values), 3),
        'routeWidth': round(max(1, max(route_x_values) - min(route_x_values)), 3),
        'routeHeight': round(max(1, max(route_y_values) - min(route_y_values)), 3),
        'skeletonPixels': len(graph), 'routeCount': len(cleaned),
        'maximumRouteError': round(float(maximum_error), 3),
    }
    normalized = [
        [[round((x - min_x) / 900, 6), round((y - min_y) / 620, 6)] for x, y in route]
        for route in cleaned
    ]
    return normalized, geometry, cleaned


def write_template_data(sheet_urls, glyphs):
    lines = [
        '/** Generated from the approved non-cursive handwriting reference sheets. */',
        'export const CHARACTER_TEMPLATE_SHEETS = Object.freeze({',
    ]
    lines.extend(
        f"  {key}: new URL('../assets/handwriting-templates/{filename}', import.meta.url).href,"
        for key, filename in sheet_urls
    )
    lines += ['});', '', 'export const CHARACTER_TEMPLATE_CROPS = Object.freeze({']
    lines.extend(
        f"  {character!r}: Object.freeze({{ sheet: '{data['sheet']}', x: {data['x']}, y: {data['y']}, width: {data['width']}, height: {data['height']} }}),"
        for character, data in glyphs.items()
    )
    lines += [
        '});', '',
        'export function characterTemplateCrop(character) {',
        '  return CHARACTER_TEMPLATE_CROPS[character] ?? null;',
        '}', '',
    ]
    TEMPLATE_DATA.write_text('\n'.join(lines), encoding='utf-8')


def write_stroke_data(strokes, geometry):
    raw_strokes = json.dumps(strokes, ensure_ascii=False, separators=(',', ':'))
    raw_geometry = json.dumps(geometry, ensure_ascii=False, separators=(',', ':'))
    content = f"""/** Generated exact centre lines from the approved template pixels. */
const RAW_CHARACTER_STROKES = {raw_strokes};
const RAW_CHARACTER_GEOMETRY = {raw_geometry};

const freezeStrokes = (strokes) => Object.freeze(strokes.map((stroke) => Object.freeze(
  stroke.map(([x, y]) => Object.freeze({{ x, y }})),
)));

export const CHARACTER_STROKES = Object.freeze(Object.fromEntries(
  Object.entries(RAW_CHARACTER_STROKES).map(([character, routes]) => [character, freezeStrokes(routes)]),
));

export const CHARACTER_STROKE_GEOMETRY = Object.freeze(Object.fromEntries(
  Object.entries(RAW_CHARACTER_GEOMETRY).map(([character, metrics]) => [character, Object.freeze(metrics)]),
));

export function characterStrokes(character) {{
  return CHARACTER_STROKES[character] ?? null;
}}

export function characterStrokeGeometry(character) {{
  return CHARACTER_STROKE_GEOMETRY[character] ?? null;
}}
"""
    STROKE_DATA.write_text(content, encoding='utf-8')


def write_contact_sheet(records):
    columns = 13
    cell_width = 164
    cell_height = 190
    rows = math.ceil(len(records) / columns)
    sheet = Image.new('RGB', (columns * cell_width, rows * cell_height), '#f7f9f8')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=17)
    for index, (character, crop, routes, geometry) in enumerate(records):
        column = index % columns
        row = index // columns
        left = column * cell_width
        top = row * cell_height
        draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1), outline='#c8d4d8')
        draw.text((left + 8, top + 6), character, fill='#23343a', font=font)
        available_width = cell_width - 24
        available_height = cell_height - 38
        scale = min(available_width / crop.width, available_height / crop.height)
        display = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
        x0 = left + (cell_width - display.width) // 2
        y0 = top + 28 + (available_height - display.height) // 2
        background = Image.new('RGBA', display.size, '#ffffff')
        background.alpha_composite(display)
        sheet.paste(background.convert('RGB'), (x0, y0))
        for route_index, route in enumerate(routes):
            points = [(x0 + x * scale, y0 + y * scale) for x, y in route]
            if len(points) == 1:
                x, y = points[0]
                draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=ROUTE_COLOURS[route_index % len(ROUTE_COLOURS)])
            else:
                draw.line(points, fill=ROUTE_COLOURS[route_index % len(ROUTE_COLOURS)], width=2, joint='curve')
            if points:
                x, y = points[0]
                draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill='#1f9d62', outline='#ffffff', width=1)
        draw.text(
            (left + 7, top + cell_height - 19),
            f"{geometry['routeCount']} Str. · {geometry['maximumRouteError']:.1f}px",
            fill='#587078', font=ImageFont.load_default(),
        )
    QA_OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet.save(QA_OUTPUT / 'all-character-centrelines.png', optimize=True)


UMLAUT_BASES = {'Ä': 'A', 'Ö': 'O', 'Ü': 'U', 'ä': 'a', 'ö': 'o', 'ü': 'u'}


def _join_strokes(first, second, tolerance):
    """Join a round body into its stem/tail as one continuous pen motion."""
    if (len(first) > 1 and len(second) > 1
            and abs(first[-1][0] - first[0][0]) < tolerance
            and abs(first[-1][1] - first[0][1]) < tolerance):
        first = first[:-1]
    return first + second


def extract_umlaut(crop, base_letter):
    """Routes for an umlaut crop: the base letter's centre lines plus one
    single-point route per real source-sheet dot.

    The crop contains the base glyph and its two dots as disconnected
    components.  The base routes are extracted exactly like the base letter's
    (including the one-stroke join for a/d), then the dots become their own
    single-point routes so Fino and recognition use the real dot positions.
    All coordinates are normalised against the full crop's ink bounds.
    """
    alpha = np.asarray(crop.getchannel('A'))
    binary = alpha >= 32
    labels, count = ndimage.label(binary)
    components = []
    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        components.append((len(xs), int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, label))
    components.sort(reverse=True)
    base_component = components[0][-1]
    base_mask = labels == base_component
    base_rgba = np.zeros((*crop.size[::-1], 4), dtype=np.uint8)
    base_rgba[:, :, 3] = np.where(base_mask, alpha, 0)
    base_image = Image.fromarray(base_rgba, 'RGBA')
    base_routes, _, base_display = extract_routes(base_image, ROUTE_HINTS[base_letter])
    if base_letter in ONE_STROKE_CHARACTERS and len(base_routes) == 2:
        base_routes = [_join_strokes(base_routes[0], base_routes[1], 0.0005)]
        base_display = [_join_strokes(base_display[0], base_display[1], 0.45)]

    dot_components = sorted(components[1:], key=lambda item: item[1])
    dot_routes = []
    for _, _, _, _, _, label in dot_components:
        ys, xs = np.where(labels == label)
        dot_routes.append([(float(xs.mean()), float(ys.mean()))])

    all_display = base_display + dot_routes
    ys, xs = np.where(binary)
    ink_min_x, ink_min_y = int(xs.min()), int(ys.min())
    ink_max_x, ink_max_y = int(xs.max()) + 1, int(ys.max()) + 1
    normalized = [
        [[round((px - ink_min_x) / 900, 6), round((py - ink_min_y) / 620, 6)] for px, py in route]
        for route in all_display
    ]
    route_points = [point for route in all_display for point in route]
    route_x = min(point[0] for point in route_points)
    route_y = min(point[1] for point in route_points)
    route_width = max(1, max(point[0] for point in route_points) - route_x)
    route_height = max(1, max(point[1] for point in route_points) - route_y)
    route_tree = cKDTree(np.array([
        point for route in all_display for point in densify(route, step=.75)
    ], dtype=float))
    # The centre-line fidelity metric applies to the base letter's ink.  Each
    # dot is a point route placed inside its own ink, so its radius is not a
    # route miss; the base component alone pins the extraction quality.
    ys_c, xs_c = np.where(labels == base_component)
    base_points = np.array(list(zip(xs_c.astype(float), ys_c.astype(float))))
    errors = [float(route_tree.query(base_points)[0].max())]
    geometry = {
        'inkX': ink_min_x, 'inkY': ink_min_y,
        'inkWidth': max(1, ink_max_x - ink_min_x), 'inkHeight': max(1, ink_max_y - ink_min_y),
        'routeX': round(route_x, 3), 'routeY': round(route_y, 3),
        'routeWidth': round(route_width, 3), 'routeHeight': round(route_height, 3),
        'skeletonPixels': int(binary.sum()), 'routeCount': len(normalized),
        'maximumRouteError': round(max(errors), 3),
    }
    return normalized, geometry, all_display


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    glyphs = {}
    routes_by_character = {}
    geometry_by_character = {}
    sheet_urls = []
    contact_records = []

    for spec in SHEETS:
        source = Image.open(REFERENCE / spec['file'])
        mask = glyph_mask(source)
        output_name = f"{spec['key']}-mask.png"
        mask.save(OUTPUT / output_name, optimize=True)
        sheet_urls.append((spec['key'], output_name))

        for index, character in enumerate(spec['characters']):
            row = index // spec['columns']
            column = index % spec['columns']
            box = (
                round(spec['left'] + column * spec['cell_width']), spec['row_tops'][row],
                round(spec['left'] + (column + 1) * spec['cell_width']),
                spec['row_tops'][row] + spec['cell_height'],
            )
            x, y, width, height = content_bounds(mask, box)
            crop = mask.crop((x, y, x + width, y + height))
            if character in UMLAUT_BASES:
                routes, geometry, display_routes = extract_umlaut(crop, UMLAUT_BASES[character])
            else:
                routes, geometry, display_routes = extract_routes(crop, ROUTE_HINTS[character])
            if character in ONE_STROKE_CHARACTERS and len(routes) == 2:
                # a, d, p, q, g and 9 are taught as one continuous pen motion:
                # the round body runs without lifting into the stem or tail.
                # The two hint strokes already end/start on the shared centre
                # line, so joining them keeps the route on the ink and the
                # connecting segment is exactly the taught retrace (the d/p
                # stem, the q/g/9 tail).  A closed round body returns to its
                # own start point as its final point; that redundant close
                # would make Fino do a tiny loop at the junction before the
                # stem, so it is dropped.
                routes = [_join_strokes(routes[0], routes[1], 0.0005)]
                display_routes = [_join_strokes(display_routes[0], display_routes[1], 0.45)]
                geometry['routeCount'] = 1
            glyphs[character] = {'sheet': spec['key'], 'x': x, 'y': y, 'width': width, 'height': height}
            geometry.update({'cropWidth': width, 'cropHeight': height})
            routes_by_character[character] = routes
            geometry_by_character[character] = geometry
            contact_records.append((character, crop, display_routes, geometry))

    write_template_data(sheet_urls, glyphs)
    write_stroke_data(routes_by_character, geometry_by_character)
    write_contact_sheet(contact_records)
    worst = max(geometry_by_character.items(), key=lambda item: item[1]['maximumRouteError'])
    print(f"Generated {len(routes_by_character)} glyphs; worst centre-line miss: {worst[0]} {worst[1]['maximumRouteError']}px")


if __name__ == '__main__':
    main()
