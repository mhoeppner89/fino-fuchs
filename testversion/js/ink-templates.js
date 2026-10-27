/** Recognise a child's complete answer independently of the Sudoku solution. */
import { EXERCISE_BANKS, adaptTaskToViewport } from './curriculum.js?v=1.3.56';
import { SUDOKU_SYMBOLS } from './sudoku.js?v=1.3.56';

export const SUDOKU_PAD = Object.freeze({ width: 300, height: 200 });
const VIEWPORT = { width: 900, height: 620 };
const referenceCache = new Map();
const profileCache = new Map();

function bounds(strokes, viewport) {
  const points = strokes.flat();
  if (!points.length) return null;
  const xs = points.map((point) => point.x * viewport.width);
  const ys = points.map((point) => point.y * viewport.height);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { width: maxX - minX, height: maxY - minY, x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function referenceTask(mode, value) {
  const key = `${mode}-${value}`;
  if (referenceCache.has(key)) return referenceCache.get(key);
  const symbol = SUDOKU_SYMBOLS[mode]?.[value - 1];
  if (!symbol) return null;
  const task = adaptTaskToViewport(EXERCISE_BANKS[symbol.category].find((task) => task.id === symbol.taskId), VIEWPORT);
  referenceCache.set(key, task);
  return task;
}

function segmentDistanceSquared(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
}

function inkDistanceSquared(point, strokes) {
  let nearest = Infinity;
  for (const stroke of strokes) {
    if (stroke.length === 1) nearest = Math.min(nearest, (point.x - stroke[0].x) ** 2 + (point.y - stroke[0].y) ** 2);
    for (let index = 1; index < stroke.length; index += 1) nearest = Math.min(nearest, segmentDistanceSquared(point, stroke[index - 1], stroke[index]));
  }
  return nearest;
}

function simplify(points) {
  if (points.length <= 2) return points;
  let farthest = 0, error = 0.006 ** 2;
  for (let index = 1; index < points.length - 1; index += 1) {
    const candidate = segmentDistanceSquared(points[index], points[0], points.at(-1));
    if (candidate > error) { farthest = index; error = candidate; }
  }
  return farthest
    ? [...simplify(points.slice(0, farthest + 1)).slice(0, -1), ...simplify(points.slice(farthest))]
    : [points[0], points.at(-1)];
}

function normalizeInk(strokes, viewport, degrees = 0, shear = 0) {
  const source = bounds(strokes, viewport);
  const angle = degrees * Math.PI / 180;
  const rotated = strokes.filter((stroke) => stroke.length).map((stroke) => stroke.map((point) => {
    const x = point.x * viewport.width - source.x, y = point.y * viewport.height - source.y;
    const yy = x * Math.sin(angle) + y * Math.cos(angle);
    return { x: x * Math.cos(angle) - y * Math.sin(angle) + shear * yy, y: yy };
  }));
  const box = bounds(rotated, { width: 1, height: 1 });
  const height = Math.max(0.001, box.height);
  return rotated.map((stroke) => simplify(stroke.map((point) => ({ x: (point.x - box.x) / height, y: (point.y - box.y) / height }))));
}

function prepareInk(strokes) {
  const samples = [];
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const a = stroke[index - 1], b = stroke[index];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.max(1, Math.ceil(length / 0.055));
      for (let sample = 0; sample < count; sample += 1) {
        const t = (sample + 0.5) / count;
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, weight: length / count });
      }
    }
  }
  return { strokes, samples, box: bounds(strokes, { width: 1, height: 1 }), length: samples.reduce((sum, point) => sum + point.weight, 0) };
}

