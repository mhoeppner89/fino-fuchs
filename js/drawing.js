/** Canvas input, rendering, and forgiving local handwriting scoring. */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DEMO_JUMP_UNITS = 0.42;
export const INK_COLORS = Object.freeze(['#284B73', '#C75C7B', '#2A9D8F', '#9A63BA', '#DD8530']);

export function inkColorAt(strokeIndex) {
  return INK_COLORS[strokeIndex % INK_COLORS.length];
}

function toPixels(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

function pointToSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function polylineLength(stroke, width, height) {
  let length = 0;
  for (let i = 1; i < stroke.length; i += 1) {
    length += distance(toPixels(stroke[i - 1], width, height), toPixels(stroke[i], width, height));
  }
  return length;
}

function resampleStroke(stroke, width, height, spacing = 7) {
  if (!stroke.length) return [];
  if (stroke.length === 1) return [toPixels(stroke[0], width, height)];
  const source = stroke.map((point) => toPixels(point, width, height));
  const result = [source[0]];
  let carry = 0;

  for (let i = 1; i < source.length; i += 1) {
    let a = source[i - 1];
    const b = source[i];
    let segmentLength = distance(a, b);
    if (segmentLength === 0) continue;

    while (carry + segmentLength >= spacing) {
      const ratio = (spacing - carry) / segmentLength;
      a = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      result.push(a);
      segmentLength = distance(a, b);
      carry = 0;
    }
    carry += segmentLength;
  }

  const last = source[source.length - 1];
  if (distance(result[result.length - 1], last) > spacing * 0.35) result.push(last);
  return result;
}

function minDistanceToStrokes(point, strokes) {
  let best = Infinity;
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      best = Math.min(best, distance(point, stroke[0]));
      continue;
    }
    for (let i = 1; i < stroke.length; i += 1) {
      best = Math.min(best, pointToSegmentDistance(point, stroke[i - 1], stroke[i]));
    }
  }
  return best;
}

function distanceScore(samples, targetStrokes, tolerance) {
  if (!samples.length || !targetStrokes.length) return 0;
  let total = 0;
  for (const sample of samples) {
    const d = minDistanceToStrokes(sample, targetStrokes);
    total += Math.exp(-((d / tolerance) ** 2));
  }
  return total / samples.length;
}

function pointStrokes(points) {
  return points.map((point) => [point]);
}

