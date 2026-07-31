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
  completionGroups = [strokes.map((_, index) => index)],
  angularStrokes = [],
  strokeColors = [],
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
    strokes: [arc(0.5, 0.5, 0.3, 0.36, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-oval', category: 'shapes', title: 'Oval', speech: 'Male ein langes Oval.', label: '⬭',
    strokes: [arc(0.5, 0.5, 0.24, 0.38, -90, 270, 44)], complexity: 1,
  }),
  makeTask({
    id: 'shape-square', category: 'shapes', title: 'Viereck', speech: 'Male ein Viereck.', label: '□',
    strokes: [poly([0.25, 0.22], [0.75, 0.22], [0.75, 0.78], [0.25, 0.78], [0.25, 0.22])], complexity: 1, angularStrokes: [0],
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
    strokes: [poly([0.16, 0.5], [0.7, 0.5], [0.53, 0.32]), poly([0.7, 0.5], [0.53, 0.68])], complexity: 2, angularStrokes: [0, 1],
  }),
  makeTask({
    id: 'shape-house', category: 'shapes', title: 'Haus', speech: 'Male ein kleines Haus.', label: 'Haus',
    strokes: [poly([0.22, 0.5], [0.5, 0.2], [0.78, 0.5]), poly([0.28, 0.47], [0.28, 0.8], [0.72, 0.8], [0.72, 0.47])], complexity: 2, angularStrokes: [0, 1],
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
    strokes: [arc(0.5, 0.36, 0.2, 0.16, -90, 270, 28), arc(0.5, 0.36, 0.1, 0.26, 0, 360, 28), poly([0.5, 0.55], [0.5, 0.86]), poly([0.5, 0.72], [0.35, 0.64]), poly([0.5, 0.78], [0.65, 0.7])], complexity: 3, angularStrokes: [2, 3, 4],
  }),
  makeTask({
    id: 'shape-sun', category: 'shapes', title: 'Sonne', speech: 'Male eine Sonne mit Strahlen.', label: 'Sonne',
    strokes: [arc(0.5, 0.5, 0.2, 0.2, -90, 270, 30), poly([0.5, 0.08], [0.5, 0.2]), poly([0.5, 0.8], [0.5, 0.92]), poly([0.08, 0.5], [0.2, 0.5]), poly([0.8, 0.5], [0.92, 0.5]), poly([0.2, 0.2], [0.29, 0.29]), poly([0.71, 0.71], [0.8, 0.8])], complexity: 3, angularStrokes: [1, 2, 3, 4, 5, 6],
  }),
  makeTask({
    id: 'shape-sailboat', category: 'shapes', title: 'Segelboot', speech: 'Male ein Segelboot.', label: 'Segelboot',
    strokes: [poly([0.18, 0.72], [0.82, 0.72], [0.68, 0.84], [0.32, 0.84], [0.18, 0.72]), poly([0.5, 0.72], [0.5, 0.2], [0.76, 0.64], [0.5, 0.64]), poly([0.46, 0.28], [0.24, 0.64], [0.46, 0.64])], complexity: 3, angularStrokes: [0, 1, 2],
  }),
  makeTask({
    id: 'shape-rocket', category: 'shapes', title: 'Rakete', speech: 'Male eine Rakete.', label: 'Rakete',
    strokes: [poly([0.5, 0.12], [0.7, 0.38], [0.66, 0.72], [0.5, 0.86], [0.34, 0.72], [0.3, 0.38], [0.5, 0.12]), arc(0.5, 0.46, 0.07, 0.07, -90, 270, 20), poly([0.42, 0.76], [0.34, 0.88]), poly([0.58, 0.76], [0.66, 0.88])], complexity: 3, angularStrokes: [0, 2, 3],
  }),
  makeTask({
    id: 'shape-tree', category: 'shapes', title: 'Baum', speech: 'Male einen Baum mit Stamm und Krone.', label: 'Baum',
    strokes: [poly([0.5, 0.84], [0.5, 0.55]), poly([0.5, 0.16], [0.27, 0.58], [0.73, 0.58], [0.5, 0.16]), poly([0.2, 0.84], [0.8, 0.84])],
    complexity: 3, angularStrokes: [0, 1, 2], strokeColors: [PICTURE_INK.brown, PICTURE_INK.green, PICTURE_INK.green],
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
    strokes: [arc(0.37, 0.48, 0.16, 0.27, -90, 270, 28), arc(0.63, 0.48, 0.16, 0.27, -90, 270, 28), poly([0.5, 0.18], [0.5, 0.78]), poly([0.5, 0.22], [0.42, 0.12]), poly([0.5, 0.22], [0.58, 0.12])],
    complexity: 3, angularStrokes: [2, 3, 4], strokeColors: [PICTURE_INK.purple, PICTURE_INK.purple, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.charcoal],
  }),
  makeTask({
    id: 'shape-snail', category: 'shapes', title: 'Schnecke', speech: 'Male eine Schnecke mit Haus und Fühlern.', label: 'Schnecke',
    strokes: [arc(0.4, 0.5, 0.2, 0.2, -90, 270, 30), bezier(p(0.18, 0.68), p(0.46, 0.77), p(0.77, 0.75), p(0.8, 0.58), 28), poly([0.8, 0.58], [0.74, 0.44]), poly([0.8, 0.58], [0.87, 0.45])],
    complexity: 3, angularStrokes: [2, 3], strokeColors: [PICTURE_INK.purple, PICTURE_INK.green, PICTURE_INK.green, PICTURE_INK.green],
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
    strokes: [arc(0.44, 0.52, 0.26, 0.18, -90, 270, 28), arc(0.44, 0.52, 0.12, 0.08, 180, 540, 20), poly([0.68, 0.52], [0.83, 0.57], [0.68, 0.62], [0.68, 0.52])],
    complexity: 3, angularStrokes: [2], strokeColors: [PICTURE_INK.blue, PICTURE_INK.purple, PICTURE_INK.orange],
  }),
  makeTask({
    id: 'shape-present', category: 'shapes', title: 'Geschenk', speech: 'Male ein Geschenk mit Schleife.', label: 'Geschenk',
    strokes: [poly([0.22, 0.36], [0.78, 0.36], [0.78, 0.8], [0.22, 0.8], [0.22, 0.36]), poly([0.5, 0.36], [0.5, 0.8]), poly([0.22, 0.56], [0.78, 0.56]), join(bezier(p(0.5, 0.36), p(0.34, 0.12), p(0.21, 0.28), p(0.5, 0.42), 18), bezier(p(0.5, 0.42), p(0.79, 0.28), p(0.66, 0.12), p(0.5, 0.36), 18))],
    complexity: 3, angularStrokes: [0, 1, 2], strokeColors: [PICTURE_INK.blue, PICTURE_INK.yellow, PICTURE_INK.yellow, PICTURE_INK.pink],
  }),
  makeTask({
    id: 'shape-crown', category: 'shapes', title: 'Krone', speech: 'Male eine Krone mit drei Spitzen.', label: 'Krone',
    strokes: [poly([0.22, 0.72], [0.78, 0.72], [0.78, 0.82], [0.22, 0.82], [0.22, 0.72]), poly([0.22, 0.72], [0.3, 0.3], [0.5, 0.58], [0.7, 0.3], [0.78, 0.72]), poly([0.22, 0.78], [0.78, 0.78])],
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
    strokes: [arc(0.5, 0.56, 0.18, 0.24, -90, 270, 28), poly([0.34, 0.47], [0.66, 0.47]), poly([0.32, 0.62], [0.68, 0.62]), arc(0.37, 0.38, 0.14, 0.1, 0, 360, 20), arc(0.63, 0.38, 0.14, 0.1, 0, 360, 20)],
    complexity: 3, angularStrokes: [1, 2], strokeColors: [PICTURE_INK.yellow, PICTURE_INK.charcoal, PICTURE_INK.charcoal, PICTURE_INK.blue, PICTURE_INK.blue],
  }),
];

