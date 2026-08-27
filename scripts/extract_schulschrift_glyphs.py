#!/usr/bin/env python3
"""Slice the approved Schulschrift sheet into per-character reference sheets.

The approved artwork (`SCHULSCHRIFT.png`, black ink in the alpha channel) is
the single source of truth for the new font.  This script cuts it into the
62 exercisable characters (A-Z, a-z, 0-9), lays them out on uniform white
reference sheets, and writes a debug contact sheet for visual review.

Umlauts are derived in the app from the base letters, and ß is normalised to
"ss" for names, so the pair cells Ää, Öö, Üü and ß are intentionally skipped.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'SCHULSCHRIFT.png'
REFERENCE = ROOT / 'design' / 'print-handwriting-reference'
DEBUG_SHEET = REFERENCE / 'schulschrift-glyph-crops.png'
INK_RGB = (18, 22, 24)
ALPHA_THRESHOLD = 32

# Visual grid of the approved sheet: six pair rows of five cells, then digits.
ROW_LETTERS = (
    ('Aa', 'Bb', 'Cc', 'Dd', 'Ee'),
    ('Ff', 'Gg', 'Hh', 'Ii', 'Jj'),
    ('Kk', 'Ll', 'Mm', 'Nn', 'Oo'),
    ('Pp', 'Qq', 'Rr', 'Ss', 'Tt'),
    ('Uu', 'Vv', 'Ww', 'Xx', 'Yy'),
    ('Zz', 'Ää', 'Öö', 'Üü', 'ß'),
)
DIGIT_CELLS = ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')
COLUMN_STARTS = (95, 372, 640, 920, 1225)
COLUMN_END = 1435
SHEET_COLUMNS = 13
CELL_PADDING = 18


def row_bands(ink):
    """Seven content bands: six letter rows plus the digit row."""
    first_column = ink[:, COLUMN_STARTS[0]:292]
    occupied = first_column.any(axis=1)
    bands = []
    y = 0
    while y < occupied.shape[0]:
        if occupied[y]:
            top = y
            while y < occupied.shape[0] and occupied[y]:
                y += 1
            bands.append([top, y])
        else:
            y += 1
    assert len(bands) == 6, f'expected six letter bands, found {len(bands)}'
    # The P and U rows merge in the projection; split at the emptiest valley.
    merged = bands[3]
    height = merged[1] - merged[0]
    window = ink[merged[0]:merged[1], COLUMN_STARTS[0]:292]
    density = window.sum(axis=1)
    offset = height // 3
    valley = merged[0] + offset + int(np.argmin(density[offset:2 * offset]))
    bands[3:4] = [[merged[0], valley], [valley, merged[1]]]
    return bands[:6]


def digit_band(ink, letter_bands):
    first_column = ink[:, COLUMN_STARTS[0]:292]
    occupied = first_column.any(axis=1)
    bands = []
    y = 0
    while y < occupied.shape[0]:
        if occupied[y]:
            top = y
            while y < occupied.shape[0] and occupied[y]:
                y += 1
            bands.append((top, y))
        else:
            y += 1
    return bands[-1]


def component_rows(ink, bands):
    """Label the full sheet once and assign every component to a row band.

    Descenders (j, y, g) cross the visual row boundaries, so components are
    joined on the unclipped image first and then assigned to the band their
    pixels overlap most.
    """
    labels, count = ndimage.label(ink)
    assignment = {}
    for label in range(1, count + 1):
        ys, _ = np.where(labels == label)
        y_min, y_max = ys.min(), ys.max() + 1
        overlaps = [max(0, min(y_max, bottom) - max(y_min, top)) for top, bottom in bands]
        assignment[label] = int(np.argmax(overlaps))
    return labels, assignment


def cell_component_masks(labels, assignment, row_index, x_range):
    """Full-image masks of one row's components inside an x-range."""
    chosen = [label for label, row in assignment.items() if row == row_index]
    if not chosen:
        raise ValueError(f'row {row_index} has no components')
    masked = np.where(np.isin(labels, chosen), labels, 0)
    x0, x1 = x_range
    masked[:, :x0] = 0
    masked[:, x1:] = 0
    present = [int(label) for label in np.unique(masked) if label]
    if not present:
        raise ValueError(f'row {row_index} x-range {x_range} is empty')
    return {label: (masked == label) for label in present}


def mask_bounds(masks):
    ys, xs = np.where(np.logical_or.reduce(masks))
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def split_pair_components(component_masks):
    """Group a pair cell's components into (uppercase, lowercase) bounds+masks."""
    intervals = sorted(
        (int(xs.min()), int(xs.max()), label)
        for label, mask in component_masks.items()
        for xs in [np.where(mask)[1]]
    )
    gaps = [
        (right[0] - left[1], index)
        for index, (left, right) in enumerate(zip(intervals, intervals[1:]))
    ]
    width, index = max(gaps)
    if width < 2:
        raise ValueError('pair glyphs overlap without a separating gap')
    upper = [component_masks[intervals[i][2]] for i in range(index + 1)]
    lower = [component_masks[intervals[i][2]] for i in range(index + 1, len(intervals))]
    return mask_bounds(upper), mask_bounds(lower), upper, lower