function normalizeShape(strokes, viewport) {
  const ink = prepareInk(normalizeInk(strokes, viewport));
  const average = (fn) => ink.samples.reduce((sum, point) => sum + point.weight * fn(point), 0) / Math.max(0.001, ink.length);
  const cx = average((p) => p.x), cy = average((p) => p.y);
  const xx = average((p) => (p.x - cx) ** 2), yy = average((p) => (p.y - cy) ** 2);
  const xy = average((p) => (p.x - cx) * (p.y - cy));
  const shear = xy / Math.max(0.001, yy);
  const sx = Math.sqrt(Math.max(0.001, xx - xy * shear)), sy = Math.sqrt(Math.max(0.001, yy));
  // Symbols name a shape rather than a prescribed orientation/proportion.
  // Remove ordinary oval/skew distortions before comparing their contours.
  const corrected = ink.strokes.map((stroke) => stroke.map((p) => ({ x: (p.x - cx - shear * (p.y - cy)) / sx, y: (p.y - cy) / sy })));
  return normalizeInk(corrected, { width: 1, height: 1 });
}

function fitWidth(ink, profile) {
  const ratio = profile.ink.box.width / Math.max(0.001, ink.box.width);
  // A narrow 1 must not swallow the crossbar of a 4 or the long top of a 7.
  const one = profile.value === 1 && profile.task.category === 'numbers';
  const scale = Math.max(one ? 0.85 : 0.4, Math.min(one ? 1.25 : 2.5, ratio));
  return prepareInk(ink.strokes.map((stroke) => stroke.map((p) => ({ x: p.x * scale, y: p.y }))));
}

function coveredInk(source, target) {
  return source.samples.reduce((sum, point) => sum + (inkDistanceSquared(point, target.strokes) <= 0.15 ** 2 ? point.weight : 0), 0) / Math.max(0.001, source.length);
}

function distanceCost(a, b) {
  const mean = (source, target) => source.samples.reduce((sum, point) => sum + point.weight * inkDistanceSquared(point, target.strokes), 0) / Math.max(0.001, source.length);
  return (mean(a, b) + mean(b, a)) / 2;
}

function makeProfile(task, value, coordinates = null) {
  if (coordinates) {
    const strokes = coordinates.map((stroke) => stroke.map(([x, y]) => ({ x, y })));
    const box = bounds(strokes, { width: 1, height: 1 });
    const target = bounds(task.strokes, VIEWPORT);
    const scale = target.height / box.height;
    task = { ...task, strokes: strokes.map((stroke) => stroke.map((p) => ({
      x: (target.x + (p.x - box.x) * scale) / VIEWPORT.width,
      y: (target.y + (p.y - box.y) * scale) / VIEWPORT.height,
    }))), completionGroups: [strokes.map((_, index) => index)] };
  }
  return { task, value, ink: prepareInk(task.category === 'shapes' ? normalizeShape(task.strokes, VIEWPORT) : normalizeInk(task.strokes, VIEWPORT)) };
}

function roundedSquare() {
  const points = [];
  for (const [cx, cy, start] of [[82, 18, -90], [82, 82, 0], [18, 82, 90], [18, 18, 180]]) {
    for (let index = 0; index <= 6; index += 1) {
      const angle = (start + index * 15) * Math.PI / 180;
      points.push([cx + 18 * Math.cos(angle), cy + 18 * Math.sin(angle)]);
    }
  }
  return [[...points, points[0]]];
}

function arcPoints(cx, cy, rx, ry, start, end) {
  return Array.from({ length: 33 }, (_, index) => {
    const angle = (start + (end - start) * index / 32) * Math.PI / 180;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function curve(a, b, c, d) {
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24, u = 1 - t;
    return [0, 1].map((axis) => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]);
  });
}

function joinPenLifts(strokes) {
  const paths = strokes.map((stroke) => [...stroke]);
  while (paths.length > 1) {
    let best = null;
    for (let a = 0; a < paths.length; a += 1) for (let b = a + 1; b < paths.length; b += 1) {
      for (const reverseA of [false, true]) for (const reverseB of [false, true]) {
        const end = reverseA ? paths[a][0] : paths[a].at(-1);
        const start = reverseB ? paths[b].at(-1) : paths[b][0];
        const gap = Math.hypot(end.x - start.x, end.y - start.y);
        if (gap <= 0.12 && (!best || gap < best.gap)) best = { a, b, reverseA, reverseB, gap };
      }
    }
    if (!best) break;
    const { a, b, reverseA, reverseB } = best;
    const first = reverseA ? [...paths[a]].reverse() : paths[a];
    const second = reverseB ? [...paths[b]].reverse() : paths[b];
    paths[a] = simplify([...first, ...second]);
    paths.splice(b, 1);
  }
  return paths;
}

