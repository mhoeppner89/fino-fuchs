/**
 * Fuchsschrift curriculum and deterministic session generation.
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
  decorations = [],
  example = '',
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
    decorations: Object.freeze(decorations),
    example,
  });
}

const lineTasks = [
  makeTask({
    id: 'line-vertical', category: 'lines', title: 'Von oben nach unten',
    speech: 'Hilf der Biene zur Blume. Zieh die Linie von oben nach unten.', label: '│',
    strokes: [poly([0.5, 0.18], [0.5, 0.82])], complexity: 1,
    decorations: [{ x: 0.5, y: 0.1, symbol: '🐝' }, { x: 0.5, y: 0.9, symbol: '🌼' }],
  }),
  makeTask({
    id: 'line-horizontal', category: 'lines', title: 'Von links nach rechts',
    speech: 'Fahr mit dem Auto zur Garage. Von links nach rechts.', label: '—',
    strokes: [poly([0.18, 0.5], [0.82, 0.5])], complexity: 1,
    decorations: [{ x: 0.1, y: 0.5, symbol: '🚗' }, { x: 0.9, y: 0.5, symbol: '🏠' }],
  }),
  makeTask({
    id: 'line-diagonal-down', category: 'lines', title: 'Schräg nach unten',
    speech: 'Lass den Ball schräg nach unten rollen.', label: '╲',
    strokes: [poly([0.25, 0.2], [0.75, 0.8])], complexity: 1,
    decorations: [{ x: 0.2, y: 0.14, symbol: '⚽' }, { x: 0.82, y: 0.86, symbol: '🥅' }],
  }),
  makeTask({
    id: 'line-diagonal-up', category: 'lines', title: 'Schräg nach oben',
    speech: 'Flieg mit der Rakete schräg nach oben.', label: '╱',
    strokes: [poly([0.25, 0.8], [0.75, 0.2])], complexity: 1,
    decorations: [{ x: 0.2, y: 0.86, symbol: '🚀' }, { x: 0.82, y: 0.14, symbol: '⭐' }],
  }),
  makeTask({
    id: 'line-arch', category: 'lines', title: 'Ein großer Bogen',
    speech: 'Male einen großen Regenbogen.', label: '⌒',
    strokes: [arc(0.5, 0.64, 0.32, 0.42, 180, 360, 34)], complexity: 2,
    decorations: [{ x: 0.13, y: 0.66, symbol: '☁️' }, { x: 0.87, y: 0.66, symbol: '☁️' }],
  }),
  makeTask({
    id: 'line-wave', category: 'lines', title: 'Eine Wellenlinie',
    speech: 'Schwimm mit dem Fisch durch die Wellen.', label: '〰',
    strokes: [join(
      bezier(p(0.12, 0.52), p(0.22, 0.25), p(0.32, 0.25), p(0.42, 0.52), 18),
      bezier(p(0.42, 0.52), p(0.52, 0.79), p(0.62, 0.79), p(0.72, 0.52), 18),
      bezier(p(0.72, 0.52), p(0.8, 0.29), p(0.87, 0.29), p(0.92, 0.5), 14),
    )], complexity: 2,
    decorations: [{ x: 0.08, y: 0.52, symbol: '🐟' }, { x: 0.95, y: 0.5, symbol: '🐚' }],
  }),
  makeTask({
    id: 'line-zigzag', category: 'lines', title: 'Zickzack',
    speech: 'Klettere im Zickzack über die Berge.', label: '〽',
    strokes: [poly([0.12, 0.72], [0.28, 0.28], [0.44, 0.72], [0.6, 0.28], [0.76, 0.72], [0.9, 0.34])], complexity: 2,
    decorations: [{ x: 0.08, y: 0.78, symbol: '🦊' }, { x: 0.94, y: 0.28, symbol: '🚩' }],
  }),
  makeTask({
    id: 'line-loop', category: 'lines', title: 'Eine Schleife',
    speech: 'Flieg eine große Schleife.', label: '∞',
    strokes: [join(
      bezier(p(0.12, 0.5), p(0.27, 0.12), p(0.42, 0.12), p(0.5, 0.5), 24),
      bezier(p(0.5, 0.5), p(0.58, 0.88), p(0.75, 0.88), p(0.88, 0.5), 24),
      bezier(p(0.88, 0.5), p(0.75, 0.12), p(0.58, 0.12), p(0.5, 0.5), 24),
      bezier(p(0.5, 0.5), p(0.42, 0.88), p(0.27, 0.88), p(0.12, 0.5), 24),
    )], complexity: 3,
    decorations: [{ x: 0.08, y: 0.45, symbol: '🦋' }, { x: 0.92, y: 0.45, symbol: '🌻' }],
  }),
  makeTask({
    id: 'line-spiral', category: 'lines', title: 'Eine Schnecke',
    speech: 'Male das Schneckenhaus von außen nach innen.', label: '🌀',
    strokes: [[...Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const angle = t * Math.PI * 4.4;
      const r = 0.34 * (1 - t * 0.82);
      return p(0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r);
    })]], complexity: 3,
    decorations: [{ x: 0.14, y: 0.82, symbol: '🐌' }],
  }),
];

const shapeTasks = [
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
    id: 'shape-heart', category: 'shapes', title: 'Herz', speech: 'Male ein Herz.', label: '♡',
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
const numberTasks = Object.entries(digitStrokes).map(([digit, strokes]) => makeTask({
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

const letterTasks = Object.entries(letterStrokes).map(([letter, strokes]) => {
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

export const TASKS = Object.freeze([...lineTasks, ...shapeTasks, ...numberTasks, ...letterTasks]);

export const CATEGORY_CONFIG = Object.freeze({
  lines: { label: 'Linien', speech: 'Linien üben', icon: 'line' },
  shapes: { label: 'Formen', speech: 'Formen üben', icon: 'shapes' },
  numbers: { label: 'Zahlen', speech: 'Zahlen üben', icon: 'numbers' },
  letters: { label: 'Buchstaben', speech: 'Buchstaben üben', icon: 'letters' },
  name: { label: 'Mein Name', speech: 'Deinen Namen üben', icon: 'name' },
  mixed: { label: 'Bunte Mischung', speech: 'Alles gemischt', icon: 'mixed' },
});

export const DIFFICULTIES = Object.freeze({
  easy: { label: 'Leicht', speech: 'Leicht', description: 'Dicke Spur und Pfeile' },
  medium: { label: 'Mittel', speech: 'Mittel', description: 'Feine Spur und Startpunkte' },
  hard: { label: 'Knifflig', speech: 'Knifflig', description: 'Nur Startpunkte' },
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

export function createWordTask(rawName) {
  const name = normalizeName(rawName).replace(/[- ]/g, '').slice(0, 8);
  const characters = [...name].filter((character) => letterStrokes[character]);
  if (!characters.length) return null;

  const margin = 0.06;
  const gap = 0.015;
  const usable = 1 - margin * 2 - gap * (characters.length - 1);
  const slotWidth = usable / characters.length;
  const strokes = [];
  characters.forEach((character, index) => {
    const rect = {
      x: margin + index * (slotWidth + gap),
      y: 0.2,
      width: slotWidth,
      height: 0.62,
    };
    strokes.push(...fitStrokes(letterStrokes[character], rect));
  });

  return makeTask({
    id: `word-${characters.join('')}`,
    category: 'name',
    title: 'Dein Name',
    speech: `Schreib deinen Namen. ${characters.join('')}.`,
    label: characters.join(''),
    strokes,
    complexity: 3,
    group: 'name',
  });
}

function randomFrom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

function choose(pool, rng, counts, recent) {
  if (!pool.length) throw new Error('Cannot choose from an empty task pool.');
  const last = recent.at(-1);
  const tiers = [
    pool.filter((task) => (counts.get(task.id) ?? 0) < 2 && !recent.includes(task.id)),
    pool.filter((task) => (counts.get(task.id) ?? 0) < 2 && task.id !== last),
    pool.filter((task) => task.id !== last),
    pool.filter((task) => (counts.get(task.id) ?? 0) < 2),
    pool,
  ];
  const candidates = tiers.find((tier) => tier.length);
  const selected = randomFrom(candidates, rng);
  counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
  recent.push(selected.id);
  while (recent.length > 2) recent.shift();
  return selected;
}

function taskPool(category, difficulty, option, name) {
  const maxComplexity = difficulty === 'easy' ? 2 : 3;
  switch (category) {
    case 'lines': return lineTasks.filter((task) => task.complexity <= maxComplexity);
    case 'shapes': return shapeTasks.filter((task) => task.complexity <= maxComplexity);
    case 'numbers': {
      const max = option === '1-3' ? 3 : option === '1-6' ? 6 : 9;
      return numberTasks.filter((task) => Number(task.label) <= max && (task.label !== '0' || option === '0-9'));
    }
    case 'letters': {
      const group = option || 'all';
      return letterTasks.filter((task) => task.complexity <= maxComplexity && (group === 'all' || task.group === group));
    }
    case 'name': {
      const normalized = normalizeName(name).replace(/[- ]/g, '');
      const letters = [...new Set([...normalized])]
        .map((character) => letterTasks.find((task) => task.label === character))
        .filter(Boolean);
      return letters.length ? letters : letterTasks.filter((task) => ['M', 'A', 'X'].includes(task.label));
    }
    case 'mixed':
      return [
        ...lineTasks.filter((task) => task.complexity <= maxComplexity),
        ...shapeTasks.filter((task) => task.complexity <= maxComplexity),
        ...numberTasks.filter((task) => task.complexity <= maxComplexity),
        ...letterTasks.filter((task) => task.complexity <= maxComplexity),
      ];
    default: throw new Error(`Unknown category: ${category}`);
  }
}

const assistancePlans = {
  easy: ['easy', 'easy', 'easy', 'easy', 'medium', 'easy', 'easy'],
  medium: ['easy', 'medium', 'medium', 'medium', 'hard', 'medium', 'easy'],
  hard: ['medium', 'hard', 'hard', 'hard', 'hard', 'medium', 'easy'],
};

/**
 * Creates a seven-task session with controlled randomization.
 */