// These centre lines are traced from Kiwi School Handwriting v3.0.  The
// companion "with Guides" font supplies the start dots, route and pen lifts;
// that order is what Fino demonstrates.  Keeping the guides as centre lines
// gives children a forgiving path to follow instead of asking them to colour
// in a typeface outline.
const digitStrokes = {
  '0': [join(
    bezier(p(0.52, 0.13), p(0.29, 0.19), p(0.23, 0.62), p(0.4, 0.84), 22),
    bezier(p(0.4, 0.84), p(0.62, 0.97), p(0.77, 0.54), p(0.63, 0.21), 22),
    bezier(p(0.63, 0.21), p(0.59, 0.14), p(0.55, 0.13), p(0.52, 0.13), 10),
  )],
  // Kiwi's 1 is one deliberate, slightly left-leaning downstroke — no hook
  // and no extra upright that could turn it into an L or an I.
  '1': [poly([0.59, 0.16], [0.43, 0.84])],
  '2': [join(
    bezier(p(0.29, 0.23), p(0.45, 0.09), p(0.74, 0.12), p(0.73, 0.3), 20),
    bezier(p(0.73, 0.3), p(0.71, 0.48), p(0.42, 0.63), p(0.26, 0.82), 22),
    poly([0.26, 0.82], [0.76, 0.82]),
  )],
  '3': [join(
    bezier(p(0.3, 0.22), p(0.46, 0.1), p(0.73, 0.13), p(0.71, 0.34), 20),
    bezier(p(0.71, 0.34), p(0.69, 0.46), p(0.55, 0.5), p(0.45, 0.5), 12),
    bezier(p(0.45, 0.5), p(0.68, 0.49), p(0.76, 0.6), p(0.71, 0.75), 18),
    bezier(p(0.71, 0.75), p(0.64, 0.9), p(0.39, 0.9), p(0.27, 0.78), 20),
  )],
  '4': [
    poly([0.6, 0.16], [0.27, 0.66], [0.78, 0.66]),
    poly([0.61, 0.16], [0.52, 0.84]),
  ],
  '5': [join(
    poly([0.75, 0.17], [0.35, 0.17], [0.29, 0.5]),
    bezier(p(0.29, 0.5), p(0.48, 0.42), p(0.72, 0.47), p(0.72, 0.66), 20),
    bezier(p(0.72, 0.66), p(0.74, 0.88), p(0.4, 0.92), p(0.25, 0.77), 20),
  )],
  '6': [join(
    bezier(p(0.68, 0.2), p(0.55, 0.12), p(0.32, 0.2), p(0.28, 0.52), 22),
    bezier(p(0.28, 0.52), p(0.23, 0.84), p(0.64, 0.92), p(0.72, 0.7), 22),
    bezier(p(0.72, 0.7), p(0.79, 0.43), p(0.43, 0.39), p(0.28, 0.58), 22),
  )],
  // The reference 7 has only a top stroke and a descending diagonal; the
  // former middle crossbar made it look like an unrelated character.
  '7': [poly([0.26, 0.17], [0.78, 0.17], [0.38, 0.84])],
  '8': [join(
    bezier(p(0.6, 0.15), p(0.3, 0.12), p(0.23, 0.34), p(0.5, 0.5), 20),
    bezier(p(0.5, 0.5), p(0.2, 0.67), p(0.29, 0.89), p(0.5, 0.88), 20),
    bezier(p(0.5, 0.88), p(0.76, 0.87), p(0.8, 0.64), p(0.5, 0.5), 20),
    bezier(p(0.5, 0.5), p(0.78, 0.36), p(0.75, 0.16), p(0.6, 0.15), 20),
  )],
  // Start at the upper-right loop, then let the tail fall cleanly below it.
  // This makes a 9, not a mirrored g.
  '9': [join(
    bezier(p(0.68, 0.16), p(0.42, 0.06), p(0.22, 0.18), p(0.22, 0.38), 22),
    bezier(p(0.22, 0.38), p(0.22, 0.62), p(0.6, 0.64), p(0.69, 0.45), 22),
    bezier(p(0.69, 0.45), p(0.72, 0.64), p(0.63, 0.83), p(0.48, 0.92), 20),
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
  A: [poly([0.2, 0.84], [0.54, 0.16]), poly([0.54, 0.16], [0.62, 0.84]), poly([0.34, 0.56], [0.6, 0.56])],
  B: [poly([0.36, 0.16], [0.25, 0.84]), join(bezier(p(0.36, 0.16), p(0.76, 0.14), p(0.77, 0.42), p(0.3, 0.49), 24), bezier(p(0.3, 0.49), p(0.82, 0.48), p(0.76, 0.85), p(0.25, 0.84), 26))],
  C: [arc(0.55, 0.5, 0.28, 0.36, -48, -312, 42)],
  D: [poly([0.36, 0.16], [0.25, 0.84]), bezier(p(0.36, 0.16), p(0.82, 0.18), p(0.77, 0.78), p(0.25, 0.84), 38)],
  E: [poly([0.36, 0.16], [0.25, 0.84], [0.74, 0.84]), poly([0.36, 0.16], [0.78, 0.16]), poly([0.31, 0.5], [0.67, 0.5])],
  F: [poly([0.36, 0.16], [0.25, 0.84]), poly([0.36, 0.16], [0.77, 0.16]), poly([0.31, 0.5], [0.68, 0.5])],
  G: [arc(0.55, 0.5, 0.28, 0.36, -48, -312, 42), poly([0.52, 0.55], [0.77, 0.55], [0.71, 0.75])],
  H: [poly([0.35, 0.16], [0.25, 0.84]), poly([0.76, 0.16], [0.66, 0.84]), poly([0.3, 0.52], [0.71, 0.52])],
  I: [poly([0.56, 0.16], [0.45, 0.84]), poly([0.4, 0.16], [0.7, 0.16]), poly([0.37, 0.84], [0.64, 0.84])],
  J: [join(poly([0.62, 0.16], [0.5, 0.68]), bezier(p(0.5, 0.68), p(0.45, 0.91), p(0.17, 0.89), p(0.2, 0.76), 24))],
  K: [poly([0.35, 0.16], [0.24, 0.84]), poly([0.76, 0.16], [0.3, 0.52]), poly([0.3, 0.52], [0.69, 0.84])],
  L: [poly([0.36, 0.16], [0.25, 0.84], [0.75, 0.84])],
  M: [poly([0.19, 0.84], [0.37, 0.16]), poly([0.37, 0.16], [0.52, 0.64], [0.68, 0.16], [0.79, 0.84])],
  // An N has a diagonal that travels from top-left to bottom-right. Keep its
  // three marks separate so the helper can show the natural pen lifts too.
  N: [poly([0.37, 0.16], [0.25, 0.84]), poly([0.37, 0.16], [0.66, 0.84]), poly([0.66, 0.84], [0.77, 0.16])],
  O: [arc(0.5, 0.5, 0.25, 0.36, -64, 296, 44)],
  P: [poly([0.36, 0.16], [0.25, 0.84]), bezier(p(0.36, 0.16), p(0.78, 0.16), p(0.77, 0.5), p(0.3, 0.5), 32)],
  Q: [arc(0.5, 0.48, 0.25, 0.34, -64, 296, 44), poly([0.55, 0.64], [0.78, 0.85])],
  R: [poly([0.36, 0.16], [0.25, 0.84]), bezier(p(0.36, 0.16), p(0.78, 0.16), p(0.77, 0.5), p(0.3, 0.5), 32), poly([0.31, 0.5], [0.74, 0.84])],
  S: [join(bezier(p(0.74, 0.23), p(0.58, 0.09), p(0.3, 0.15), p(0.29, 0.35), 22), bezier(p(0.29, 0.35), p(0.29, 0.52), p(0.7, 0.49), p(0.72, 0.68), 22), bezier(p(0.72, 0.68), p(0.75, 0.89), p(0.4, 0.91), p(0.23, 0.77), 22))],
  T: [poly([0.22, 0.16], [0.78, 0.16]), poly([0.56, 0.16], [0.45, 0.84])],
  U: [join(poly([0.35, 0.16], [0.26, 0.63]), bezier(p(0.26, 0.63), p(0.22, 0.91), p(0.66, 0.93), p(0.71, 0.65), 28), poly([0.71, 0.65], [0.78, 0.16]))],
  V: [poly([0.23, 0.16], [0.5, 0.84], [0.77, 0.16])],
  W: [poly([0.13, 0.16], [0.31, 0.84], [0.5, 0.4], [0.68, 0.84], [0.86, 0.16])],
  X: [poly([0.24, 0.16], [0.75, 0.84]), poly([0.77, 0.16], [0.23, 0.84])],
  Y: [poly([0.23, 0.16], [0.5, 0.52], [0.75, 0.16]), poly([0.5, 0.52], [0.29, 0.84])],
  Z: [poly([0.24, 0.16], [0.79, 0.16], [0.25, 0.84], [0.78, 0.84])],
};
letterStrokes['Ä'] = [...letterStrokes.A, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];
letterStrokes['Ö'] = [...letterStrokes.O, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];
letterStrokes['Ü'] = [...letterStrokes.U, poly([0.36, 0.07], [0.4, 0.07]), poly([0.6, 0.07], [0.64, 0.07])];

// Lowercase letters use the approved upright print model. Dots and crossbars
// stay separate strokes so Fino can jump between the natural pen lifts.
const lowerLetterStrokes = {
  a: [join(arc(0.48, 0.56, 0.18, 0.18, -55, 305, 28), poly([0.58, 0.41], [0.64, 0.73]))],
  b: [join(
    poly([0.48, 0.16], [0.34, 0.72]),
    bezier(p(0.34, 0.72), p(0.72, 0.8), p(0.76, 0.4), p(0.48, 0.4), 20),
    bezier(p(0.48, 0.4), p(0.31, 0.42), p(0.3, 0.64), p(0.34, 0.72), 16),
  )],
  c: [arc(0.53, 0.56, 0.2, 0.18, -48, -312, 28)],
  d: [arc(0.46, 0.56, 0.18, 0.18, -55, 305, 28), poly([0.69, 0.16], [0.58, 0.73])],
  e: [join(bezier(p(0.3, 0.56), p(0.38, 0.35), p(0.69, 0.35), p(0.68, 0.53), 18), bezier(p(0.68, 0.53), p(0.55, 0.57), p(0.4, 0.58), p(0.3, 0.56), 12), bezier(p(0.3, 0.56), p(0.34, 0.8), p(0.67, 0.78), p(0.72, 0.64), 18))],
  f: [join(bezier(p(0.61, 0.16), p(0.46, 0.15), p(0.43, 0.31), p(0.39, 0.8), 16)), poly([0.26, 0.45], [0.62, 0.45])],
  g: [join(arc(0.48, 0.55, 0.18, 0.18, -55, 305, 28), bezier(p(0.58, 0.4), p(0.74, 0.78), p(0.58, 0.98), p(0.35, 0.92), 22))],
  h: [poly([0.48, 0.16], [0.34, 0.73]), bezier(p(0.4, 0.49), p(0.51, 0.31), p(0.7, 0.38), p(0.63, 0.73), 28)],
  i: [poly([0.54, 0.4], [0.47, 0.73]), poly([0.53, 0.25], [0.55, 0.25])],
  j: [join(poly([0.56, 0.4], [0.48, 0.84]), bezier(p(0.48, 0.84), p(0.45, 0.98), p(0.24, 0.97), p(0.28, 0.84), 16)), poly([0.62, 0.25], [0.64, 0.25])],
  k: [poly([0.48, 0.16], [0.34, 0.73]), poly([0.41, 0.51], [0.68, 0.35]), poly([0.41, 0.51], [0.66, 0.73])],
  // A print l has one upright stroke and a small, friendly rightward exit at
  // the baseline. It is not a loop and does not connect to another letter.
  l: [join(
    poly([0.5, 0.16], [0.5, 0.68]),
    bezier(p(0.5, 0.68), p(0.5, 0.73), p(0.52, 0.74), p(0.55, 0.73), 10),
  )],
  m: [join(poly([0.3, 0.73], [0.36, 0.4]), bezier(p(0.36, 0.4), p(0.5, 0.34), p(0.57, 0.49), p(0.53, 0.73), 18), bezier(p(0.53, 0.49), p(0.69, 0.35), p(0.79, 0.49), p(0.75, 0.73), 18))],
  n: [join(poly([0.32, 0.73], [0.37, 0.4]), bezier(p(0.37, 0.4), p(0.55, 0.34), p(0.72, 0.43), p(0.66, 0.73), 24))],
  o: [arc(0.5, 0.56, 0.19, 0.18, -55, 305, 30)],
  p: [poly([0.44, 0.4], [0.31, 0.94]), arc(0.5, 0.56, 0.18, 0.18, -90, 270, 28)],
  // q keeps a plain vertical descender; the little exit curve belongs to l.
  q: [arc(0.48, 0.56, 0.18, 0.18, -55, 305, 28), poly([0.67, 0.4], [0.67, 0.94])],
  r: [join(poly([0.31, 0.73], [0.36, 0.43]), bezier(p(0.36, 0.43), p(0.48, 0.35), p(0.59, 0.37), p(0.66, 0.48), 16))],
  s: [join(bezier(p(0.69, 0.43), p(0.57, 0.31), p(0.33, 0.37), p(0.34, 0.53), 18), bezier(p(0.34, 0.53), p(0.39, 0.65), p(0.7, 0.56), p(0.68, 0.69), 18), bezier(p(0.68, 0.69), p(0.64, 0.81), p(0.39, 0.8), p(0.31, 0.71), 16))],
  t: [join(bezier(p(0.58, 0.18), p(0.48, 0.2), p(0.46, 0.3), p(0.4, 0.66), 12), bezier(p(0.4, 0.66), p(0.39, 0.77), p(0.55, 0.79), p(0.68, 0.69), 12)), poly([0.3, 0.42], [0.63, 0.42])],
  u: [join(poly([0.36, 0.4], [0.31, 0.65]), bezier(p(0.31, 0.65), p(0.3, 0.82), p(0.63, 0.84), p(0.66, 0.65), 18), poly([0.66, 0.65], [0.71, 0.4]))],
  v: [poly([0.31, 0.4], [0.49, 0.73], [0.7, 0.4])],
  w: [poly([0.23, 0.4], [0.37, 0.73], [0.51, 0.51], [0.63, 0.73], [0.78, 0.4])],
  x: [poly([0.32, 0.4], [0.67, 0.73]), poly([0.7, 0.4], [0.31, 0.73])],
  y: [poly([0.31, 0.4], [0.5, 0.73], [0.7, 0.4]), join(poly([0.5, 0.73], [0.4, 0.94]), bezier(p(0.4, 0.94), p(0.34, 1), p(0.25, 0.98), p(0.23, 0.94), 10))],
  z: [poly([0.3, 0.4], [0.7, 0.4], [0.31, 0.73], [0.7, 0.73])],
};
lowerLetterStrokes.ä = [...lowerLetterStrokes.a, poly([0.4, 0.23], [0.44, 0.23]), poly([0.58, 0.23], [0.62, 0.23])];
lowerLetterStrokes.ö = [...lowerLetterStrokes.o, poly([0.4, 0.23], [0.44, 0.23]), poly([0.58, 0.23], [0.62, 0.23])];
lowerLetterStrokes.ü = [...lowerLetterStrokes.u, poly([0.4, 0.23], [0.44, 0.23]), poly([0.58, 0.23], [0.62, 0.23])];
Object.assign(letterStrokes, lowerLetterStrokes);

const letterMeta = {
  A: ['Affe', 'diagonal', 2], B: ['Ball', 'mixed', 3], C: ['Clown', 'round', 2], D: ['Dino', 'mixed', 2],
  E: ['Ente', 'straight', 1], F: ['Fisch', 'straight', 1], G: ['Gans', 'round', 3], H: ['Haus', 'straight', 1],
  I: ['Igel', 'straight', 1], J: ['Jacke', 'round', 2], K: ['Katze', 'diagonal', 2], L: ['Löwe', 'straight', 1],
  M: ['Maus', 'diagonal', 3], N: ['Nase', 'diagonal', 2], O: ['Oma', 'round', 1], P: ['Panda', 'mixed', 2],
  Q: ['Qualle', 'round', 3], R: ['Regen', 'mixed', 3], S: ['Sonne', 'round', 3], T: ['Tiger', 'straight', 1],
  U: ['Uhu', 'round', 2], V: ['Vogel', 'diagonal', 1], W: ['Wolke', 'diagonal', 3], X: ['Xylofon', 'diagonal', 2],
  Y: ['Yak', 'diagonal', 2], Z: ['Zebra', 'diagonal', 2], Ä: ['Äpfel', 'diagonal', 3], Ö: ['Öl', 'round', 3], Ü: ['Überraschung', 'round', 3],
  ...Object.fromEntries(Object.keys(lowerLetterStrokes).map((letter) => [letter, [`kleines ${letter}`, 'lowercase', 2]])),
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
  mixed: { label: 'Bunte Mischung', speech: 'Alles gemischt', icon: 'mixed' },
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

function fitStrokesToBounds(strokes, rect, bounds) {
  const spanX = Math.max(0.001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.001, bounds.maxY - bounds.minY);
  return strokes.map((stroke) => stroke.map((point) => p(
    rect.x + ((point.x - bounds.minX) / spanX) * rect.width,
    rect.y + ((point.y - bounds.minY) / spanY) * rect.height,
  )));
}

function fitStrokes(strokes, rect) {
  return fitStrokesToBounds(strokes, rect, boundsOf(strokes));
}

const LOWERCASE_EM_BOX = Object.freeze({ minX: 0.18, maxX: 0.82, minY: 0.12, maxY: 0.96 });
const NARROW_CAPITAL_EM_BOX = Object.freeze({ minX: 0.2, maxX: 0.8, minY: 0.12, maxY: 0.9 });
const NARROW_LETTERS = new Set(['I', 'i', 'j', 'l']);
const WIDE_LETTERS = new Set(['M', 'W', 'm', 'w']);

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

function fitLetterStrokes(letter, rect) {
  const lowerCase = letter === letter.toLocaleLowerCase('de-DE');
  const bounds = lowerCase
    ? LOWERCASE_EM_BOX
    : NARROW_LETTERS.has(letter)
      ? NARROW_CAPITAL_EM_BOX
      : boundsOf(letterStrokes[letter]);
  return fitStrokesToBounds(letterStrokes[letter], rect, bounds);
}

function letterAdvance(letter) {
  if (NARROW_LETTERS.has(letter)) return 0.58;
  if (WIDE_LETTERS.has(letter)) return 1.18;
  if ('JFT'.includes(letter)) return 0.78;
  if ('ftr'.includes(letter)) return 0.7;
  return 0.96;
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

function textTaskData(rawText, rect = { x: 0.06, y: 0.2, width: 0.88, height: 0.62 }) {
  const characters = textCharacters(rawText);
  if (!characters.length) return { strokes: [], completionGroups: [] };
  // Equal-width cells leave a conspicuous hole after narrow letters such as
  // I/i. Give every glyph a modest, handwriting-like advance instead.
  // Give neighbouring characters enough physical breathing room for the
  // generous tracing corridor. This is especially important beside i/l,
  // whose narrow bodies otherwise make the next letter feel glued on.
  const preferredGap = Math.min(0.05, rect.width * 0.07);
  // Keep breathing room around short names, then share at most 28% of the
  // word's width between gaps. Otherwise an 11- or 12-letter name would use
  // more of the board for empty gaps than for the letters themselves.
  const gap = Math.min(
    preferredGap,
    (rect.width * 0.28) / Math.max(1, characters.length - 1),
  );
  const advances = characters.map(letterAdvance);
  const totalAdvance = advances.reduce((sum, advance) => sum + advance, 0);
  const usable = Math.max(0.02, rect.width - gap * (characters.length - 1));
  const averageCharacterWidth = usable / totalAdvance;
  // A long name must become smaller as a whole. Keeping the old full height
  // while narrowing each slot made the letters look squeezed and unnaturally
  // tall. Four letters still use the generous writing height; longer names
  // gently reduce their height and stay centred in the same writing area.
  const textHeight = characters.length <= 4
    ? rect.height
    : Math.max(
      rect.height * (characters.length > 8 ? 0.27 : 0.35),
      Math.min(rect.height * (4 / characters.length), averageCharacterWidth * 3.1),
    );
  const textY = rect.y + (rect.height - textHeight) / 2;
  const strokes = [];
  const completionGroups = [];
  let cursor = rect.x;
  characters.forEach((character, index) => {
    const slotWidth = usable * (advances[index] / totalAdvance);
    const fitted = fitLetterStrokes(character, {
      x: cursor, y: textY, width: slotWidth, height: textHeight,
    });
    const firstStroke = strokes.length;
    strokes.push(...fitted);
    completionGroups.push(fitted.map((_, strokeIndex) => firstStroke + strokeIndex));
    cursor += slotWidth + gap;
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
      : fitStrokes(source[symbol], cell);
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
      : fitStrokes(source[symbol], easySymbolCell(index));
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
    });
  }));
}

const lineBank = variantBank('lines', lineTemplates, ROUTE_LAYOUTS);
// Position, scale and a mirrored stroke order do not make a new shape. Keep
// one genuinely distinct drawing for each family until we have a larger bank
// of truly different pictures to add.
const shapeBank = Object.freeze([...shapeTemplates]);
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
  ...lineBank.slice(0, 22),
  ...shapeBank,
  ...numberBank.slice(0, 21),
  ...letterBank.slice(0, 21),
].map((task) => makeTask({ ...task, id: `mixed-${task.id}`, family: task.family })));

