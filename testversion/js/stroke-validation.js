/** Sequential pen-stroke acceptance. All distances scale with the symbol. */
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (points) => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const mean = (points) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});
const PROFILES = Object.freeze({
  easy: { band: 0.13, dot: 0.14, join: 0.12, minLength: 0.50, maxLength: 2.4 },
  medium: { band: 0.09, dot: 0.11, join: 0.08, minLength: 0.60, maxLength: 2.0 },
  hard: { band: 0.055, dot: 0.085, join: 0.045, minLength: 0.70, maxLength: 1.65 },
});

function bounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { size: Math.max(maxX - minX, maxY - minY, 1e-6), center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
}

function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}

function routeDistance(p, route) {
  if (route.length === 1) return distance(p, route[0]);
  return route.slice(1).reduce((best, end, i) => Math.min(best, segmentDistance(p, route[i], end)), Infinity);
}

function closedStructure(points, size) {
  // Remove small hand wobble before counting structural turns. This operates
  // on the original geometry, so resampling cannot round away a polygon tip.
  const tolerance = size * 0.025;
  const simplify = (route) => {
    if (route.length <= 2) return route;
    let farthest = 0, maximum = 0;
    for (let i = 1; i < route.length - 1; i += 1) {
      const gap = segmentDistance(route[i], route[0], route.at(-1));
      if (gap > maximum) { maximum = gap; farthest = i; }
    }
    if (maximum <= tolerance) return [route[0], route.at(-1)];
    return [...simplify(route.slice(0, farthest + 1)).slice(0, -1), ...simplify(route.slice(farthest))];
  };
  const ring = simplify([...points, points[0]]).slice(0, -1);
  const winding = Math.sign(ring.reduce((sum, p, i) => {
    const next = ring[(i + 1) % ring.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0));
  let corners = 0, notches = 0;
  ring.forEach((p, i) => {
    const previous = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
    const ax = p.x - previous.x, ay = p.y - previous.y;
    const bx = next.x - p.x, by = next.y - p.y;
    const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
    const angle = denominator > 1e-9 ? Math.acos(clamp((ax * bx + ay * by) / denominator, -1, 1)) : 0;
    if (angle >= 50 * Math.PI / 180) {
      corners += 1;
      if (Math.sign(ax * by - ay * bx) !== winding
        && Math.min(Math.hypot(ax, ay), Math.hypot(bx, by)) >= size * 0.08) notches += 1;
    }
  });
  return { corners, notches };
}

// Arc-length sampling makes speed and the browser's event frequency irrelevant.
export function sampleStroke(points, count = 65) {
  if (!points.length) return [];
  const total = length(points);
  if (total < 1e-9) return Array.from({ length: count }, () => ({ ...points[0] }));
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < points.length - 1 && lengths[segment] < target) segment += 1;
    const t = (target - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1] || 1);
    const a = points[segment - 1], b = points[segment];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

function closestLineErrors(expected, actual) {
  return [
    ...sampleStroke(expected).map((p) => routeDistance(p, actual)),
    ...sampleStroke(actual).map((p) => routeDistance(p, expected)),
  ];
}

// Direction is a separate teaching rule. Monotone alignment permits a bend
// earlier/later along the line instead of requiring equal arc-length positions.
function traversalCost(expected, actual) {
  let previous = Array(actual.length + 1).fill(Infinity);
  previous[0] = 0;
  for (const point of expected) {
    const row = [Infinity];
    for (let j = 0; j < actual.length; j += 1) {
      row.push(distance(point, actual[j]) ** 2 + Math.min(previous[j], previous[j + 1], row[j]));
    }
    previous = row;
  }
  return previous.at(-1);
}

function alignedTraversal(expected, actual, closed, strict) {
  const forward = traversalCost(expected, actual);
  const backward = traversalCost(expected, [...actual].reverse());
  if (strict) return { cost: forward, directionFits: forward <= backward + 1e-6 };
  if (!closed) return { cost: Math.min(forward, backward), directionFits: true };
  const ring = actual.slice(0, -1);
  // Closed shapes may begin anywhere. Try nearby start samples in both
  // directions; this changes only the comparison, never the guide or ink.
  const starts = ring.map((point, index) => ({ index, gap: distance(point, expected[0]) }))
    .sort((a, b) => a.gap - b.gap).slice(0, 3);
  let cost = Math.min(forward, backward);
  for (const { index } of starts) {
    const shifted = [...ring.slice(index), ...ring.slice(0, index), ring[index]];
    cost = Math.min(cost, traversalCost(expected, shifted), traversalCost(expected, [...shifted].reverse()));
  }
  return { cost, directionFits: true };
}

export class StrokeProgress {
  constructor(task, { width = 900, height = 620, assist = 'easy', strict = true } = {}) {
    this.task = task;
    this.width = width;
    this.height = height;
    this.profile = PROFILES[assist] ?? PROFILES.easy;
    this.strict = strict && ['letters', 'numbers', 'name'].includes(task.category);
    this.routes = task.strokes.map((route) => route.map((p) => ({ x: p.x * width, y: p.y * height })));
    this.groups = (task.completionGroups?.length ? task.completionGroups : [this.routes.map((_, i) => i)])
      .map((indexes) => ({ indexes, ...bounds(indexes.flatMap((i) => this.routes[i])) }));
    this.attempts = [];
    this.accepted = new Map();
    this.groupChecks = new Map();
  }

  currentGroup() {
    return this.groups.findIndex((group) => group.indexes.some((index) => !this.accepted.has(index)));
  }

  nextIndex() {
    const group = this.groups[this.currentGroup()];
    return group?.indexes.find((index) => !this.accepted.has(index)) ?? Math.max(0, this.routes.length - 1);
  }

  guideStroke(index) {
    return this.task.strokes[index];
  }

  dotTolerance(index, group) {
    const otherRoutes = group.indexes.filter((i) => i !== index);
    const clearance = otherRoutes.reduce((best, i) => Math.min(best, routeDistance(this.routes[index][0], this.routes[i])), Infinity);
    return Math.min(group.size * this.profile.dot, clearance * 0.65);
  }

  match(user, index, groupIndex) {
    const group = this.groups[groupIndex];
    const route = this.routes[index];
    const isDot = route.length === 1;
    if (isDot) {
      const normalized = user;
      const center = mean(normalized);
      const tolerance = this.dotTolerance(index, group);
      const offset = distance(center, route[0]);
      const fits = offset <= tolerance && length(normalized) <= tolerance * 3
        && normalized.every((p) => distance(p, center) <= tolerance * 0.6);
      return { fits, index, normalized, geometry: normalized, error: offset / tolerance, reason: 'dot' };
    }
    const expectedLength = length(route);
    const rawRatio = length(user) / expectedLength;
    if (rawRatio < this.profile.minLength - 1e-9 || rawRatio > this.profile.maxLength + 1e-9) {
      return { fits: false, index, error: Infinity, ratio: rawRatio, reason: 'length' };
    }
    const tolerance = Math.min(group.size * this.profile.band, Math.max(group.size * 0.025, expectedLength * 0.30));
    const closed = distance(route[0], route.at(-1)) <= group.size * 0.018;
    const expected = sampleStroke(route);
    const sampled = sampleStroke(user);
    const errors = closestLineErrors(route, user);
    const mse = errors.reduce((sum, d) => sum + d * d, 0) / errors.length;
    const error = Math.sqrt(mse) / tolerance;
    const sorted = [...errors].sort((a, b) => a - b);
    const forwardEnds = Math.max(distance(route[0], user[0]), distance(route.at(-1), user.at(-1)));
    const reverseEnds = Math.max(distance(route[0], user.at(-1)), distance(route.at(-1), user[0]));
    const endpoints = !this.strict && closed ? 0 : this.strict ? forwardEnds : Math.min(forwardEnds, reverseEnds);
    const closure = !closed || distance(user[0], user.at(-1)) <= group.size * this.profile.join;
    const shapeFits = error <= 1 && sorted[Math.floor(sorted.length * 0.95)] <= tolerance * 1.8;
    const complete = endpoints <= tolerance * 1.5 && closure;
    const alignment = shapeFits && complete ? alignedTraversal(expected, sampled, closed, this.strict) : null;
    // Closest-line MSE is the geometry score. A loose monotone traversal
    // bound also requires visiting the major parts (e.g. both humps of m).
    const traversalError = alignment ? Math.sqrt(alignment.cost / expected.length) / tolerance : Infinity;
    const traversalFits = traversalError <= 1.2;
    const directionFits = alignment?.directionFits ?? true;
    return { fits: shapeFits && complete && directionFits && traversalFits, index, normalized: sampled,
      geometry: user, error, mse: mse / tolerance ** 2, ratio: rawRatio, traversalError,
      reason: !directionFits ? 'direction' : !complete ? 'incomplete' : !traversalFits ? 'traversal' : 'stroke' };
  }

  relationsFit(candidate, groupIndex) {
    const group = this.groups[groupIndex];
    const entries = [...this.accepted.values()].filter((entry) => group.indexes.includes(entry.index));
    for (const previous of entries) {
      // All accepted marks share the fixed template coordinates.
      const oldPoints = previous.user;
      const expectedOld = this.routes[previous.index];
      const expectedNew = this.routes[candidate.index];
      if (expectedOld.length === 1 || expectedNew.length === 1) {
        const dotEntry = expectedOld.length === 1 ? { index: previous.index, points: oldPoints } : { index: candidate.index, points: candidate.normalized };
        if (distance(mean(dotEntry.points), this.routes[dotEntry.index][0]) > this.dotTolerance(dotEntry.index, group)) return false;
        if (expectedOld.length === 1 && expectedNew.length === 1
          && distance(mean(oldPoints), mean(candidate.normalized)) < distance(expectedOld[0], expectedNew[0]) * 0.4) return false;
        continue;
      }
      const contact = group.size * 0.009;
      const allowedGap = group.size * this.profile.join;
      // Only actual strokes can form a join. Check endpoint attachments near
      // the child's lines, not same-index samples or imaginary future strokes.
      for (const [expected, actual, otherExpected, otherActual] of [
        [expectedNew, candidate.geometry, expectedOld, oldPoints],
        [expectedOld, oldPoints, expectedNew, candidate.geometry],
      ]) {
        for (const [target, point] of [[expected[0], actual[0]], [expected.at(-1), actual.at(-1)]]) {
          const targetGap = routeDistance(target, otherExpected);
          if (targetGap <= contact && routeDistance(point, otherActual) > targetGap + allowedGap) return false;
        }
      }
    }
    return true;
  }

  shapeFits(candidate, groupIndex) {
    const group = this.groups[groupIndex];
    const entries = [...this.accepted.values()].filter((entry) => group.indexes.includes(entry.index));
    entries.push(candidate);
    // Check the combined silhouette in one coordinate system. Each dot has
    // already passed its own location, size, and separation checks.
    const lines = entries.filter((entry) => this.routes[entry.index].length > 1);
    if (!lines.length) return true;
    const expected = lines.map((entry) => this.routes[entry.index]);
    const actual = lines.map((entry) => entry.geometry);
    if (this.task.category === 'shapes') {
      for (let i = 0; i < expected.length; i += 1) {
        if (distance(expected[i][0], expected[i].at(-1)) > group.size * 0.018) continue;
        const target = closedStructure(expected[i], group.size);
        const drawn = closedStructure(actual[i], group.size);
        if (target.corners === 0 ? drawn.corners > 2 || drawn.notches > 0 : drawn.corners !== target.corners) return false;
        const aspect = (route) => {
          const xs = route.map((p) => p.x), ys = route.map((p) => p.y);
          return (Math.max(...xs) - Math.min(...xs)) / Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
        };
        // A circle/oval or square/rectangle still needs its defining proportion.
        const proportion = aspect(actual[i]) / aspect(expected[i]);
        if (proportion < 0.75 || proportion > 1 / 0.75) return false;
      }
    }
    const tolerance = group.size * this.profile.band;
    const errors = [];
    for (const [source, target] of [[expected, actual], [actual, expected]]) {
      for (const route of source) for (const point of sampleStroke(route)) {
        errors.push(Math.min(...target.map((other) => routeDistance(point, other))) / tolerance);
      }
    }
    errors.sort((a, b) => a - b);
    return errors.reduce((sum, error) => sum + error * error, 0) / errors.length <= 1
      && errors[Math.floor(errors.length * 0.95)] <= 1.8;
  }

  submit(stroke, { cancelled = false } = {}) {
    const groupIndex = this.currentGroup();
    const user = stroke.map((p) => ({ x: p.x * this.width, y: p.y * this.height }));
    let result = { status: 'rejected', reason: cancelled ? 'interrupted' : 'stroke', index: this.nextIndex() };
    if (!cancelled && groupIndex >= 0 && user.length && user.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      const available = this.groups[groupIndex].indexes.filter((index) => !this.accepted.has(index));
      const candidates = (this.strict ? available.slice(0, 1) : available)
        .map((index) => this.match(user, index, groupIndex)).filter(Boolean).sort((a, b) => a.error - b.error);
      if (candidates[0]) {
        const { reason, mse, ratio, traversalError } = candidates[0];
        result = { ...result, reason, mse, ratio, traversalError };
      }
      for (const candidate of candidates) {
        if (!candidate.fits) continue;
        if (!this.relationsFit(candidate, groupIndex)) {
          result.reason = 'connections';
          continue;
        }
        if (!this.shapeFits(candidate, groupIndex)) {
          result.reason = 'shape';
          continue;
        }
        result = { ...candidate, user, status: 'accepted', groupIndex };
        this.accepted.set(candidate.index, result);
        this.groupChecks.set(groupIndex, true);
        break;
      }
    }
    this.attempts.push(result);
    return result;
  }

  snapshot() {
    const pathCoverage = this.routes.map((_, i) => this.accepted.has(i) ? 1 : 0);
    const complete = this.routes.length > 0 && this.accepted.size === this.routes.length;
    return {
      hasInk: this.accepted.size > 0, allRequired: complete,
      recognizable: complete && this.groups.every((_, i) => this.groupChecks.get(i)),
      completion: this.accepted.size / Math.max(1, this.routes.length), pathCoverage,
      acceptedCount: this.accepted.size, rejectedCount: this.attempts.filter((a) => a.status === 'rejected').length,
      nextStroke: this.nextIndex(), lastStatus: this.attempts.at(-1)?.status ?? null,
      lastReason: this.attempts.at(-1)?.reason ?? null,
      lastMse: this.attempts.at(-1)?.mse ?? null,
      lastLengthRatio: this.attempts.at(-1)?.ratio ?? null,
      lastTraversalError: this.attempts.at(-1)?.traversalError ?? null,
    };
  }
}