function profiles(mode) {
  if (profileCache.has(mode)) return profileCache.get(mode);
  const positive = [1, 2, 3, 4].map((value) => makeProfile(referenceTask(mode, value), value));
  if (mode === 'numbers') {
    const one = referenceTask(mode, 1);
    positive.push(
      makeProfile(one, 1, [[[50, 0], [50, 100]]]),
      // Flagged 1 is also valid without a foot. Keep both ordinary flag sizes.
      makeProfile(one, 1, [[[20, 25], [55, 0], [55, 100]]]),
      makeProfile(one, 1, [[[0, 40], [50, 0], [50, 100]]]),
      makeProfile(one, 1, [[[25, 20], [55, 0], [55, 100]], [[20, 100], [85, 100]]]),
      makeProfile(one, 1, [[[50, 0], [50, 100]], [[20, 100], [80, 100]]]),
      makeProfile(referenceTask(mode, 2), 2, [[[0, 20], [15, 0], [80, 0], [100, 20], [90, 40], [0, 100], [100, 100]]]),
      makeProfile(referenceTask(mode, 3), 3, [[
        ...curve([10, 8], [100, -23], [110, 48], [38, 48]),
        ...curve([38, 48], [115, 45], [115, 125], [8, 91]).slice(1),
      ]]),
    );
  }
  if (mode === 'letters') positive.push(makeProfile(referenceTask(mode, 4), 4, [[[0, 0], [0, 100]], arcPoints(0, 50, 80, 50, -90, 90)]));
  if (mode === 'symbols') {
    positive.push(makeProfile(referenceTask(mode, 3), 3, roundedSquare()));
    positive.push(makeProfile(referenceTask(mode, 4), 4, [[[50, 0], [80, 95], [2, 36], [98, 36], [20, 95], [50, 0]]]));
  }
  // "None of these four" is a real outcome: a 5 must not become the nearest
  // available 3, and an O or unfinished P must not be forced into A–D.
  const distractors = mode === 'numbers' ? ['0', '5', '6', '7', '8', '9']
    : mode === 'letters' ? ['E', 'F', 'H', 'I', 'L', 'O', 'P', 'R', 'U', 'V', 'X', 'Y', 'Z']
      : ['heart', 'pentagon', 'hexagon'];
  const bank = mode === 'numbers' ? 'numbers' : mode === 'letters' ? 'letters' : 'shapes';
  const negative = distractors.map((symbol) => {
    const id = mode === 'numbers' ? `number-${symbol}-gross` : mode === 'letters' ? `letter-${symbol}-gross` : `shape-${symbol}`;
    return makeProfile(adaptTaskToViewport(EXERCISE_BANKS[bank].find((task) => task.id === id), VIEWPORT), null);
  });
  if (mode === 'numbers') {
    const seven = adaptTaskToViewport(EXERCISE_BANKS.numbers.find((task) => task.id === 'number-7-gross'), VIEWPORT);
    negative.push(makeProfile(seven, null, [[[0, 0], [100, 0], [30, 100]]]));
  }
  if (mode === 'letters') negative.push(makeProfile(referenceTask(mode, 1), null, [[[0, 100], [50, 0], [100, 100]]]));
  if (mode !== 'symbols') {
    for (const value of mode === 'numbers' ? [2, 3] : [2, 3, 4]) {
      const task = referenceTask(mode, value), center = bounds(task.strokes, VIEWPORT).x / VIEWPORT.width;
      negative.push(makeProfile({ ...task, strokes: task.strokes.map((stroke) => stroke.map((p) => ({ x: 2 * center - p.x, y: p.y }))) }, null));
    }
  }
  const result = { positive, negative };
  profileCache.set(mode, result);
  return result;
}

