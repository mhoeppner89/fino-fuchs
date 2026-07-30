/** Canvas input, rendering, and forgiving local handwriting scoring. */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
} = {}) {
  const expected = expectedStrokes.filter((stroke) => stroke.length).map((stroke) => stroke.map((point) => toPixels(point, width, height)));
  const user = userStrokes.filter((stroke) => stroke.length).map((stroke) => stroke.map((point) => toPixels(point, width, height)));
  const expectedLength = expectedStrokes.reduce((sum, stroke) => sum + polylineLength(stroke, width, height), 0);
  const userLength = userStrokes.reduce((sum, stroke) => sum + polylineLength(stroke, width, height), 0);

  if (!user.length || userLength < 8) {
    return {
      score: 0, coverage: 0, precision: 0, start: 0, direction: 0,
      length: 0, strokeCount: 0, expectedLength, userLength, hasInk: false,
    };
  }

  const expectedSamples = expectedStrokes.flatMap((stroke) => resampleStroke(stroke, width, height));
  const userSamples = userStrokes.flatMap((stroke) => resampleStroke(stroke, width, height));
  const coverage = distanceScore(expectedSamples, user, tolerance);
  const precision = distanceScore(userSamples, expected, tolerance);

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
  const strokeCount = Math.exp(-Math.abs(expected.length - user.length) * 0.38);
  const lengthRatio = expectedLength > 0 ? userLength / expectedLength : 0;
  const length = lengthRatio > 0 ? Math.exp(-Math.abs(Math.log(lengthRatio)) * 0.75) : 0;
  const shape = Math.sqrt(Math.max(0, coverage * precision));
  const rawScore =
    0.5 * shape
      + 0.15 * coverage
      + 0.15 * precision
      + 0.08 * start
      + 0.05 * direction
      + 0.04 * length
      + 0.03 * strokeCount;
  // Excessive scribbling may cover the target by chance. The length factor
  // discounts that pattern while remaining forgiving of short child strokes.
  const score = clamp(rawScore * (0.65 + 0.35 * length), 0, 1);

  return {
    score, coverage, precision, start, direction, length, strokeCount,
    expectedLength, userLength, hasInk: true,
  };
}

