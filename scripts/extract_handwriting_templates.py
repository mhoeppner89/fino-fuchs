#!/usr/bin/env python3
"""Build approved masks and sample the reviewed line/Bezier teaching paths.

The masks are unchanged source artwork. clean-stroke-paths.json describes
pen movements in each source crop's pixel coordinates. Pixel skeletons are
used only to report fidelity, never to generate movement. Run this script
after editing the canonical paths; do not edit generated runtime points.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from clean_handwriting_paths import extract_clean_routes


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

ROUTE_COLOURS = ('#e76f51', '#2a9d8f', '#6c63b5', '#e9a23b', '#2679a8', '#c75c7b')


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
    content = f"""/** Generated from reviewed source-aligned lines and Bezier curves. See scripts/extract_handwriting_templates.py. */
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
            routes, geometry, display_routes = extract_clean_routes(
                character, crop, zhang_suen(np.asarray(crop.getchannel('A')) >= 32),
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
