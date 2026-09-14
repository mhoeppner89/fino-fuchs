/** Sequential pen-stroke acceptance. All distances scale with the symbol. */
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (points) => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const mean = (points) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});
const PROFILES = Object.freeze({
  easy: { band: 0.085, dot: 0.12, join: 0.075, minLength: 0.72, maxLength: 1.8 },
  medium: { band: 0.06, dot: 0.10, join: 0.05, minLength: 0.78, maxLength: 1.6 },
  hard: { band: 0.04, dot: 0.08, join: 0.035, minLength: 0.84, maxLength: 1.45 },
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

function closedCornerCount(points, size) {
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
  return ring.reduce((count, p, i) => {
    const previous = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
    const ax = p.x - previous.x, ay = p.y - previous.y;
    const bx = next.x - p.x, by = next.y - p.y;
    const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
    const angle = denominator > 1e-9 ? Math.acos(clamp((ax * bx + ay * by) / denominator, -1, 1)) : 0;
    return count + Number(angle >= 50 * Math.PI / 180);
  }, 0);
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

function variants(samples, closed, strict) {
  if (strict) return [samples];
  if (!closed) return [samples, [...samples].reverse()];
  const ring = samples.slice(0, -1);
  return [ring, [...ring].reverse()].flatMap((direction) => direction.map((_, offset) => {
    const shifted = [...direction.slice(offset), ...direction.slice(0, offset)];
    return [...shifted, shifted[0]];
  }));
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
      return { fits: false, index, error: Infinity, reason: 'stroke' };
    }
    const tolerance = Math.min(group.size * this.profile.band, Math.max(group.size * 0.012, expectedLength * 0.20));
    const closed = distance(route[0], route.at(-1)) <= group.size * 0.018;
    const expected = sampleStroke(route, closed ? 129 : 65);
    const sampled = sampleStroke(user, expected.length);
    let best = null;
    for (const oriented of variants(sampled, closed, this.strict)) {
      const normalized = oriented;
      const distances = expected.map((p, i) => distance(p, normalized[i]));
      const mse = distances.reduce((sum, d) => sum + d * d, 0) / distances.length;
      const error = Math.sqrt(mse) / tolerance;
      if (best && best.error <= error) continue;
      const ratio = rawRatio;
      const sorted = [...distances].sort((a, b) => a - b);
      const endpoints = Math.max(distances[0], distances.at(-1));
      const closure = !closed || distance(normalized[0], normalized.at(-1)) <= group.size * this.profile.join;
      const fits = error <= 1 && sorted[Math.floor(sorted.length * 0.95)] <= tolerance * 1.8
        && sorted.at(-1) <= tolerance * 2.5 && endpoints <= tolerance * 1.5
        && ratio >= this.profile.minLength && ratio <= this.profile.maxLength && closure;
      best = { fits, index, normalized: closed ? normalized.filter((_, i) => i % 2 === 0) : normalized,
        geometry: user,
        error, ratio, reason: 'stroke' };
    }
    return best;
  }

  relationsFit(candidate, groupIndex) {
    const group = this.groups[groupIndex];
    const entries = [...this.accepted.values()].filter((entry) => group.indexes.includes(entry.index));
    // Protect future junctions too: accepting a malformed attachment point
    // must not make a later correctly traced stroke impossible to accept.
    if (this.routes[candidate.index].length > 1) {
      const expected = sampleStroke(this.routes[candidate.index]);
      const contact = group.size * 0.009;
      const allowedGap = group.size * this.profile.join;
      for (const index of group.indexes) {
        if (index === candidate.index || this.accepted.has(index) || this.routes[index].length === 1) continue;
        const future = this.routes[index];
        for (let i = 0; i < expected.length; i += 1) {
          const gap = routeDistance(expected[i], future);
          if (gap <= contact && routeDistance(candidate.normalized[i], future) > gap + allowedGap) return false;
        }
        for (const point of sampleStroke(future)) {
          const gap = routeDistance(point, this.routes[candidate.index]);
          if (gap <= contact && routeDistance(point, candidate.geometry) > gap + allowedGap) return false;
        }
      }
    }
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
      // Check the actual junction, not just whether two strokes touch somewhere.
      for (const [expected, actual, otherExpected, otherActual] of [
        [sampleStroke(expectedNew), candidate.normalized, expectedOld, oldPoints],
        [sampleStroke(expectedOld), previous.normalized, expectedNew, candidate.geometry],
      ]) {
        for (let i = 0; i < expected.length; i += 1) {
          const targetGap = routeDistance(expected[i], otherExpected);
          if (targetGap <= contact && routeDistance(actual[i], otherActual) > targetGap + allowedGap) return false;
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
    if (this.task.category === 'shapes' && this.routes.length === 1
      && distance(expected[0][0], expected[0].at(-1)) <= group.size * 0.018) {
      const targetCorners = closedCornerCount(expected[0], group.size);
      const drawnCorners = closedCornerCount(actual[0], group.size);
      if (targetCorners === 0 ? drawnCorners > 2 : drawnCorners !== targetCorners) return false;
    }
    const tolerance = group.size * this.profile.band;
    const errors = [];
    for (const [source, target] of [[expected, actual], [actual, expected]]) {
      for (const route of source) for (const point of sampleStroke(route)) {
        errors.push(Math.min(...target.map((other) => routeDistance(point, other))) / tolerance);
      }
    }
    errors.sort((a, b) => a - b);
    return errors.reduce((sum, error) => sum + error * error, 0) / errors.length <= 0.85
      && errors[Math.floor(errors.length * 0.95)] <= 1.5;
  }

  submit(stroke, { cancelled = false } = {}) {
    const groupIndex = this.currentGroup();
    const user = stroke.map((p) => ({ x: p.x * this.width, y: p.y * this.height }));
    let result = { status: 'rejected', reason: cancelled ? 'interrupted' : 'stroke', index: this.nextIndex() };
    if (!cancelled && groupIndex >= 0 && user.length && user.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      const available = this.groups[groupIndex].indexes.filter((index) => !this.accepted.has(index));
      const candidates = (this.strict ? available.slice(0, 1) : available)
        .map((index) => this.match(user, index, groupIndex)).filter(Boolean).sort((a, b) => a.error - b.error);
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
    };
  }
}