export function feedbackForEvaluation(result) {
  if (!result.hasInk) return 'Zeichne zuerst mit dem Stift oder Finger.';
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

function partialStroke(stroke, progress) {
  if (progress <= 0) return [];
  if (progress >= 1) return stroke;
  const count = Math.max(2, Math.ceil(stroke.length * progress));
  return stroke.slice(0, count);
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
    this.activeStroke = null;
    this.activePointerId = null;
    this.lastPenAt = 0;
    this.demoProgress = null;
    this.demoFrame = 0;
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
    this.activeStroke = null;
    this.demoProgress = null;
    this.highlightUntil = 0;
    cancelAnimationFrame(this.demoFrame);
    this.render();
    this.hooks.onInkChange?.(false);
  }

  clear() {
    this.userStrokes = [];
    this.activeStroke = null;
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

  setUserStrokes(strokes) {
    this.userStrokes = strokes.map((stroke) => stroke.map((point) => ({ x: point.x, y: point.y, pressure: point.pressure ?? 0.5 })));
    this.render();
    this.hooks.onInkChange?.(this.hasInk());
  }

  evaluationOptions() {
    return { width: this.width, height: this.height, tolerance: Math.min(this.width, this.height) * 0.085 };
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
    this.demoProgress = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 350 : clamp(this.task.strokes.length * 350 + 950, 1100, 2300);
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
    this.activePointerId = event.pointerId;
    this.activeStroke = [this.pointFromEvent(event)];
    this.userStrokes.push(this.activeStroke);
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
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.activePointerId = null;
    this.activeStroke = null;
    this.render();
    this.hooks.onStrokeEnd?.();
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

  drawDecorations(context) {
    if (!this.task?.decorations?.length) return;
    context.save();
    const size = clamp(Math.min(this.width, this.height) * 0.075, 28, 50);
    context.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    this.task.decorations.forEach(({ x, y, symbol }) => context.fillText(symbol, x * this.width, y * this.height));
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

  drawStartPointsAndArrows(context) {
    if (!this.task || this.assist === 'hard' && this.task.category === 'name') return;
    const radius = clamp(Math.min(this.width, this.height) * 0.018, 7, 13);
    context.save();
    this.task.strokes.forEach((stroke, index) => {
      if (!stroke.length) return;
      const start = toPixels(stroke[0], this.width, this.height);
      context.beginPath();
      context.fillStyle = '#62C892';
      context.arc(start.x, start.y, radius, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = '#FFFFFF';
      context.stroke();

      if (this.assist === 'easy' && stroke.length > 2) {
        const arrowIndex = Math.min(stroke.length - 1, Math.max(1, Math.floor(stroke.length * 0.18)));
        const before = toPixels(stroke[arrowIndex - 1], this.width, this.height);
        const after = toPixels(stroke[arrowIndex], this.width, this.height);
        const angle = Math.atan2(after.y - before.y, after.x - before.x);
        const x = (before.x + after.x) / 2;
        const y = (before.y + after.y) / 2;
        const size = radius * 1.45;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.beginPath();
        context.moveTo(size, 0);
        context.lineTo(-size * 0.55, -size * 0.55);
        context.lineTo(-size * 0.55, size * 0.55);
        context.closePath();
        context.fillStyle = '#F58B45';
        context.fill();
        context.restore();
      }

      if (this.task.strokes.length > 1 && this.assist !== 'hard') {
        context.fillStyle = '#23405F';
        context.font = `700 ${clamp(radius * 1.2, 10, 16)}px system-ui`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(index + 1), start.x, start.y);
      }
    });
    context.restore();
  }

  drawDemo(context) {
    if (this.demoProgress === null || !this.task) return;
    const total = this.task.strokes.length;
    const scaled = this.demoProgress * total;
    const demoStrokes = [];
    this.task.strokes.forEach((stroke, index) => {
      const local = clamp(scaled - index, 0, 1);
      if (local > 0) demoStrokes.push(partialStroke(stroke, local));
    });
    this.drawStrokeSet(context, demoStrokes, {
      color: '#F58B45',
      width: clamp(Math.min(this.width, this.height) * 0.026, 12, 22),
      alpha: 0.96,
      angular: ['letters', 'numbers', 'name'].includes(this.task.category),
    });

    const activeIndex = Math.min(total - 1, Math.floor(scaled));
    const local = clamp(scaled - activeIndex, 0, 1);
    const activeStroke = this.task.strokes[activeIndex];
    if (activeStroke?.length && local > 0 && local < 1) {
      const pointIndex = Math.min(activeStroke.length - 1, Math.floor(local * activeStroke.length));
      const point = toPixels(activeStroke[pointIndex], this.width, this.height);
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, clamp(Math.min(this.width, this.height) * 0.022, 10, 16), 0, Math.PI * 2);
      context.fillStyle = '#FFFFFF';
      context.fill();
      context.lineWidth = 5;
      context.strokeStyle = '#F58B45';
      context.stroke();
      context.restore();
    }
  }

  render() {
    const context = this.context;
    if (!context) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    this.drawGuidelines(context);
    this.drawDecorations(context);

    if (this.task) {
      const isHighlight = performance.now() < this.highlightUntil;
      const angularGuide = ['letters', 'numbers', 'name'].includes(this.task.category);
      if (this.assist === 'easy') {
        this.drawStrokeSet(context, this.task.strokes, {
          color: isHighlight ? '#F3B348' : '#B9D8DE',
          width: clamp(Math.min(this.width, this.height) * 0.034, 16, 28),
          dash: [2, clamp(Math.min(this.width, this.height) * 0.045, 20, 34)],
          alpha: isHighlight ? 0.9 : 0.72,
          angular: angularGuide,
        });
      } else if (this.assist === 'medium') {
        this.drawStrokeSet(context, this.task.strokes, {
          color: isHighlight ? '#F3B348' : '#C9D6E2',
          width: clamp(Math.min(this.width, this.height) * 0.016, 7, 13),
          dash: [10, 10],
          alpha: isHighlight ? 0.92 : 0.64,
          angular: angularGuide,
        });
      } else if (isHighlight) {
        this.drawStrokeSet(context, this.task.strokes, {
          color: '#F3B348',
          width: clamp(Math.min(this.width, this.height) * 0.014, 7, 12),
          dash: [9, 10],
          alpha: 0.8,
          angular: angularGuide,
        });
      }

      this.drawStartPointsAndArrows(context);
      this.drawDemo(context);
    }

    this.drawStrokeSet(context, this.userStrokes, {
      color: '#284B73',
      width: clamp(Math.min(this.width, this.height) * 0.025, 11, 20),
      alpha: 0.98,
    });
  }
}
