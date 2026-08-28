/**
 * Fino schreibt curriculum and deterministic session generation.
 * All coordinates are normalized to the drawing board (0..1).
 */

import {
  CHARACTER_STROKES,
  CHARACTER_STROKE_GEOMETRY,
} from './handwriting-stroke-data.js?v=1.3.35';
import {
  connectSolutionStrokes,
  createConnectSpec,
  createMazeSpec,
  layoutConnect,
  layoutMaze,
} from './mini-games.js?v=1.3.35';

const p = (x, y) => ({ x, y });
const poly = (...pairs) => pairs.map(([x, y]) => p(x, y));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function arc(cx, cy, rx, ry, startDeg, endDeg, steps = 32) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const deg = startDeg + (endDeg - startDeg) * t;
    const rad = (deg * Math.PI) / 180;
    points.push(p(cx + Math.cos(rad) * rx, cy + Math.sin(rad) * ry));
  }
  return points;
}

function bezier(a, b, c, d, steps = 28) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push(
      p(
        mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
        mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
      ),
    );
  }
  return points;
}

function join(...segments) {
  return segments.flatMap((segment, index) => (index === 0 ? segment : segment.slice(1)));
}

function spiral(cx, cy, outerRadius, innerRadius, turns = 2, steps = 42) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const radius = outerRadius + (innerRadius - outerRadius) * progress;
    const angle = progress * Math.PI * 2 * turns;
    return p(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  });
}

function makeTask({
  id,
  category,
  title,
  speech,
  label,
  strokes,
  complexity = 1,
  group = 'all',
  example = '',
  family = category,
  value = label,
  layout = '',
  completionGroups = [strokes.map((_, index) => index)],
  angularStrokes = [],
  strokeColors = [],
  gameMode = '',
  game = null,
  responsiveVariant = null,
}) {
  const plannedStrokeColors = strokeColors.length
    ? strokes.map((_, index) => strokeColors[index] ?? null)
    : [];
  return Object.freeze({
    id,
    category,
    title,
    speech,
    label,
    strokes: Object.freeze(strokes.map((stroke) => Object.freeze(stroke))),
    complexity,
    group,
    example,
    family,
    value,
    layout,
    completionGroups: Object.freeze(completionGroups.map((group) => Object.freeze([...group]))),
    angularStrokes: Object.freeze([...angularStrokes]),
    strokeColors: Object.freeze(plannedStrokeColors),
    gameMode,
    game,
    responsiveVariant,
  });
}

const lineTemplates = [
  makeTask({
    id: 'line-vertical', category: 'lines', title: 'Von oben nach unten',
    speech: 'Folge Fino von oben nach unten.', label: '│',
    strokes: [poly([0.5, 0.18], [0.5, 0.82])], complexity: 1,
  }),
  makeTask({
    id: 'line-horizontal', category: 'lines', title: 'Von links nach rechts',
    speech: 'Folge Fino von links nach rechts.', label: '—',
    strokes: [poly([0.18, 0.5], [0.82, 0.5])], complexity: 1,
  }),
  makeTask({
    id: 'line-diagonal-down', category: 'lines', title: 'Schräg nach unten',
    speech: 'Folge Fino schräg nach unten.', label: '╲',
    strokes: [poly([0.25, 0.2], [0.75, 0.8])], complexity: 1,
  }),
  makeTask({
    id: 'line-diagonal-up', category: 'lines', title: 'Schräg nach oben',
    speech: 'Folge Fino schräg nach oben.', label: '╱',
    strokes: [poly([0.25, 0.8], [0.75, 0.2])], complexity: 1,
  }),
  makeTask({
    id: 'line-arch', category: 'lines', title: 'Ein großer Bogen',
    speech: 'Folge Fino über den großen Bogen.', label: '⌒',
    strokes: [arc(0.5, 0.64, 0.32, 0.42, 180, 360, 34)], complexity: 2,
  }),
  makeTask({
    id: 'line-wave', category: 'lines', title: 'Eine Wellenlinie',
    speech: 'Folge Fino durch die Wellen.', label: 'Welle',
    strokes: [join(
      bezier(p(0.12, 0.52), p(0.22, 0.25), p(0.32, 0.25), p(0.42, 0.52), 18),
      bezier(p(0.42, 0.52), p(0.52, 0.79), p(0.62, 0.79), p(0.72, 0.52), 18),
      bezier(p(0.72, 0.52), p(0.8, 0.29), p(0.87, 0.29), p(0.92, 0.5), 14),
    )], complexity: 2,
  }),
  makeTask({
    id: 'line-zigzag', category: 'lines', title: 'Zickzack',
    speech: 'Folge Fino im Zickzack.', label: 'Zickzack',
    strokes: [poly([0.12, 0.72], [0.28, 0.28], [0.44, 0.72], [0.6, 0.28], [0.76, 0.72], [0.9, 0.34])], complexity: 2,
  }),
  makeTask({
    id: 'line-loop', category: 'lines', title: 'Eine Schleife',
    speech: 'Folge Fino durch die große Schleife.', label: '∞',
    strokes: [join(
      bezier(p(0.12, 0.5), p(0.27, 0.12), p(0.42, 0.12), p(0.5, 0.5), 24),
      bezier(p(0.5, 0.5), p(0.58, 0.88), p(0.75, 0.88), p(0.88, 0.5), 24),
      bezier(p(0.88, 0.5), p(0.75, 0.12), p(0.58, 0.12), p(0.5, 0.5), 24),
      bezier(p(0.5, 0.5), p(0.42, 0.88), p(0.27, 0.88), p(0.12, 0.5), 24),
    )], complexity: 3,
  }),
  makeTask({
    id: 'line-spiral', category: 'lines', title: 'Eine Schnecke',
    speech: 'Folge Fino von außen nach innen.', label: 'Spirale',
    strokes: [[...Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const angle = t * Math.PI * 4.4;
      const r = 0.34 * (1 - t * 0.82);
      return p(0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r);
    })]], complexity: 3,
  }),
  makeTask({
    id: 'line-s-curve', category: 'lines', title: 'S-Kurve',
    speech: 'Folge Fino durch die S-Kurve.', label: 'S-Kurve',
    strokes: [join(
      bezier(p(0.2, 0.24), p(0.62, 0.05), p(0.78, 0.38), p(0.5, 0.5), 26),
      bezier(p(0.5, 0.5), p(0.22, 0.62), p(0.38, 0.95), p(0.8, 0.76), 26),
    )], complexity: 3,
  }),
];

const PICTURE_INK = Object.freeze({
  blue: '#3F8FC2',
  brown: '#A86C43',
  charcoal: '#475467',
  cream: '#E9C982',
  green: '#58A765',
  orange: '#E88942',
  pink: '#D65E94',
  purple: '#8D68B8',
  red: '#D96450',
  yellow: '#E4AE21',
});

