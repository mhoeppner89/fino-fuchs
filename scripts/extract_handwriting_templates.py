#!/usr/bin/env python3
"""Build child-facing masks and exact centre-line routes from approved sheets.

The raster mask is the visual source of truth.  A Zhang-Suen thinning pass
extracts its centre line.  Reviewed route hints determine only the teaching
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
from scipy.spatial import cKDTree


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'design' / 'print-handwriting-reference'
OUTPUT = ROOT / 'assets' / 'handwriting-templates'
TEMPLATE_DATA = ROOT / 'js' / 'handwriting-template-data.js'
STROKE_DATA = ROOT / 'js' / 'handwriting-stroke-data.js'
ROUTE_HINTS = REFERENCE / 'stroke-route-hints.json'
QA_OUTPUT = ROOT / 'qa-stroke-system-2026-07-31'

SHEETS = (
    {
        'key': 'uppercase', 'file': 'uppercase-v1.png',
        'characters': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'columns': 13,
        'left': 42, 'row_tops': (101, 347), 'cell_width': 161, 'cell_height': 209,
    },
    {
        'key': 'lowercase', 'file': 'lowercase-v2.png',
        'characters': 'abcdefghijklmnopqrstuvwxyz', 'columns': 13,
        'left': 33, 'row_tops': (138, 425), 'cell_width': 142, 'cell_height': 273,
    },
    {
        'key': 'digits', 'file': 'digits-v1.png',
        'characters': '0123456789', 'columns': 10,
        'left': 21, 'row_tops': (183,), 'cell_width': 213, 'cell_height': 294,
    },
)

NEIGHBOURS = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
ROUTE_COLOURS = ('#e76f51', '#2a9d8f', '#6c63b5', '#e9a23b', '#2679a8', '#c75c7b')


def route_hints(*strokes):
    return [[{'x': x, 'y': y} for x, y in stroke] for stroke in strokes]


# The former Kiwi-derived paths are useful for teaching order, but these
# approved print forms differ materially in a few places.  Explicit waypoints
# keep those routes natural while projection still constrains every point to
# the extracted raster centre line.
ROUTE_HINT_OVERRIDES = {
    '1': route_hints(((0, .14), (1, 0), (1, 1))),
    '2': route_hints(((.05, .16), (.23, .03), (.55, 0), (.85, .08), (1, .27), (.93, .43),
                      (.72, .59), (.48, .73), (.08, 1), (1, 1))),
    '3': route_hints(((.05, .12), (.3, 0), (.68, .02), (.96, .18), (.95, .38), (.78, .49),
                      (.58, .52)),
                     ((.58, .52), (.8, .54), (1, .68), (.94, .88), (.68, 1), (.3, .98), (0, .83))),
    '4': route_hints(((.12, 0), (0, .5), (1, .5)), ((.82, 0), (.82, 1))),
    '9': route_hints(((1, .4), (.92, .14), (.67, 0), (.28, .02), (.03, .2), (0, .45),
                      (.2, .61), (.62, .65), (1, .4), (.98, .67), (.84, .87), (.58, 1))),
    'B': route_hints(((0, 0), (0, 1)),
                     ((0, 0), (.55, 0), (1, .15), (.96, .36), (.62, .5), (0, .5)),
                     ((0, .5), (.62, .5), (1, .66), (.96, .88), (.55, 1), (0, 1))),
    'J': route_hints(((0, 0), (1, 0)), ((.56, 0), (.56, .7), (.48, .88), (.25, 1), (0, .85))),
    'a': route_hints(((1, .08), (.72, 0), (.3, .02), (0, .3), (.02, .72), (.32, 1),
                      (.72, .98), (1, .72), (1, .08)), ((1, 0), (1, 1))),
    'b': route_hints(((0, 0), (0, 1)),
                     ((0, .4), (.35, .28), (.72, .3), (1, .5), (.9, .82),
                      (.55, 1), (.18, .92), (0, .7))),
    'd': route_hints(((1, .45), (.72, .38), (.3, .42), (0, .62), (.04, .88), (.4, 1),
                      (.78, .94), (1, .75)), ((1, 0), (1, 1))),
    'f': route_hints(((1, 0), (.72, 0), (.58, .12), (.52, 1)), ((0, .48), (1, .48))),
    'g': route_hints(((1, .04), (.7, 0), (.27, .03), (0, .23), (.02, .52), (.3, .65),
                      (.72, .62), (1, .42), (1, .04)),
                     ((1, 0), (1, .7), (.92, .9), (.62, 1), (.25, .94))),
    'm': route_hints(((0, 1), (0, 0)), ((0, 0), (.2, 0), (.42, .2), (.42, 1)),
                     ((.42, .2), (.62, 0), (.83, .03), (1, .23), (1, 1))),
    'n': route_hints(((0, 1), (0, 0)), ((0, 0), (.3, 0), (.65, .08), (1, .3), (1, 1))),
    'p': route_hints(((0, 0), (0, 1)), ((0, 0), (.48, 0), (.85, .12), (1, .35),
                      (.92, .62), (.58, .72), (0, .62))),
    'r': route_hints(((0, 1), (0, 0)), ((0, .2), (.35, 0), (.72, .04), (1, .22))),
    'u': route_hints(((0, 0), (0, .62), (.15, .9), (.48, 1), (.82, .9), (1, .72)),
                     ((1, 0), (1, .72))),
}


def luma(red, green, blue):
    return red * 0.2126 + green * 0.7152 + blue * 0.0722


def glyph_mask(source):
    source = source.convert('RGBA')
    output = Image.new('RGBA', source.size)
    pixels = []
    for red, green, blue, alpha in source.get_flattened_data():
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


def remove_reversal_spurs(points):
    """Collapse raster-junction spikes while retaining genuine corners."""
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
            if cosine < -0.8:
                del cleaned[index]
                changed = True
                break
    return cleaned


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
        # Pen-down and pen-up positions occur at visible ends, crossings, or
        # outer extrema.  Restricting endpoint projection to these landmarks
        # prevents an A leg from snapping to its nearby crossbar.
        anchors = {node for node, degree in degrees.items() if degree != 2} | extrema
        component_anchors.append(anchors or nodes)

    mapped_strokes = []
    for hint_stroke in hints:
        mapped = densify([map_point(point) for point in hint_stroke])
        if not mapped:
            continue
        sample = mapped[::max(1, len(mapped) // 48)]
        component_index = min(
            range(len(components)),
            key=lambda index: sum(float(component_trees[index].query(point)[0]) for point in sample),
        )
        mapped_strokes.append((hint_stroke, mapped, component_index))

    remaining_counts = Counter(component_index for _, _, component_index in mapped_strokes)
    used_edges = [set() for _ in components]
    endpoint_cache = {}
    routes = []
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

    for hint_stroke, mapped, component_index in mapped_strokes:
        remaining_counts[component_index] -= 1
        edges = component_edges[component_index]
        if not edges:
            point = components[component_index][0]
            routes.append([point])
            visited.add(point)
            continue

        start = project_endpoint(hint_stroke[0], mapped[0], component_index)
        goal = project_endpoint(hint_stroke[-1], mapped[-1], component_index)
        available = edges - used_edges[component_index]
        is_last_for_component = remaining_counts[component_index] == 0
        is_closed_hint = math.dist(
            (hint_stroke[0]['x'], hint_stroke[0]['y']),
            (hint_stroke[-1]['x'], hint_stroke[-1]['y']),
        ) <= .035

        route = []
        if is_closed_hint and available:
            if is_last_for_component:
                remaining_piece = edge_component(start, available)
                degrees = Counter(node for edge in remaining_piece for node in edge)
                odd = [node for node, degree in degrees.items() if degree % 2]
                if len(odd) in (0, 2):
                    route = ordered_euler_trail(start, remaining_piece, mapped)
            if not route:
                route = hinted_cycle(graph, start, available, mapped)

        if not route and is_last_for_component and available:
            remaining_piece = edge_component(start, available)
            if not remaining_piece:
                nearest = min(
                    {node for edge in available for node in edge},
                    key=lambda node: math.dist(node, mapped[0]),
                )
                remaining_piece = edge_component(nearest, available)
                start = nearest
            piece_nodes = {node for edge in remaining_piece for node in edge}
            degrees = Counter(node for edge in remaining_piece for node in edge)
            odd = [node for node, degree in degrees.items() if degree % 2]
            if goal in piece_nodes and len(odd) in (0, 2):
                route = ordered_euler_trail(start, remaining_piece, mapped)
            elif goal in piece_nodes:
                route = weighted_edge_path(
                    graph, start, goal, remaining_piece,
                    cKDTree(np.array(mapped, dtype=float)), used_edges[component_index],
                )

        if not route:
            route = weighted_edge_path(
                graph, start, goal, edges,
                cKDTree(np.array(mapped, dtype=float)), used_edges[component_index],
            )
        if not route:
            route = [start] if start == goal else [start, goal]

        compact = [point for index, point in enumerate(route) if index == 0 or point != route[index - 1]]
        for first, second in zip(compact, compact[1:]):
            used_edges[component_index].add(edge_key(first, second))
        visited.update(compact)
        routes.append(compact)
    return routes, visited


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
    routes, visited = mapped_hint_routes(hints, graph, component_ids, components, bounds)
    # The reviewed hints already describe every teaching stroke. Earlier
    # versions appended uncovered skeleton twigs to the closest route. Those
    # twigs made Fino reverse over junctions (notably A, N, p and u). Keep the
    # exact hint-projected centre lines and use maximumRouteError below to
    # catch any reference whose hints no longer cover the visible template.

    cleaned = []
    for route in routes:
        if not route:
            continue
        xy = [(float(x), float(y)) for y, x in route]
        simplified = remove_reversal_spurs(rdp(xy))
        if len(route) <= 5:
            center_x = sum(point[0] for point in xy) / len(xy)
            center_y = sum(point[1] for point in xy) / len(xy)
            simplified = [(center_x, center_y)]
        cleaned.append(simplified)

    route_pixels = [
        (y, x)
        for route in cleaned
        for x, y in densify(route, step=.75)
    ]
    route_tree = cKDTree(np.array(route_pixels, dtype=float))
    maximum_error = max(route_tree.query(node)[0] for node in graph)
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


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    hints = json.loads(ROUTE_HINTS.read_text(encoding='utf-8'))
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
            routes, geometry, display_routes = extract_routes(
                crop,
                ROUTE_HINT_OVERRIDES.get(character, hints[character]),
            )
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
