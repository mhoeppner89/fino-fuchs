/** Sequential pen-stroke acceptance. All distances scale with the symbol. */
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (points) => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const mean = (points) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});
const PROFILES = Object.freeze({
  // p95: the whole-stroke outlier clause allows this multiple of the band for
  // the worst 5% of samples (a wobbly stretch must not sink a good stroke).
  // mse: how far the RMSE may sit outside the band on this level — easy gives
  // a beginner's constant slight offset room, hard demands on-line ink.
  // smooth: samples averaged on each side when measuring the pen-path length
  // ratio, so per-point jitter cannot inflate the length of a straight line.
  // endpointMult kept at the historical 1.5: looser anchors let a V's
  // diagonal land inside a U's stem and pass as it — the coverage gate
  // below guards that instead.
  easy: { band: 0.13, dot: 0.14, join: 0.12, minLength: 0.50, maxLength: 2.8, p95: 2.4, mse: 1.15, smooth: 5, simplify: 0.06, endpointMult: 1.5 },
  medium: { band: 0.09, dot: 0.11, join: 0.08, minLength: 0.60, maxLength: 2.0, p95: 2.0, mse: 1.1, smooth: 3, simplify: 0.045, endpointMult: 1.5 },
  hard: { band: 0.055, dot: 0.085, join: 0.045, minLength: 0.70, maxLength: 1.65, p95: 1.8, mse: 1.0, smooth: 0, simplify: 0.03, endpointMult: 1.5 },
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

// Uniform arc-length resampling makes structural analysis independent of the
// browser's point density (fast swipes produce sparse rings, slow wiggles
// dense ones — and corner counting must not depend on either).
// Light moving average along a densely resampled path. Used symmetrically on
// the route and the user path so per-point sampling jitter (which inflates
// every segment) cancels out of the length ratio, while legitimate sharp
// geometry (a motor zigzag) shrinks on BOTH sides and keeps its ratio.
function smoothPath(points, half) {
  if (points.length < 5 || half < 1) return points;
  return points.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(points.length - 1, i + half);
    let sx = 0, sy = 0;
    for (let k = from; k <= to; k += 1) { sx += points[k].x; sy += points[k].y; }
    return { x: sx / (to - from + 1), y: sy / (to - from + 1) };
  });
}

function resampleClosed(points, spacing) {
  const ring = points.length > 1 && distance(points[0], points.at(-1)) <= 1e-9 ? points.slice(0, -1) : points;
  if (ring.length < 3 || spacing <= 0) return ring;
  const lengths = ring.map((_, i) => distance(ring[i], ring[(i + 1) % ring.length]));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  if (total < 1e-9) return ring;
  const count = Math.max(12, Math.min(256, Math.round(total / spacing)));
  const out = [];
  let edge = 0, edgeStart = 0;
  for (let i = 0; i < count; i += 1) {
    const target = total * i / count;
    while (edge < ring.length - 1 && edgeStart + lengths[edge] < target) { edgeStart += lengths[edge]; edge += 1; }
    const a = ring[edge], b = ring[(edge + 1) % ring.length];
    const t = (target - edgeStart) / (lengths[edge] || 1);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// Radial signature of a closed contour: mean radius per angular bin from the
// centroid, normalised. Density-independent (uniform resampling first) and
// wobble-stable (each bin averages many samples), yet it separates a circle
// from a square, one bump from two (B vs D), and a heart's notch — the
// structural signals Douglas-Peucker corner counting kept flipping on.
function radialSignature(points, size, bins = 72) {
  // Resample relative to the CONTOUR's own extent, not the enclosing
  // group: a sun's ring is a fraction of the glyph the rays span, and
  // spacing derived from the group size left the small ring with fewer
  // samples than angular bins — empty bins (radius 0) poisoned every
  // comparison.
  void size;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
  const dense = resampleClosed(points, Math.max(extent / 128, extent * 0.01));
  if (dense.length < 8) return null;
  const cx = dense.reduce((sum, p) => sum + p.x, 0) / dense.length;
  const cy = dense.reduce((sum, p) => sum + p.y, 0) / dense.length;
  const radii = Array(bins).fill(0);
  const counts = Array(bins).fill(0);
  for (const p of dense) {
    const angle = Math.atan2(p.y - cy, p.x - cx);
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * bins)));
    radii[bin] += Math.hypot(p.x - cx, p.y - cy);
    counts[bin] += 1;
  }
  const maxR = Math.max(...radii.map((sum, i) => (counts[i] ? sum / counts[i] : 0))) || 1;
  return radii.map((sum, i) => (counts[i] ? sum / counts[i] / maxR : 0));
}

