/**
 * Fino schreibt curriculum and deterministic session generation.
 * All coordinates are normalized to the drawing board (0..1).
 */

const p = (x, y) => ({ x, y });
const poly = (...pairs) => pairs.map(([x, y]) => p(x, y));

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
}) {
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

const shapeTemplates = [
  makeTask({
    id: 'shape-circle', category: 'shapes', title: 'Kreis', speech: 'Male einen Kreis. Starte oben.', label: '○',
    strokes: [arc(0.5, 0.5, 0.3, 0.36, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-oval', category: 'shapes', title: 'Oval', speech: 'Male ein langes Oval.', label: '⬭',
    strokes: [arc(0.5, 0.5, 0.24, 0.38, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-square', category: 'shapes', title: 'Viereck', speech: 'Male ein Viereck.', label: '□',
    strokes: [poly([0.25, 0.22], [0.75, 0.22], [0.75, 0.78], [0.25, 0.78], [0.25, 0.22])], complexity: 1,
  }),
  makeTask({
    id: 'shape-triangle', category: 'shapes', title: 'Dreieck', speech: 'Male ein Dreieck.', label: '△',
    strokes: [poly([0.5, 0.18], [0.82, 0.78], [0.18, 0.78], [0.5, 0.18])], complexity: 1,
  }),
  makeTask({
    id: 'shape-cross', category: 'shapes', title: 'Kreuz', speech: 'Male ein großes Kreuz.', label: '＋',
    strokes: [poly([0.5, 0.18], [0.5, 0.82]), poly([0.18, 0.5], [0.82, 0.5])], complexity: 2,
  }),
  makeTask({
    id: 'shape-diamond', category: 'shapes', title: 'Raute', speech: 'Male eine Raute.', label: '◇',
    strokes: [poly([0.5, 0.14], [0.82, 0.5], [0.5, 0.86], [0.18, 0.5], [0.5, 0.14])], complexity: 2,
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
    strokes: [poly([0.5, 0.12], [0.59, 0.4], [0.88, 0.4], [0.64, 0.57], [0.73, 0.86], [0.5, 0.68], [0.27, 0.86], [0.36, 0.57], [0.12, 0.4], [0.41, 0.4], [0.5, 0.12])], complexity: 3,
  }),
  makeTask({
    id: 'shape-rectangle', category: 'shapes', title: 'Rechteck', speech: 'Male ein breites Rechteck.', label: '▭',
    strokes: [poly([0.16, 0.3], [0.84, 0.3], [0.84, 0.7], [0.16, 0.7], [0.16, 0.3])], complexity: 1,
  }),
  makeTask({
    id: 'shape-pentagon', category: 'shapes', title: 'Fünfeck', speech: 'Male ein Fünfeck.', label: 'Fünfeck',
    strokes: [poly([0.5, 0.15], [0.82, 0.39], [0.7, 0.82], [0.3, 0.82], [0.18, 0.39], [0.5, 0.15])], complexity: 2,
  }),
  makeTask({
    id: 'shape-hexagon', category: 'shapes', title: 'Sechseck', speech: 'Male ein Sechseck.', label: 'Sechseck',
    strokes: [poly([0.33, 0.18], [0.67, 0.18], [0.84, 0.5], [0.67, 0.82], [0.33, 0.82], [0.16, 0.5], [0.33, 0.18])], complexity: 2,
  }),
  makeTask({
    id: 'shape-arrow', category: 'shapes', title: 'Pfeil', speech: 'Male einen Pfeil nach rechts.', label: 'Pfeil',
    strokes: [poly([0.16, 0.5], [0.7, 0.5], [0.53, 0.32]), poly([0.7, 0.5], [0.53, 0.68])], complexity: 2,
  }),
  makeTask({
    id: 'shape-house', category: 'shapes', title: 'Haus', speech: 'Male ein kleines Haus.', label: 'Haus',
    strokes: [poly([0.22, 0.5], [0.5, 0.2], [0.78, 0.5]), poly([0.28, 0.47], [0.28, 0.8], [0.72, 0.8], [0.72, 0.47])], complexity: 2,
  }),
  makeTask({
    id: 'shape-kite', category: 'shapes', title: 'Drachen', speech: 'Male einen Drachen mit Schwanz.', label: 'Drachen',
    strokes: [poly([0.5, 0.16], [0.77, 0.46], [0.5, 0.75], [0.23, 0.46], [0.5, 0.16]), poly([0.5, 0.75], [0.58, 0.84], [0.5, 0.9], [0.42, 0.84])], complexity: 2,
  }),
  makeTask({
    id: 'shape-balloon', category: 'shapes', title: 'Ballon', speech: 'Male einen Ballon mit Schnur.', label: 'Ballon',
    strokes: [arc(0.5, 0.4, 0.22, 0.27, -90, 270, 36), poly([0.5, 0.67], [0.46, 0.8], [0.52, 0.88])], complexity: 2,
  }),
  makeTask({
    id: 'shape-fish', category: 'shapes', title: 'Fisch', speech: 'Male einen Fisch.', label: 'Fisch',
    strokes: [arc(0.45, 0.5, 0.28, 0.18, -90, 270, 32), poly([0.72, 0.5], [0.88, 0.3], [0.88, 0.7], [0.72, 0.5])], complexity: 2,
  }),
  makeTask({
    id: 'shape-flower', category: 'shapes', title: 'Blume', speech: 'Male eine Blume mit Stiel.', label: 'Blume',
    strokes: [arc(0.5, 0.36, 0.2, 0.16, -90, 270, 28), arc(0.5, 0.36, 0.1, 0.26, 0, 360, 28), poly([0.5, 0.55], [0.5, 0.86]), poly([0.5, 0.72], [0.35, 0.64]), poly([0.5, 0.78], [0.65, 0.7])], complexity: 3,
  }),
  makeTask({
    id: 'shape-sun', category: 'shapes', title: 'Sonne', speech: 'Male eine Sonne mit Strahlen.', label: 'Sonne',
    strokes: [arc(0.5, 0.5, 0.2, 0.2, -90, 270, 30), poly([0.5, 0.08], [0.5, 0.2]), poly([0.5, 0.8], [0.5, 0.92]), poly([0.08, 0.5], [0.2, 0.5]), poly([0.8, 0.5], [0.92, 0.5]), poly([0.2, 0.2], [0.29, 0.29]), poly([0.71, 0.71], [0.8, 0.8])], complexity: 3,
  }),
  makeTask({
    id: 'shape-sailboat', category: 'shapes', title: 'Segelboot', speech: 'Male ein Segelboot.', label: 'Segelboot',
    strokes: [poly([0.18, 0.72], [0.82, 0.72], [0.68, 0.84], [0.32, 0.84], [0.18, 0.72]), poly([0.5, 0.72], [0.5, 0.2], [0.76, 0.64], [0.5, 0.64]), poly([0.46, 0.28], [0.24, 0.64], [0.46, 0.64])], complexity: 3,
  }),
  makeTask({
    id: 'shape-rocket', category: 'shapes', title: 'Rakete', speech: 'Male eine Rakete.', label: 'Rakete',
    strokes: [poly([0.5, 0.12], [0.7, 0.38], [0.66, 0.72], [0.5, 0.86], [0.34, 0.72], [0.3, 0.38], [0.5, 0.12]), arc(0.5, 0.46, 0.07, 0.07, -90, 270, 20), poly([0.42, 0.76], [0.34, 0.88]), poly([0.58, 0.76], [0.66, 0.88])], complexity: 3,
  }),
];

const digitStrokes = {
  '0': [arc(0.5, 0.5, 0.25, 0.38, -90, 270, 44)],
  '1': [poly([0.36, 0.3], [0.5, 0.16], [0.5, 0.84])],
  '2': [join(
    bezier(p(0.25, 0.32), p(0.34, 0.1), p(0.72, 0.1), p(0.75, 0.32), 24),
    bezier(p(0.75, 0.32), p(0.76, 0.49), p(0.4, 0.61), p(0.24, 0.83), 24),
    poly([0.24, 0.83], [0.78, 0.83]),
  )],
  '3': [join(
    bezier(p(0.27, 0.24), p(0.42, 0.09), p(0.74, 0.13), p(0.72, 0.36), 22),
    bezier(p(0.72, 0.36), p(0.7, 0.49), p(0.57, 0.5), p(0.49, 0.5), 12),
    bezier(p(0.49, 0.5), p(0.67, 0.49), p(0.77, 0.58), p(0.73, 0.74), 18),
    bezier(p(0.73, 0.74), p(0.68, 0.92), p(0.38, 0.91), p(0.25, 0.77), 22),
  )],
  '4': [poly([0.67, 0.84], [0.67, 0.16]), poly([0.67, 0.16], [0.23, 0.65], [0.82, 0.65])],
  '5': [poly([0.73, 0.17], [0.31, 0.17], [0.28, 0.5]), join(
    bezier(p(0.28, 0.5), p(0.47, 0.42), p(0.73, 0.46), p(0.75, 0.66), 22),
    bezier(p(0.75, 0.66), p(0.77, 0.9), p(0.39, 0.94), p(0.24, 0.78), 22),
  )],
  '6': [join(
    bezier(p(0.72, 0.22), p(0.57, 0.1), p(0.31, 0.18), p(0.28, 0.52), 24),
    bezier(p(0.28, 0.52), p(0.25, 0.86), p(0.68, 0.95), p(0.75, 0.69), 24),
    bezier(p(0.75, 0.69), p(0.79, 0.43), p(0.43, 0.38), p(0.29, 0.57), 24),
  )],
  '7': [poly([0.22, 0.18], [0.8, 0.18], [0.4, 0.84])],
  '8': [join(
    bezier(p(0.5, 0.5), p(0.18, 0.37), p(0.28, 0.12), p(0.51, 0.14), 22),
    bezier(p(0.51, 0.14), p(0.76, 0.16), p(0.82, 0.39), p(0.5, 0.5), 22),
    bezier(p(0.5, 0.5), p(0.18, 0.61), p(0.24, 0.88), p(0.5, 0.88), 22),
    bezier(p(0.5, 0.88), p(0.78, 0.88), p(0.82, 0.61), p(0.5, 0.5), 22),
  )],
  '9': [join(
    bezier(p(0.72, 0.48), p(0.75, 0.15), p(0.32, 0.07), p(0.25, 0.34), 24),
    bezier(p(0.25, 0.34), p(0.19, 0.61), p(0.57, 0.67), p(0.71, 0.49), 24),
    bezier(p(0.71, 0.49), p(0.74, 0.75), p(0.57, 0.88), p(0.35, 0.86), 20),
  )],
};

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

const letterStrokes = {
  A: [poly([0.2, 0.84], [0.5, 0.15]), poly([0.5, 0.15], [0.8, 0.84]), poly([0.32, 0.58], [0.68, 0.58])],
  B: [poly([0.27, 0.84], [0.27, 0.16]), join(bezier(p(0.27, 0.16), p(0.74, 0.12), p(0.78, 0.48), p(0.28, 0.49), 26), bezier(p(0.28, 0.49), p(0.83, 0.47), p(0.82, 0.88), p(0.27, 0.84), 28))],
  C: [arc(0.53, 0.5, 0.32, 0.37, -45, -315, 44)],
  D: [poly([0.27, 0.84], [0.27, 0.16]), bezier(p(0.27, 0.16), p(0.84, 0.13), p(0.84, 0.86), p(0.27, 0.84), 40)],
  E: [poly([0.72, 0.16], [0.27, 0.16], [0.27, 0.84], [0.74, 0.84]), poly([0.27, 0.5], [0.65, 0.5])],
  F: [poly([0.27, 0.84], [0.27, 0.16], [0.74, 0.16]), poly([0.27, 0.5], [0.65, 0.5])],
  G: [arc(0.53, 0.5, 0.32, 0.37, -45, -315, 44), poly([0.55, 0.55], [0.8, 0.55], [0.8, 0.75])],
  H: [poly([0.25, 0.16], [0.25, 0.84]), poly([0.75, 0.16], [0.75, 0.84]), poly([0.25, 0.5], [0.75, 0.5])],
  I: [poly([0.5, 0.16], [0.5, 0.84])],
  J: [poly([0.25, 0.16], [0.75, 0.16]), join(poly([0.67, 0.16], [0.67, 0.68]), bezier(p(0.67, 0.68), p(0.66, 0.9), p(0.31, 0.92), p(0.24, 0.72), 24))],
  K: [poly([0.25, 0.16], [0.25, 0.84]), poly([0.75, 0.16], [0.25, 0.53]), poly([0.36, 0.45], [0.78, 0.84])],
  L: [poly([0.27, 0.16], [0.27, 0.84], [0.77, 0.84])],
  M: [poly([0.18, 0.84], [0.18, 0.16], [0.5, 0.58], [0.82, 0.16], [0.82, 0.84])],
  N: [poly([0.22, 0.84], [0.22, 0.16], [0.78, 0.84], [0.78, 0.16])],
  O: [arc(0.5, 0.5, 0.3, 0.37, -90, 270, 46)],
  P: [poly([0.27, 0.84], [0.27, 0.16]), bezier(p(0.27, 0.16), p(0.82, 0.12), p(0.83, 0.54), p(0.27, 0.51), 34)],
  Q: [arc(0.5, 0.48, 0.3, 0.35, -90, 270, 46), poly([0.57, 0.65], [0.8, 0.88])],
  R: [poly([0.27, 0.84], [0.27, 0.16]), bezier(p(0.27, 0.16), p(0.82, 0.12), p(0.83, 0.54), p(0.27, 0.51), 34), poly([0.5, 0.5], [0.8, 0.84])],
  S: [join(bezier(p(0.76, 0.24), p(0.59, 0.08), p(0.28, 0.14), p(0.28, 0.36), 24), bezier(p(0.28, 0.36), p(0.28, 0.54), p(0.72, 0.48), p(0.74, 0.69), 24), bezier(p(0.74, 0.69), p(0.75, 0.91), p(0.4, 0.94), p(0.23, 0.78), 24))],
  T: [poly([0.18, 0.16], [0.82, 0.16]), poly([0.5, 0.16], [0.5, 0.84])],
  U: [join(poly([0.23, 0.16], [0.23, 0.64]), bezier(p(0.23, 0.64), p(0.23, 0.9), p(0.77, 0.9), p(0.77, 0.64), 30), poly([0.77, 0.64], [0.77, 0.16]))],
  V: [poly([0.18, 0.16], [0.5, 0.84], [0.82, 0.16])],
  W: [poly([0.12, 0.16], [0.3, 0.84], [0.5, 0.4], [0.7, 0.84], [0.88, 0.16])],
  X: [poly([0.2, 0.16], [0.8, 0.84]), poly([0.8, 0.16], [0.2, 0.84])],
  Y: [poly([0.2, 0.16], [0.5, 0.5], [0.8, 0.16]), poly([0.5, 0.5], [0.5, 0.84])],
  Z: [poly([0.2, 0.16], [0.8, 0.16], [0.2, 0.84], [0.8, 0.84])],
};
letterStrokes['Ä'] = [...letterStrokes.A, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];
letterStrokes['Ö'] = [...letterStrokes.O, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];
letterStrokes['Ü'] = [...letterStrokes.U, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];

const letterMeta = {
  A: ['Affe', 'diagonal', 2], B: ['Ball', 'mixed', 3], C: ['Clown', 'round', 2], D: ['Dino', 'mixed', 2],
  E: ['Ente', 'straight', 1], F: ['Fisch', 'straight', 1], G: ['Gans', 'round', 3], H: ['Haus', 'straight', 1],
  I: ['Igel', 'straight', 1], J: ['Jacke', 'round', 2], K: ['Katze', 'diagonal', 2], L: ['Löwe', 'straight', 1],
  M: ['Maus', 'diagonal', 3], N: ['Nase', 'diagonal', 2], O: ['Oma', 'round', 1], P: ['Panda', 'mixed', 2],
  Q: ['Qualle', 'round', 3], R: ['Regen', 'mixed', 3], S: ['Sonne', 'round', 3], T: ['Tiger', 'straight', 1],
  U: ['Uhu', 'round', 2], V: ['Vogel', 'diagonal', 1], W: ['Wolke', 'diagonal', 3], X: ['Xylofon', 'diagonal', 2],
  Y: ['Yak', 'diagonal', 2], Z: ['Zebra', 'diagonal', 2], Ä: ['Äpfel', 'diagonal', 3], Ö: ['Öl', 'round', 3], Ü: ['Überraschung', 'round', 3],
};

const letterTemplates = Object.entries(letterStrokes).map(([letter, strokes]) => {
  const [example, group, complexity] = letterMeta[letter];
  return makeTask({
    id: `letter-${letter}`,
    category: 'letters',
    title: `${letter} wie ${example}`,
    speech: `Schreib ein ${letter}. ${letter} wie ${example}.`,
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
  mixed: { label: 'Bunte Mischung', speech: 'Alles gemischt', icon: 'mixed' },
});

export const DIFFICULTIES = Object.freeze({
  easy: { label: 'Leicht', speech: 'Leicht', description: 'Klare, dünne Spur' },
  medium: { label: 'Mittel', speech: 'Mittel', description: 'Feine, transparente Spur' },
  hard: { label: 'Knifflig', speech: 'Knifflig', description: 'Zarte, transparente Spur' },
});

export const OPTION_SETS = Object.freeze({
  numbers: [
    { value: '1-3', label: '1–3' },
    { value: '1-6', label: '1–6' },
    { value: '0-9', label: '0–9' },
  ],
  letters: [
    { value: 'straight', label: 'Gerade' },
    { value: 'diagonal', label: 'Schräg' },
    { value: 'round', label: 'Rund' },
    { value: 'all', label: 'Alle' },
  ],
});

export function normalizeName(value) {
  const protectedUmlauts = String(value ?? '')
    .trim()
    .toLocaleUpperCase('de-DE')
    .replace(/ẞ/g, 'SS')
    .replace(/Ä/g, '\uE000')
    .replace(/Ö/g, '\uE001')
    .replace(/Ü/g, '\uE002')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\uE000/g, 'Ä')
    .replace(/\uE001/g, 'Ö')
    .replace(/\uE002/g, 'Ü');
  return protectedUmlauts
    .replace(/[^A-ZÄÖÜ\- ]/g, '')
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

function fitStrokes(strokes, rect) {
  const bounds = boundsOf(strokes);
  const spanX = Math.max(0.001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.001, bounds.maxY - bounds.minY);
  return strokes.map((stroke) => stroke.map((point) => p(
    rect.x + ((point.x - bounds.minX) / spanX) * rect.width,
    rect.y + ((point.y - bounds.minY) / spanY) * rect.height,
  )));
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

function textStrokes(rawText, rect = { x: 0.06, y: 0.2, width: 0.88, height: 0.62 }) {
  const characters = textCharacters(rawText);
  if (!characters.length) return [];
  const gap = Math.min(0.025, rect.width * 0.04);
  const usable = rect.width - gap * (characters.length - 1);
  const slotWidth = usable / characters.length;
  return characters.flatMap((character, index) => fitStrokes(letterStrokes[character], {
    x: rect.x + index * (slotWidth + gap), y: rect.y, width: slotWidth, height: rect.height,
  }));
}

export function createWordTask(rawName) {
  const name = normalizeName(rawName).replace(/[- ]/g, '').slice(0, 8);
  const strokes = textStrokes(name);
  if (!strokes.length) return null;
  return makeTask({
    id: `word-${name}`,
    category: 'name',
    title: 'Dein Name',
    speech: `Schreib deinen Namen. ${name}.`,
    label: name,
    strokes,
    complexity: 3,
    group: 'name',
  });
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

function repeatedStrokes(strokes, cells) {
  return cells.flatMap((cell) => fitStrokes(strokes, cell));
}

const lineBank = variantBank('lines', lineTemplates, ROUTE_LAYOUTS);
const shapeBank = variantBank('shapes', shapeTemplates, SHAPE_LAYOUTS);
const numberBank = Object.freeze(numberTemplates.flatMap((template) => NUMBER_LAYOUTS.map(([key, title, cells]) => makeTask({
  id: `number-${template.label}-${key}`,
  category: 'numbers',
  title: `${template.title} – ${title}`,
  speech: `${template.speech} ${title}.`,
  label: cells.length === 1 ? template.label : Array(cells.length).fill(template.label).join(' '),
  value: template.label,
  strokes: repeatedStrokes(template.strokes, cells),
  complexity: template.complexity,
  family: 'numbers',
  layout: key,
}))));

const LETTER_LAYOUTS = [
  ['gross', 'einmal groß', [{ x: 0.3, y: 0.12, width: 0.4, height: 0.76 }]],
  ['paar', 'zweimal', [{ x: 0.14, y: 0.2, width: 0.3, height: 0.6 }, { x: 0.56, y: 0.2, width: 0.3, height: 0.6 }]],
  ['reihe', 'dreimal', [{ x: 0.08, y: 0.26, width: 0.22, height: 0.48 }, { x: 0.39, y: 0.26, width: 0.22, height: 0.48 }, { x: 0.7, y: 0.26, width: 0.22, height: 0.48 }]],
];

const letterDrills = letterTemplates.flatMap((template) => LETTER_LAYOUTS.map(([key, title, cells]) => makeTask({
  id: `letter-${template.label}-${key}`,
  category: 'letters',
  title: `${template.title} – ${title}`,
  speech: `${template.speech} ${title}.`,
  label: Array(cells.length).fill(template.label).join(' '),
  value: template.label,
  strokes: repeatedStrokes(template.strokes, cells),
  complexity: template.complexity,
  group: template.group,
  example: template.example,
  family: 'letters',
  layout: key,
})));

const letterExtraDrills = letterTemplates.filter((template) => ['E', 'F'].includes(template.label)).map((template) => makeTask({
  id: `letter-${template.label}-turm`,
  category: 'letters',
  title: `${template.title} – Buchstabenturm`,
  speech: `${template.speech} Buchstabenturm.`,
  label: `${template.label} ${template.label} ${template.label}`,
  value: template.label,
  strokes: repeatedStrokes(template.strokes, [{ x: 0.36, y: 0.08, width: 0.28, height: 0.25 }, { x: 0.36, y: 0.38, width: 0.28, height: 0.25 }, { x: 0.36, y: 0.68, width: 0.28, height: 0.25 }]),
  complexity: template.complexity,
  group: template.group,
  example: template.example,
  family: 'letters',
  layout: 'turm',
}));

const letterWords = ['ICH', 'DU', 'JA', 'OMA', 'OPA', 'HAUS', 'BALL', 'MAUS', 'HASE', 'AUTO', 'FUCHS'];
const letterBank = Object.freeze([
  ...letterDrills,
  ...letterExtraDrills,
  ...letterWords.map((word) => makeTask({
    id: `letter-word-${word}`,
    category: 'letters',
    title: `Wort ${word}`,
    speech: `Schreib das Wort ${word}.`,
    label: word,
    value: word,
    strokes: textStrokes(word),
    complexity: 3,
    group: 'all',
    family: 'letters',
    layout: 'word',
  })),
]);

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
  const name = normalizeName(rawName).replace(/[- ]/g, '').slice(0, 8) || 'FINO';
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
    exercises.push(makeTask({ id: `name-focus-${name}-${index}`, category: 'name', title: `${letter} üben`, speech: `Übe den Buchstaben ${letter}.`, label: Array(copies).fill(letter).join(' '), value: letter, strokes: repeatedStrokes(letterStrokes[letter], cells), complexity: copies === 1 ? 1 : 2, group: 'name', family: 'name', layout: `focus-${index}` }));
  }
  for (let index = 0; index < 20; index += 1) {
    const prefix = characters.slice(0, 1 + (index % characters.length)).join('');
    exercises.push(makeTask({ id: `name-prefix-${name}-${index}`, category: 'name', title: `Anfang ${prefix}`, speech: `Schreib den Anfang ${prefix}.`, label: prefix, value: prefix, strokes: textStrokes(prefix, nameRect(index, -0.024)), complexity: prefix.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `prefix-${index}` }));
    const suffix = characters.slice(Math.max(0, characters.length - 1 - (index % characters.length))).join('');
    exercises.push(makeTask({ id: `name-suffix-${name}-${index}`, category: 'name', title: `Ende ${suffix}`, speech: `Schreib das Ende ${suffix}.`, label: suffix, value: suffix, strokes: textStrokes(suffix, nameRect(index + 20, 0.024)), complexity: suffix.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `suffix-${index}` }));
    const chunk = chunks[index];
    exercises.push(makeTask({ id: `name-chunk-${name}-${index}`, category: 'name', title: `Namensstück ${chunk}`, speech: `Schreib ${chunk}.`, label: chunk, value: chunk, strokes: textStrokes(chunk, nameRect(index + 40, -0.012)), complexity: chunk.length > 2 ? 3 : 2, group: 'name', family: 'name', layout: `chunk-${index}` }));
    exercises.push(makeTask({ id: `name-full-${name}-${index}`, category: 'name', title: `Dein Name ${name}`, speech: `Schreib deinen Namen ${name}.`, label: name, value: name, strokes: textStrokes(name, nameRect(index + 60, 0.012)), complexity: 3, group: 'name', family: 'name', layout: `full-${index}` }));
  }
  return Object.freeze(exercises);
}

const mixedBank = Object.freeze([
  ...lineBank.slice(0, 25),
  ...shapeBank.slice(0, 25),
  ...numberBank.slice(0, 25),
  ...letterBank.slice(0, 25),
].map((task) => makeTask({ ...task, id: `mixed-${task.id}`, family: task.family })));

export const EXERCISE_BANKS = Object.freeze({ lines: lineBank, shapes: shapeBank, numbers: numberBank, letters: letterBank, mixed: mixedBank });
export const TASKS = Object.freeze(Object.values(EXERCISE_BANKS).flat());

export function getExerciseBank(category, { name = '', option = '' } = {}) {
  if (category === 'name') return createNameExerciseBank(name);
  const bank = EXERCISE_BANKS[category];
  if (!bank) throw new Error(`Unknown category: ${category}`);
  if (category === 'numbers') {
    const max = option === '1-3' ? 3 : option === '1-6' ? 6 : 9;
    return bank.filter((task) => Number(task.value) <= max && (task.value !== '0' || option === '0-9'));
  }
  if (category === 'letters') {
    const group = option || 'all';
    return bank.filter((task) => group === 'all' || task.group === group);
  }
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
export const SESSION_SIZE = 20;

/**
 * Creates a 20-task playthrough sampled without replacement from a bank of 100.
 */
export function buildSession({ category, difficulty = 'easy', option = '', name = '', rng = Math.random }) {
  if (!CATEGORY_CONFIG[category]) throw new Error(`Unknown category: ${category}`);
  if (!DIFFICULTIES[difficulty]) throw new Error(`Unknown difficulty: ${difficulty}`);

  const primary = taskPool(category, option, name);
  const sampled = category === 'mixed'
    ? shuffle(['lines', 'shapes', 'numbers', 'letters'].flatMap((family) => randomSample(primary.filter((task) => task.family === family), 5, rng)), rng)
    : randomSample(primary, SESSION_SIZE, rng);

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