function isClosedInk(strokes) {
  // Allow ordinary pen lifts and small joining gaps, but not three sides of
  // a square or an open C standing in for a closed symbol.
  const ink = prepareInk(normalizeInk(strokes, SUDOKU_PAD));
  const paths = ink.strokes.filter((stroke) => prepareInk([stroke]).length >= 0.1);
  return paths.length > 0 && paths.every((stroke, index) => {
    if (Math.hypot(stroke[0].x - stroke.at(-1).x, stroke[0].y - stroke.at(-1).y) <= 0.18) return true;
    const other = paths.filter((_, candidate) => candidate !== index);
    return inkDistanceSquared(stroke[0], other) <= 0.12 ** 2 && inkDistanceSquared(stroke.at(-1), other) <= 0.12 ** 2;
  });
}

export function sudokuReferenceInk(mode, value) {
  const task = referenceTask(mode, value);
  if (!task) return [];
  const box = bounds(task.strokes, VIEWPORT);
  const scale = Math.min(SUDOKU_PAD.width * 0.7 / Math.max(1, box.width), SUDOKU_PAD.height * 0.74 / Math.max(1, box.height));
  return task.strokes.map((stroke) => stroke.map((point) => ({
    x: 0.5 + (point.x * VIEWPORT.width - box.x) * scale / SUDOKU_PAD.width,
    y: 0.5 + (point.y * VIEWPORT.height - box.y) * scale / SUDOKU_PAD.height,
  })));
}

export function matchInkTemplates(strokes, mode) {
  const box = bounds(strokes, SUDOKU_PAD);
  if (!box || box.height < 14 || Math.max(box.width, box.height) < 20) return { value: null, reason: 'empty', matches: [] };
  if (!SUDOKU_SYMBOLS[mode] || (mode === 'symbols' && !isClosedInk(strokes))) return { value: null, reason: 'unrecognized', matches: [] };
  const transforms = mode === 'symbols'
    ? Array.from({ length: 24 }, (_, index) => [index * 15, 0])
    : [0, -12, 12].flatMap((angle) => [0, -0.25, 0.25].map((shear) => [angle, shear]));
  const shape = mode === 'symbols' ? normalizeShape(strokes, SUDOKU_PAD) : null;
  const inputs = transforms.map(([angle, shear]) => {
    const normalized = shape ? normalizeInk(shape, { width: 1, height: 1 }, angle) : normalizeInk(strokes, SUDOKU_PAD, angle, shear);
    return prepareInk(mode === 'symbols' ? joinPenLifts(normalized) : normalized);
  });
  const library = profiles(mode);
  const closest = (profile) => inputs.reduce((best, ink) => {
    const fitted = fitWidth(ink, profile);
    const cost = distanceCost(fitted, profile.ink);
    return !best || cost < best.cost ? { profile, ink: fitted, cost } : best;
  }, null);
  const candidates = library.positive.map(closest);
  const matches = [];
  for (const value of [1, 2, 3, 4]) {
    const alternatives = candidates.filter((candidate) => candidate.profile.value === value).sort((a, b) => a.cost - b.cost);
    for (const candidate of alternatives.slice(0, 2)) {
      const { profile, ink, cost } = candidate;
      if (cost > 0.025 || coveredInk(profile.ink, ink) < 0.82 || coveredInk(ink, profile.ink) < 0.82) continue;
      matches.push({ value, score: Math.exp(-40 * cost), cost });
      break;
    }
  }
  matches.sort((a, b) => b.score - a.score);
  if (!matches.length) return { value: null, reason: 'unrecognized', matches };
  const negative = library.negative.map(closest).sort((a, b) => a.cost - b.cost)[0];
  if (negative.cost <= matches[0].cost * 1.05 + 0.0002) return { value: null, reason: 'out-of-set', alternative: negative.profile.task.id, matches };
  if (matches.length > 1 && matches[0].score - matches[1].score < 0.035) return { value: null, reason: 'ambiguous', matches };
  return { value: matches[0].value, matches };
}