function pathOwnership(expectedSamplesByStroke, groups, userSamples) {
  const ownedSamples = expectedSamplesByStroke.map(() => []);
  userSamples.forEach((sample) => {
    let closestGroup = [];
    let closestGroupDistance = Infinity;
    groups.forEach((indexes) => {
      const groupStrokes = indexes.map((index) => expectedSamplesByStroke[index]);
      const d = minDistanceToStrokes(sample, groupStrokes);
      if (d < closestGroupDistance) {
        closestGroupDistance = d;
        closestGroup = indexes;
      }
    });
    let bestIndex = -1;
    let bestDistance = Infinity;
    closestGroup.forEach((index) => {
      const expectedSamples = expectedSamplesByStroke[index];
      const d = minDistanceToStrokes(sample, [expectedSamples]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) ownedSamples[bestIndex].push(sample);
  });
  return ownedSamples;
}

function strokeComponents(expectedStrokes, samplesByStroke, tolerance) {
  const parents = expectedStrokes.map((_, index) => index);
  const root = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const join = (a, b) => {
    const aRoot = root(a);
    const bRoot = root(b);
    if (aRoot !== bRoot) parents[bRoot] = aRoot;
  };
  // Strokes that touch belong to one character or shape. Separate copies in
  // a row remain their own components, so every copy has to be traced.
  const touchDistance = Math.max(3, tolerance * 0.2);
  for (let first = 0; first < expectedStrokes.length; first += 1) {
    for (let second = first + 1; second < expectedStrokes.length; second += 1) {
      const touches = samplesByStroke[first].some((point) => minDistanceToStrokes(point, [expectedStrokes[second]]) <= touchDistance)
        || samplesByStroke[second].some((point) => minDistanceToStrokes(point, [expectedStrokes[first]]) <= touchDistance);
      if (touches) join(first, second);
    }
  }
  return expectedStrokes.reduce((groups, _, index) => {
    const key = root(index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
    return groups;
  }, new Map());
}

function vectorScore(aStart, aEnd, bStart, bEnd) {
  const ax = aEnd.x - aStart.x;
  const ay = aEnd.y - aStart.y;
  const bx = bEnd.x - bStart.x;
  const by = bEnd.y - bStart.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength < 8 || bLength < 8) return 1;
  const cosine = clamp((ax * bx + ay * by) / (aLength * bLength), -1, 1);
  return (cosine + 1) / 2;
}

/**
 * Returns a score in [0,1]. It intentionally tolerates child-like variation.
 */
export function evaluateDrawing(expectedStrokes, userStrokes, {
  width = 900,
  height = 620,
  tolerance = Math.min(width, height) * 0.085,
  completionGroups = null,
} = {}) {
  const expected = expectedStrokes.filter((stroke) => stroke.length).map((stroke) => stroke.map((point) => toPixels(point, width, height)));
  const user = userStrokes.filter((stroke) => stroke.length).map((stroke) => stroke.map((point) => toPixels(point, width, height)));
  const expectedLength = expectedStrokes.reduce((sum, stroke) => sum + polylineLength(stroke, width, height), 0);
  const userLength = userStrokes.reduce((sum, stroke) => sum + polylineLength(stroke, width, height), 0);

  if (!user.length || userLength < 8) {
    return {
      score: 0, coverage: 0, precision: 0, start: 0, direction: 0,
      length: 0, strokeCount: 0, expectedLength, userLength, hasInk: false,
      completion: 0,
      componentCoverage: [],
      pathCoverage: expectedStrokes.map(() => 0),
    };
  }

  const expectedSamplesByStroke = expectedStrokes.filter((stroke) => stroke.length).map((stroke) => resampleStroke(stroke, width, height));
  const expectedSamples = expectedSamplesByStroke.flat();
  const userSamples = userStrokes.flatMap((stroke) => resampleStroke(stroke, width, height));
  const coverage = distanceScore(expectedSamples, user, tolerance);
  const precision = distanceScore(userSamples, expected, tolerance);
  const groups = completionGroups?.length
    ? completionGroups.filter((group) => group.length && group.every((index) => expectedSamplesByStroke[index]))
    : [...strokeComponents(expected, expectedSamplesByStroke, tolerance).values()];
  // A sample belongs only to its nearest required path. This stops a nearby
  // letter, number, or the other half of a character from receiving credit
  // for a path the child never drew. It still permits a child to merge,
  // split, reverse, or reorder their real pen strokes.
  const ownedSamplesByPath = pathOwnership(expectedSamplesByStroke, groups, userSamples);
  // Completion is a little tighter than the overall quality score. A nearby
  // vertical stroke must not count as most of a missing T bar, while the
  // mode-specific tolerance still keeps easy/medium/hard appropriately kind.
  const completionTolerance = tolerance * 0.65;
  const pathCoverage = expectedSamplesByStroke.map((pathSamples, index) => (
    distanceScore(pathSamples, pointStrokes(ownedSamplesByPath[index]), completionTolerance)
      * clamp(ownedSamplesByPath[index].length / Math.max(1, pathSamples.length * 0.55), 0, 1)
  ));
  // Every visible part is required: the least-covered path decides its
  // character's completion, and the least-complete character decides the
  // exercise. A crossbar, tail, or umlaut dot can no longer disappear into
  // an otherwise high average.
  const componentCoverage = groups
    .map((indexes) => Math.min(...indexes.map((index) => pathCoverage[index])));
  const completion = componentCoverage.length ? Math.min(...componentCoverage) : 0;

  let startTotal = 0;
  let directionTotal = 0;
  expected.forEach((expectedStroke) => {
    const expectedStart = expectedStroke[0];
    let nearest = user[0];
    let nearestDistance = Infinity;
    user.forEach((userStroke) => {
      const d = distance(expectedStart, userStroke[0]);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = userStroke;
      }
    });
    startTotal += Math.exp(-((nearestDistance / (tolerance * 1.25)) ** 2));
    directionTotal += vectorScore(
      expectedStroke[0], expectedStroke[expectedStroke.length - 1],
      nearest[0], nearest[nearest.length - 1],
    );
  });
  const start = expected.length ? startTotal / expected.length : 0;
  const direction = expected.length ? directionTotal / expected.length : 0;
  const strokeCount = Math.exp(-Math.abs(expected.length - user.length) * 0.16);
  const lengthRatio = expectedLength > 0 ? userLength / expectedLength : 0;
  const length = lengthRatio > 0 ? Math.exp(-Math.abs(Math.log(lengthRatio)) * 0.75) : 0;
  const shape = Math.sqrt(Math.max(0, coverage * precision));
  const rawScore =
    0.54 * shape
      + 0.2 * coverage
      + 0.2 * precision
      + 0.025 * start
      + 0.015 * direction
      + 0.015 * length
      + 0.005 * strokeCount;
  // Shape match matters most. Start, direction, and pen lifts are deliberately
  // light-touch checks so a child may use a natural alternative stroke order.
  const score = clamp(rawScore * (0.74 + 0.26 * length), 0, 1);

  return {
    score, coverage, precision, completion, componentCoverage, pathCoverage, start, direction, length, strokeCount,
    expectedLength, userLength, hasInk: true,
  };
}

const PASS_CRITERIA = Object.freeze({
  easy: Object.freeze({ score: 0.52, coverage: 0.45, precision: 0.35, completion: 0.55 }),
  medium: Object.freeze({ score: 0.56, coverage: 0.49, precision: 0.40, completion: 0.60 }),
  hard: Object.freeze({ score: 0.60, coverage: 0.53, precision: 0.46, completion: 0.65 }),
});

/**
 * The completion gate is intentionally never relaxed. Extra chances may be
 * forgiving about neatness, but every required part must still be present.
 */
export function passesDrawingCriteria(result, assist, { qualityAdjustment = 0, slack = 0 } = {}) {
  const criteria = PASS_CRITERIA[assist] ?? PASS_CRITERIA.easy;
  const qualitySlack = qualityAdjustment + slack;
  return result.hasInk
    && result.score >= criteria.score - qualitySlack
    && result.coverage >= criteria.coverage - qualitySlack
    && result.precision >= criteria.precision - qualitySlack
    && result.completion >= criteria.completion;
}

export function nextGuideStrokeIndex(expectedStrokes, userStrokes, {
  width = 900,
  height = 620,
  tolerance = Math.min(width, height) * 0.085,
  completionGroups = null,
} = {}) {
  if (!expectedStrokes.length || !userStrokes.some((stroke) => stroke.length)) return 0;
  const { pathCoverage = [] } = evaluateDrawing(expectedStrokes, userStrokes, {
    width,
    height,
    tolerance,
    completionGroups,
  });
  const next = pathCoverage.findIndex((coverage) => coverage < 0.72);
  return next >= 0 ? next : Math.max(0, expectedStrokes.length - 1);
}

export function feedbackForEvaluation(result) {
  if (!result.hasInk) return 'Zeichne zuerst mit dem Stift oder Finger.';
  if (result.completion < 0.5) return 'Fahr jede Zahl oder jeden Buchstaben nach.';
  if (result.coverage < 0.38) return 'Fahr die ganze Linie entlang.';
  if (result.precision < 0.32) return 'Bleib ein bisschen näher an der Spur.';
  if (result.start < 0.3) return 'Beginne beim grünen Punkt.';
  if (result.direction < 0.35) return 'Schau auf den Pfeil und probiere es noch einmal.';
  return 'Fast geschafft. Versuch es noch einmal.';
}

function roundedPath(context, points, width, height) {
  if (!points.length) return;
  const first = toPixels(points[0], width, height);
  context.moveTo(first.x, first.y);
  if (points.length === 1) {
    context.lineTo(first.x + 0.01, first.y + 0.01);
    return;
  }
  if (points.length === 2) {
    const last = toPixels(points[1], width, height);
    context.lineTo(last.x, last.y);
    return;
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = toPixels(points[i], width, height);
    const next = toPixels(points[i + 1], width, height);
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = toPixels(points[points.length - 1], width, height);
  context.lineTo(last.x, last.y);
}

function angularPath(context, points, width, height) {
  if (!points.length) return;
  const first = toPixels(points[0], width, height);
  context.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = toPixels(points[index], width, height);
    context.lineTo(point.x, point.y);
  }
}

function guideSegments(stroke, width, height, angular) {
  const points = stroke.map((point) => toPixels(point, width, height));
  if (points.length < 2) return [];
  if (angular || points.length === 2) {
    return points.slice(1).map((end, index) => ({ type: 'line', start: points[index], end }));
  }

  const segments = [];
  let start = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    segments.push({ type: 'quadratic', start, control, end });
    start = end;
  }
  segments.push({ type: 'line', start, end: points.at(-1) });
  return segments;
}