export const EXERCISE_BANKS = Object.freeze({ lines: lineBank, shapes: shapeBank, numbers: numberBank, letters: letterBank, mixed: mixedBank });
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

function fitGroupToBox(strokes, box, profile) {
  const source = physicalBounds(strokes);
  const sourceWidth = Math.max(26, source.maxX - source.minX);
  const sourceHeight = Math.max(26, source.maxY - source.minY);
  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
  const sourceCenterX = (source.minX + source.maxX) / 2;
  const sourceCenterY = (source.minY + source.maxY) / 2;
  return strokes.map((stroke) => stroke.map((point) => p(
    (box.centerX + ((point.x * CANONICAL_DRAWING_WIDTH) - sourceCenterX) * scale) / profile.width,
    (box.centerY + ((point.y * CANONICAL_DRAWING_HEIGHT) - sourceCenterY) * scale) / profile.height,
  )));
}

/**
 * Reflow an already-authored task into the measured drawing board. Each
 * component is scaled uniformly from the 900×620 source drawing, so a circle,
 * letter or hard-cornered polygon keeps its intended proportions. Portrait
 * boards use a calm diagonal; landscape boards use a row.
 */
export function adaptTaskToViewport(task, viewport) {
  const profile = layoutProfileForViewport(viewport);
  const groups = task.completionGroups?.length
    ? task.completionGroups
    : [task.strokes.map((_, index) => index)];
  const groupIndexes = selectedGroupIndexes(task, profile);
  const boxes = targetBoxes(groupIndexes.length, profile);
  if (groupIndexes.length === 1) {
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
    const fitted = fitGroupToBox(sourceStrokes, boxes[visibleIndex], profile);
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

  const primary = ['numbers', 'letters'].includes(category) && difficulty === 'easy'
    ? createEasySymbolBank(category, option)
    : taskPool(category, option, name);
  const sampled = category === 'mixed'
    ? shuffle(['lines', 'shapes', 'numbers', 'letters'].flatMap((family, index) => (
      sampleVariedTasks(primary.filter((task) => task.family === family), index < 2 ? 3 : 2, rng)
    )), rng)
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