// Best alignment over all rotations (a closed shape may start anywhere).
function signatureDistance(a, b) {
  if (!a || !b) return 0;
  const n = a.length;
  let best = Infinity;
  for (let shift = 0; shift < n; shift += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = a[i] - b[(i + shift) % n];
      sum += d * d;
    }
    best = Math.min(best, sum / n);
  }
  return Math.sqrt(best);
}

// Circular moving average over an already uniformly resampled ring; the
// window is given in pixels so the smoothing radius is density-independent.
function smoothClosedRing(points, windowPx) {
  if (points.length < 5 || windowPx <= 0) return points;
  const k = Math.max(1, Math.round(windowPx));
  // The window may exceed the ring length (short raw routes): index with a
  // double modulo so negative offsets wrap instead of reading undefined.
  return points.map((_, i) => {
    let x = 0, y = 0;
    for (let d = -k; d <= k; d += 1) {
      const p = points[(((i + d) % points.length) + points.length) % points.length];
      x += p.x; y += p.y;
    }
    return { x: x / (2 * k + 1), y: y / (2 * k + 1) };
  });
}

function closedStructure(points, size, snapTolerance = size * 0.025, smoothingPx = 0, toleranceFraction = 0.10) {
  // Corner counting uses a deliberately coarse structural tolerance (10% of
  // the glyph) far away from the threshold where a circle's chord count
  // flips: near-identical rings then simplify to identical vertex sets, so
  // in-band wobble cannot invent or erase a corner. The tolerance is the
  // same for template and trace and does not scale with difficulty — a
  // circle is a circle on every level.
  const tolerance = size * toleranceFraction;
  // A child closing a contour ends the pen near — not exactly on — the start
  // point. That small gap is a closure artifact, not a structural corner:
  // snap it shut (at the same forgiveness the join check allows) before
  // simplifying when it sits inside the snap band.
  const outline = points.length > 2 && distance(points[0], points.at(-1)) <= snapTolerance
    ? points.slice(0, -1)
    : points;
  const dense = resampleClosed(outline, Math.max(size / 128, tolerance / 3));
  const smoothed = smoothingPx > 0 ? smoothClosedRing(dense, smoothingPx / Math.max(size / 128, tolerance / 3)) : dense;
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
  const ring = simplify([...smoothed, smoothed[0]]).slice(0, -1);
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
    // Per-point sampling jitter inflates a pen path's length (every tiny zig
    // adds length even when the drawn line is straight). Measuring the ratio
    // on equally smoothed route and path cancels that noise while a real
    // detour or an extra loop keeps its length on both sides alike.
    const smoothing = this.profile.smooth;
    let path = user;
    let routePath = route;
    if (smoothing > 0 && user.length > 2) {
      const dense = sampleStroke(user, 129);
      const half = Math.max(1, Math.min(smoothing, Math.floor(dense.length / 12)));
      path = smoothPath(dense, half);
      routePath = smoothPath(sampleStroke(route, 129), half);
    }
    const ratio = length(path) / length(routePath);
    if (ratio < this.profile.minLength - 1e-9 || ratio > this.profile.maxLength + 1e-9) {
      return { fits: false, index, error: Infinity, ratio, reason: 'length' };
    }
    const tolerance = Math.min(group.size * this.profile.band, Math.max(group.size * 0.025, expectedLength * 0.75));
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
    // Closest-line MSE is the geometry score; the level's mse allowance
    // gives a constant slight offset room on easy, and the p95 clause lets a
    // short wobbly stretch (the worst 5% of samples) exceed the band by the
    // profile's outlier multiple instead of failing the whole stroke.
    const shapeFits = error <= this.profile.mse && sorted[Math.floor(sorted.length * 0.95)] <= tolerance * this.profile.p95;
    const complete = endpoints <= tolerance * this.profile.endpointMult && closure;
    const alignment = shapeFits && complete ? alignedTraversal(expected, sampled, closed, this.strict) : null;
    // Closest-line MSE is the geometry score. A loose monotone traversal
    // bound also requires visiting the major parts (e.g. both humps of m).
    const traversalError = alignment ? Math.sqrt(alignment.cost / expected.length) / tolerance : Infinity;
    // A bare 2-point route is a straight segment: its DTW traversal bound
    // carries no structure beyond the endpoints (which the anchor check
    // already pins), yet a coherent whole-glyph rotation displaces short
    // rays far enough to break it. Judge segments by endpoints + band only.
    const traversalFits = traversalError <= 1.2 || route.length <= 2;
    const directionFits = alignment?.directionFits ?? true;
    // Coverage: the fraction of the taught path that sits within one band of
    // the ink. RMSE dilutes an uncovered stretch across the whole stroke (a
    // V's shallow arc vanishes inside a U's bowl); coverage does not —
    // every part of the template must actually be drawn. The demand scales
    // with the length ratio, so a deliberately partial stroke (a fragment
    // at easy, the tail of a joined pen movement) is judged by the ink it
    // claims, and full-length ink must cover essentially the whole path.
    // The coverage radius extends slightly past the band (1.2×): a wobbly
    // stretch forgiven by the p95 clause peaks ~1.2 bands off the line, and
    // coverage must not strip what the geometry score forgives — while a
    // different glyph (a V against U's bowl) still leaves most of the path
    // uncovered at that radius.
    const coverageRadius = tolerance * 1.2;
    const covered = expected.filter((p) => routeDistance(p, user) <= coverageRadius).length / expected.length;
    const coverageFits = covered >= Math.min(0.85, ratio);
    return { fits: shapeFits && complete && directionFits && traversalFits && coverageFits, index, normalized: sampled,
      geometry: user, error, mse: mse / tolerance ** 2, ratio, traversalError, coverage: covered,
      reason: !directionFits ? 'direction' : !complete ? 'incomplete' : !traversalFits ? 'traversal'
        : !coverageFits ? 'coverage' : 'stroke' };
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
      // The drawn endpoint is compared to the other stroke's DRAWN ink: a
      // coherent whole-glyph drift (rotation/shift) moves both parts
      // together and must not fail the join. Two endpoints wobble
      // independently within their bands, so the honest gap reaches
      // ~1.4×band; 1.35×band covers the observed honest maximum (1.07×band
      // under the jitter suite) while a lifted restart further along the
      // template line (1.73×band) still fails.
      const allowedGap = group.size * this.profile.band * 1.35;
      // Only actual strokes can form a join. Check endpoint attachments near
      // the child's lines, not same-index samples or imaginary future strokes.
      for (const [expected, actual, otherExpected, otherActual] of [
        [expectedNew, candidate.geometry, expectedOld, oldPoints],
        [expectedOld, oldPoints, expectedNew, candidate.geometry],
      ]) {
        for (const [target, index] of [[expected[0], 0], [expected.at(-1), actual.length - 1]]) {
          const targetGap = routeDistance(target, otherExpected);
          if (targetGap > contact) continue;
          // In taught order the template endpoint pairs with the matching
          // end of the drawn ink. With order freedom the pen may traverse
          // either way, so the ink end that actually sits at the junction
          // (the nearer one) is the honest pairing.
          const other = actual.length - 1 - index;
          const point = !this.strict && distance(actual[other], target) < distance(actual[index], target)
            ? actual[other]
            : actual[index];
          if (routeDistance(point, otherActual) > targetGap + allowedGap) return false;
          // A lifted restart skips the first stretch of the candidate's own
          // template line: its junction endpoint sits INTO the body (along
          // the line toward the other endpoint) while sitting nearly ON the
          // line (tiny perpendicular offset). Honest whole-glyph drift is
          // 2-dimensional, so it never looks like a continuation. Checked
          // independently of the gap budget because an in-band restart gap
          // overlaps honest jitter gaps.
          if (expected.length > 1) {
            const anchor = index === 0 ? expected[1] : expected[expected.length - 2];
            const dx = anchor.x - target.x;
            const dy = anchor.y - target.y;
            const len = Math.hypot(dx, dy);
            if (len > 1e-9) {
              const ox = point.x - target.x;
              const oy = point.y - target.y;
              const along = (ox * dx + oy * dy) / len;
              const perp = Math.abs(ox * -dy + oy * dx) / len;
              const band = group.size * this.profile.band;
              if (along > band * 1.1 && perp <= band * 0.25) return false;
            }
          }
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
        // Structural identity of closed contours, two signals:
        // 1) Corner counting at the coarse shared tolerance — decisive for
        //    cornered shapes (a pentagon must not pass as a circle), but
        //    only enforced when the TEMPLATE has a stable corner count,
        //    because a wobbly trace's count is the unstable one.
        // 2) The radial signature (rotation-searched) guards the smooth
        //    contours corner counting flips on, catching bump/notch
        //    structure (heart) that pure geometry can blur.
        const snap = group.size * this.profile.join;
        // Structural identity of the closed contour, two signals:
        // 1) For pure polygons (cornered template, no notches) the corner
        //    count is stable on both sides and separates near-polygons
        //    (pentagon vs hexagon) that signatures barely distinguish.
        // 2) Otherwise the rotation-searched radial signature captures
        //    bump/notch structure stably under wobble, where corner
        //    counting kept flipping (circle chords, heart notch).
        const target = closedStructure(expected[i], group.size);
        const drawn = closedStructure(actual[i], group.size);
        void target;
        void drawn;        // Corner identity is only decisive when BOTH contours hold one
        // dominant corner count across a sweep of structural tolerances:
        // crisp polygons (square, pentagon, hexagon) do, so a pentagon
        // cannot pass as a hexagon. Template features near the tolerance
        // scale (balloon tail, heart lobes, circle chords) flip their count
        // under in-band wobble — those shapes are guarded by the radial
        // signature and the band geometry instead.
        const FRACTIONS = [0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13];
        // Both contours are smoothed with the SAME operator (at the
        // structural scale) before counting: hand wobble then cancels on
        // both sides alike, and a counted difference reflects a real shape
        // difference — not which side carried more sampling noise.
        const smoothing = group.size * 0.03;
        const cornerMode = (points) => {
          const counts = FRACTIONS.map((fraction) => closedStructure(points, group.size, undefined, smoothing, fraction).corners);
          const tally = new Map();
          counts.forEach((c) => tally.set(c, (tally.get(c) ?? 0) + 1));
          let mode = null, best = 0;
          for (const [c, n] of tally) if (n > best) { mode = c; best = n; }
          return { mode, share: best / FRACTIONS.length, counts };
        };
        const templateCorners = cornerMode(expected[i]);
        const drawnCorners = cornerMode(actual[i]);
        // Corner identity, two branches by the TEMPLATE's own stability:
        // - A cornered template (stable count >= 3) is matched EXACTLY when
        //   the trace is stable too (pentagon != hexagon), and within one
        //   phantom vertex when wobble makes the trace's count flicker
        //   (wobble can add a DP vertex, never remove a real corner).
        // - A smooth template (stable count < 3: circle, oval) must not be
        //   satisfied by a STABLE polygon (square/pentagon/hexagon as circle).
        // - Unstable templates (balloon tail, castle battlements) are guarded
        //   by the radial signature below.
        if (templateCorners.share === 1 && templateCorners.mode >= 3) {
          if (drawnCorners.share === 1) {
            if (drawnCorners.mode !== templateCorners.mode) return false;
          } else {
            // The wobbled trace's count flickers, so corner identity is
            // judged as a distribution over the tolerance sweep: how far,
            // per tolerance, does the trace's corner count sit from the
            // template's? In-band wobble of the SAME shape shifts the count
            // by at most one in one tolerance (a present traces 4,4,4,4,4,4,3
            // → 0.14); a DIFFERENT shape (heart as pentagon, balloon as
            // kite) keeps the wrong structure in most tolerances (≥ 0.85).
            const drift = drawnCorners.counts.reduce((sum, c) => sum + Math.abs(c - templateCorners.mode), 0) / FRACTIONS.length;
            if (drift > 0.5) return false;
          }
        } else if (templateCorners.share === 1 && templateCorners.mode < 3) {
          if (drawnCorners.share === 1 && drawnCorners.mode >= 3) return false;
        }
        // Notch identity: a convex template (no concave vertex at any
        // tolerance) must not be satisfied by a contour WITH a notch — the
        // heart's cleft reads as one notch at every viewport and fraction,
        // while every convex template keeps 0 and honest traces of them do
        // too (star carries its real five). The reverse is not enforced:
        // wobble may carve phantom concavities into an honest trace of a
        // notched template, and the corner branches already police the
        // counts of stable cornered shapes.
        const templateNotches = FRACTIONS.map((fraction) => closedStructure(expected[i], group.size, undefined, smoothing, fraction).notches);
        const drawnNotches = FRACTIONS.map((fraction) => closedStructure(actual[i], group.size, undefined, smoothing, fraction).notches);
        if (Math.max(...templateNotches) === 0 && Math.max(...drawnNotches) > 0) return false;
        const ringExtent = bounds(actual[i]).size;
        // Small decorative rings (flower petals) are held by the band
        // geometry alone; the signature there is wobble noise.
        if (ringExtent >= group.size * 0.4) {
          // When the TEMPLATE's own corner count is tolerance-unstable
          // (smooth contours: circle, oval, heart lobes, balloon tail),
          // corner counting cannot discriminate. There the rotation-searched
          // radial signature takes over, computed after the SAME smoothing
          // on both sides. The moving-average window scales with the RING's
          // own sample count (a fixed pixel window erases real corners at
          // one size and does nothing at another): hand wobble cancels
          // alike on both sides, so the distance reflects real bump/notch
          // structure differences. Self-wobble tops out at ~0.067 across
          // the shipped shapes; the nearest impostor pair sits at 0.087.
          // The gate fires when the TEMPLATE's own corner count is
          // tolerance-unstable (smooth contours: circle, oval; wobbly
          // templates: balloon tail, castle battlements). A cornered stable
          // template is handled by the corner-distribution check above.
          // Self-wobble tops out at ~0.069 across the shipped shapes; the
          // nearest impostor pair with an unstable template sits at 0.075.
          if (templateCorners.share < 1 || templateCorners.mode < 3) {
            const signatureRing = (route) => {
              const ring = sampleStroke(route);
              return smoothClosedRing(ring, Math.max(1, Math.round(ring.length * 0.06)));
            };
            const signature = signatureDistance(
              radialSignature(signatureRing(expected[i]), group.size),
              radialSignature(signatureRing(actual[i]), group.size),
            );
            if (signature > 0.075) return false;
          }
        }
        // A circle/oval or square/rectangle still needs its defining
        // proportion. Measured from the contour's principal axes (covariance
        // eigenvalues of a uniform resample), which is rotation-invariant:
        // an axis-aligned bounding box stretches by (cos+sin)/(sin+cos) under
        // a child's whole-glyph rotation, which legitimately crushed a wide
        // car window from 3.3 to 2.5 and failed honest traces.
        const axisAspect = (route) => {
          const dense = sampleStroke(route, 65);
          const cx = dense.reduce((s, p) => s + p.x, 0) / dense.length;
          const cy = dense.reduce((s, p) => s + p.y, 0) / dense.length;
          let sxx = 0, syy = 0, sxy = 0;
          for (const p of dense) {
            const dx = p.x - cx, dy = p.y - cy;
            sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
          }
          sxx /= dense.length; syy /= dense.length; sxy /= dense.length;
          const mid = (sxx + syy) / 2;
          const spread = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
          const minor = Math.max(1e-9, mid - spread);
          return Math.sqrt((mid + spread) / minor);
        };
        const proportion = axisAspect(actual[i]) / axisAspect(expected[i]);
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
    // The pooled silhouette ignores the worst 5% of sample distances (the
    // same profile outlier clause as a single stroke): offsets that
    // accumulated across several strokes must not sum into a rejection when
    // each stroke individually sat in its guide band.
    const pooled = errors.slice(0, Math.max(1, Math.floor(errors.length * 0.95)));
    const meanSquared = pooled.reduce((sum, error) => sum + error * error, 0) / pooled.length;
    return meanSquared <= this.profile.mse
      && pooled[Math.floor(pooled.length * 0.95)] <= this.profile.p95;
  }

  matchJoined(user, groupIndex, available) {
    const group = this.groups[groupIndex];
    const original = this.accepted;
    const sampled = sampleStroke(user, 129);
    // Try only consecutive, connected teaching parts. Dots remain separate
    // marks. Every part must pass before any part of this pen movement counts.
    let budget = 96;
    const search = (index, offset, parts) => {
      if (budget <= 0 || this.routes[index].length === 1) return null;
      const accept = (points) => {
        budget -= 1;
        const part = this.match(points, index, groupIndex);
        return part?.fits && this.relationsFit(part, groupIndex) && this.shapeFits(part, groupIndex)
          ? { ...part, user: points, groupIndex, status: 'accepted' } : null;
      };
      if (parts.length) {
        const last = accept(sampled.slice(offset));
        if (last) return [...parts, last];
      }
      const position = group.indexes.indexOf(index);
      const next = group.indexes[position + 1];
      if (!available.includes(next) || this.routes[next].length === 1) return null;
      const end = this.routes[index].at(-1), start = this.routes[next][0];
      if (distance(end, start) > group.size * this.profile.join * 2) return null;
      const candidates = [];
      for (let cut = offset + 4; cut < sampled.length - 4; cut += 1) {
        candidates.push({ cut, gap: distance(sampled[cut], end) + distance(sampled[cut], start) });
      }
      const cuts = [];
      for (const candidate of candidates.sort((a, b) => a.gap - b.gap)) {
        if (cuts.every((cut) => Math.abs(cut - candidate.cut) >= 3)) cuts.push(candidate.cut);
        if (cuts.length === 5) break;
      }
      for (const cut of cuts) {
        const part = accept(sampled.slice(offset, cut + 1));
        if (!part) continue;
        this.accepted.set(index, part);
        const result = search(next, cut, [...parts, part]);
        this.accepted.delete(index);
        if (result) return result;
      }
      return null;
    };
    this.accepted = new Map(original);
    try {
      for (const index of this.strict ? available.slice(0, 1) : available) {
        const parts = search(index, 0, []);
        if (parts) return parts;
      }
      return null;
    } finally {
      this.accepted = original;
    }
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
      if (result.status !== 'accepted' && available.length > 1) {
        const parts = this.matchJoined(user, groupIndex, available);
        if (parts) {
          for (const part of parts) this.accepted.set(part.index, part);
          this.groupChecks.set(groupIndex, true);
          result = { ...parts.at(-1), user, indices: parts.map((part) => part.index), parts, reason: 'joined' };
        }
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