function pointOnGuideSegment(segment, progress) {
  if (segment.type === 'line') {
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * progress,
      y: segment.start.y + (segment.end.y - segment.start.y) * progress,
    };
  }
  const inverse = 1 - progress;
  return {
    x: inverse ** 2 * segment.start.x + 2 * inverse * progress * segment.control.x + progress ** 2 * segment.end.x,
    y: inverse ** 2 * segment.start.y + 2 * inverse * progress * segment.control.y + progress ** 2 * segment.end.y,
  };
}

function guideSegmentAngle(segment, progress) {
  const dx = segment.type === 'line'
    ? segment.end.x - segment.start.x
    : 2 * (1 - progress) * (segment.control.x - segment.start.x) + 2 * progress * (segment.end.x - segment.control.x);
  const dy = segment.type === 'line'
    ? segment.end.y - segment.start.y
    : 2 * (1 - progress) * (segment.control.y - segment.start.y) + 2 * progress * (segment.end.y - segment.control.y);
  return Math.atan2(dy, dx);
}

// The helper is sampled from the same line and quadratic segments as
// roundedPath(), keeping Fino centered on the visible dotted guide.
export function pointAlongGuidePath(stroke, progress, width, height, angular = false) {
  if (!stroke.length) return null;
  if (stroke.length === 1) return { point: toPixels(stroke[0], width, height), angle: 0 };

  const segments = guideSegments(stroke, width, height, angular);
  const samples = [];
  let previous = segments[0].start;
  let travelled = 0;
  samples.push({ segment: 0, t: 0, point: previous, travelled });
  segments.forEach((segment, segmentIndex) => {
    if (segmentIndex > 0) samples.push({ segment: segmentIndex, t: 0, point: previous, travelled });
    for (let step = 1; step <= 32; step += 1) {
      const t = step / 32;
      const point = pointOnGuideSegment(segment, t);
      travelled += distance(previous, point);
      samples.push({ segment: segmentIndex, t, point, travelled });
      previous = point;
    }
  });

  const target = clamp(progress, 0, 1) * travelled;
  const nextIndex = samples.findIndex((sample) => sample.travelled >= target);
  const next = samples[nextIndex === -1 ? samples.length - 1 : nextIndex];
  const previousSample = samples[Math.max(0, (nextIndex === -1 ? samples.length - 1 : nextIndex) - 1)];
  const span = next.travelled - previousSample.travelled;
  const ratio = span > 0 ? (target - previousSample.travelled) / span : 0;
  const segmentIndex = previousSample.segment === next.segment ? next.segment : previousSample.segment;
  const t = previousSample.segment === next.segment
    ? previousSample.t + (next.t - previousSample.t) * ratio
    : previousSample.t;
  const segment = segments[segmentIndex];
  return { point: pointOnGuideSegment(segment, t), angle: guideSegmentAngle(segment, t) };
}