def split_umlaut_pair(component_masks):
    """Split an umlaut cell (Ää, Öö, Üü) into (uppercase, lowercase) bounds.

    Each cell contains six disconnected components: the uppercase base and
    its two dots, then the lowercase base and its two dots. The dots sit
    above their base in the same x-range, so the largest horizontal gap
    separates the two cases; each side must hold exactly base + 2 dots.
    """
    intervals = sorted(
        (int(np.where(mask)[1].min()), int(np.where(mask)[1].max()), label)
        for label, mask in component_masks.items()
    )
    gaps = [
        (right[0] - left[1], index)
        for index, (left, right) in enumerate(zip(intervals, intervals[1:]))
    ]
    _, index = max(gaps)
    upper = [component_masks[intervals[i][2]] for i in range(index + 1)]
    lower = [component_masks[intervals[i][2]] for i in range(index + 1, len(intervals))]
    if len(upper) != 3 or len(lower) != 3:
        raise ValueError(f'umlaut cell must have base + two dots per case, got {len(upper)} / {len(lower)}')
    return mask_bounds(upper), mask_bounds(lower), upper, lower


def glyph_image(source_alpha, box, keep_masks=None):
    """Crop one glyph, keeping only its own components' pixels.

    Neighbouring glyphs bleed into a crop box: descenders of the row above
    (g, j, y, p, q) dip into the next row's cells, so a raw rectangle crop
    would carry foreign ink (e.g. the g tail that poked into the l box and
    looked like a stray blob on the l sprite). When keep_masks is given,
    every pixel outside those components is cleared.
    """
    x0, y0, x1, y1 = box
    alpha = source_alpha[y0:y1, x0:x1].copy()
    if keep_masks:
        keep = np.logical_or.reduce([mask[y0:y1, x0:x1] for mask in keep_masks])
        alpha = np.where(keep, alpha, 0)
    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[:, :, 0] = INK_RGB[0]
    rgba[:, :, 1] = INK_RGB[1]
    rgba[:, :, 2] = INK_RGB[2]
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, 'RGBA')