const shapeTemplates = [
  makeTask({
    id: 'shape-circle', category: 'shapes', title: 'Kreis', speech: 'Male einen Kreis. Starte oben.', label: '○',
    strokes: [arc(0.5, 0.5, 0.36, 0.36, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-oval', category: 'shapes', title: 'Oval', speech: 'Male ein langes Oval.', label: '⬭',
    strokes: [arc(0.5, 0.5, 0.24, 0.38, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-square', category: 'shapes', title: 'Quadrat', speech: 'Male ein Quadrat.', label: '□',
    strokes: [poly([0.22, 0.22], [0.78, 0.22], [0.78, 0.78], [0.22, 0.78], [0.22, 0.22])], complexity: 1, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-triangle', category: 'shapes', title: 'Dreieck', speech: 'Male ein Dreieck.', label: '△',
    strokes: [poly([0.5, 0.18], [0.82, 0.78], [0.18, 0.78], [0.5, 0.18])], complexity: 1, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-cross', category: 'shapes', title: 'Kreuz', speech: 'Male ein großes Kreuz.', label: '＋',
    strokes: [poly([0.5, 0.18], [0.5, 0.82]), poly([0.18, 0.5], [0.82, 0.5])], complexity: 2, angularStrokes: [0, 1],
  }),
  makeTask({
    id: 'shape-diamond', category: 'shapes', title: 'Raute', speech: 'Male eine Raute.', label: '◇',
    strokes: [poly([0.5, 0.14], [0.82, 0.5], [0.5, 0.86], [0.18, 0.5], [0.5, 0.14])], complexity: 2, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-heart', category: 'shapes', title: 'Herz', speech: 'Male ein Herz.', label: 'Herz',
    strokes: [join(
      bezier(p(0.5, 0.82), p(0.17, 0.58), p(0.17, 0.25), p(0.39, 0.24), 24),
      bezier(p(0.39, 0.24), p(0.47, 0.24), p(0.5, 0.31), p(0.5, 0.37), 10),
      bezier(p(0.5, 0.37), p(0.5, 0.31), p(0.54, 0.24), p(0.63, 0.24), 10),
      bezier(p(0.63, 0.24), p(0.85, 0.25), p(0.84, 0.58), p(0.5, 0.82), 24),
    )], complexity: 3,
  }),
  makeTask({
    id: 'shape-star', category: 'shapes', title: 'Stern', speech: 'Male einen Stern.', label: '☆',
    strokes: [poly([0.5, 0.12], [0.59, 0.4], [0.88, 0.4], [0.64, 0.57], [0.73, 0.86], [0.5, 0.68], [0.27, 0.86], [0.36, 0.57], [0.12, 0.4], [0.41, 0.4], [0.5, 0.12])], complexity: 3, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-rectangle', category: 'shapes', title: 'Rechteck', speech: 'Male ein breites Rechteck.', label: '▭',
    strokes: [poly([0.16, 0.3], [0.84, 0.3], [0.84, 0.7], [0.16, 0.7], [0.16, 0.3])], complexity: 1, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-pentagon', category: 'shapes', title: 'Fünfeck', speech: 'Male ein Fünfeck.', label: 'Fünfeck',
    strokes: [poly([0.5, 0.15], [0.82, 0.39], [0.7, 0.82], [0.3, 0.82], [0.18, 0.39], [0.5, 0.15])], complexity: 2, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-hexagon', category: 'shapes', title: 'Sechseck', speech: 'Male ein Sechseck.', label: 'Sechseck',
    strokes: [poly([0.33, 0.18], [0.67, 0.18], [0.84, 0.5], [0.67, 0.82], [0.33, 0.82], [0.16, 0.5], [0.33, 0.18])], complexity: 2, angularStrokes: [0],
  }),
  makeTask({
    id: 'shape-arrow', category: 'shapes', title: 'Pfeil', speech: 'Male einen Pfeil nach rechts.', label: 'Pfeil',
    strokes: [poly([0.14, 0.5], [0.76, 0.5]), poly([0.56, 0.28], [0.78, 0.5], [0.56, 0.72])], complexity: 2, angularStrokes: [0, 1],
  }),
  makeTask({
    id: 'shape-house', category: 'shapes', title: 'Haus', speech: 'Male ein kleines Haus.', label: 'Haus',
    strokes: [poly([0.28, 0.47], [0.5, 0.2], [0.72, 0.47]), poly([0.28, 0.47], [0.28, 0.8], [0.72, 0.8], [0.72, 0.47])], complexity: 2, angularStrokes: [0, 1],
  }),
  makeTask({
    id: 'shape-kite', category: 'shapes', title: 'Drachen', speech: 'Male einen Drachen mit Schwanz.', label: 'Drachen',
    strokes: [poly([0.5, 0.16], [0.77, 0.46], [0.5, 0.75], [0.23, 0.46], [0.5, 0.16]), poly([0.5, 0.75], [0.58, 0.84], [0.5, 0.9], [0.42, 0.84])], complexity: 2, angularStrokes: [0, 1],
  }),
  makeTask({
    id: 'shape-balloon', category: 'shapes', title: 'Ballon', speech: 'Male einen Ballon mit Schnur.', label: 'Ballon',
    strokes: [arc(0.5, 0.4, 0.22, 0.27, -90, 270, 36), poly([0.5, 0.67], [0.46, 0.8], [0.52, 0.88])], complexity: 2, angularStrokes: [1],
  }),
  makeTask({
    id: 'shape-fish', category: 'shapes', title: 'Fisch', speech: 'Male einen Fisch.', label: 'Fisch',
    strokes: [arc(0.45, 0.5, 0.28, 0.18, -90, 270, 32), poly([0.72, 0.5], [0.88, 0.3], [0.88, 0.7], [0.72, 0.5])], complexity: 2, angularStrokes: [1],
  }),
  makeTask({
    id: 'shape-flower', category: 'shapes', title: 'Blume', speech: 'Male eine Blume mit Stiel.', label: 'Blume',
    strokes: [
      arc(0.5, 0.37, 0.075, 0.075, -90, 270, 22),
      arc(0.5, 0.19, 0.1, 0.12, -90, 270, 24),
      arc(0.67, 0.37, 0.11, 0.095, -90, 270, 24),
      arc(0.5, 0.55, 0.1, 0.12, -90, 270, 24),
      arc(0.33, 0.37, 0.11, 0.095, -90, 270, 24),
      poly([0.5, 0.67], [0.5, 0.9]),
      bezier(p(0.5, 0.76), p(0.42, 0.67), p(0.33, 0.69), p(0.31, 0.79), 16),
      bezier(p(0.5, 0.82), p(0.58, 0.73), p(0.67, 0.75), p(0.69, 0.85), 16),
    ],
    complexity: 3, angularStrokes: [5],
    strokeColors: [PICTURE_INK.yellow, PICTURE_INK.pink, PICTURE_INK.pink, PICTURE_INK.pink, PICTURE_INK.pink, PICTURE_INK.green, PICTURE_INK.green, PICTURE_INK.green],
  }),
  makeTask({
    id: 'shape-sun', category: 'shapes', title: 'Sonne', speech: 'Male eine Sonne mit Strahlen.', label: 'Sonne',
    strokes: [arc(0.5, 0.5, 0.2, 0.2, -90, 270, 30), poly([0.5, 0.08], [0.5, 0.2]), poly([0.5, 0.8], [0.5, 0.92]), poly([0.08, 0.5], [0.2, 0.5]), poly([0.8, 0.5], [0.92, 0.5]), poly([0.2, 0.2], [0.29, 0.29]), poly([0.71, 0.71], [0.8, 0.8]), poly([0.8, 0.2], [0.71, 0.29]), poly([0.29, 0.71], [0.2, 0.8])], complexity: 3, angularStrokes: [1, 2, 3, 4, 5, 6, 7, 8],
  }),
  makeTask({
    id: 'shape-sailboat', category: 'shapes', title: 'Segelboot', speech: 'Male ein Segelboot.', label: 'Segelboot',
    strokes: [poly([0.18, 0.72], [0.82, 0.72], [0.68, 0.84], [0.32, 0.84], [0.18, 0.72]), poly([0.5, 0.72], [0.5, 0.2], [0.76, 0.64], [0.5, 0.64]), poly([0.46, 0.28], [0.24, 0.64], [0.46, 0.64])], complexity: 3, angularStrokes: [0, 1, 2],
  }),
  makeTask({
    id: 'shape-rocket', category: 'shapes', title: 'Rakete', speech: 'Male eine Rakete.', label: 'Rakete',
    strokes: [poly([0.5, 0.12], [0.7, 0.38], [0.66, 0.72], [0.5, 0.86], [0.34, 0.72], [0.3, 0.38], [0.5, 0.12]), arc(0.5, 0.46, 0.07, 0.07, -90, 270, 20), poly([0.36, 0.67], [0.23, 0.84], [0.39, 0.8]), poly([0.64, 0.67], [0.77, 0.84], [0.61, 0.8]), poly([0.45, 0.82], [0.5, 0.94], [0.55, 0.82])], complexity: 3, angularStrokes: [0, 2, 3, 4],
  }),
  makeTask({
    id: 'shape-tree', category: 'shapes', title: 'Baum', speech: 'Male einen Baum mit Stamm und Krone.', label: 'Baum',
    strokes: [
      poly([0.43, 0.82], [0.43, 0.58], [0.57, 0.58], [0.57, 0.82], [0.43, 0.82]),
      join(
        bezier(p(0.5, 0.16), p(0.4, 0.11), p(0.31, 0.2), p(0.33, 0.3), 14),
        bezier(p(0.33, 0.3), p(0.18, 0.29), p(0.17, 0.48), p(0.31, 0.5), 14),
        bezier(p(0.31, 0.5), p(0.34, 0.64), p(0.48, 0.62), p(0.5, 0.55), 14),
        bezier(p(0.5, 0.55), p(0.58, 0.64), p(0.72, 0.59), p(0.7, 0.49), 14),
        bezier(p(0.7, 0.49), p(0.84, 0.44), p(0.78, 0.28), p(0.67, 0.29), 14),
        bezier(p(0.67, 0.29), p(0.68, 0.19), p(0.58, 0.12), p(0.5, 0.16), 14),
      ),
      poly([0.24, 0.83], [0.76, 0.83]),
    ],
    complexity: 3, angularStrokes: [0, 2], strokeColors: [PICTURE_INK.brown, PICTURE_INK.green, PICTURE_INK.green],
  }),
  makeTask({
    id: 'shape-ice-cream', category: 'shapes', title: 'Eis', speech: 'Male eine Kugel Eis in einer Waffel.', label: 'Eis',
    strokes: [arc(0.5, 0.36, 0.22, 0.2, 180, 360, 28), poly([0.28, 0.36], [0.72, 0.36], [0.5, 0.84], [0.28, 0.36]), poly([0.36, 0.45], [0.64, 0.68]), poly([0.64, 0.45], [0.36, 0.68])],
    complexity: 3, angularStrokes: [1, 2, 3], strokeColors: [PICTURE_INK.pink, PICTURE_INK.brown, PICTURE_INK.cream, PICTURE_INK.cream],
  }),
  makeTask({
    id: 'shape-rainbow', category: 'shapes', title: 'Regenbogen', speech: 'Male drei bunte Bögen.', label: 'Regenbogen',
    strokes: [arc(0.5, 0.76, 0.34, 0.47, 180, 360, 28), arc(0.5, 0.76, 0.25, 0.36, 180, 360, 28), arc(0.5, 0.76, 0.16, 0.25, 180, 360, 24)],
    complexity: 3, strokeColors: [PICTURE_INK.red, PICTURE_INK.yellow, PICTURE_INK.blue],
  }),
  makeTask({
    id: 'shape-car', category: 'shapes', title: 'Auto', speech: 'Male ein Auto mit Rädern.', label: 'Auto',
    strokes: [poly([0.16, 0.7], [0.28, 0.48], [0.63, 0.48], [0.82, 0.63], [0.82, 0.76], [0.16, 0.76], [0.16, 0.7]), arc(0.33, 0.76, 0.1, 0.1, 0, 360, 20), arc(0.68, 0.76, 0.1, 0.1, 0, 360, 20), poly([0.34, 0.5], [0.58, 0.5], [0.68, 0.62], [0.28, 0.62], [0.34, 0.5])],
    complexity: 3, angularStrokes: [0, 3], strokeColors: [PICTURE_INK.red, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.blue],
  }),
  makeTask({
    id: 'shape-butterfly', category: 'shapes', title: 'Schmetterling', speech: 'Male einen Schmetterling mit Flügeln.', label: 'Schmetterling',
    strokes: [
      join(
        bezier(p(0.48, 0.3), p(0.34, 0.12), p(0.15, 0.22), p(0.25, 0.48), 18),
        bezier(p(0.25, 0.48), p(0.15, 0.72), p(0.37, 0.84), p(0.48, 0.62), 18),
      ),
      join(
        bezier(p(0.52, 0.3), p(0.66, 0.12), p(0.85, 0.22), p(0.75, 0.48), 18),
        bezier(p(0.75, 0.48), p(0.85, 0.72), p(0.63, 0.84), p(0.52, 0.62), 18),
      ),
      bezier(p(0.5, 0.22), p(0.46, 0.38), p(0.46, 0.66), p(0.5, 0.8), 20),
      bezier(p(0.49, 0.24), p(0.44, 0.14), p(0.38, 0.11), p(0.35, 0.15), 12),
      bezier(p(0.51, 0.24), p(0.56, 0.14), p(0.62, 0.11), p(0.65, 0.15), 12),
    ],
    complexity: 3, angularStrokes: [2, 3, 4], strokeColors: [PICTURE_INK.purple, PICTURE_INK.purple, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.charcoal],
  }),
  makeTask({
    id: 'shape-snail', category: 'shapes', title: 'Schnecke', speech: 'Male eine Schnecke mit Haus und Fühlern.', label: 'Schnecke',
    strokes: [
      arc(0.4, 0.48, 0.22, 0.22, -90, 270, 34),
      spiral(0.4, 0.48, 0.145, 0.018, 1.8, 42),
      bezier(p(0.16, 0.7), p(0.4, 0.79), p(0.72, 0.77), p(0.8, 0.61), 30),
      poly([0.8, 0.61], [0.75, 0.43], [0.72, 0.38]),
      poly([0.8, 0.61], [0.87, 0.44], [0.9, 0.4]),
    ],
    complexity: 3, angularStrokes: [3, 4], strokeColors: [PICTURE_INK.purple, PICTURE_INK.pink, PICTURE_INK.green, PICTURE_INK.green, PICTURE_INK.green],
  }),
  makeTask({
    id: 'shape-umbrella', category: 'shapes', title: 'Regenschirm', speech: 'Male einen Regenschirm mit Griff.', label: 'Regenschirm',
    strokes: [arc(0.5, 0.5, 0.32, 0.25, 180, 360, 28), join(poly([0.5, 0.5], [0.5, 0.76]), bezier(p(0.5, 0.76), p(0.5, 0.88), p(0.65, 0.88), p(0.63, 0.76), 16)), poly([0.5, 0.5], [0.35, 0.5]), poly([0.5, 0.5], [0.65, 0.5])],
    complexity: 3, angularStrokes: [2, 3], strokeColors: [PICTURE_INK.blue, PICTURE_INK.charcoal, PICTURE_INK.blue, PICTURE_INK.blue],
  }),
  makeTask({
    id: 'shape-mushroom', category: 'shapes', title: 'Pilz', speech: 'Male einen Pilz mit Hut und Stiel.', label: 'Pilz',
    strokes: [arc(0.5, 0.46, 0.27, 0.21, 180, 360, 28), poly([0.23, 0.46], [0.77, 0.46]), poly([0.43, 0.46], [0.38, 0.82], [0.62, 0.82], [0.57, 0.46])],
    complexity: 3, angularStrokes: [1, 2], strokeColors: [PICTURE_INK.red, PICTURE_INK.red, PICTURE_INK.cream],
  }),
  makeTask({
    id: 'shape-bird', category: 'shapes', title: 'Vogel', speech: 'Male einen Vogel mit Flügel und Schnabel.', label: 'Vogel',
    strokes: [
      arc(0.46, 0.58, 0.25, 0.17, -90, 270, 30),
      arc(0.67, 0.41, 0.13, 0.13, -90, 270, 26),
      poly([0.79, 0.4], [0.91, 0.45], [0.79, 0.49], [0.79, 0.4]),
      join(
        bezier(p(0.52, 0.52), p(0.38, 0.43), p(0.31, 0.56), p(0.5, 0.67), 18),
        bezier(p(0.5, 0.67), p(0.6, 0.62), p(0.61, 0.55), p(0.52, 0.52), 14),
      ),
      poly([0.23, 0.59], [0.09, 0.48], [0.17, 0.67], [0.23, 0.59]),
      poly([0.42, 0.73], [0.4, 0.85], [0.34, 0.85]),
      poly([0.53, 0.73], [0.55, 0.85], [0.61, 0.85]),
    ],
    complexity: 3, angularStrokes: [2, 4, 5, 6], strokeColors: [PICTURE_INK.blue, PICTURE_INK.blue, PICTURE_INK.orange, PICTURE_INK.purple, PICTURE_INK.blue, PICTURE_INK.brown, PICTURE_INK.brown],
  }),
  makeTask({
    id: 'shape-present', category: 'shapes', title: 'Geschenk', speech: 'Male ein Geschenk mit Schleife.', label: 'Geschenk',
    strokes: [poly([0.22, 0.36], [0.78, 0.36], [0.78, 0.8], [0.22, 0.8], [0.22, 0.36]), poly([0.5, 0.36], [0.5, 0.8]), poly([0.22, 0.56], [0.78, 0.56]), join(bezier(p(0.5, 0.36), p(0.34, 0.12), p(0.21, 0.28), p(0.5, 0.42), 18), bezier(p(0.5, 0.42), p(0.79, 0.28), p(0.66, 0.12), p(0.5, 0.36), 18))],
    complexity: 3, angularStrokes: [0, 1, 2], strokeColors: [PICTURE_INK.blue, PICTURE_INK.yellow, PICTURE_INK.yellow, PICTURE_INK.pink],
  }),
  makeTask({
    id: 'shape-crown', category: 'shapes', title: 'Krone', speech: 'Male eine Krone mit drei Spitzen.', label: 'Krone',
    strokes: [poly([0.22, 0.72], [0.78, 0.72], [0.78, 0.82], [0.22, 0.82], [0.22, 0.72]), poly([0.22, 0.72], [0.28, 0.34], [0.4, 0.57], [0.5, 0.25], [0.6, 0.57], [0.72, 0.34], [0.78, 0.72]), poly([0.22, 0.78], [0.78, 0.78])],
    complexity: 3, angularStrokes: [0, 1, 2], strokeColors: [PICTURE_INK.yellow, PICTURE_INK.yellow, PICTURE_INK.pink],
  }),
  makeTask({
    id: 'shape-castle', category: 'shapes', title: 'Burg', speech: 'Male eine Burg mit Türmen und Fahnen.', label: 'Burg',
    strokes: [poly([0.2, 0.8], [0.2, 0.42], [0.34, 0.42], [0.34, 0.3], [0.46, 0.3], [0.46, 0.42], [0.54, 0.42], [0.54, 0.22], [0.66, 0.22], [0.66, 0.42], [0.8, 0.42], [0.8, 0.8], [0.2, 0.8]), arc(0.5, 0.8, 0.08, 0.15, 180, 360, 18), poly([0.34, 0.3], [0.34, 0.16], [0.44, 0.2]), poly([0.66, 0.22], [0.66, 0.1], [0.76, 0.14])],
    complexity: 3, angularStrokes: [0, 2, 3], strokeColors: [PICTURE_INK.red, PICTURE_INK.brown, PICTURE_INK.yellow, PICTURE_INK.yellow],
  }),
  makeTask({
    id: 'shape-train', category: 'shapes', title: 'Zug', speech: 'Male einen Zug mit Rädern.', label: 'Zug',
    strokes: [poly([0.15, 0.7], [0.15, 0.52], [0.64, 0.52], [0.64, 0.4], [0.76, 0.4], [0.76, 0.7], [0.15, 0.7]), arc(0.3, 0.7, 0.09, 0.09, 0, 360, 18), arc(0.62, 0.7, 0.09, 0.09, 0, 360, 18), poly([0.58, 0.52], [0.58, 0.3], [0.7, 0.3], [0.7, 0.52]), poly([0.28, 0.54], [0.46, 0.54], [0.46, 0.64], [0.28, 0.64], [0.28, 0.54])],
    complexity: 3, angularStrokes: [0, 3, 4], strokeColors: [PICTURE_INK.red, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.orange, PICTURE_INK.blue],
  }),
  makeTask({
    id: 'shape-planet', category: 'shapes', title: 'Planet', speech: 'Male einen Planeten mit Ring.', label: 'Planet',
    strokes: [arc(0.5, 0.5, 0.22, 0.22, -90, 270, 28), arc(0.5, 0.5, 0.36, 0.13, 0, 360, 30), arc(0.45, 0.45, 0.07, 0.05, -90, 270, 16)],
    complexity: 3, strokeColors: [PICTURE_INK.blue, PICTURE_INK.purple, PICTURE_INK.cream],
  }),
  makeTask({
    id: 'shape-apple', category: 'shapes', title: 'Apfel', speech: 'Male einen Apfel mit Blatt.', label: 'Apfel',
    strokes: [join(bezier(p(0.5, 0.3), p(0.32, 0.18), p(0.2, 0.46), p(0.3, 0.7), 22), bezier(p(0.3, 0.7), p(0.42, 0.93), p(0.58, 0.93), p(0.7, 0.7), 22), bezier(p(0.7, 0.7), p(0.84, 0.45), p(0.68, 0.18), p(0.5, 0.3), 22)), bezier(p(0.5, 0.28), p(0.66, 0.09), p(0.78, 0.21), p(0.6, 0.33), 18), poly([0.5, 0.3], [0.45, 0.16])],
    complexity: 3, angularStrokes: [2], strokeColors: [PICTURE_INK.red, PICTURE_INK.green, PICTURE_INK.brown],
  }),
  makeTask({
    id: 'shape-bee', category: 'shapes', title: 'Biene', speech: 'Male eine Biene mit Flügeln und Streifen.', label: 'Biene',
    strokes: [arc(0.5, 0.58, 0.18, 0.22, -90, 270, 28), arc(0.5, 0.31, 0.13, 0.11, -90, 270, 22), poly([0.34, 0.5], [0.66, 0.5]), poly([0.32, 0.63], [0.68, 0.63]), arc(0.34, 0.4, 0.14, 0.1, 0, 360, 20), arc(0.66, 0.4, 0.14, 0.1, 0, 360, 20), bezier(p(0.45, 0.23), p(0.4, 0.12), p(0.32, 0.13), p(0.31, 0.2), 12), bezier(p(0.55, 0.23), p(0.6, 0.12), p(0.68, 0.13), p(0.69, 0.2), 12), poly([0.5, 0.8], [0.5, 0.89])],
    complexity: 3, angularStrokes: [2, 3, 8], strokeColors: [PICTURE_INK.yellow, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.blue, PICTURE_INK.blue, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.charcoal],
  }),
];

// Runtime geometry is extracted from the same approved pixels the child sees.
// This one data set drives Fino, layout, and scoring.
export const digitStrokes = Object.freeze(Object.fromEntries(
  [...'0123456789'].map((digit) => [digit, CHARACTER_STROKES[digit]]),
));

const numberWords = ['Null', 'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun'];
const numberTemplates = Object.entries(digitStrokes).map(([digit, strokes]) => makeTask({
  id: `number-${digit}`,
  category: 'numbers',
  title: `Die ${numberWords[Number(digit)]}`,
  speech: `Schreib die ${numberWords[Number(digit)]}.`,
  label: digit,
  strokes,
  complexity: digit === '1' || digit === '0' ? 1 : Number(digit) <= 5 ? 2 : 3,
}));

export const letterStrokes = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß'].map((letter) => [letter, CHARACTER_STROKES[letter]]),
);
Object.freeze(letterStrokes);

const letterMeta = {
  A: ['Affe', 'diagonal', 2], B: ['Ball', 'mixed', 3], C: ['Clown', 'round', 2], D: ['Dino', 'mixed', 2],
  E: ['Ente', 'straight', 1], F: ['Fisch', 'straight', 1], G: ['Gans', 'round', 3], H: ['Haus', 'straight', 1],
  I: ['Igel', 'straight', 1], J: ['Jacke', 'round', 2], K: ['Katze', 'diagonal', 2], L: ['Löwe', 'straight', 1],
  M: ['Maus', 'diagonal', 3], N: ['Nase', 'diagonal', 2], O: ['Oma', 'round', 1], P: ['Panda', 'mixed', 2],
  Q: ['Qualle', 'round', 3], R: ['Regen', 'mixed', 3], S: ['Sonne', 'round', 3], T: ['Tiger', 'straight', 1],
  U: ['Uhu', 'round', 2], V: ['Vogel', 'diagonal', 1], W: ['Wolke', 'diagonal', 3], X: ['Xylofon', 'diagonal', 2],
  Y: ['Yak', 'diagonal', 2], Z: ['Zebra', 'diagonal', 2], Ä: ['Äpfel', 'diagonal', 3], Ö: ['Öl', 'round', 3], Ü: ['Überraschung', 'round', 3],
  ß: ['Straße', 'mixed', 3],
  ...Object.fromEntries([...'abcdefghijklmnopqrstuvwxyzäöü'].map((letter) => [letter, [`kleines ${letter}`, 'lowercase', 2]])),
};

const letterTemplates = Object.entries(letterStrokes).map(([letter, strokes]) => {
  const [example, group, complexity] = letterMeta[letter];
  const lowerCase = group === 'lowercase';
  return makeTask({
    id: `letter-${letter}`,
    category: 'letters',
    title: lowerCase ? `kleines ${letter}` : `${letter} wie ${example}`,
    speech: lowerCase ? `Schreib ein kleines ${letter}.` : `Schreib ein ${letter}. ${letter} wie ${example}.`,
    label: letter,
    strokes,
    complexity,
    group,
    example,
  });
});

export const CATEGORY_CONFIG = Object.freeze({
  lines: { label: 'Linien', speech: 'Linien üben', icon: 'line' },
  shapes: { label: 'Formen', speech: 'Formen üben', icon: 'shapes' },
  numbers: { label: 'Zahlen', speech: 'Zahlen üben', icon: 'numbers' },
  letters: { label: 'Buchstaben', speech: 'Buchstaben üben', icon: 'letters' },
  name: { label: 'Mein Name', speech: 'Deinen Namen üben', icon: 'name' },
  maze: { label: 'Labyrinth', speech: 'Finde den Weg durchs Labyrinth', icon: 'maze' },
  connect: { label: 'Funkelpunkte', speech: 'Verbinde die auftauchenden Punkte', icon: 'connect' },
  mixed: { label: 'Bunte Mischung', speech: 'Alles gemischt', icon: 'mixed' },
  // Nur über den Testmodus (?test) erreichbar: alle Buchstaben und Zahlen
  // nacheinander als Einzelaufgabe, für die visuelle Symbolprüfung.
  review: { label: 'Alle Symbole', speech: 'Alle Buchstaben und Zahlen ansehen', icon: 'review' },
});

export const DIFFICULTIES = Object.freeze({
  easy: { label: 'Leicht', speech: 'Leicht', description: 'Klare, dünne Spur' },
  medium: { label: 'Mittel', speech: 'Mittel', description: 'Feine, transparente Spur' },
  hard: { label: 'Knifflig', speech: 'Knifflig', description: 'Zarte, transparente Spur' },
});

export const OPTION_SETS = Object.freeze({
  numbers: [
    { value: 'all', label: 'Alle' },
    { value: 'custom', label: 'Eigene Zahlen' },
  ],
  letters: [
    { value: 'all', label: 'Alle' },
    { value: 'custom', label: 'Eigene Buchstaben' },
  ],
});

export function normalizeName(value) {
  const protectedUmlauts = String(value ?? '')
    .trim()
    .replace(/ẞ/g, 'SS')
    .replace(/ß/g, 'ss')
    .replace(/Ä/g, '\uE000')
    .replace(/Ö/g, '\uE001')
    .replace(/Ü/g, '\uE002')
    .replace(/ä/g, '\uE003')
    .replace(/ö/g, '\uE004')
    .replace(/ü/g, '\uE005')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\uE000/g, 'Ä')
    .replace(/\uE001/g, 'Ö')
    .replace(/\uE002/g, 'Ü')
    .replace(/\uE003/g, 'ä')
    .replace(/\uE004/g, 'ö')
    .replace(/\uE005/g, 'ü');
  return protectedUmlauts
    .replace(/[^A-Za-zÄÖÜäöü\- ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

function boundsOf(strokes) {
  const all = strokes.flat();
  return all.reduce((b, point) => ({
    minX: Math.min(b.minX, point.x), maxX: Math.max(b.maxX, point.x),
    minY: Math.min(b.minY, point.y), maxY: Math.max(b.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function fitStrokesToBounds(strokes, rect, bounds) {
  const sourceCenterX = ((bounds.minX + bounds.maxX) / 2) * CANONICAL_DRAWING_WIDTH;
  const sourceCenterY = ((bounds.minY + bounds.maxY) / 2) * CANONICAL_DRAWING_HEIGHT;
  const sourceWidth = Math.max(1, (bounds.maxX - bounds.minX) * CANONICAL_DRAWING_WIDTH);
  const sourceHeight = Math.max(1, (bounds.maxY - bounds.minY) * CANONICAL_DRAWING_HEIGHT);
  const targetWidth = rect.width * CANONICAL_DRAWING_WIDTH;
  const targetHeight = rect.height * CANONICAL_DRAWING_HEIGHT;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const targetCenterX = (rect.x + rect.width / 2) * CANONICAL_DRAWING_WIDTH;
  const targetCenterY = (rect.y + rect.height / 2) * CANONICAL_DRAWING_HEIGHT;
  return strokes.map((stroke) => stroke.map((point) => p(
    (targetCenterX + (point.x * CANONICAL_DRAWING_WIDTH - sourceCenterX) * scale) / CANONICAL_DRAWING_WIDTH,
    (targetCenterY + (point.y * CANONICAL_DRAWING_HEIGHT - sourceCenterY) * scale) / CANONICAL_DRAWING_HEIGHT,
  )));
}

function fitStrokes(strokes, rect) {
  return fitStrokesToBounds(strokes, rect, boundsOf(strokes));
}

const X_HEIGHT_LETTERS = new Set([...'acemnorsuvwxzäöü']);
const ASCENDER_LETTERS = new Set([...'bdfhkl']);
const DESCENDER_LETTERS = new Set([...'gjpqy']);

const CANONICAL_DRAWING_WIDTH = 900;
const CANONICAL_DRAWING_HEIGHT = 620;

/**
 * Classify the space the child can actually draw in. We deliberately use the
 * canvas rectangle, not the device or window size: toolbars, split view and
 * Safari's browser chrome can otherwise choose the wrong exercise layout.
 */
export function layoutProfileForViewport({ width = CANONICAL_DRAWING_WIDTH, height = CANONICAL_DRAWING_HEIGHT } = {}) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const portrait = safeHeight > safeWidth * 1.08;
  const phone = Math.min(safeWidth, safeHeight) < 600;
  // The canvas is inset from the viewport by the practice-screen padding.
  // Keep a 390px-wide phone in the two-target range after that inset; reserve
  // single-target rounds for genuinely narrow boards instead.
  const compactPhone = phone && Math.min(safeWidth, safeHeight) < 340;
  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    portrait,
    landscape: !portrait,
    phone,
    compactPhone,
    maxSymbols: portrait
      ? (compactPhone ? 1 : phone ? 2 : 3)
      : (phone ? 3 : safeWidth >= 1000 ? 6 : 4),
  });
}

function fitSymbolStrokes(character, strokes, rect) {
  const routeBounds = boundsOf(strokes);
  const geometry = CHARACTER_STROKE_GEOMETRY[character];
  if (!geometry) return fitStrokesToBounds(strokes, rect, routeBounds);
  // Route-fit first: the strokes fill the exercise cell exactly as before.
  const routeWidth = Math.max(1, (routeBounds.maxX - routeBounds.minX) * CANONICAL_DRAWING_WIDTH);
  const routeHeight = Math.max(1, (routeBounds.maxY - routeBounds.minY) * CANONICAL_DRAWING_HEIGHT);
  const cellWidth = rect.width * CANONICAL_DRAWING_WIDTH;
  const cellHeight = rect.height * CANONICAL_DRAWING_HEIGHT;
  let scale = Math.min(cellWidth / routeWidth, cellHeight / routeHeight);
  // The grey template crop reaches past the centre-line route: by the crop's
  // padding, and for the M by the apex wedge above the walked junction. The
  // sprite is anchored to the route, so a cell near the board edge let it
  // poke off-board and get cut off (the M's top). Shrink the fit only as much
  // as the sprite needs to stay on the board.
  const centerX = (rect.x + rect.width / 2) * CANONICAL_DRAWING_WIDTH;
  const centerY = (rect.y + rect.height / 2) * CANONICAL_DRAWING_HEIGHT;
  const boardMargin = 6;
  const spriteTopPad = geometry.routeY + routeHeight / 2;
  const spriteBottomPad = geometry.cropHeight - geometry.routeY - routeHeight / 2;
  const spriteLeftPad = geometry.routeX + routeWidth / 2;
  const spriteRightPad = geometry.cropWidth - geometry.routeX - routeWidth / 2;
  scale = Math.min(
    scale,
    Math.max(scale * 0.5, (centerY - boardMargin) / Math.max(1, spriteTopPad)),
    Math.max(scale * 0.5, (CANONICAL_DRAWING_HEIGHT - centerY - boardMargin) / Math.max(1, spriteBottomPad)),
    Math.max(scale * 0.5, (centerX - boardMargin) / Math.max(1, spriteLeftPad)),
    Math.max(scale * 0.5, (CANONICAL_DRAWING_WIDTH - centerX - boardMargin) / Math.max(1, spriteRightPad)),
  );
  const sourceCenterX = ((routeBounds.minX + routeBounds.maxX) / 2) * CANONICAL_DRAWING_WIDTH;
  const sourceCenterY = ((routeBounds.minY + routeBounds.maxY) / 2) * CANONICAL_DRAWING_HEIGHT;
  return strokes.map((stroke) => stroke.map((point) => p(
    (centerX + (point.x * CANONICAL_DRAWING_WIDTH - sourceCenterX) * scale) / CANONICAL_DRAWING_WIDTH,
    (centerY + (point.y * CANONICAL_DRAWING_HEIGHT - sourceCenterY) * scale) / CANONICAL_DRAWING_HEIGHT,
  )));
}

function fitLetterStrokes(letter, rect) {
  return fitSymbolStrokes(letter, letterStrokes[letter], rect);
}

function transformStrokes(strokes, { scale = 1, dx = 0, dy = 0, mirrorX = false, mirrorY = false } = {}) {
  return strokes.map((stroke) => stroke.map((point) => p(
    0.5 + (point.x - 0.5) * scale * (mirrorX ? -1 : 1) + dx,
    0.5 + (point.y - 0.5) * scale * (mirrorY ? -1 : 1) + dy,
  )));
}

function textCharacters(rawText) {
  return [...normalizeName(rawText).replace(/[- ]/g, '')].filter((character) => letterStrokes[character]);
}

// Distance from each glyph's crop top to the drawn baseline of its row in
// the approved Schulschrift sheet (measured by
// scripts/extract_schulschrift_glyphs.py).  Name layout places every letter
// so these offsets share one baseline, exactly as the source sheet draws them.
const SCHULSCHRIFT_BASELINE_OFFSETS = Object.freeze({
  A: 112, B: 113, C: 114, D: 111, E: 112, F: 108, G: 110, H: 109, I: 109,
  J: 108, K: 109, L: 107, M: 107, N: 108, O: 108, P: 110, Q: 109, R: 110,
  S: 110, T: 108, U: 102, V: 103, W: 103, X: 104, Y: 104, Z: 102,
  a: 64, b: 112, c: 67, d: 111, e: 67, f: 108, g: 67, h: 108, i: 75, j: 76,
  k: 107, l: 104, m: 60, n: 61, o: 62, p: 69, q: 67, r: 66, s: 69, t: 96,
  u: 59, v: 60, w: 59, x: 62, y: 63, z: 60,
  Ä: 113, Ö: 116, Ü: 112, ä: 84, ö: 85, ü: 78,
  ß: 106,
});
const SCHULSCHRIFT_DESIGN_TOP = 114;
export const baselineOffsets = SCHULSCHRIFT_BASELINE_OFFSETS;

function characterDesignTop(character) {
  // The umlaut offsets already account for the dots above the base letter
  // (the crop top includes them), so every glyph shares one baseline.
  const offset = SCHULSCHRIFT_BASELINE_OFFSETS[character];
  if (offset === undefined) return 0;
  return SCHULSCHRIFT_DESIGN_TOP - offset;
}

function characterPhysicalBounds(character) {
  const strokes = letterStrokes[character];
  const bounds = boundsOf(strokes);
  return {
    minX: bounds.minX * CANONICAL_DRAWING_WIDTH,
    maxX: bounds.maxX * CANONICAL_DRAWING_WIDTH,
    minY: bounds.minY * CANONICAL_DRAWING_HEIGHT,
    maxY: bounds.maxY * CANONICAL_DRAWING_HEIGHT,
  };
}

function textTaskData(rawText, rect = { x: 0.06, y: 0.2, width: 0.88, height: 0.62 }) {
  const characters = textCharacters(rawText);
  if (!characters.length) return { strokes: [], completionGroups: [] };
  // Lay out the complete word like one font line. Every source pixel uses the
  // same physical scale; uppercase letters share a cap line and baseline,
  // lowercase letters share x-height/ascender/descender positions. This keeps
  // a narrow i and a wide M visibly related instead of inflating each glyph
  // independently to fill its own box.
  const bounds = characters.map(characterPhysicalBounds);
  const gaps = characters.length > 1 ? 18 : 0;
  const advances = bounds.map((box) => Math.max(16, box.maxX - box.minX) + gaps);
  const designWidth = advances.reduce((sum, advance) => sum + advance, 0) - gaps;
  const designTops = characters.map(characterDesignTop);
  const designMinY = Math.min(...bounds.map((box, index) => designTops[index] + box.minY));
  const designMaxY = Math.max(...bounds.map((box, index) => designTops[index] + box.maxY));
  const target = {
    x: rect.x * CANONICAL_DRAWING_WIDTH,
    y: rect.y * CANONICAL_DRAWING_HEIGHT,
    width: rect.width * CANONICAL_DRAWING_WIDTH,
    height: rect.height * CANONICAL_DRAWING_HEIGHT,
  };
  const scale = Math.min(target.width / Math.max(1, designWidth), target.height / Math.max(1, designMaxY - designMinY));
  const originX = target.x + (target.width - designWidth * scale) / 2;
  const originY = target.y + (target.height - (designMaxY - designMinY) * scale) / 2;
  const strokes = [];
  const completionGroups = [];
  let cursor = 0;
  characters.forEach((character, index) => {
    const source = bounds[index];
    const top = designTops[index];
    // Centre each glyph's ink inside its advance slot so narrow letters (I, i)
    // keep even gaps to both neighbours.
    const inkWidth = source.maxX - source.minX;
    const inkLeft = cursor + Math.max(0, (advances[index] - gaps) - inkWidth) / 2;
    const fitted = letterStrokes[character].map((stroke) => stroke.map((point) => p(
      (originX + (inkLeft + point.x * CANONICAL_DRAWING_WIDTH - source.minX) * scale) / CANONICAL_DRAWING_WIDTH,
      (originY + (top + point.y * CANONICAL_DRAWING_HEIGHT - designMinY) * scale) / CANONICAL_DRAWING_HEIGHT,
    )));
    const firstStroke = strokes.length;
    strokes.push(...fitted);
    completionGroups.push(fitted.map((_, strokeIndex) => firstStroke + strokeIndex));
    cursor += advances[index];
  });
  return { strokes, completionGroups };
}

function textStrokes(rawText, rect) {
  return textTaskData(rawText, rect).strokes;
}

export function createWordTask(rawName) {
  const name = normalizeName(rawName).replace(/[- ]/g, '');
  const data = textTaskData(name);
  if (!data.strokes.length) return null;
  return makeTask({
    id: `word-${name}`,
    category: 'name',
    title: 'Dein Name',
    speech: `Schreib deinen Namen. ${name}.`,
    label: name,
    strokes: data.strokes,
    completionGroups: data.completionGroups,
    complexity: 3,
    group: 'name',
  });
}

function namePartTask(part, index, total) {
  const data = textTaskData(part);
  return makeTask({
    id: `name-part-${part}-${index}`,
    category: 'name',
    title: total > 1 ? `Dein Name – Teil ${index + 1}` : 'Dein Name',
    speech: total > 1 ? `Schreib diesen Teil deines Namens. ${part}.` : `Jetzt schreibst du deinen Namen. ${part}.`,
    label: part,
    value: part,
    strokes: data.strokes,
    completionGroups: data.completionGroups,
    complexity: part.length > 1 ? 2 : 1,
    group: 'name',
    family: 'name',
    layout: `name-part-${index + 1}`,
  });
}

function createNameRound(rawName, viewport) {
  const name = normalizeName(rawName).replace(/[- ]/g, '') || 'FINO';
  const characters = textCharacters(name);
  const profile = layoutProfileForViewport(viewport);
  const letterRect = { x: 0.28, y: 0.12, width: 0.44, height: 0.76 };
  const letterTasks = characters.map((letter, index) => {
    const strokes = fitLetterStrokes(letter, letterRect);
    return makeTask({
      id: `name-round-${name}-letter-${index}`,
      category: 'name',
      title: `Buchstabe ${letter}`,
      speech: `Schreib den Buchstaben ${letter}.`,
      label: letter,
      value: `${letter}-${index}`,
      strokes,
      completionGroups: [strokes.map((_, strokeIndex) => strokeIndex)],
      complexity: 1,
      group: 'name',
      family: 'name',
      layout: 'single-letter',
    });
  });
  // A complete name stays readable on a phone only in landscape and only up
  // to eight letters. In portrait (or for a longer phone name), keep the
  // child's progress moving in short, meaningful name parts instead.
  const canWriteWholeName = !profile.phone || (profile.landscape && characters.length <= 8);
  if (!canWriteWholeName) {
    const chunkSize = profile.portrait ? (profile.compactPhone ? 1 : 2) : 3;
    const parts = [];
    for (let start = 0; start < characters.length; start += chunkSize) {
      parts.push(characters.slice(start, start + chunkSize).join(''));
    }
    return [...letterTasks, ...parts.map((part, index) => namePartTask(part, index, parts.length))];
  }

  const wholeName = createWordTask(name);
  return [
    ...letterTasks,
    makeTask({
      ...wholeName,
      id: `name-round-${name}-full`,
      title: 'Dein ganzer Name',
      speech: `Jetzt schreibst du deinen Namen. ${name}.`,
      layout: 'whole-name',
    }),
  ];
}

const ROUTE_LAYOUTS = [
  ['gross', 'groß', { scale: 1 }],
  ['kompakt', 'kompakt', { scale: 0.76 }],
  ['hoch', 'hoch', { scale: 0.86, dy: -0.08 }],
  ['tief', 'tief', { scale: 0.86, dy: 0.08 }],
  ['links', 'links', { scale: 0.82, dx: -0.09 }],
  ['rechts', 'rechts', { scale: 0.82, dx: 0.09 }],
  ['spiegel', 'spiegelverkehrt', { scale: 0.92, mirrorX: true }],
  ['kopfüber', 'andersherum', { scale: 0.92, mirrorY: true }],
  ['klein-links', 'klein links', { scale: 0.68, dx: -0.1, dy: 0.08 }],
  ['klein-rechts', 'klein rechts', { scale: 0.68, dx: 0.1, dy: -0.08 }],
];

const SHAPE_LAYOUTS = [
  ['gross', 'groß', { scale: 1 }],
  ['kompakt', 'kompakt', { scale: 0.76 }],
  ['oben', 'oben', { scale: 0.78, dy: -0.1 }],
  ['unten', 'unten', { scale: 0.78, dy: 0.1 }],
  ['spiegel', 'andersherum', { scale: 0.9, mirrorX: true }],
];

function variantBank(category, templates, layouts) {
  return Object.freeze(templates.flatMap((template) => layouts.map(([key, title, transform]) => makeTask({
    id: `${category}-${template.id}-${key}`,
    category,
    title: `${template.title} – ${title}`,
    speech: `${template.speech} ${title}.`,
    label: template.label,
    value: template.value,
    strokes: transformStrokes(template.strokes, transform),
    complexity: template.complexity,
    group: template.group,
    example: template.example,
    family: category,
    layout: key,
    angularStrokes: template.angularStrokes,
    strokeColors: template.strokeColors,
  }))));
}

const NUMBER_LAYOUTS = [
  ['gross', 'einmal groß', [{ x: 0.3, y: 0.12, width: 0.4, height: 0.76 }]],
  ['paar', 'zwei nebeneinander', [{ x: 0.12, y: 0.22, width: 0.3, height: 0.56 }, { x: 0.58, y: 0.22, width: 0.3, height: 0.56 }]],
  ['reihe', 'Dreierreihe', [{ x: 0.08, y: 0.26, width: 0.22, height: 0.48 }, { x: 0.39, y: 0.26, width: 0.22, height: 0.48 }, { x: 0.7, y: 0.26, width: 0.22, height: 0.48 }]],
  ['turm', 'Zahlenturm', [{ x: 0.36, y: 0.08, width: 0.28, height: 0.25 }, { x: 0.36, y: 0.38, width: 0.28, height: 0.25 }, { x: 0.36, y: 0.68, width: 0.28, height: 0.25 }]],
  ['treppe', 'Zahlentreppe', [{ x: 0.1, y: 0.12, width: 0.24, height: 0.34 }, { x: 0.38, y: 0.33, width: 0.24, height: 0.34 }, { x: 0.66, y: 0.54, width: 0.24, height: 0.34 }]],
  ['vierer', 'Viererfeld', [{ x: 0.16, y: 0.12, width: 0.25, height: 0.32 }, { x: 0.59, y: 0.12, width: 0.25, height: 0.32 }, { x: 0.16, y: 0.56, width: 0.25, height: 0.32 }, { x: 0.59, y: 0.56, width: 0.25, height: 0.32 }]],
  ['diagonal', 'Diagonale', [{ x: 0.1, y: 0.1, width: 0.24, height: 0.28 }, { x: 0.38, y: 0.36, width: 0.24, height: 0.28 }, { x: 0.66, y: 0.62, width: 0.24, height: 0.28 }]],
  ['gross-klein', 'groß und klein', [{ x: 0.1, y: 0.16, width: 0.47, height: 0.68 }, { x: 0.68, y: 0.54, width: 0.2, height: 0.28 }]],
  ['oben-unten', 'oben und unten', [{ x: 0.26, y: 0.1, width: 0.48, height: 0.32 }, { x: 0.26, y: 0.58, width: 0.48, height: 0.32 }]],
  ['schlange', 'Zahlenschlange', [{ x: 0.1, y: 0.5, width: 0.2, height: 0.3 }, { x: 0.34, y: 0.2, width: 0.2, height: 0.3 }, { x: 0.58, y: 0.5, width: 0.2, height: 0.3 }]],
];

function compactCells(cells) {
  return cells.map((cell) => ({
    x: 0.5 + (cell.x - 0.5) * 0.84,
    y: 0.5 + (cell.y - 0.5) * 0.84,
    width: cell.width * 0.84,
    height: cell.height * 0.84,
  }));
}

const CUSTOM_SET_LAYOUTS = NUMBER_LAYOUTS.flatMap(([key, title, cells]) => [
  [`${key}-gross`, title, cells],
  [`${key}-kompakt`, `${title} – kompakt`, compactCells(cells)],
]);

function strokesInCells(source, symbols, cells) {
  const strokes = [];
  const completionGroups = [];
  cells.forEach((cell, index) => {
    const symbol = symbols[index];
    const fitted = source === letterStrokes
      ? fitLetterStrokes(symbol, cell)
      : fitSymbolStrokes(symbol, source[symbol], cell);
    const firstStroke = strokes.length;
    strokes.push(...fitted);
    completionGroups.push(fitted.map((_, strokeIndex) => firstStroke + strokeIndex));
  });
  return { strokes, completionGroups };
}

function repeatedTaskData(strokes, cells) {
  return strokesInCells({ symbol: strokes }, Array(cells.length).fill('symbol'), cells);
}

function repeatedLetterTaskData(letter, cells) {
  return strokesInCells(letterStrokes, Array(cells.length).fill(letter), cells);
}

function selectedSymbols(category, rawSet) {
  if (category === 'numbers') return [...new Set(String(rawSet ?? '').match(/[0-9]/g) ?? [])];
  return [...new Set([...String(rawSet ?? '').normalize('NFC')].filter((character) => letterStrokes[character]))];
}

function createCustomSetBank(category, rawSet) {
  const symbols = selectedSymbols(category, rawSet);
  if (!symbols.length) return [];
  const source = category === 'numbers' ? digitStrokes : letterStrokes;
  const titleFor = category === 'numbers'
    ? (symbol) => numberWords[Number(symbol)]
    : (symbol) => letterMeta[symbol]?.[0] ?? symbol;
  return Object.freeze(CUSTOM_SET_LAYOUTS.map(([key, layoutTitle, cells], layoutIndex) => {
    const exerciseSymbols = cells.map((_, cellIndex) => symbols[(layoutIndex + cellIndex) % symbols.length]);
    const data = strokesInCells(source, exerciseSymbols, cells);
    return makeTask({
      id: `${category}-custom-${symbols.join('')}-${key}`,
      category,
      title: `${category === 'numbers' ? 'Deine Zahlen' : 'Deine Buchstaben'} – ${layoutTitle}`,
      speech: `${category === 'numbers' ? 'Schreib deine Zahlen' : 'Schreib deine Buchstaben'}. ${exerciseSymbols.map(titleFor).join(', ')}.`,
      label: exerciseSymbols.join(' '),
      value: symbols.join(''),
      strokes: data.strokes,
      completionGroups: data.completionGroups,
      complexity: cells.length === 1 ? 1 : cells.length < 4 ? 2 : 3,
      group: 'custom',
      family: category,
      layout: `custom-${key}`,
      responsiveVariant: layoutIndex,
    });
  }));
}

function symbolsForMode(category, option) {
  if (option && option !== 'all') return selectedSymbols(category, option);
  return category === 'numbers' ? Object.keys(digitStrokes) : Object.keys(letterStrokes);
}

function easySymbolCell(index) {
  const width = 0.34 + (index % 5) * 0.04;
  const height = 0.58 + (Math.floor(index / 5) % 5) * 0.04;
  const xShift = [-0.08, -0.026, 0.026, 0.08][Math.floor(index / 25) % 4];
  const yShift = [-0.05, 0.05][Math.floor(index / 50) % 2];
  return { x: 0.5 - width / 2 + xShift, y: 0.5 - height / 2 + yShift, width, height };
}

function createEasySymbolBank(category, option) {
  const symbols = symbolsForMode(category, option);
  if (!symbols.length) return [];
  const source = category === 'numbers' ? digitStrokes : letterStrokes;
  const titleFor = category === 'numbers'
    ? (symbol) => numberWords[Number(symbol)]
    : (symbol) => letterMeta[symbol]?.[0] ?? symbol;
  return Object.freeze(Array.from({ length: 100 }, (_, index) => {
    const symbol = symbols[index % symbols.length];
    const fitted = category === 'letters'
      ? fitLetterStrokes(symbol, easySymbolCell(index))
      : fitSymbolStrokes(symbol, source[symbol], easySymbolCell(index));
    return makeTask({
      id: `${category}-easy-${symbols.join('')}-${index}`,
      category,
      title: `${category === 'numbers' ? 'Die' : ''} ${symbol} – einmal`.trim(),
      speech: category === 'numbers' ? `Schreib die ${titleFor(symbol)}.` : `Schreib ${titleFor(symbol)}.`,
      label: symbol,
      value: symbol,
      strokes: fitted,
      completionGroups: [fitted.map((_, strokeIndex) => strokeIndex)],
      complexity: 1,
      group: category === 'letters' ? letterMeta[symbol]?.[1] ?? 'all' : 'all',
      family: category,
      layout: `easy-${index}`,
      responsiveVariant: index,
    });
  }));
}

const lineFamilyNames = ['Gerade', 'Wellen', 'Zickzack', 'Bögen', 'Schalen', 'Schleifen', 'Spiralen', 'Slalom', 'Treppen', 'Schlangen'];

function generatedMotorLine(index) {
  const family = index % lineFamilyNames.length;
  const variant = Math.floor(index / lineFamilyNames.length);
  const samples = 54;
  let strokes;
  let angularStrokes = [];
  if (family === 0) {
    const angle = (-70 + variant * 17) * Math.PI / 180;
    const physicalLength = 360 + variant * 18;
    const dx = Math.cos(angle) * physicalLength / 2 / CANONICAL_DRAWING_WIDTH;
    const dy = Math.sin(angle) * physicalLength / 2 / CANONICAL_DRAWING_HEIGHT;
    strokes = [poly([0.5 - dx, 0.5 - dy], [0.5 + dx, 0.5 + dy])];
    angularStrokes = [0];
  } else if (family === 1) {
    const cycles = 1.25 + variant * 0.24;
    const amplitude = 0.16 + (variant % 3) * 0.035;
    strokes = [Array.from({ length: samples }, (_, pointIndex) => {
      const t = pointIndex / (samples - 1);
      return p(0.09 + t * 0.82, 0.5 + Math.sin(t * Math.PI * 2 * cycles) * amplitude);
    })];
  } else if (family === 2) {
    const teeth = 3 + (variant % 6);
    strokes = [Array.from({ length: teeth * 2 + 1 }, (_, pointIndex) => p(
      0.1 + (pointIndex / (teeth * 2)) * 0.8,
      pointIndex % 2 ? 0.24 + variant * 0.012 : 0.76 - variant * 0.012,
    ))];
    angularStrokes = [0];
  } else if (family === 3 || family === 4) {
    const arches = 2 + (variant % 5);
    const direction = family === 3 ? -1 : 1;
    strokes = [Array.from({ length: samples }, (_, pointIndex) => {
      const t = pointIndex / (samples - 1);
      return p(0.09 + t * 0.82, 0.5 + direction * Math.abs(Math.sin(t * Math.PI * arches)) * (0.24 + variant * 0.008));
    })];
  } else if (family === 5) {
    const loops = 2 + (variant % 5);
    strokes = [Array.from({ length: 82 }, (_, pointIndex) => {
      const t = pointIndex / 81;
      const angle = t * Math.PI * 2 * loops;
      return p(0.1 + t * 0.8 + Math.sin(angle) * (0.035 + variant * 0.0015), 0.5 + Math.cos(angle) * (0.2 + (variant % 3) * 0.025));
    })];
  } else if (family === 6) {
    const turns = 1.7 + variant * 0.24;
    const direction = variant % 2 ? -1 : 1;
    strokes = [Array.from({ length: 76 }, (_, pointIndex) => {
      const t = pointIndex / 75;
      const angle = direction * t * Math.PI * 2 * turns;
      const radius = 0.08 + t * 0.3;
      return p(0.5 + Math.cos(angle) * radius * (CANONICAL_DRAWING_HEIGHT / CANONICAL_DRAWING_WIDTH), 0.5 + Math.sin(angle) * radius);
    })];
  } else if (family === 7) {
    const turns = 1.5 + variant * 0.23;
    strokes = [Array.from({ length: samples }, (_, pointIndex) => {
      const t = pointIndex / (samples - 1);
      return p(0.5 + Math.sin(t * Math.PI * 2 * turns) * (0.2 + (variant % 3) * 0.025), 0.08 + t * 0.84);
    })];
  } else if (family === 8) {
    const steps = 3 + (variant % 6);
    const startY = 0.8 - variant * 0.008;
    const rise = 0.56 + variant * 0.006;
    const points = [p(0.1, startY)];
    for (let step = 0; step < steps; step += 1) {
      const nextX = 0.1 + ((step + 1) / steps) * 0.8;
      const nextY = startY - ((step + 1) / steps) * rise;
      points.push(p(nextX, points.at(-1).y), p(nextX, nextY));
    }
    strokes = [points];
    angularStrokes = [0];
  } else {
    const firstCycles = 1.1 + variant * 0.17;
    const secondCycles = 2.1 + (variant % 4) * 0.2;
    strokes = [Array.from({ length: 70 }, (_, pointIndex) => {
      const t = pointIndex / 69;
      return p(0.1 + t * 0.8, 0.5 + Math.sin(t * Math.PI * 2 * firstCycles) * 0.17 + Math.sin(t * Math.PI * 2 * secondCycles) * 0.075);
    })];
  }
  const familyName = lineFamilyNames[family];
  return makeTask({
    id: `lines-motor-${String(index + 1).padStart(3, '0')}`,
    category: 'lines',
    title: `${familyName} ${variant + 1}`,
    speech: `Folge Fino durch die ${familyName.toLocaleLowerCase('de-DE')}.`,
    label: familyName,
    value: familyName,
    strokes,
    complexity: family < 2 ? 1 : family < 6 ? 2 : 3,
    family: 'lines',
    layout: `motor-${family}-${variant}`,
    angularStrokes,
  });
}

const lineBank = Object.freeze([
  ...lineTemplates.map((template) => makeTask({ ...template, id: `lines-${template.id}-gross`, family: 'lines', value: template.label, layout: 'gross' })),
  ...Array.from({ length: 90 }, (_, index) => generatedMotorLine(index)),
]);
// Position, scale and a mirrored stroke order do not make a new shape. Keep
// one genuinely distinct drawing for each family until we have a larger bank
// of truly different pictures to add.
const shapeBank = Object.freeze(shapeTemplates.map((task) => makeTask({
  ...task,
  // Shape art was designed in square authoring units. Convert x to the
  // 900×620 physical artboard once so circles remain circles and corners do
  // not become wide, flattened versions on real screens.
  strokes: task.strokes.map((stroke) => stroke.map((point) => p(
    0.5 + (point.x - 0.5) * (CANONICAL_DRAWING_HEIGHT / CANONICAL_DRAWING_WIDTH),
    point.y,
  ))),
})));
const numberBank = Object.freeze(numberTemplates.flatMap((template) => NUMBER_LAYOUTS.map(([key, title, cells]) => {
  const data = repeatedTaskData(template.strokes, cells);
  return makeTask({
    id: `number-${template.label}-${key}`,
    category: 'numbers',
    title: `${template.title} – ${title}`,
    speech: `${template.speech} ${title}.`,
    label: cells.length === 1 ? template.label : Array(cells.length).fill(template.label).join(' '),
    value: template.label,
    strokes: data.strokes,
    completionGroups: data.completionGroups,
    complexity: template.complexity,
    family: 'numbers',
    layout: key,
  });
})));

const LETTER_LAYOUTS = [
  ['gross', 'einmal groß', [{ x: 0.3, y: 0.12, width: 0.4, height: 0.76 }]],
  ['paar', 'zweimal', [{ x: 0.14, y: 0.2, width: 0.3, height: 0.6 }, { x: 0.56, y: 0.2, width: 0.3, height: 0.6 }]],
];

function letterExercise(template, key, title, cells) {
  const data = repeatedLetterTaskData(template.label, cells);
  return makeTask({
    id: `letter-${template.label}-${key}`,
    category: 'letters',
    title: `${template.title} – ${title}`,
    speech: `${template.speech} ${title}.`,
    label: Array(cells.length).fill(template.label).join(' '),
    value: template.label,
    strokes: data.strokes,
    completionGroups: data.completionGroups,
    complexity: template.complexity,
    group: template.group,
    example: template.example,
    family: 'letters',
    layout: key,
  });
}

const letterSingles = letterTemplates.map((template) => {
  const lowerCase = template.group === 'lowercase';
  return letterExercise(
    template,
    'gross',
    'einmal groß',
    [lowerCase ? { x: 0.33, y: 0.16, width: 0.34, height: 0.68 } : LETTER_LAYOUTS[0][2][0]],
  );
});
const letterPairDrills = letterTemplates.slice(0, 31).map((template) => letterExercise(template, 'paar', 'zweimal', LETTER_LAYOUTS[1][2]));

const letterWords = ['ICH', 'DU', 'JA', 'OMA', 'OPA', 'HAUS', 'BALL', 'MAUS', 'HASE', 'AUTO', 'FUCHS'];
const letterBank = Object.freeze([
  ...letterSingles,
  ...letterPairDrills,
  ...letterWords.map((word) => {
    const data = textTaskData(word);
    return makeTask({
      id: `letter-word-${word}`,
      category: 'letters',
      title: `Wort ${word}`,
      speech: `Schreib das Wort ${word}.`,
      label: word,
      value: word,
      strokes: data.strokes,
      completionGroups: data.completionGroups,
      complexity: 3,
      group: 'all',
      family: 'letters',
      layout: 'word',
    });
  }),
]);

const mazeBank = Object.freeze(Array.from({ length: 100 }, (_, index) => {
  const complexity = 1 + (index % 4);
  const game = createMazeSpec(index + 1, complexity);
  const preview = layoutMaze(game, { width: CANONICAL_DRAWING_WIDTH, height: CANONICAL_DRAWING_HEIGHT });
  return makeTask({
    id: `maze-${String(index + 1).padStart(3, '0')}`,
    category: 'maze',
    title: `Finos Labyrinth ${index + 1}`,
    speech: 'Bring Fino sicher zum Ziel.',
    label: `Weg ${index + 1}`,
    value: `maze-${index + 1}`,
    strokes: [preview.solution],
    complexity,
    family: 'maze',
    layout: 'maze',
    gameMode: 'maze',
    game,
  });
}));

const connectBank = Object.freeze(Array.from({ length: 100 }, (_, index) => {
  const complexity = 1 + (index % 4);
  const game = createConnectSpec(index + 1, complexity);
  // The expensive barrier-aware route is generated only for a selected task
  // and its measured board. A tiny placeholder keeps the 100-item catalogue
  // cheap to load; adaptTaskToViewport replaces it before play.
  const strokes = [[
    p(0.16, 0.1 + (index % 10) * 0.08),
    p(0.84, 0.1 + Math.floor(index / 10) * 0.08),
  ]];
  return makeTask({
    id: `connect-${String(index + 1).padStart(3, '0')}`,
    category: 'connect',
    title: `Funkelpunkte ${index + 1}`,
    speech: 'Verbinde die neuen Punkte, ohne deine Linien zu berühren.',
    label: `Punkte ${index + 1}`,
    value: `connect-${index + 1}`,
    strokes,
    completionGroups: strokes.map((_, strokeIndex) => [strokeIndex]),
    complexity,
    family: 'connect',
    layout: 'connect',
    gameMode: 'connect',
    game,
  });
}));

function nameRect(index, dx = 0) {
  const scales = [0.88, 0.76, 0.64, 0.82, 0.7];
  const scale = scales[index % scales.length];
  const width = scale;
  const height = Math.min(0.68, scale * 0.72);
  const x = 0.5 - width / 2 + ((index % 3) - 1) * 0.035 + dx;
  const y = 0.5 - height / 2 + ((Math.floor(index / 3) % 3) - 1) * 0.035;
  return { x, y, width, height };
}

export function createNameExerciseBank(rawName) {
  const name = normalizeName(rawName).replace(/[- ]/g, '') || 'FINO';
  const characters = textCharacters(name);
  const chunks = Array.from({ length: 20 }, (_, index) => {
    const length = 1 + (index % Math.min(3, characters.length));
    const start = index % characters.length;
    return Array.from({ length }, (_, offset) => characters[(start + offset) % characters.length]).join('');
  });
  const exercises = [];
  for (let index = 0; index < 20; index += 1) {
    const letter = characters[index % characters.length];
    const copies = 1 + (index % 3);
    const cells = Array.from({ length: copies }, (_, copy) => ({
      x: 0.12 + copy * (0.76 / copies), y: 0.2 + (index % 2) * 0.08, width: 0.6 / copies, height: 0.56,
    }));
    const data = repeatedLetterTaskData(letter, cells);
    exercises.push(makeTask({ id: `name-focus-${name}-${index}`, category: 'name', title: `${letter} üben`, speech: `Übe den Buchstaben ${letter}.`, label: Array(copies).fill(letter).join(' '), value: letter, strokes: data.strokes, completionGroups: data.completionGroups, complexity: copies === 1 ? 1 : 2, group: 'name', family: 'name', layout: `focus-${index}` }));
  }
  for (let index = 0; index < 20; index += 1) {
    const prefix = characters.slice(0, 1 + (index % characters.length)).join('');
    const prefixData = textTaskData(prefix, nameRect(index, -0.024));
    exercises.push(makeTask({ id: `name-prefix-${name}-${index}`, category: 'name', title: `Anfang ${prefix}`, speech: `Schreib den Anfang ${prefix}.`, label: prefix, value: prefix, strokes: prefixData.strokes, completionGroups: prefixData.completionGroups, complexity: prefix.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `prefix-${index}` }));
    const suffix = characters.slice(Math.max(0, characters.length - 1 - (index % characters.length))).join('');
    const suffixData = textTaskData(suffix, nameRect(index + 20, 0.024));
    exercises.push(makeTask({ id: `name-suffix-${name}-${index}`, category: 'name', title: `Ende ${suffix}`, speech: `Schreib das Ende ${suffix}.`, label: suffix, value: suffix, strokes: suffixData.strokes, completionGroups: suffixData.completionGroups, complexity: suffix.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `suffix-${index}` }));
    const chunk = chunks[index];
    const chunkData = textTaskData(chunk, nameRect(index + 40, -0.012));
    exercises.push(makeTask({ id: `name-chunk-${name}-${index}`, category: 'name', title: `Namensstück ${chunk}`, speech: `Schreib ${chunk}.`, label: chunk, value: chunk, strokes: chunkData.strokes, completionGroups: chunkData.completionGroups, complexity: chunk.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `chunk-${index}` }));
    const fullData = textTaskData(name, nameRect(index + 60, 0.012));
    exercises.push(makeTask({ id: `name-full-${name}-${index}`, category: 'name', title: `Dein Name ${name}`, speech: `Schreib deinen Namen ${name}.`, label: name, value: name, strokes: fullData.strokes, completionGroups: fullData.completionGroups, complexity: 3, group: 'name', family: 'name', layout: `full-${index}` }));
  }
  return Object.freeze(exercises);
}

const mixedBank = Object.freeze([
  ...lineBank.slice(0, 16),
  ...shapeBank.slice(0, 20),
  ...numberBank.slice(0, 16),
  ...letterBank.slice(0, 16),
  ...mazeBank.slice(0, 16),
  ...connectBank.slice(0, 16),
].map((task) => makeTask({ ...task, id: `mixed-${task.id}`, family: task.family })));

export const EXERCISE_BANKS = Object.freeze({
  lines: lineBank,
  shapes: shapeBank,
  numbers: numberBank,
  letters: letterBank,
  maze: mazeBank,
  connect: connectBank,
  mixed: mixedBank,
});
export const TASKS = Object.freeze(Object.values(EXERCISE_BANKS).flat());

export function getExerciseBank(category, { name = '', option = '' } = {}) {
  if (category === 'name') return createNameExerciseBank(name);
  const bank = EXERCISE_BANKS[category];
  if (!bank) throw new Error(`Unknown category: ${category}`);
  if (['numbers', 'letters'].includes(category)) return option && option !== 'all' ? createCustomSetBank(category, option) : bank;
  return bank;
}

function randomSample(pool, count, rng) {
  if (pool.length < count) throw new Error(`Need ${count} unique exercises, but only ${pool.length} are available.`);
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

function shuffle(items, rng) {
  return randomSample(items, items.length, rng);
}

function taskPool(category, option, name) {
  return getExerciseBank(category, { option, name });
}

const assistancePlans = {
  easy: ['easy', 'easy', 'easy', 'easy', 'medium', 'easy', 'easy'],
  medium: ['easy', 'medium', 'medium', 'medium', 'hard', 'medium', 'easy'],
  hard: ['medium', 'hard', 'hard', 'hard', 'hard', 'medium', 'easy'],
};

/**
 * Choose distinct task templates first, rotating through each available symbol
 * before a symbol can appear again. A custom one-symbol set still gets varied
 * placements, but never the exact same task twice.
 */
function sampleVariedTasks(pool, count, rng) {
  if (pool.length < count) throw new Error(`Need ${count} unique exercises, but only ${pool.length} are available.`);
  const byValue = new Map();
  pool.forEach((task) => {
    const key = task.value || task.label || task.id;
    if (!byValue.has(key)) byValue.set(key, []);
    byValue.get(key).push(task);
  });

  const keys = shuffle([...byValue.keys()], rng);
  const queues = new Map(keys.map((key) => [key, randomSample(byValue.get(key), byValue.get(key).length, rng)]));
  const selected = [];
  while (selected.length < count) {
    let added = false;
    keys.forEach((key) => {
      if (selected.length >= count) return;
      const task = queues.get(key)?.shift();
      if (!task) return;
      selected.push(task);
      added = true;
    });
    if (!added) break;
  }
  return selected;
}

export const SESSION_SIZE = 10;

function taskSymbols(task) {
  const compact = String(task.label ?? '').replace(/\s/g, '');
  return [...compact];
}

function taskHash(value) {
  return [...String(value)].reduce((hash, character) => ((hash * 31) + character.codePointAt(0)) >>> 0, 0);
}

function selectedGroupIndexes(task, profile) {
  const groups = task.completionGroups ?? [];
  if (groups.length <= 1) return groups.map((_, index) => index);
  const isFullName = task.category === 'name' && task.layout === 'whole-name';
  const targetCount = isFullName
    ? groups.length
    : Math.min(groups.length, profile.maxSymbols);
  if (targetCount === groups.length) return groups.map((_, index) => index);
  const first = (taskHash(task.id) + (task.slot ?? 0)) % (groups.length - targetCount + 1);
  return Array.from({ length: targetCount }, (_, index) => first + index);
}

function targetBoxes(count, profile) {
  const { width, height, portrait } = profile;
  const minimum = Math.min(width, height);
  if (count === 1) return [{
    centerX: width / 2,
    centerY: height / 2,
    width: width * 0.76,
    height: height * 0.78,
  }];

  if (portrait) {
    const slotHeight = Math.min(height * 0.3, (height / (count + 0.55)) * 0.9);
    const slotWidth = Math.min(width * 0.44, minimum * 0.66);
    return Array.from({ length: count }, (_, index) => ({
      centerX: width * (index % 2 === 0 ? 0.32 : 0.68),
      centerY: height * (0.16 + ((index + 0.5) / count) * 0.68),
      width: slotWidth,
      height: slotHeight,
    }));
  }

  const gap = Math.min(30, width * 0.035);
  const slotWidth = Math.max(36, (width - width * 0.14 - gap * (count - 1)) / count);
  return Array.from({ length: count }, (_, index) => ({
    centerX: width * 0.07 + slotWidth * (index + 0.5) + gap * index,
    centerY: height / 2,
    width: slotWidth * 0.9,
    height: height * 0.74,
  }));
}

function physicalBounds(strokes) {
  const points = strokes.flat();
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x * CANONICAL_DRAWING_WIDTH),
    maxX: Math.max(bounds.maxX, point.x * CANONICAL_DRAWING_WIDTH),
    minY: Math.min(bounds.minY, point.y * CANONICAL_DRAWING_HEIGHT),
    maxY: Math.max(bounds.maxY, point.y * CANONICAL_DRAWING_HEIGHT),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function fitGroupToBox(strokes, box, profile, spritePad = null) {
  const source = physicalBounds(strokes);
  const sourceWidth = Math.max(26, source.maxX - source.minX);
  const sourceHeight = Math.max(26, source.maxY - source.minY);
  let scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
  const sourceCenterX = (source.minX + source.maxX) / 2;
  const sourceCenterY = (source.minY + source.maxY) / 2;
  let spriteOffsetX = 0;
  let spriteOffsetY = 0;
  if (spritePad) {
    // The grey template sprite reaches past the centre-line route (crop
    // padding, plus the M's apex wedge above the walked junction). Route-fit
    // sizes stay untouched unless the sprite would leave the board around
    // the (possibly varied) box centre — then shrink just enough to keep it
    // fully visible, so Fino and the grey template stay glued together. A
    // small spill stays untouched: it only softens the antialiased edge of
    // the band, and recalibrating every size for it would be worse.
    const spriteHeight = sourceHeight + spritePad.top + spritePad.bottom;
    // Vertical only: a top or bottom cut removes taught geometry (the apex
    // wedge, the baseline hooks where strokes start and end). A horizontal
    // spill merely flattens the band's soft flank mid-stroke and has never
    // read as a defect, so the familiar presented sizes stay untouched.
    const spillTolerance = profile.height * 0.03;
    const safety = profile.height * 0.015;
    const halfHeight = (spriteHeight * scale) / 2;
    const roomHeight = Math.min(box.centerY, profile.height - box.centerY);
    if (halfHeight > roomHeight + spillTolerance) {
      scale *= Math.max(0.5, (roomHeight - safety) / halfHeight);
    }
    spriteOffsetX = (spritePad.left - spritePad.right) / 2;
    spriteOffsetY = (spritePad.top - spritePad.bottom) / 2;
  }
  return strokes.map((stroke) => stroke.map((point) => p(
    (box.centerX + ((point.x * CANONICAL_DRAWING_WIDTH) - sourceCenterX + spriteOffsetX) * scale) / profile.width,
    (box.centerY + ((point.y * CANONICAL_DRAWING_HEIGHT) - sourceCenterY + spriteOffsetY) * scale) / profile.height,
  )));
}

function symbolSpritePad(category, symbol, sourceStrokes) {
  if (!['letters', 'numbers', 'name'].includes(category)) return null;
  const geometry = CHARACTER_STROKE_GEOMETRY[symbol];
  if (!geometry) return null;
  // The source strokes may already be pre-scaled into an exercise cell, so
  // express the crop margins as fractions of the raw route and re-apply them
  // to whatever route size arrives here. Fits are uniform, so the ratios hold.
  const source = physicalBounds(sourceStrokes);
  const xRatio = (source.maxX - source.minX) / Math.max(1, geometry.routeWidth);
  const yRatio = (source.maxY - source.minY) / Math.max(1, geometry.routeHeight);
  return {
    left: geometry.routeX * xRatio,
    top: geometry.routeY * yRatio,
    right: (geometry.cropWidth - geometry.routeX - geometry.routeWidth) * xRatio,
    bottom: (geometry.cropHeight - geometry.routeY - geometry.routeHeight) * yRatio,
  };
}

function letterPresentationBox(symbol, box) {
  if (!/[a-zäöü]/.test(symbol)) return box;
  let scale = 0.7;
  let verticalOffset = 0.13;
  if (X_HEIGHT_LETTERS.has(symbol)) {
    scale = 0.62;
    verticalOffset = 0.17;
  } else if (ASCENDER_LETTERS.has(symbol)) {
    scale = symbol === 't' ? 0.8 : 0.92;
    verticalOffset = symbol === 't' ? 0.1 : 0.04;
  } else if (DESCENDER_LETTERS.has(symbol)) {
    scale = 0.88;
    verticalOffset = 0.08;
  }
  return {
    ...box,
    centerY: box.centerY + box.height * verticalOffset,
    width: box.width * scale,
    height: box.height * scale,
  };
}

function variedSymbolBox(task, box, visibleIndex, profile, groupCount) {
  const shouldVary = ['letters', 'numbers'].includes(task.category)
    && (task.group === 'custom' || String(task.layout).startsWith('easy-'));
  if (!shouldVary) return box;
  const presentations = [
    [1, 0, 0],
    [0.94, -0.04, 0], [0.94, 0.04, 0], [0.94, 0, -0.05], [0.94, 0, 0.05],
    [0.88, -0.04, -0.04], [0.88, 0.04, -0.04],
    [0.88, -0.04, 0.04], [0.88, 0.04, 0.04],
    [0.86, 0, 0],
  ];
  const sourceVariant = Number.isInteger(task.slot)
    ? task.slot
    : Number.isInteger(task.responsiveVariant) ? task.responsiveVariant : taskHash(task.id);
  const [scale, dx, dy] = presentations[(sourceVariant + visibleIndex) % presentations.length];
  if (groupCount > 1) {
    const [groupScale, groupDx, groupDy] = presentations[sourceVariant % presentations.length];
    return {
      ...box,
      centerX: profile.width / 2 + (box.centerX - profile.width / 2) * groupScale + profile.width * groupDx * 0.55,
      centerY: profile.height / 2 + (box.centerY - profile.height / 2) * groupScale + profile.height * groupDy * 0.55,
      width: box.width * groupScale,
      height: box.height * groupScale,
    };
  }
  const width = box.width * scale;
  const height = box.height * scale;
  const margin = Math.min(20, Math.min(profile.width, profile.height) * 0.055);
  const requestedX = box.centerX + box.width * dx;
  const requestedY = box.centerY + box.height * dy;
  return {
    ...box,
    centerX: clamp(requestedX, margin + width / 2, profile.width - margin - width / 2),
    centerY: clamp(requestedY, margin + height / 2, profile.height - margin - height / 2),
    width,
    height,
  };
}

/**
 * Reflow an already-authored task into the measured drawing board. Each
 * component is scaled uniformly from the 900×620 source drawing, so a circle,
 * letter or hard-cornered polygon keeps its intended proportions. Portrait
 * boards use a calm diagonal; landscape boards use a row.
 */
export function adaptTaskToViewport(task, viewport) {
  const profile = layoutProfileForViewport(viewport);
  if (task.gameMode === 'maze') {
    const gameSpec = task.gameSpec ?? task.game;
    const game = layoutMaze(gameSpec, profile);
    return Object.freeze({
      ...task,
      gameSpec,
      game,
      strokes: Object.freeze([game.solution]),
      completionGroups: Object.freeze([Object.freeze([0])]),
      strokeColors: Object.freeze([]),
      angularStrokes: Object.freeze([]),
      layout: `maze-${profile.portrait ? 'portrait' : 'landscape'}-${game.cols}x${game.rows}`,
      viewport: Object.freeze({ width: profile.width, height: profile.height, portrait: profile.portrait }),
    });
  }
  if (task.gameMode === 'connect') {
    const gameSpec = task.gameSpec ?? task.game;
    const game = layoutConnect(gameSpec, profile);
    const strokes = connectSolutionStrokes(game);
    return Object.freeze({
      ...task,
      gameSpec,
      game,
      strokes: Object.freeze(strokes),
      completionGroups: Object.freeze(strokes.map((_, index) => Object.freeze([index]))),
      strokeColors: Object.freeze(strokes.map((_, index) => Object.values(PICTURE_INK)[index % Object.keys(PICTURE_INK).length])),
      angularStrokes: Object.freeze([]),
      layout: `connect-${profile.portrait ? 'portrait' : 'landscape'}-${game.points.length}`,
      viewport: Object.freeze({ width: profile.width, height: profile.height, portrait: profile.portrait }),
    });
  }
  const groups = task.completionGroups?.length
    ? task.completionGroups
    : [task.strokes.map((_, index) => index)];
  const isTextLine = groups.length > 1 && (
    (task.category === 'name' && task.layout !== 'single-letter')
    || (task.category === 'letters' && task.layout === 'word')
  );
  if (isTextLine) {
    const fitted = fitGroupToBox(task.strokes, {
      centerX: profile.width / 2,
      centerY: profile.height / 2,
      width: profile.width * 0.88,
      height: profile.height * 0.68,
    }, profile);
    return Object.freeze({
      ...task,
      strokes: Object.freeze(fitted.map((stroke) => Object.freeze(stroke))),
      completionGroups: Object.freeze(groups.map((group) => Object.freeze([...group]))),
      layout: `${task.layout || 'word'}-${profile.portrait ? 'portrait' : 'landscape'}-${groups.length}`,
      viewport: Object.freeze({ width: profile.width, height: profile.height, portrait: profile.portrait }),
    });
  }
  const groupIndexes = selectedGroupIndexes(task, profile);
  const boxes = targetBoxes(groupIndexes.length, profile);
  if (groupIndexes.length === 1 && !['letters', 'numbers'].includes(task.category)) {
    const sourceIndexes = groups[groupIndexes[0]];
    const source = physicalBounds(sourceIndexes.map((index) => task.strokes[index]));
    const centerX = ((source.minX + source.maxX) / 2 / CANONICAL_DRAWING_WIDTH) * profile.width;
    const centerY = ((source.minY + source.maxY) / 2 / CANONICAL_DRAWING_HEIGHT) * profile.height;
    boxes[0].centerX = Math.min(profile.width - boxes[0].width / 2, Math.max(boxes[0].width / 2, centerX));
    boxes[0].centerY = Math.min(profile.height - boxes[0].height / 2, Math.max(boxes[0].height / 2, centerY));
  }
  const strokes = [];
  const completionGroups = [];
  const strokeColors = [];
  const sourceToTarget = new Map();

  groupIndexes.forEach((groupIndex, visibleIndex) => {
    const sourceIndexes = groups[groupIndex];
    const sourceStrokes = sourceIndexes.map((strokeIndex) => task.strokes[strokeIndex]);
    const variedBox = variedSymbolBox(task, boxes[visibleIndex], visibleIndex, profile, groupIndexes.length);
    const symbol = taskSymbols(task)[groupIndex] ?? '';
    const presentationBox = task.category === 'letters' || task.category === 'name'
      ? letterPresentationBox(symbol, variedBox)
      : variedBox;
    const fitted = fitGroupToBox(sourceStrokes, presentationBox, profile, symbolSpritePad(task.category, symbol, sourceStrokes));
    const firstStroke = strokes.length;
    sourceIndexes.forEach((strokeIndex, index) => sourceToTarget.set(strokeIndex, firstStroke + index));
    strokes.push(...fitted);
    strokeColors.push(...sourceIndexes.map((strokeIndex) => task.strokeColors?.[strokeIndex] ?? null));
    completionGroups.push(fitted.map((_, index) => firstStroke + index));
  });

  const symbols = taskSymbols(task);
  const displayedSymbols = groupIndexes.map((groupIndex) => symbols[groupIndex] ?? '').join('');
  const trimmed = groupIndexes.length !== groups.length;
  return Object.freeze({
    ...task,
    title: trimmed ? `${task.title} – Teil` : task.title,
    label: displayedSymbols || task.label,
    strokes: Object.freeze(strokes.map((stroke) => Object.freeze(stroke))),
    completionGroups: Object.freeze(completionGroups.map((group) => Object.freeze(group))),
    strokeColors: Object.freeze(strokeColors),
    angularStrokes: Object.freeze((task.angularStrokes ?? [])
      .filter((index) => sourceToTarget.has(index))
      .map((index) => sourceToTarget.get(index))),
    layout: `${task.layout || 'drawing'}-${profile.portrait ? 'portrait' : 'landscape'}-${groupIndexes.length}`,
    viewport: Object.freeze({ width: profile.width, height: profile.height, portrait: profile.portrait }),
  });
}

/**
 * Preserve an in-progress drawing through a resize. Target geometry and the
 * child's ink receive the same uniform pixel transform, so rotation cannot
 * stretch a letter, shape, maze, or line.
 */
export function reflowTaskWithInk(task, userStrokes, viewport) {
  if (task.gameMode) {
    const responsiveTask = adaptTaskToViewport(task, viewport);
    return Object.freeze({
      task: responsiveTask,
      // A maze or point path changes orientation as a whole. Restart just
      // this short task rather than shrinking the old portrait playfield into
      // a thin strip with tiny touch targets.
      userStrokes: Object.freeze([]),
      resetGame: true,
    });
  }
  const oldWidth = Math.max(1, Number(task?.viewport?.width) || CANONICAL_DRAWING_WIDTH);
  const oldHeight = Math.max(1, Number(task?.viewport?.height) || CANONICAL_DRAWING_HEIGHT);
  const profile = layoutProfileForViewport(viewport);
  const geometryPoints = task.strokes.flat();
  const pixelPoints = geometryPoints.map((point) => ({ x: point.x * oldWidth, y: point.y * oldHeight }));
  const bounds = pixelPoints.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y), maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
  const padding = Math.min(profile.width, profile.height) * 0.055;
  const scale = Math.min(
    (profile.width - padding * 2) / sourceWidth,
    (profile.height - padding * 2) / sourceHeight,
  );
  const sourceCenter = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const targetCenter = { x: profile.width / 2, y: profile.height / 2 };
  const transform = (point) => Object.freeze({
    ...point,
    x: (targetCenter.x + (point.x * oldWidth - sourceCenter.x) * scale) / profile.width,
    y: (targetCenter.y + (point.y * oldHeight - sourceCenter.y) * scale) / profile.height,
  });
  const transformStrokes = (strokes) => Object.freeze(strokes.map((stroke) => Object.freeze(stroke.map(transform))));
  const transformedStrokes = transformStrokes(task.strokes);
  const transformedUserStrokes = userStrokes.map((stroke) => stroke.map((point) => ({ ...transform(point) })));
  return Object.freeze({
    task: Object.freeze({
      ...task,
      strokes: transformedStrokes,
      viewport: Object.freeze({ width: profile.width, height: profile.height, portrait: profile.portrait }),
    }),
    userStrokes: Object.freeze(transformedUserStrokes.map((stroke) => Object.freeze(stroke))),
  });
}

/**
 * Creates a 10-task playthrough sampled without repeating a task.
 */
export function buildSession({ category, difficulty = 'easy', option = '', name = '', viewport, rng = Math.random }) {
  if (!CATEGORY_CONFIG[category]) throw new Error(`Unknown category: ${category}`);
  if (!DIFFICULTIES[difficulty]) throw new Error(`Unknown difficulty: ${difficulty}`);

  if (category === 'name') {
    const sequence = createNameRound(name, viewport);
    return sequence.map((task, index) => ({
      ...task,
      uid: `${task.id}-${index}`,
      assist: index === sequence.length - 1 ? 'easy' : assistancePlans[difficulty][index % assistancePlans[difficulty].length],
      slot: index,
    }));
  }

  let primary = ['numbers', 'letters'].includes(category) && difficulty === 'easy'
    ? createEasySymbolBank(category, option)
    : taskPool(category, option, name);
  const allowedGameComplexity = difficulty === 'easy' ? [1] : difficulty === 'medium' ? [2, 3] : [4];
  if (['maze', 'connect'].includes(category)) {
    const allowedComplexity = allowedGameComplexity;
    primary = primary.filter((task) => allowedComplexity.includes(task.complexity));
  }
  const sampled = category === 'mixed'
    ? shuffle([
      ['lines', 2], ['shapes', 2], ['numbers', 2], ['letters', 2], ['maze', 1], ['connect', 1],
    ].flatMap(([family, count]) => sampleVariedTasks(primary.filter((task) => (
      task.family === family
      && (!['maze', 'connect'].includes(family) || allowedGameComplexity.includes(task.complexity))
    )), count, rng)), rng)
    : sampleVariedTasks(primary, SESSION_SIZE, rng);

  if (category !== 'lines' && sampled[0]?.family === 'lines') {
    const firstNonLine = sampled.findIndex((task) => task.family !== 'lines');
    if (firstNonLine > 0) [sampled[0], sampled[firstNonLine]] = [sampled[firstNonLine], sampled[0]];
  }

  return sampled.map((task, index) => ({
    ...task,
    uid: `${task.id}-${index}`,
    assist: index === SESSION_SIZE - 1 ? 'easy' : assistancePlans[difficulty][index % assistancePlans[difficulty].length],
    slot: index,
  }));
}

/**
 * Test/review session: every letter (upper and lower case) and every digit
 * exactly once, in a fixed order, as a single-symbol task. Lets a reviewer
 * sweep the whole sprite library symbol by symbol instead of typing custom
 * sets by hand. Fino previews every task (assist 'easy').
 */
export function buildReviewSession() {
  const sequence = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß',
    ...'abcdefghijklmnopqrstuvwxyzäöü',
    ...'0123456789',
  ];
  return sequence.map((symbol, index) => {
    const isDigit = /[0-9]/.test(symbol);
    const bank = isDigit ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters;
    const id = isDigit ? `number-${symbol}-gross` : `letter-${symbol}-gross`;
    const task = bank.find((candidate) => candidate.id === id);
    if (!task) throw new Error(`Review mode: no single-symbol task for ${symbol}`);
    return {
      ...task,
      uid: `${task.id}-review-${index}`,
      assist: 'easy',
      slot: index,
    };
  });
}

/** Small deterministic RNG for tests and repeatable demos. */
export function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTaskById(id) {
  return TASKS.find((task) => task.id === id) ?? null;
}