export function demoStageAtProgress(strokeCount, progress) {
  if (strokeCount < 1) return null;
  const totalUnits = strokeCount + Math.max(0, strokeCount - 1) * DEMO_JUMP_UNITS;
  let remaining = clamp(progress, 0, 1) * totalUnits;

  for (let index = 0; index < strokeCount; index += 1) {
    if (remaining <= 1 || index === strokeCount - 1) {
      return { type: 'run', strokeIndex: index, progress: clamp(remaining, 0, 1) };
    }
    remaining -= 1;
    if (remaining <= DEMO_JUMP_UNITS) {
      return { type: 'jump', fromStroke: index, toStroke: index + 1, progress: remaining / DEMO_JUMP_UNITS };
    }
    remaining -= DEMO_JUMP_UNITS;
  }
  return { type: 'run', strokeIndex: strokeCount - 1, progress: 1 };
}

export class DrawingBoard {
  constructor(canvas, hooks = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('DrawingBoard requires a canvas element.');
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.hooks = hooks;
    this.task = null;
    this.assist = 'easy';
    this.userStrokes = [];
    this.strokeColors = [];
    this.activeStroke = null;
    this.activePointerId = null;
    this.lastPenAt = 0;
    this.demoProgress = null;
    this.demoFrame = 0;
    this.jumpAnimation = null;
    this.jumpFrame = 0;
    this.highlightUntil = 0;
    this.width = 800;
    this.height = 560;
    this.dpr = 1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.resize();
  }

