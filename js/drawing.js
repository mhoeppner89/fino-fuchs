/** Canvas input, rendering, and forgiving local handwriting scoring. */

import {
  CHARACTER_TEMPLATE_SHEETS,
  characterTemplateCrop,
} from './handwriting-template-data.js';
import { characterStrokeGeometry } from './handwriting-stroke-data.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DEMO_JUMP_UNITS = 0.42;
const REQUIRED_PATH_COVERAGE = 0.8;
export const DEMO_SPEED_MULTIPLIER = 1.5;
export const INK_COLORS = Object.freeze(['#284B73', '#C75C7B', '#2A9D8F', '#9A63BA', '#DD8530']);
// The guide remains easy to find at every difficulty. Difficulty comes from
// scoring, not from making the practice path disappear into the background.
export const GUIDE_STYLES = Object.freeze({
  easy: Object.freeze({ width: 0.021, min: 10, max: 17, dash: [2, 22], alpha: 0.78, color: '#5BACC0' }),
  medium: Object.freeze({ width: 0.015, min: 7, max: 12, dash: [9, 12], alpha: 0.68, color: '#69AFC0' }),
  hard: Object.freeze({ width: 0.01, min: 5, max: 8, dash: [5, 13], alpha: 0.58, color: '#78ADBB' }),
});

// Letter, number, and name exercises use a quiet solid handwriting template
// instead of a dotted route. The same centre lines remain the source of truth
// for Fino's route and the generous scoring corridor.
export const TEMPLATE_STYLES = Object.freeze({
  easy: Object.freeze({ width: 0.058, min: 26, max: 42, alpha: 0.29, color: '#3E7F95' }),
  medium: Object.freeze({ width: 0.054, min: 24, max: 38, alpha: 0.24, color: '#3E7F95' }),
  hard: Object.freeze({ width: 0.05, min: 22, max: 34, alpha: 0.2, color: '#3E7F95' }),
});

export function guidePresentationForTask(task, assist = 'easy') {
  const template = ['letters', 'numbers', 'name'].includes(task?.category);
  const style = template
    ? TEMPLATE_STYLES[assist] ?? TEMPLATE_STYLES.easy
    : GUIDE_STYLES[assist] ?? GUIDE_STYLES.easy;
  return Object.freeze({ ...style, dash: template ? [] : style.dash, template });
}

export function inkColorAt(strokeIndex) {
  return INK_COLORS[strokeIndex % INK_COLORS.length];
}

export function drawingBounds(width, height) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  // Tasks are uniformly reflowed to the actual board before rendering. Using
  // the whole measured rectangle here removes the old fixed landscape band on
  // portrait screens without stretching their individual letters or shapes.
  return { x: 0, y: 0, width: safeWidth, height: safeHeight };
}

function toPixels(point, width, height) {
  const bounds = drawingBounds(width, height);
  return { x: bounds.x + point.x * bounds.width, y: bounds.y + point.y * bounds.height };
}

function toNormalized(point, width, height) {
  const bounds = drawingBounds(width, height);
  return {
    x: clamp((point.x - bounds.x) / bounds.width, 0, 1),
    y: clamp((point.y - bounds.y) / bounds.height, 0, 1),
  };
}