def main():
    REFERENCE.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    alpha = np.array(source)[:, :, 3]
    ink = alpha >= ALPHA_THRESHOLD
    letter_bands = row_bands(ink)
    digits_band = digit_band(ink, letter_bands)
    labels, assignment = component_rows(ink, [*letter_bands, digits_band])

    glyphs = {}
    for row_index, (band, pairs) in enumerate(zip(letter_bands, ROW_LETTERS)):
        for column_index, pair in enumerate(pairs):
            x_range = (
                COLUMN_STARTS[column_index] - 6,
                COLUMN_STARTS[column_index + 1] - 48 if column_index < 4 else COLUMN_END,
            )
            masks = cell_component_masks(labels, assignment, row_index, x_range)
            if len(pair) == 1:
                continue
            upper, lower = pair
            if pair in ('Ää', 'Öö', 'Üü'):
                upper_box, lower_box, upper_masks, lower_masks = split_umlaut_pair(masks)
            else:
                upper_box, lower_box, upper_masks, lower_masks = split_pair_components(masks)
            glyphs[upper] = glyph_image(alpha, upper_box, upper_masks)
            glyphs[lower] = glyph_image(alpha, lower_box, lower_masks)

    digit_top, digit_bottom = digits_band
    columns = ink[digit_top:digit_bottom, 90:1440].any(axis=0)
    edges = []
    start = None
    for index, filled in enumerate(columns):
        if filled and start is None:
            start = index
        if not filled and start is not None:
            edges.append([start, index])
            start = None
    if start is not None:
        edges.append([start, len(columns)])
    merged = []
    for edge in edges:
        if merged and edge[0] - merged[-1][1] < 30:
            merged[-1][1] = edge[1]
        else:
            merged.append(edge)
    assert len(merged) == len(DIGIT_CELLS), f'expected {len(DIGIT_CELLS)} digit cells, found {len(merged)}: {merged}'
    for (cell_left, cell_right), label in zip(merged, DIGIT_CELLS):
        masks = cell_component_masks(labels, assignment, len(letter_bands), (90 + cell_left - 3, 90 + cell_right + 3))
        if label == '10':
            _, zero_box, _, zero_masks = split_pair_components(masks)
            glyphs['0'] = glyph_image(alpha, zero_box, zero_masks)
        else:
            keep = list(masks.values())
            glyphs[label] = glyph_image(alpha, mask_bounds(keep), keep)

    expected = [chr(c) for c in range(ord('A'), ord('Z') + 1)] + \
               [chr(c) for c in range(ord('a'), ord('z') + 1)] + \
               list('ÄÖÜäöü') + [str(d) for d in range(10)]
    missing = [character for character in expected if character not in glyphs]
    assert not missing, f'missing glyphs: {missing}'

    # Debug contact sheet of every crop.
    cell_w = max(image.width for image in glyphs.values()) + 24
    cell_h = max(image.height for image in glyphs.values()) + 44
    cols = 10
    rows = (len(expected) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), '#ffffff')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for index, character in enumerate(expected):
        left = (index % cols) * cell_w
        top = (index // cols) * cell_h
        draw.rectangle((left, top, left + cell_w - 1, top + cell_h - 1), outline='#d0d8dc')
        draw.text((left + 6, top + 4), character, fill='#23343a', font=font)
        image = glyphs[character]
        background = Image.new('RGBA', (cell_w, cell_h - 30), '#ffffff')
        background.alpha_composite(image, ((cell_w - image.width) // 2, 26 + (cell_h - 60 - image.height) // 2))
        sheet.paste(background.convert('RGB'), (left, top))
    sheet.save(DEBUG_SHEET, optimize=True)

    # Uniform white reference sheets at native resolution.
    def build_sheet(characters, name):
        cell_w = max(glyphs[c].width for c in characters) + CELL_PADDING * 2
        cell_h = max(glyphs[c].height for c in characters) + CELL_PADDING * 2
        rows = (len(characters) + SHEET_COLUMNS - 1) // SHEET_COLUMNS
        out = Image.new('RGB', (SHEET_COLUMNS * cell_w, rows * cell_h), '#ffffff')
        for index, character in enumerate(characters):
            image = glyphs[character]
            left = (index % SHEET_COLUMNS) * cell_w
            top = (index // SHEET_COLUMNS) * cell_h
            out.paste(
                image,
                (left + (cell_w - image.width) // 2, top + (cell_h - image.height) // 2),
                image,
            )
        out.save(REFERENCE / name, optimize=True)
        print(f'{name}: {out.size}, cell {cell_w}x{cell_h}')

    build_sheet([chr(c) for c in range(ord('A'), ord('Z') + 1)] + list('ÄÖÜ'), 'uppercase-v2.png')
    build_sheet([chr(c) for c in range(ord('a'), ord('z') + 1)] + list('äöü'), 'lowercase-v3.png')
    build_sheet([str(d) for d in range(10)], 'digits-v2.png')
    sizes = {c: (glyphs[c].width, glyphs[c].height) for c in expected}
    print('glyph sizes:', sizes)
    print(f'wrote {len(glyphs)} glyphs; debug sheet: {DEBUG_SHEET}')


def baseline_offsets():
    """Print the JS map of crop-top-to-baseline distances for name layout."""
    source = Image.open(SOURCE).convert('RGBA')
    alpha = np.array(source)[:, :, 3]
    ink = alpha >= ALPHA_THRESHOLD
    letter_bands = row_bands(ink)
    digits_band = digit_band(ink, letter_bands)
    labels, assignment = component_rows(ink, [*letter_bands, digits_band])
    # Flat-bottom capitals per row pin the drawn baseline; rounded or pointed
    # glyphs overshoot it by a pixel or two.
    flat_bottoms = {
        0: ['B', 'E'], 1: ['F', 'H', 'I'], 2: ['K', 'L', 'M', 'N'],
        3: ['P', 'R', 'T'], 4: ['U', 'X'], 5: ['Z'],
    }
    boxes = {}
    for row_index, (band, pairs) in enumerate(zip(letter_bands, ROW_LETTERS)):
        for column_index, pair in enumerate(pairs):
            if len(pair) == 1:
                continue
            x_range = (
                COLUMN_STARTS[column_index] - 6,
                COLUMN_STARTS[column_index + 1] - 48 if column_index < 4 else COLUMN_END,
            )
            masks = cell_component_masks(labels, assignment, row_index, x_range)
            if pair in ('Ää', 'Öö', 'Üü'):
                upper_box, lower_box, _, _ = split_umlaut_pair(masks)
            else:
                upper_box, lower_box, _, _ = split_pair_components(masks)
            boxes[pair[0]] = (*upper_box, row_index)
            boxes[pair[1]] = (*lower_box, row_index)
    baselines = {}
    for row_index, characters in flat_bottoms.items():
        bottoms = []
        for character in characters:
            x0, _, x1, _, _ = boxes[character]
            masks = cell_component_masks(labels, assignment, row_index, (x0 - 2, x1 + 2))
            for mask in masks.values():
                ys, _ = np.where(mask)
                bottoms.append(int(ys.max()))
        baselines[row_index] = int(np.median(bottoms))
    print('const SCHULSCHRIFT_BASELINE_OFFSETS = Object.freeze({')
    letters = [chr(c) for c in range(ord('A'), ord('Z') + 1)]
    letters += [chr(c) for c in range(ord('a'), ord('z') + 1)]
    letters += list('ÄÖÜäöü')
    for character in letters:
        x0, y0, _, _, row_index = boxes[character]
        offset = baselines[row_index] - y0
        print(f"  {character!r}: {offset},")
    print('});')


if __name__ == '__main__':
    main()
    baseline_offsets()