  destroy() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.demoFrame);
    cancelAnimationFrame(this.jumpFrame);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    const pixelWidth = Math.round(this.width * this.dpr);
    const pixelHeight = Math.round(this.height * this.dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  setTask(task, assist = 'easy') {
    this.task = task;
    this.assist = assist;
    this.userStrokes = [];
    this.strokeColors = [];
    this.activeStroke = null;
    this.demoProgress = null;
    this.jumpAnimation = null;
    this.highlightUntil = 0;
    cancelAnimationFrame(this.demoFrame);
    cancelAnimationFrame(this.jumpFrame);
    this.render();
    this.hooks.onInkChange?.(false);
  }

  clear() {
    this.userStrokes = [];
    this.strokeColors = [];
    this.activeStroke = null;
    this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    this.highlightUntil = 0;
    this.render();
    this.hooks.onInkChange?.(false);
  }

  hasInk() {
    return this.userStrokes.some((stroke) => stroke.length > 0);
  }

  getUserStrokes() {
    return this.userStrokes.map((stroke) => stroke.map((point) => ({ ...point })));
  }

  getUserStrokeColors() {
    return [...this.strokeColors];
  }

  setUserStrokes(strokes) {
    this.userStrokes = strokes.map((stroke) => stroke.map((point) => ({ x: point.x, y: point.y, pressure: point.pressure ?? 0.5 })));
    this.strokeColors = this.userStrokes.map((_, index) => inkColorAt(index));
    this.render();
    this.hooks.onInkChange?.(this.hasInk());
  }

  evaluationOptions() {
    const toleranceByAssist = { easy: 0.068, medium: 0.058, hard: 0.048 };
    return {
      width: this.width,
      height: this.height,
      tolerance: Math.min(this.width, this.height) * toleranceByAssist[this.assist],
    };
  }

  nextGuideStrokeIndex() {
    return nextGuideStrokeIndex(this.task?.strokes ?? [], this.userStrokes, {
      ...this.evaluationOptions(),
      completionGroups: this.task?.completionGroups ?? null,
    });
  }

  flashGuide() {
    this.highlightUntil = performance.now() + 1700;
    const tick = () => {
      this.render();
      if (performance.now() < this.highlightUntil) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  startDemo() {
    if (!this.task || this.demoProgress !== null) return Promise.resolve();
    this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    this.demoProgress = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Fino moves at 1.5× the previous pace. The path stays invisible so it
    // demonstrates the movement without drawing the child's orange trace.
    const duration = reducedMotion ? 240 : clamp((this.task.strokes.length * 350 + 950) / 1.5, 733, 1533);
    const startedAt = performance.now();

    return new Promise((resolve) => {
      const frame = (now) => {
        this.demoProgress = clamp((now - startedAt) / duration, 0, 1);
        this.render();
        if (this.demoProgress < 1) {
          this.demoFrame = requestAnimationFrame(frame);
        } else {
          window.setTimeout(() => {
            this.demoProgress = null;
            this.render();
            resolve();
          }, reducedMotion ? 100 : 280);
        }
      };
      this.demoFrame = requestAnimationFrame(frame);
    });
  }

  pointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      pressure: event.pressure > 0 ? event.pressure : event.pointerType === 'mouse' ? 0.5 : 0.45,
      time: performance.now(),
    };
  }

  onPointerDown(event) {
    if (!this.task || this.demoProgress !== null || this.activePointerId !== null) return;
    if (event.pointerType === 'touch' && (!event.isPrimary || performance.now() - this.lastPenAt < 900)) return;
    if (event.pointerType === 'pen') this.lastPenAt = performance.now();
    event.preventDefault();
    this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    this.activePointerId = event.pointerId;
    this.activeStroke = [this.pointFromEvent(event)];
    this.userStrokes.push(this.activeStroke);
    this.strokeColors.push(inkColorAt(this.userStrokes.length - 1));
    this.canvas.setPointerCapture?.(event.pointerId);
    this.hooks.onStrokeStart?.();
    this.hooks.onInkChange?.(true);
    this.render();
  }

  onPointerMove(event) {
    if (event.pointerId !== this.activePointerId || !this.activeStroke) return;
    if (event.pointerType === 'pen') this.lastPenAt = performance.now();
    event.preventDefault();
    // Some browsers and automation layers expose getCoalescedEvents() but
    // return an empty list for an ordinary pointer move. Always keep the
    // dispatched event in that case, otherwise a drag is recorded as a dot.
    const coalescedEvents = event.getCoalescedEvents?.();
    const events = coalescedEvents?.length ? coalescedEvents : [event];
    for (const item of events) {
      const point = this.pointFromEvent(item);
      const last = this.activeStroke[this.activeStroke.length - 1];
      if (!last || distance(
        { x: last.x * this.width, y: last.y * this.height },
        { x: point.x * this.width, y: point.y * this.height },
      ) >= 1.4) this.activeStroke.push(point);
    }
    this.render();
  }

  onPointerUp(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    if (this.activeStroke && this.activeStroke.length === 1) {
      const start = this.activeStroke[0];
      this.activeStroke.push({ ...start, x: clamp(start.x + 0.002, 0, 1) });
    }
    const finishedStroke = this.activeStroke;
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.activePointerId = null;
    this.activeStroke = null;
    this.startJumpToNextStroke(finishedStroke);
    this.render();
    this.hooks.onStrokeEnd?.();
  }

  startJumpToNextStroke(finishedStroke) {
    const nextStroke = this.task?.strokes[this.nextGuideStrokeIndex()];
    const lastPoint = finishedStroke?.at(-1);
    const nextPoint = nextStroke?.[0];
    if (!lastPoint || !nextPoint) return;

    const from = toPixels(lastPoint, this.width, this.height);
    const to = toPixels(nextPoint, this.width, this.height);
    const travel = distance(from, to);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.jumpAnimation = {
      from,
      to,
      progress: 0,
      travel,
      startedAt: performance.now(),
      duration: reducedMotion ? 170 : clamp(230 + travel * 0.45, 300, 520),
    };

    const frame = (now) => {
      if (!this.jumpAnimation) return;
      this.jumpAnimation.progress = clamp((now - this.jumpAnimation.startedAt) / this.jumpAnimation.duration, 0, 1);
      this.render();
      if (this.jumpAnimation.progress < 1) {
        this.jumpFrame = requestAnimationFrame(frame);
      } else {
        this.jumpAnimation = null;
        this.render();
      }
    };
    this.jumpFrame = requestAnimationFrame(frame);
  }

  drawGuidelines(context) {
    if (!this.task || !['letters', 'numbers', 'name'].includes(this.task.category)) return;
    context.save();
    context.strokeStyle = 'rgba(82, 105, 142, .13)';
    context.lineWidth = 2;
    context.setLineDash([7, 9]);
    [0.18, 0.5, 0.84].forEach((y, index) => {
      context.beginPath();
      context.moveTo(this.width * 0.08, this.height * y);
      context.lineTo(this.width * 0.92, this.height * y);
      context.stroke();
      if (index === 2) {
        context.setLineDash([]);
        context.strokeStyle = 'rgba(82, 105, 142, .19)';
        context.stroke();
      }
    });
    context.restore();
  }

  drawStrokeSet(context, strokes, {
    color,
    width,
    dash = [],
    alpha = 1,
    angular = false,
  }) {
    context.save();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = angular ? 'miter' : 'round';
    context.setLineDash(dash);
    strokes.forEach((stroke) => {
      context.beginPath();
      if (angular) angularPath(context, stroke, this.width, this.height);
      else roundedPath(context, stroke, this.width, this.height);
      context.stroke();
    });
    context.restore();
  }

  drawGuideFox(context, point, angle = 0, { jumping = false } = {}) {
    const size = clamp(Math.min(this.width, this.height) * 0.08, 26, 46);
    context.save();
    context.translate(point.x, point.y - (jumping ? size * 0.34 : 0));
    context.rotate(angle);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(-size * 0.18, size * 0.06);
    context.quadraticCurveTo(-size * 0.56, -size * 0.18, -size * 0.64, size * 0.12);
    context.quadraticCurveTo(-size * 0.54, size * 0.3, -size * 0.28, size * 0.17);
    context.fillStyle = '#F58B45';
    context.fill();

    context.beginPath();
    context.ellipse(-size * 0.08, size * 0.06, size * 0.31, size * 0.2, 0, 0, Math.PI * 2);
    context.fillStyle = '#F58B45';
    context.fill();

    context.beginPath();
    context.moveTo(-size * 0.04, -size * 0.22);
    context.lineTo(size * 0.04, -size * 0.48);
    context.lineTo(size * 0.16, -size * 0.2);
    context.closePath();
    context.moveTo(size * 0.22, -size * 0.2);
    context.lineTo(size * 0.34, -size * 0.47);
    context.lineTo(size * 0.42, -size * 0.16);
    context.closePath();
    context.fillStyle = '#F58B45';
    context.fill();

    context.beginPath();
    context.arc(size * 0.19, -size * 0.15, size * 0.24, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(size * 0.34, -size * 0.08, size * 0.16, size * 0.12, 0, 0, Math.PI * 2);
    context.fillStyle = '#FFF0D8';
    context.fill();
    context.beginPath();
    context.arc(size * 0.22, -size * 0.21, size * 0.032, 0, Math.PI * 2);
    context.fillStyle = '#27314A';
    context.fill();
    context.beginPath();
    context.arc(size * 0.47, -size * 0.08, size * 0.045, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#7A3A2D';
    context.lineWidth = size * 0.07;
    context.beginPath();
    context.moveTo(-size * 0.17, size * 0.2);
    context.lineTo(-size * 0.05, size * 0.3);
    context.moveTo(size * 0.14, size * 0.19);
    context.lineTo(size * 0.24, size * 0.29);
    context.stroke();
    context.restore();
  }

  drawFoxForCurrentStroke(context) {
    if (!this.task || this.demoProgress !== null) return;
    if (this.jumpAnimation) {
      this.drawJumpingFox(context, this.jumpAnimation);
      return;
    }
    if (this.activeStroke?.length) {
      const lastIndex = this.activeStroke.length - 1;
      const point = toPixels(this.activeStroke[lastIndex], this.width, this.height);
      const previous = toPixels(this.activeStroke[Math.max(0, lastIndex - 1)], this.width, this.height);
      this.drawGuideFox(context, point, Math.atan2(point.y - previous.y, point.x - previous.x));
      return;
    }

    const nextStroke = this.task.strokes[this.nextGuideStrokeIndex()];
    const angular = ['letters', 'numbers', 'name'].includes(this.task.category);
    // Fino waits just after the green starting point, still exactly on the
    // dotted path. This leaves the child a clear, visible place to begin.
    const next = pointAlongGuidePath(nextStroke ?? [], 0.07, this.width, this.height, angular);
    if (next) this.drawGuideFox(context, next.point, next.angle);
  }

  drawJumpingFox(context, jump) {
    const eased = jump.progress < 0.5
      ? 2 * jump.progress ** 2
      : 1 - ((-2 * jump.progress + 2) ** 2) / 2;
    const baseline = {
      x: jump.from.x + (jump.to.x - jump.from.x) * eased,
      y: jump.from.y + (jump.to.y - jump.from.y) * eased,
    };
    const lift = Math.sin(Math.PI * jump.progress) * clamp(jump.travel * 0.2, 24, 58);
    const size = clamp(Math.min(this.width, this.height) * 0.08, 26, 46);

    context.save();
    context.globalAlpha = 0.12 + (1 - Math.sin(Math.PI * jump.progress)) * 0.08;
    context.fillStyle = '#27314A';
    context.beginPath();
    context.ellipse(baseline.x, baseline.y + size * 0.27, size * 0.34, size * 0.1, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const angle = Math.atan2(jump.to.y - jump.from.y, jump.to.x - jump.from.x);
    this.drawGuideFox(context, { x: baseline.x, y: baseline.y - lift }, angle);
  }

  drawDemo(context) {
    if (this.demoProgress === null || !this.task) return;
    const angular = ['letters', 'numbers', 'name'].includes(this.task.category);
    const stage = demoStageAtProgress(this.task.strokes.length, this.demoProgress);
    if (!stage) return;

    if (stage.type === 'run') {
      const activeStroke = this.task.strokes[stage.strokeIndex];
      const guide = pointAlongGuidePath(activeStroke ?? [], stage.progress, this.width, this.height, angular);
      if (guide) this.drawGuideFox(context, guide.point, guide.angle);
      return;
    }

    const from = pointAlongGuidePath(this.task.strokes[stage.fromStroke], 1, this.width, this.height, angular);
    const to = pointAlongGuidePath(this.task.strokes[stage.toStroke], 0, this.width, this.height, angular);
    if (from && to) {
      this.drawJumpingFox(context, {
        from: from.point,
        to: to.point,
        progress: stage.progress,
        travel: distance(from.point, to.point),
      });
    }
  }

  drawStartPoint(context) {
    if (!this.task || this.demoProgress !== null || this.activeStroke?.length || this.jumpAnimation) return;
    const stroke = this.task.strokes[this.nextGuideStrokeIndex()];
    const angular = ['letters', 'numbers', 'name'].includes(this.task.category);
    const guide = pointAlongGuidePath(stroke ?? [], 0, this.width, this.height, angular);
    if (!guide) return;
    const radius = clamp(Math.min(this.width, this.height) * 0.016, 6, 10);
    context.save();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(guide.point.x, guide.point.y, radius + 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#62C892';
    context.beginPath();
    context.arc(guide.point.x, guide.point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  render() {
    const context = this.context;
    if (!context) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    this.drawGuidelines(context);
    if (this.task) {
      const isHighlight = performance.now() < this.highlightUntil;
      const angularGuide = ['letters', 'numbers', 'name'].includes(this.task.category);
      const guideStyle = {
        easy: { width: 0.021, min: 10, max: 17, dash: [2, 22], alpha: 0.45, color: '#B9D8DE' },
        medium: { width: 0.015, min: 7, max: 12, dash: [9, 12], alpha: 0.34, color: '#C9D6E2' },
        hard: { width: 0.01, min: 5, max: 8, dash: [5, 13], alpha: 0.25, color: '#D0DAE5' },
      }[this.assist];
      this.drawStrokeSet(context, this.task.strokes, {
        color: isHighlight ? '#F3B348' : guideStyle.color,
        width: clamp(Math.min(this.width, this.height) * guideStyle.width, guideStyle.min, guideStyle.max),
        dash: guideStyle.dash,
        alpha: isHighlight ? 0.72 : guideStyle.alpha,
        angular: angularGuide,
      });

      this.drawFoxForCurrentStroke(context);
      this.drawStartPoint(context);
      this.drawDemo(context);
    }

    this.userStrokes.forEach((stroke, index) => {
      this.drawStrokeSet(context, [stroke], {
        color: this.strokeColors[index] ?? inkColorAt(index),
        width: clamp(Math.min(this.width, this.height) * 0.025, 11, 20),
        alpha: 0.98,
      });
    });
  }
}