function pixelBoundsForStrokes(strokes, width, height) {
  const points = strokes.flat().map((point) => toPixels(point, width, height));
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    minX, maxX, minY, maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function characterTemplatePlacement(bounds, crop, geometry) {
  if (!bounds || !crop || !geometry) return null;
  const scaleX = bounds.width / Math.max(1, geometry.routeWidth);
  const scaleY = bounds.height / Math.max(1, geometry.routeHeight);
  // A one-pixel source span is a synthetic bound for a perfectly vertical or
  // horizontal centre line (notably lowercase i). It cannot determine image
  // scale, so use the other axis. For ordinary glyphs, averaging only absorbs
  // sub-pixel rounding from the generated JS data.
  const horizontalScaleIsReliable = geometry.routeWidth > 1.5 && bounds.width > 1.5;
  const verticalScaleIsReliable = geometry.routeHeight > 1.5 && bounds.height > 1.5;
  const scale = horizontalScaleIsReliable && verticalScaleIsReliable
    ? (scaleX + scaleY) / 2
    : horizontalScaleIsReliable ? scaleX : scaleY;
  return {
    x: bounds.minX - geometry.routeX * scale,
    y: bounds.minY - geometry.routeY * scale,
    width: crop.width * scale,
    height: crop.height * scale,
    scale,
    scaleDifference: horizontalScaleIsReliable && verticalScaleIsReliable ? Math.abs(scaleX - scaleY) : 0,
    horizontalScaleIsReliable,
    verticalScaleIsReliable,
  };
}

function templateSymbolsForTask(task) {
  return [...String(task?.label ?? '').replace(/\s/g, '')];
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

function bandCoverage(samples, targetStrokes, tolerance) {
  if (!samples.length || !targetStrokes.length) return 0;
  const matches = samples.filter((sample) => minDistanceToStrokes(sample, targetStrokes) <= tolerance).length;
  return matches / samples.length;
}

function longestUncoveredRun(samples, targetStrokes, tolerance) {
  if (!samples.length || !targetStrokes.length) return 1;
  let longest = 0;
  let current = 0;
  samples.forEach((sample) => {
    if (minDistanceToStrokes(sample, targetStrokes) <= tolerance) {
      longest = Math.max(longest, current);
      current = 0;
    } else {
      current += 1;
    }
  });
  return Math.max(longest, current) / samples.length;
}

function pixelPolylineLength(points) {
  return points.reduce((sum, point, index) => (
    index ? sum + distance(points[index - 1], point) : sum
  ), 0);
}

function pointStrokes(points) {
  return points.map((point) => [point]);
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

function nearestDistanceMetrics(samples, targetStrokes, tolerance, cap = 2.5) {
  if (!samples.length || !targetStrokes.length) {
    return { coverage: 0, mse: cap ** 2, distances: samples.map(() => Infinity) };
  }
  const distances = samples.map((sample) => minDistanceToStrokes(sample, targetStrokes));
  const coverage = distances.filter((value) => value <= tolerance).length / distances.length;
  const mse = distances.reduce((sum, value) => {
    const normalized = Math.min(cap, value / Math.max(1, tolerance));
    return sum + normalized ** 2;
  }, 0) / distances.length;
  return { coverage, mse, distances };
}

function groupOwnedUserSamples(expectedPixels, groups, userSamplesByStroke, margin) {
  const groupTargets = groups.map((indexes) => indexes.map((index) => expectedPixels[index]));
  const owned = groups.map(() => []);
  userSamplesByStroke.forEach((strokeSamples) => {
    if (!strokeSamples.length) return;
    const distances = strokeSamples.map((sample) => groupTargets.map((targets) => (
      minDistanceToStrokes(sample, targets)
    )));
    const averageDistances = groupTargets.map((_, groupIndex) => (
      distances.reduce((sum, row) => sum + row[groupIndex], 0) / strokeSamples.length
    ));
    const preferred = averageDistances.reduce((best, value, index) => (
      value < averageDistances[best] ? index : best
    ), 0);
    strokeSamples.forEach((sample, sampleIndex) => {
      const row = distances[sampleIndex];
      const local = row.reduce((best, value, index) => (value < row[best] ? index : best), 0);
      const owner = row[local] + margin < row[preferred] ? local : preferred;
      owned[owner].push(sample);
    });
  });
  return owned;
}

function alignedByMedianNearest(samples, targets, maximumShift) {
  if (!targets.length || !samples.length) return samples;
  const deltas = samples.map((sample) => {
    let nearest = targets[0];
    let bestDistance = distance(sample, nearest);
    for (let index = 1; index < targets.length; index += 1) {
      const value = distance(sample, targets[index]);
      if (value < bestDistance) {
        bestDistance = value;
        nearest = targets[index];
      }
    }
    return { x: nearest.x - sample.x, y: nearest.y - sample.y };
  });
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  let dx = median(deltas.map((delta) => delta.x));
  let dy = median(deltas.map((delta) => delta.y));
  const length = Math.hypot(dx, dy);
  if (length > maximumShift) {
    dx *= maximumShift / length;
    dy *= maximumShift / length;
  }
  return samples.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

/**
 * Returns a score in [0,1]. It intentionally tolerates child-like variation.
 */
export function evaluateDrawing(expectedStrokes, userStrokes, {
  width = 900,
  height = 620,
  tolerance = Math.min(width, height) * 0.105,
  completionTolerance = null,
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
      allRequired: false,
      componentCoverage: [],
      pathCoverage: expectedStrokes.map(() => 0),
      pathLongestGaps: expectedStrokes.map(() => 1),
      pathDensitySupport: expectedStrokes.map(() => 0),
      pathLongitudinalSupport: expectedStrokes.map(() => 0),
      targetMse: Infinity,
      userMse: Infinity,
      symmetricMse: Infinity,
      groupMetrics: [],
    };
  }

  const expectedSamplesByStroke = expectedStrokes.filter((stroke) => stroke.length).map((stroke) => resampleStroke(stroke, width, height, 6));
  const expectedSamples = expectedSamplesByStroke.flat();
  const userSamplesByStroke = userStrokes
    .filter((stroke) => stroke.length)
    .map((stroke) => resampleStroke(stroke, width, height, 6));
  const userSamples = userSamplesByStroke.flat();
  // Symmetric closest-line MSE prevents both classic one-way failures: a
  // tiny correct fragment cannot stand in for a whole glyph, and a long
  // scribble crossing the target cannot pass merely because it touched it.
  const targetMatch = nearestDistanceMetrics(expectedSamples, user, tolerance);
  const userMatch = nearestDistanceMetrics(userSamples, expected, tolerance);
  const coverage = targetMatch.coverage;
  const precision = userMatch.coverage;
  const targetMse = targetMatch.mse;
  const userMse = userMatch.mse;
  const symmetricMse = (targetMse + userMse) / 2;
  const groups = completionGroups?.length
    ? completionGroups.filter((group) => group.length && group.every((index) => expectedSamplesByStroke[index]))
    : [...strokeComponents(expected, expectedSamplesByStroke, tolerance).values()];
  const boardUnit = Math.min(drawingBounds(width, height).width, drawingBounds(width, height).height);
  const requiredPathTolerance = completionTolerance ?? clamp(boardUnit * 0.115, 26, 62);
  const groupTolerances = groups.map((indexes) => {
    const points = indexes.flatMap((index) => expectedSamplesByStroke[index]);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const span = Math.max(maxX - minX, maxY - minY);
    return Math.min(requiredPathTolerance, Math.max(12, span * 0.14));
  });
  const ownedSamplesByGroup = groupOwnedUserSamples(
    expected,
    groups,
    userSamplesByStroke,
    Math.max(5, Math.min(...groupTolerances) * 0.2),
  );
  const needsAlignment = symmetricMse > 0.0005;
  const alignedSamplesByGroup = groups.map((indexes, groupIndex) => {
    const targets = indexes.flatMap((index) => expectedSamplesByStroke[index]);
    const samples = ownedSamplesByGroup[groupIndex];
    // Median nearest-point displacement finds a coherent small translation.
    // Unlike centroid alignment it stays at zero when a bar or tail is simply
    // missing, so absent geometry cannot be manufactured by repositioning the
    // remaining strokes.
    return needsAlignment
      ? alignedByMedianNearest(samples, targets, groupTolerances[groupIndex] * 0.85)
      : samples;
  });
  // Within a character, each pen sample supports only the centre-line route
  // it is closest to.  This distinguishes nearby petals, bars and stems while
  // still allowing one continuous pen movement to cover several routes.
  const ownedSamplesByPath = expectedSamplesByStroke.map(() => []);
  groups.forEach((indexes, groupIndex) => {
    const sharedRouteMargin = Math.max(0.25, groupTolerances[groupIndex] * 0.08);
    alignedSamplesByGroup[groupIndex].forEach((sample) => {
      const distances = indexes.map((index) => minDistanceToStrokes(sample, [expected[index]]));
      const bestDistance = Math.min(...distances);
      indexes.forEach((index, localIndex) => {
        // At a real shared segment (for example the right side of a print a),
        // the same ink may legitimately support both teaching routes. A
        // narrow, scale-aware tie window keeps coherent corner strokes
        // together after a small translation. Longitudinal coverage below
        // still prevents a few intersection samples from standing in for a
        // whole nearby crossbar or petal.
        if (distances[localIndex] <= bestDistance + sharedRouteMargin) ownedSamplesByPath[index].push(sample);
      });
    });
  });
  const pathCoverage = expectedSamplesByStroke.map(() => 0);
  const pathLongestGaps = expectedSamplesByStroke.map(() => 1);
  const pathDensitySupport = expectedSamplesByStroke.map(() => 0);
  const pathLongitudinalSupport = expectedSamplesByStroke.map(() => 0);
  const groupMetrics = groups.map((indexes, groupIndex) => {
    const ownedPoints = pointStrokes(alignedSamplesByGroup[groupIndex]);
    const groupSamples = indexes.flatMap((index) => expectedSamplesByStroke[index]);
    const groupTolerance = groupTolerances[groupIndex];
    const groupMatch = nearestDistanceMetrics(groupSamples, ownedPoints, groupTolerance);
    indexes.forEach((index) => {
      const samples = expectedSamplesByStroke[index];
      const pathLength = pixelPolylineLength(samples);
      // Small neighbouring details (a crossbar, dot, flower petal, or tail)
      // need their own local band.  Otherwise a broad child-friendly glyph
      // band could let an adjacent line fill a detail that was never drawn.
      const pathTolerance = pathLength <= 12
        ? Math.min(groupTolerance, Math.max(10, groupTolerance * 0.72))
        : groupTolerance;
      const alignedPathSamples = needsAlignment
        ? alignedByMedianNearest(ownedSamplesByPath[index], samples, groupTolerance * 0.55)
        : ownedSamplesByPath[index];
      const pathPoints = pointStrokes(alignedPathSamples);
      const geometricCoverage = bandCoverage(samples, pathPoints, pathTolerance);
      const densitySupport = clamp(
        ownedSamplesByPath[index].length / Math.max(1, samples.length * 0.6),
        0,
        1,
      );
      const binCount = pathLength <= 12
        ? 1
        : Math.min(samples.length, clamp(
          Math.ceil(pathLength / Math.max(12, groupTolerance * 0.55)),
          3,
          8,
        ));
      const occupiedBins = new Set();
      alignedPathSamples.forEach((sample) => {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        samples.forEach((target, sampleIndex) => {
          const value = distance(sample, target);
          if (value < nearestDistance) {
            nearestDistance = value;
            nearestIndex = sampleIndex;
          }
        });
        if (nearestDistance <= pathTolerance) {
          occupiedBins.add(Math.min(binCount - 1, Math.floor((nearestIndex / Math.max(1, samples.length)) * binCount)));
        }
      });
      const longitudinalSupport = occupiedBins.size / Math.max(1, binCount);
      pathDensitySupport[index] = densitySupport;
      pathLongitudinalSupport[index] = longitudinalSupport;
      pathCoverage[index] = geometricCoverage * Math.min(densitySupport, longitudinalSupport);
      // A coherent offset trace stays near the entire route.  A missing stem
      // or tail only happens to be near another route at one end and leaves a
      // long empty run.  Measuring that run with all points in the character
      // avoids penalising harmless alternative pen segmentation.
      const gapTolerance = Math.min(groupTolerance, Math.max(10, groupTolerance * 0.68));
      pathLongestGaps[index] = longestUncoveredRun(samples, ownedPoints, gapTolerance);
    });
    const minPathCoverage = Math.min(...indexes.map((index) => pathCoverage[index]));
    const maxGap = Math.max(...indexes.map((index) => pathLongestGaps[index]));
    const structural = groupMatch.coverage >= 0.8
      && groupMatch.mse <= 1.2
      && minPathCoverage >= REQUIRED_PATH_COVERAGE
      && maxGap <= 0.24;
    const completionScore = structural
      ? clamp(
        0.55 * groupMatch.coverage
          + 0.2 * (1 - maxGap)
          + 0.15 * minPathCoverage
          + 0.1 * Math.exp(-groupMatch.mse),
        0,
        1,
      )
      : Math.min(0.69, groupMatch.coverage * 0.7);
    return {
      indexes: [...indexes],
      coverage: groupMatch.coverage,
      mse: groupMatch.mse,
      minPathCoverage,
      maxGap,
      completion: completionScore,
      structural,
      ownedSamples: ownedSamplesByGroup[groupIndex].length,
      tolerance: groupTolerance,
    };
  });
  const componentCoverage = groupMetrics.map((metric) => metric.coverage);
  const completion = groupMetrics.length ? Math.min(...groupMetrics.map((metric) => metric.completion)) : 0;
  const allRequired = groupMetrics.length > 0 && groupMetrics.every((metric) => metric.structural);

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
  const mseScore = Math.exp(-0.72 * symmetricMse);
  // Start, direction, and number of pen lifts are feedback only.  Completion
  // depends on the resulting shape, so a child may reverse, merge, or split
  // strokes whenever the finished letter is still recognisable.
  const score = clamp(0.55 * mseScore + 0.25 * coverage + 0.2 * precision, 0, 1);

  return {
    score, coverage, precision, completion, allRequired, componentCoverage, pathCoverage, pathLongestGaps,
    pathDensitySupport, pathLongitudinalSupport, start, direction, length, strokeCount,
    targetMse, userMse, symmetricMse, groupMetrics,
    expectedLength, userLength, hasInk: true,
  };
}

const PASS_CRITERIA = Object.freeze({
  easy: Object.freeze({ score: 0.58, coverage: 0.72, precision: 0.52, completion: 0.7, targetMse: 1.05, userMse: 1.4 }),
  medium: Object.freeze({ score: 0.62, coverage: 0.76, precision: 0.57, completion: 0.73, targetMse: 0.88, userMse: 1.18 }),
  hard: Object.freeze({ score: 0.66, coverage: 0.8, precision: 0.62, completion: 0.76, targetMse: 0.72, userMse: 0.98 }),
});

/**
 * The completion gate is intentionally never relaxed. Extra chances may be
 * forgiving about neatness, but every required part must still be present.
 */
export function passesDrawingCriteria(result, assist, { qualityAdjustment = 0, slack = 0 } = {}) {
  const criteria = PASS_CRITERIA[assist] ?? PASS_CRITERIA.easy;
  const qualitySlack = qualityAdjustment + slack;
  return result.hasInk
    && result.allRequired
    && result.score >= criteria.score - qualitySlack
    && result.coverage >= criteria.coverage - qualitySlack
    && result.precision >= criteria.precision - qualitySlack
    && result.completion >= criteria.completion - qualitySlack * 0.5
    && result.targetMse <= criteria.targetMse + qualitySlack * 3
    && result.userMse <= criteria.userMse + qualitySlack * 3;
}

export function nextGuideStrokeIndex(expectedStrokes, userStrokes, {
  width = 900,
  height = 620,
  tolerance = Math.min(width, height) * 0.105,
  completionGroups = null,
} = {}) {
  if (!expectedStrokes.length || !userStrokes.some((stroke) => stroke.length)) return 0;
  const { pathCoverage = [] } = evaluateDrawing(expectedStrokes, userStrokes, {
    width,
    height,
    tolerance,
    completionGroups,
  });
  const next = pathCoverage.findIndex((coverage) => coverage < REQUIRED_PATH_COVERAGE);
  return next >= 0 ? next : Math.max(0, expectedStrokes.length - 1);
}

export function feedbackForEvaluation(result) {
  if (!result.hasInk) return 'Zeichne zuerst mit dem Stift oder Finger.';
  if (result.completion < 0.62) return 'Fahr jede Zahl oder jeden Buchstaben nach.';
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
// roundedPath(), keeping Fino centered on the visible practice template.
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

export function guideStagesForTask(task) {
  if (!task?.strokes?.length) return [];
  const allIndexes = task.strokes.map((_, index) => index);
  const chunks = (indexes, size) => Array.from(
    { length: Math.ceil(indexes.length / size) },
    (_, index) => indexes.slice(index * size, (index + 1) * size),
  );
  const groups = task.completionGroups?.filter((group) => group.length) ?? [];

  // One symbol at a time keeps rows of letters/numbers readable. Complex
  // pictures reveal two marks at once, while simple one- and two-stroke
  // exercises remain whole.
  if (['letters', 'numbers', 'name'].includes(task.category) && groups.length > 1) return groups.map((group) => [...group]);
  if (task.category === 'shapes' && task.strokes.length > 2) return chunks(allIndexes, 2);
  if (task.strokes.length > 3) return chunks(allIndexes, 2);
  return [allIndexes];
}

export function visibleGuideIndexes(stages, activeStageIndex = 0) {
  if (!stages.length) return [];
  const lastVisibleStage = clamp(activeStageIndex, 0, stages.length - 1);
  return stages.slice(0, lastVisibleStage + 1).flat();
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
    this.demoStrokeIndexes = [];
    this.demoResolve = null;
    this.demoFinishTimer = 0;
    this.demoFrame = 0;
    this.jumpAnimation = null;
    this.jumpFrame = 0;
    this.highlightUntil = 0;
    this.templateImages = new Map();
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
    this.loadCharacterTemplateImages();
    this.resize();
  }

  loadCharacterTemplateImages() {
    if (typeof Image === 'undefined') return;
    Object.entries(CHARACTER_TEMPLATE_SHEETS).forEach(([key, source]) => {
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener('load', () => this.render(), { once: true });
      image.src = source;
      this.templateImages.set(key, image);
    });
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.stopDemo({ render: false });
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

  getViewport() {
    return { width: this.width, height: this.height };
  }

  setTask(task, assist = 'easy') {
    this.stopDemo({ render: false });
    this.task = task;
    this.assist = assist;
    this.userStrokes = [];
    this.strokeColors = [];
    this.activeStroke = null;
    this.demoProgress = null;
    this.demoStrokeIndexes = [];
    this.jumpAnimation = null;
    this.highlightUntil = 0;
    cancelAnimationFrame(this.demoFrame);
    cancelAnimationFrame(this.jumpFrame);
    this.render();
    this.hooks.onInkChange?.(false);
  }

  clear() {
    this.stopDemo({ render: false });
    this.userStrokes = [];
    this.strokeColors = [];
    this.activeStroke = null;
    this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    this.highlightUntil = 0;
    this.render();
    this.hooks.onInkChange?.(false);
  }

  undoLastStroke() {
    if (!this.userStrokes.length) return false;
    this.stopDemo({ render: false });
    this.userStrokes.pop();
    this.strokeColors.pop();
    this.activeStroke = null;
    this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    this.render();
    this.hooks.onInkChange?.(this.hasInk());
    return true;
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
    this.strokeColors = this.userStrokes.map((_, index) => this.task?.strokeColors?.[index] ?? inkColorAt(index));
    this.render();
    this.hooks.onInkChange?.(this.hasInk());
  }

  evaluationOptions() {
    const toleranceByAssist = { easy: 0.12, medium: 0.105, hard: 0.09 };
    const bounds = drawingBounds(this.width, this.height);
    const unit = Math.min(bounds.width, bounds.height);
    return {
      width: this.width,
      height: this.height,
      tolerance: clamp(
        unit * toleranceByAssist[this.assist],
        this.assist === 'easy' ? 28 : 24,
        this.assist === 'easy' ? 62 : this.assist === 'medium' ? 56 : 50,
      ),
      completionTolerance: clamp(unit * 0.115, 26, 62),
    };
  }

  getContentBounds() {
    return { ...drawingBounds(this.width, this.height) };
  }

  isAngularGuide(strokeIndex) {
    return ['letters', 'numbers', 'name'].includes(this.task?.category)
      || this.task?.angularStrokes?.includes(strokeIndex);
  }

  guideStages() {
    return guideStagesForTask(this.task);
  }

  activeGuideStageIndex() {
    const stages = this.guideStages();
    if (!stages.length || !this.hasInk()) return 0;
    const result = evaluateDrawing(this.task.strokes, this.userStrokes, {
      ...this.evaluationOptions(),
      completionGroups: this.task.completionGroups,
    });
    const stageIndex = stages.findIndex((stage) => stage.some((index) => result.pathCoverage[index] < REQUIRED_PATH_COVERAGE));
    return stageIndex >= 0 ? stageIndex : stages.length - 1;
  }

  activeGuideStrokeIndexes() {
    const stages = this.guideStages();
    return stages[this.activeGuideStageIndex()] ?? [];
  }

  visibleGuideStrokeIndexes() {
    return visibleGuideIndexes(this.guideStages(), this.activeGuideStageIndex());
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
    // Fino demonstrates one mark, then leaves the next turn to the child.
    this.demoStrokeIndexes = [this.nextGuideStrokeIndex()];
    const demoStrokes = this.demoStrokeIndexes.map((index) => this.task.strokes[index]);
    if (!demoStrokes.length) return Promise.resolve();
    this.demoProgress = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Pace the helper by distance, not stroke count. The 1.5× multiplier
    // makes every preview exactly 50% faster while keeping it readable.
    const pathLength = demoStrokes.reduce((sum, stroke) => sum + polylineLength(stroke, this.width, this.height), 0);
    const demoSpeed = clamp(drawingBounds(this.width, this.height).height * 0.55, 70, 140) * DEMO_SPEED_MULTIPLIER;
    const duration = reducedMotion ? 160 : clamp((pathLength / demoSpeed) * 1000, 600, 3067);
    const startedAt = performance.now();

    return new Promise((resolve) => {
      this.demoResolve = resolve;
      const finish = () => {
        if (this.demoProgress === null) return;
        this.demoProgress = null;
        this.demoStrokeIndexes = [];
        this.demoResolve = null;
        this.demoFinishTimer = 0;
        this.render();
        resolve();
      };
      const frame = (now) => {
        this.demoProgress = clamp((now - startedAt) / duration, 0, 1);
        this.render();
        if (this.demoProgress < 1) {
          this.demoFrame = requestAnimationFrame(frame);
        } else {
          this.demoFinishTimer = window.setTimeout(finish, reducedMotion ? 100 : 280);
        }
      };
      this.demoFrame = requestAnimationFrame(frame);
    });
  }

  stopDemo({ render = true } = {}) {
    if (this.demoProgress === null && !this.demoResolve) return;
    cancelAnimationFrame(this.demoFrame);
    window.clearTimeout(this.demoFinishTimer);
    this.demoFrame = 0;
    this.demoFinishTimer = 0;
    this.demoProgress = null;
    this.demoStrokeIndexes = [];
    const resolve = this.demoResolve;
    this.demoResolve = null;
    resolve?.();
    if (render) this.render();
  }

  demoFoxPosition() {
    if (this.demoProgress === null || !this.task || !this.demoStrokeIndexes.length) return null;
    const stage = demoStageAtProgress(this.demoStrokeIndexes.length, this.demoProgress);
    if (!stage) return null;
    if (stage.type === 'run') {
      const strokeIndex = this.demoStrokeIndexes[stage.strokeIndex];
      return pointAlongGuidePath(this.task.strokes[strokeIndex] ?? [], stage.progress, this.width, this.height, this.isAngularGuide(strokeIndex))?.point ?? null;
    }
    const fromIndex = this.demoStrokeIndexes[stage.fromStroke];
    const toIndex = this.demoStrokeIndexes[stage.toStroke];
    const from = pointAlongGuidePath(this.task.strokes[fromIndex] ?? [], 1, this.width, this.height, this.isAngularGuide(fromIndex));
    const to = pointAlongGuidePath(this.task.strokes[toIndex] ?? [], 0, this.width, this.height, this.isAngularGuide(toIndex));
    if (!from || !to) return null;
    return {
      x: from.point.x + (to.point.x - from.point.x) * stage.progress,
      y: from.point.y + (to.point.y - from.point.y) * stage.progress,
    };
  }

  pointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const normalized = toNormalized({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }, this.width, this.height);
    return {
      ...normalized,
      pressure: event.pressure > 0 ? event.pressure : event.pointerType === 'mouse' ? 0.5 : 0.45,
      time: performance.now(),
    };
  }

  onPointerDown(event) {
    if (!this.task || this.activePointerId !== null) return;
    if (event.pointerType === 'touch' && (!event.isPrimary || performance.now() - this.lastPenAt < 900)) return;
    if (event.pointerType === 'pen') this.lastPenAt = performance.now();
    event.preventDefault();
    const point = this.pointFromEvent(event);
    const demoPosition = this.demoFoxPosition();
    this.stopDemo({ render: false });
    if (!demoPosition) this.jumpAnimation = null;
    cancelAnimationFrame(this.jumpFrame);
    const guideStrokeIndex = this.nextGuideStrokeIndex();
    this.activePointerId = event.pointerId;
    this.activeStroke = [point];
    this.userStrokes.push(this.activeStroke);
    this.strokeColors.push(this.task.strokeColors?.[guideStrokeIndex] ?? inkColorAt(this.userStrokes.length - 1));
    if (demoPosition) this.animateFoxJump(demoPosition, toPixels(point, this.width, this.height), { maxDuration: 220 });
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
        toPixels(last, this.width, this.height),
        toPixels(point, this.width, this.height),
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
    this.animateFoxJump(from, to);
  }

  animateFoxJump(from, to, { maxDuration = 520 } = {}) {
    const travel = distance(from, to);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.jumpAnimation = {
      from,
      to,
      progress: 0,
      travel,
      startedAt: performance.now(),
      duration: reducedMotion ? 170 : clamp(140 + travel * 0.35, 160, maxDuration),
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
    const bounds = drawingBounds(this.width, this.height);
    context.save();
    context.strokeStyle = 'rgba(82, 105, 142, .13)';
    context.lineWidth = 2;
    context.setLineDash([]);
    [0.18, 0.5, 0.84].forEach((y, index) => {
      context.beginPath();
      context.moveTo(bounds.x + bounds.width * 0.08, bounds.y + bounds.height * y);
      context.lineTo(bounds.x + bounds.width * 0.92, bounds.y + bounds.height * y);
      context.stroke();
      if (index === 2) {
        context.setLineDash([]);
        context.strokeStyle = 'rgba(82, 105, 142, .19)';
        context.stroke();
      }
    });
    context.restore();
  }

  drawCharacterTemplates(context, guideIndexes, { alpha }) {
    if (!this.task) return new Set();
    const visible = new Set(guideIndexes);
    const symbols = templateSymbolsForTask(this.task);
    const groups = this.task.completionGroups?.length
      ? this.task.completionGroups
      : [this.task.strokes.map((_, index) => index)];
    const renderedIndexes = new Set();

    groups.forEach((group, groupIndex) => {
      const visibleGroup = group.filter((index) => visible.has(index));
      if (!visibleGroup.length) return;
      const symbol = symbols[groupIndex];
      const baseSymbol = ({ Ä: 'A', Ö: 'O', Ü: 'U', ä: 'a', ö: 'o', ü: 'u' })[symbol] ?? symbol;
      const crop = characterTemplateCrop(baseSymbol);
      const geometry = characterStrokeGeometry(baseSymbol);
      const image = crop ? this.templateImages.get(crop.sheet) : null;
      const imageIndexes = symbol === baseSymbol
        ? group
        : group.slice(0, geometry?.routeCount ?? 0);
      const bounds = pixelBoundsForStrokes(
        imageIndexes.map((index) => this.task.strokes[index]),
        this.width,
        this.height,
      );
      if (!crop || !geometry || !image?.complete || !image.naturalWidth || !bounds) return;

      // The generated route and the crop share source-pixel coordinates.
      // Mapping the route bounds back to that crop keeps the raster template
      // aligned to Fino's centre line down to the source pixel, including the
      // narrow i/l and wide M/W forms.
      const placement = characterTemplatePlacement(bounds, crop, geometry);
      context.save();
      context.globalAlpha = alpha;
      context.imageSmoothingEnabled = true;
      context.drawImage(
        image,
        crop.x, crop.y, crop.width, crop.height,
        placement.x, placement.y,
        placement.width, placement.height,
      );
      context.restore();
      imageIndexes.filter((index) => visible.has(index)).forEach((index) => renderedIndexes.add(index));
    });

    return renderedIndexes;
  }

  drawStrokeSet(context, strokes, {
    color,
    width,
    dash = [],
    alpha = 1,
    angular = false,
    angularForStroke = null,
  }) {
    context.save();
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.setLineDash(dash);
    strokes.forEach((stroke, index) => {
      const useAngular = angularForStroke ? angularForStroke(stroke, index) : angular;
      context.lineJoin = useAngular ? 'miter' : 'round';
      context.beginPath();
      if (useAngular) angularPath(context, stroke, this.width, this.height);
      else roundedPath(context, stroke, this.width, this.height);
      context.stroke();
    });
    context.restore();
  }

  drawGuideFox(context, point, angle = 0, { jumping = false } = {}) {
    const bounds = drawingBounds(this.width, this.height);
    const size = clamp(Math.min(bounds.width, bounds.height) * 0.08, 26, 46);
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

    const nextStrokeIndex = this.nextGuideStrokeIndex();
    const nextStroke = this.task.strokes[nextStrokeIndex];
    const angular = this.isAngularGuide(nextStrokeIndex);
    // Fino waits just after the green starting point, still exactly on the
    // invisible centre line of the visible template.
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
    const bounds = drawingBounds(this.width, this.height);
    const size = clamp(Math.min(bounds.width, bounds.height) * 0.08, 26, 46);

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
    const stage = demoStageAtProgress(this.demoStrokeIndexes.length, this.demoProgress);
    if (!stage) return;

    if (stage.type === 'run') {
      const activeIndex = this.demoStrokeIndexes[stage.strokeIndex];
      const activeStroke = this.task.strokes[activeIndex];
      const guide = pointAlongGuidePath(activeStroke ?? [], stage.progress, this.width, this.height, this.isAngularGuide(activeIndex));
      if (guide) this.drawGuideFox(context, guide.point, guide.angle);
      return;
    }

    const fromIndex = this.demoStrokeIndexes[stage.fromStroke];
    const toIndex = this.demoStrokeIndexes[stage.toStroke];
    const from = pointAlongGuidePath(this.task.strokes[fromIndex], 1, this.width, this.height, this.isAngularGuide(fromIndex));
    const to = pointAlongGuidePath(this.task.strokes[toIndex], 0, this.width, this.height, this.isAngularGuide(toIndex));
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
    const strokeIndex = this.nextGuideStrokeIndex();
    const stroke = this.task.strokes[strokeIndex];
    const angular = this.isAngularGuide(strokeIndex);
    const guide = pointAlongGuidePath(stroke ?? [], 0, this.width, this.height, angular);
    if (!guide) return;
    const bounds = drawingBounds(this.width, this.height);
    const radius = clamp(Math.min(bounds.width, bounds.height) * 0.016, 6, 10);
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
      const guideIndexes = this.visibleGuideStrokeIndexes();
      const visibleStrokes = guideIndexes.map((index) => this.task.strokes[index]);
      const bounds = drawingBounds(this.width, this.height);
      const guideStyle = guidePresentationForTask(this.task, this.assist);
      const templateIndexes = guideStyle.template
        ? this.drawCharacterTemplates(context, guideIndexes, {
          alpha: isHighlight ? Math.min(0.56, guideStyle.alpha + 0.2) : guideStyle.alpha,
        })
        : new Set();
      visibleStrokes.forEach((stroke, index) => {
        const guideIndex = guideIndexes[index];
        if (templateIndexes.has(guideIndex)) return;
        this.drawStrokeSet(context, [stroke], {
          color: isHighlight && !guideStyle.template
            ? '#F3B348'
            : this.task.strokeColors?.[guideIndex] ?? guideStyle.color,
          width: clamp(Math.min(bounds.width, bounds.height) * guideStyle.width, guideStyle.min, guideStyle.max),
          dash: guideStyle.dash,
          alpha: isHighlight
            ? guideStyle.template ? Math.min(0.56, guideStyle.alpha + 0.2) : 0.72
            : guideStyle.alpha,
          angularForStroke: () => this.isAngularGuide(guideIndex),
        });
      });

      this.drawFoxForCurrentStroke(context);
      this.drawStartPoint(context);
      this.drawDemo(context);
    }

    this.userStrokes.forEach((stroke, index) => {
      const bounds = drawingBounds(this.width, this.height);
      this.drawStrokeSet(context, [stroke], {
        color: this.strokeColors[index] ?? inkColorAt(index),
        width: clamp(Math.min(bounds.width, bounds.height) * 0.025, 11, 20),
        alpha: 0.98,
      });
    });
  }
}