export function buildSession({ category, difficulty = 'easy', option = '', name = '', rng = Math.random }) {
  if (!CATEGORY_CONFIG[category]) throw new Error(`Unknown category: ${category}`);
  if (!DIFFICULTIES[difficulty]) throw new Error(`Unknown difficulty: ${difficulty}`);

  const primary = taskPool(category, difficulty, option, name);
  const simple = primary.filter((task) => task.complexity <= 1);
  const current = primary.filter((task) => task.complexity <= (difficulty === 'easy' ? 2 : 3));
  const challenge = primary.filter((task) => task.complexity >= (difficulty === 'hard' ? 2 : 2));
  const warmups = category === 'lines' ? lineTasks.filter((task) => task.complexity === 1) : lineTasks.slice(0, 4);
  // Very small selections (for example a one-letter name) are interleaved
  // with motor warm-ups so a child never sees the same task twice in a row.
  const variedCurrent = current.length >= 2 ? current : [...current, ...warmups];
  const easyPool = simple.length >= 2 ? simple : variedCurrent;
  const challengePool = challenge.length >= 2 ? challenge : variedCurrent;
  const counts = new Map();
  const recent = [];
  const roles = [
    warmups,
    easyPool,
    variedCurrent,
    variedCurrent,
    challengePool,
    variedCurrent,
    easyPool,
  ];

  const session = roles.map((pool, index) => ({
    ...choose(pool, rng, counts, recent),
    uid: `${Date.now()}-${index}-${Math.floor(rng() * 1e8)}`,
    assist: assistancePlans[difficulty][index],
    slot: index,
  }));

  if (category === 'name') {
    const wordTask = createWordTask(name);
    if (wordTask) {
      session[5] = { ...wordTask, uid: `${Date.now()}-word`, assist: difficulty === 'easy' ? 'medium' : difficulty, slot: 5 };
      const letterPool = taskPool('name', difficulty, option, name);
      const used = new Map();
      session.slice(0, 6).forEach((task) => used.set(task.id, (used.get(task.id) ?? 0) + 1));
      const preferred = letterPool.filter((task) => (used.get(task.id) ?? 0) < 2);
      const fallback = warmups.filter((task) => (used.get(task.id) ?? 0) < 2 && task.id !== session[5].id);
      const finisher = randomFrom(preferred.length ? preferred : fallback.length ? fallback : letterPool, rng);
      session[6] = { ...finisher, uid: `${Date.now()}-finish`, assist: 'easy', slot: 6 };
    }
  }

  return session;
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
