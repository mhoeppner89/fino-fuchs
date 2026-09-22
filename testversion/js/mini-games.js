/** Pure, deterministic geometry for Fino's two path games. */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function randomFor(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

const cellKey = (x, y, cols) => y * cols + x;
const passageKey = (first, second) => `${Math.min(first, second)}:${Math.max(first, second)}`;

function cellNeighbours(index, cols, rows) {
  const x = index % cols;
  const y = Math.floor(index / cols);
  return [
    [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
  ].filter(([nextX, nextY]) => nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows)
    .map(([nextX, nextY]) => cellKey(nextX, nextY, cols));
}

function farthestCell(start, cols, rows, passages) {
  const queue = [start];
  const parent = new Map([[start, null]]);
  const distance = new Map([[start, 0]]);
  let farthest = start;
  while (queue.length) {
    const current = queue.shift();
    if (distance.get(current) > distance.get(farthest)) farthest = current;
    cellNeighbours(current, cols, rows).forEach((next) => {
      if (parent.has(next) || !passages.has(passageKey(current, next))) return;
      parent.set(next, current);
      distance.set(next, distance.get(current) + 1);
      queue.push(next);
    });
  }
  const path = [];
  for (let current = farthest; current !== null; current = parent.get(current)) path.push(current);
  path.reverse();
  return { cell: farthest, path };
}

function mazeWalls(cols, rows, passages) {
  const horizontal = [];
  for (let y = 0; y <= rows; y += 1) {
    let start = null;
    for (let x = 0; x <= cols; x += 1) {
      const hasWall = x < cols && (
        y === 0 || y === rows
        || !passages.has(passageKey(cellKey(x, y - 1, cols), cellKey(x, y, cols)))
      );
      if (hasWall && start === null) start = x;
      if ((!hasWall || x === cols) && start !== null) {
        horizontal.push({ x1: start, y1: y, x2: x, y2: y });
        start = null;
      }
    }
  }

  const vertical = [];
  for (let x = 0; x <= cols; x += 1) {
    let start = null;
    for (let y = 0; y <= rows; y += 1) {
      const hasWall = y < rows && (
        x === 0 || x === cols
        || !passages.has(passageKey(cellKey(x - 1, y, cols), cellKey(x, y, cols)))
      );
      if (hasWall && start === null) start = y;
      if ((!hasWall || y === rows) && start !== null) {
        vertical.push({ x1: x, y1: start, x2: x, y2: y });
        start = null;
      }
    }
  }
  return [...horizontal, ...vertical];
}

function cellPoint(index, cols) {
  return { x: (index % cols) + 0.5, y: Math.floor(index / cols) + 0.5 };
}

export function createMazeSpec(seed = 1, complexity = 1 + (seed % 4)) {
  const mixedSeed = (Math.imul(seed, 0x9E3779B1) ^ Math.imul(seed + complexity, 0x85EBCA6B)) >>> 0;
  const level = clamp(Math.round(complexity), 1, 4);
  const sizes = {
    1: [[4, 3], [5, 3], [4, 4]],
    2: [[6, 4], [6, 5], [7, 4]],
    3: [[8, 6], [9, 6], [9, 7]],
    4: [[11, 8], [12, 8], [11, 9]],
  }[level];
  const [cols, rows] = sizes[Math.floor((seed - 1) / 3) % sizes.length];
  const corners = [0, cols - 1, (rows - 1) * cols, rows * cols - 1];
  const startCell = corners[Math.floor(randomFor(mixedSeed ^ 0xA5A5A5A5)() * corners.length)];
  const routeRanges = { 1: [0, 14], 2: [18, 28], 3: [34, 52], 4: [58, Infinity] };
  const [minimumRoute, maximumRoute] = routeRanges[level];
  let selected = null;
  let bestPenalty = Infinity;
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const rng = randomFor((mixedSeed + Math.imul(attempt + 1, 0x27D4EB2D)) >>> 0);
    const visited = new Set([startCell]);
    const passages = new Set();
    const stack = [startCell];
    while (stack.length) {
      const current = stack.at(-1);
      const available = shuffled(cellNeighbours(current, cols, rows), rng)
        .filter((next) => !visited.has(next));
      if (!available.length) {
        stack.pop();
        continue;
      }
      const next = available[0];
      passages.add(passageKey(current, next));
      visited.add(next);
      stack.push(next);
    }
    const destination = farthestCell(startCell, cols, rows, passages);
    const length = destination.path.length;
    const penalty = Math.max(0, minimumRoute - length) + Math.max(0, length - maximumRoute);
    if (penalty < bestPenalty) {
      selected = { passages, destination };
      bestPenalty = penalty;
    }
    if (penalty === 0) break;
  }
  const { passages, destination } = selected;
  return Object.freeze({
    kind: 'maze',
    seed,
    complexity,
    cols,
    rows,
    startCell,
    goalCell: destination.cell,
    solutionCells: Object.freeze(destination.path),
    passages: Object.freeze([...passages].map((key) => Object.freeze(key.split(':').map(Number)))),
    walls: Object.freeze(mazeWalls(cols, rows, passages).map((wall) => Object.freeze(wall))),
  });
}

function transposeMaze(spec) {
  const transposeCell = (index) => {
    const x = index % spec.cols;
    const y = Math.floor(index / spec.cols);
    return cellKey(y, x, spec.rows);
  };
  return {
    ...spec,
    cols: spec.rows,
    rows: spec.cols,
    startCell: transposeCell(spec.startCell),
    goalCell: transposeCell(spec.goalCell),
    solutionCells: spec.solutionCells.map(transposeCell),
    passages: spec.passages.map(([first, second]) => [transposeCell(first), transposeCell(second)]),
    walls: spec.walls.map((wall) => ({ x1: wall.y1, y1: wall.x1, x2: wall.y2, y2: wall.x2 })),
  };
}

function normalizedPoint(pixelPoint, width, height) {
  return { x: pixelPoint.x / width, y: pixelPoint.y / height };
}

export function layoutMaze(spec, viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 900);
  const height = Math.max(220, Number(viewport.height) || 620);
  const margin = clamp(Math.min(width, height) * 0.065, 18, 42);
  const availableWidth = width - margin * 2;
  const availableHeight = height - margin * 2;
  const normalCell = Math.min(availableWidth / spec.cols, availableHeight / spec.rows);
  const transposedCell = Math.min(availableWidth / spec.rows, availableHeight / spec.cols);
  const maze = transposedCell > normalCell * 1.035 ? transposeMaze(spec) : spec;
  const cellSize = Math.min(availableWidth / maze.cols, availableHeight / maze.rows);
  const boardWidth = cellSize * maze.cols;
  const boardHeight = cellSize * maze.rows;
  const offsetX = (width - boardWidth) / 2;
  const offsetY = (height - boardHeight) / 2;
  const gridToPoint = ({ x, y }) => normalizedPoint({
    x: offsetX + x * cellSize,
    y: offsetY + y * cellSize,
  }, width, height);
  const solution = maze.solutionCells.map((index) => gridToPoint(cellPoint(index, maze.cols)));
  const cellCenters = Array.from({ length: maze.cols * maze.rows }, (_, index) => gridToPoint(cellPoint(index, maze.cols)));
  const walls = maze.walls.map((wall) => ({
    a: gridToPoint({ x: wall.x1, y: wall.y1 }),
    b: gridToPoint({ x: wall.x2, y: wall.y2 }),
  }));
  return Object.freeze({
    kind: 'maze',
    seed: spec.seed,
    complexity: spec.complexity,
    cols: maze.cols,
    rows: maze.rows,
    startCell: maze.startCell,
    goalCell: maze.goalCell,
    cellSize,
    wallWidth: clamp(cellSize * 0.095, 4, 8),
    walls: Object.freeze(walls.map((wall) => Object.freeze(wall))),
    passages: Object.freeze(maze.passages.map((passage) => Object.freeze([...passage]))),
    cellCenters: Object.freeze(cellCenters.map((point) => Object.freeze(point))),
    solution: Object.freeze(solution.map((point) => Object.freeze(point))),
    start: Object.freeze({ ...solution[0] }),
    goal: Object.freeze({ ...solution.at(-1) }),
    startRadius: clamp(cellSize * 0.24, 15, 28),
    goalRadius: clamp(cellSize * 0.28, 18, 32),
  });
}

export function createConnectSpec(seed = 1, complexity = 1 + (seed % 4)) {
  const level = clamp(Math.round(complexity), 1, 4);
  const count = {
    1: 5 + (seed % 2),
    2: 8,
    3: 9 + (seed % 3),
    4: 12 + (seed % 3),
  }[level];
  return Object.freeze({ kind: 'connect', seed, complexity: level, count });
}

/** A slimmer trail leaves a real finger-sized corridor on narrow phones. */
export function connectInkWidthForBoard(width, height) {
  return clamp(Math.min(Math.max(1, width), Math.max(1, height)) * 0.018, 7, 14);
}

/**
 * Judge only a visible overlap, not the larger spacing used to build routes.
 * A small overlap allowance keeps normal finger wobble from closing an
 * apparently open corridor, especially on iPad-sized boards.
 */
export function connectCollisionClearanceForBoard(width, height, complexity = 1) {
  const level = clamp(Math.round(complexity), 1, 4);
  const inkWidth = connectInkWidthForBoard(width, height);
  const difficultyBuffer = level >= 4 ? 2 : level >= 3 ? 1.5 : 1;
  return Math.max(7, inkWidth * 0.78 + difficultyBuffer);
}

function simplifyGridRoute(route) {
  if (route.length < 3) return route;
  const simplified = [route[0]];
  for (let index = 1; index < route.length - 1; index += 1) {
    const previous = simplified.at(-1);
    const current = route[index];
    const next = route[index + 1];
    const firstDx = Math.sign(current.x - previous.x);
    const firstDy = Math.sign(current.y - previous.y);
    const secondDx = Math.sign(next.x - current.x);
    const secondDy = Math.sign(next.y - current.y);
    if (firstDx !== secondDx || firstDy !== secondDy) simplified.push(current);
  }
  simplified.push(route.at(-1));
  return simplified;
}

function buildConnectChallenge(spec, {
  width, height, margin, pointRadius, hitRadius, clearance, routeClearance, rng,
}) {
  const level = clamp(Math.round(spec.complexity), 2, 4);
  const compactPhone = Math.min(width, height) < 430;
  const compactPortrait = compactPhone && height > width * 1.08;
  // Keep hard phone corridors physically wider. Challenge still comes from
  // routing behind old lines, not from squeezing through a 20px grid cell.
  const landscapeCols = level === 4 ? compactPhone ? 19 : 23 : level === 3 ? 19 : 15;
  const landscapeRows = level === 4 ? compactPhone ? 13 : 16 : level === 3 ? 13 : 10;
  const cols = compactPortrait ? landscapeRows : landscapeCols;
  const rows = compactPortrait ? landscapeCols : landscapeRows;
  const pointForNode = ({ x, y }) => normalizedPoint({
    x: margin + (x / (cols - 1)) * (width - margin * 2),
    y: margin + (y / (rows - 1)) * (height - margin * 2),
  }, width, height);
  const key = ({ x, y }) => `${x}:${y}`;
  const mirrorX = spec.seed % 2 === 1;
  const transformNode = ({ x, y }) => ({
    x: mirrorX ? cols - 1 - x : x,
    y,
  });
  const barrierRow = 2 + (spec.seed % Math.max(1, Math.floor(rows / 4)));
  const scaffold = [
    transformNode({ x: 1, y: barrierRow }),
    transformNode({ x: cols - 2, y: barrierRow }),
    transformNode({ x: cols - 2, y: rows - 3 }),
  ];
  const nodes = [];
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) nodes.push({ x, y });
  }

  const points = scaffold.map(pointForNode);
  const pointNodes = [...scaffold];
  const solutionStrokes = [
    Object.freeze([points[0], points[1]]),
    Object.freeze([points[1], points[2]]),
  ];
  const detourStages = [false, false];
  const lockedStrokes = [...solutionStrokes];
  const used = new Set(scaffold.map(key));
  const sharedEndpointRadius = hitRadius + clearance + 6;

  const segmentIsClear = (from, to, anchor, collisionClearance = clearance) => !connectTrailCollision(from, to, {
    lockedStrokes,
    anchor,
    width,
    height,
    clearance: collisionClearance,
    junctionRadius: hitRadius + 6,
    // Keep the free area around the numbered anchor constant. A wider route
    // planning margin must not accidentally enlarge this exemption.
    sharedEndpointRadius,
  });

  const targetHasRoom = (target, anchor) => {
    if (pointDistanceInPixels(target, anchor, width, height) < Math.max(58, pointRadius * 2.05)) return false;
    const targetPixel = pixelPoint(target, width, height);
    return lockedStrokes.every((stroke) => segmentsOf(stroke).every(([from, to]) => (
      pointToSegmentDistance(targetPixel, pixelPoint(from, width, height), pixelPoint(to, width, height))
        > pointRadius + routeClearance * 0.18
    )));
  };

  const findRoute = (startNode, targetNode, anchor) => {
    const startKey = key(startNode);
    const targetKey = key(targetNode);
    const queue = [startNode];
    const parent = new Map([[startKey, null]]);
    const directionOffset = (spec.seed + solutionStrokes.length) % 4;
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    while (queue.length && !parent.has(targetKey)) {
      const current = queue.shift();
      for (let offset = 0; offset < directions.length; offset += 1) {
        const [dx, dy] = directions[(offset + directionOffset) % directions.length];
        const next = { x: current.x + dx, y: current.y + dy };
        const nextKey = key(next);
        if (next.x < 1 || next.x >= cols - 1 || next.y < 1 || next.y >= rows - 1 || parent.has(nextKey)) continue;
        if (!segmentIsClear(pointForNode(current), pointForNode(next), anchor, routeClearance)) continue;
        parent.set(nextKey, current);
        queue.push(next);
      }
    }
    if (!parent.has(targetKey)) return null;
    const routeNodes = [];
    for (let current = targetNode; current; current = parent.get(key(current))) routeNodes.push(current);
    routeNodes.reverse();
    return simplifyGridRoute(routeNodes.map(pointForNode));
  };

  while (points.length < spec.count) {
    const stage = solutionStrokes.length;
    const challengeEvery = level === 4 ? 2 : level === 3 ? 3 : 4;
    const wantsDetour = stage >= 2 && (stage - 2) % challengeEvery === 0;
    const currentNode = pointNodes.at(-1);
    const current = points.at(-1);
    let choice = null;
    const candidates = shuffled(nodes.filter((node) => !used.has(key(node))), rng);

    for (const targetNode of candidates) {
      const target = pointForNode(targetNode);
      if (!targetHasRoom(target, current)) continue;
      const directBlocked = !segmentIsClear(current, target, current);
      if (directBlocked !== wantsDetour) continue;
      const directHasWideMargin = segmentIsClear(current, target, current, routeClearance);
      const route = directHasWideMargin ? [current, target] : findRoute(currentNode, targetNode, current);
      if (!route || (directBlocked && route.length < 3)) continue;
      choice = { targetNode, target, route, directBlocked };
      break;
    }

    if (!choice) {
      for (const targetNode of candidates) {
        const target = pointForNode(targetNode);
        if (!targetHasRoom(target, current)) continue;
        const directBlocked = !segmentIsClear(current, target, current);
        const directHasWideMargin = segmentIsClear(current, target, current, routeClearance);
        const route = directHasWideMargin ? [current, target] : findRoute(currentNode, targetNode, current);
        if (!route) continue;
        choice = { targetNode, target, route, directBlocked };
        break;
      }
    }
    if (!choice) break;

    used.add(key(choice.targetNode));
    pointNodes.push(choice.targetNode);
    points.push(Object.freeze(choice.target));
    const frozenRoute = Object.freeze(choice.route.map((point) => Object.freeze({ ...point })));
    solutionStrokes.push(frozenRoute);
    detourStages.push(choice.directBlocked);
    lockedStrokes.push(frozenRoute);
  }

  return { points, solutionStrokes, detourStages };
}

export function layoutConnect(spec, viewport = {}) {
  const width = Math.max(240, Number(viewport.width) || 900);
  const height = Math.max(220, Number(viewport.height) || 620);
  const level = clamp(Math.round(spec.complexity), 1, 4);
  const portrait = height > width * 1.08;
  const margin = clamp(Math.min(width, height) * 0.09, 24, 52);
  const majorStart = margin;
  const majorLength = (portrait ? height : width) - margin * 2;
  const crossStart = margin;
  const crossLength = (portrait ? width : height) - margin * 2;
  const rng = randomFor(spec.seed * 3571 + 91);
  const phase = rng() * Math.PI * 2;
  const frequency = 1.45 + rng() * 1.35;
  let points = [];
  let solutionStrokes = [];
  let detourStages = [];
  let previousCross = 0.5;

  const pointRadius = clamp(Math.min(width, height) * 0.055, 24, 38);
  const hitRadius = clamp(Math.min(width, height) * 0.082, 38, 54);
  const inkWidth = connectInkWidthForBoard(width, height);
  const clearance = connectCollisionClearanceForBoard(width, height, level);
  // Route generation stays deliberately more conservative than collision
  // judging. The visible path therefore has room for a child's hand wobble.
  const routeClearance = clearance + clamp(inkWidth * 0.45, 3.5, 6);

  if (level >= 2) {
    const requiredDetours = level === 4 ? 4 : level === 3 ? 2 : 1;
    let best = null;
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const candidate = buildConnectChallenge(spec, {
        width,
        height,
        margin,
        pointRadius,
        hitRadius,
        clearance,
        routeClearance,
        rng: randomFor((Math.imul(spec.seed + 17, 0x9E3779B1) + Math.imul(attempt + 1, 0x85EBCA6B)) >>> 0),
      });
      const candidateDetours = candidate.detourStages.filter(Boolean).length;
      const bestDetours = best?.detourStages.filter(Boolean).length ?? -1;
      const better = !best || candidate.points.length > best.points.length
        || (candidate.points.length === best.points.length && candidateDetours > bestDetours);
      if (!better) continue;
      const candidateGame = { ...candidate, hitRadius, clearance };
      if (candidate.solutionStrokes.some((_, stage) => !planConnectContinuation(
        candidateGame, candidate.solutionStrokes.slice(0, stage), stage, width, height,
      ))) continue;
      best = candidate;
      if (candidate.points.length === spec.count && candidateDetours >= requiredDetours) break;
    }
    if (best?.points.length === spec.count) ({ points, solutionStrokes, detourStages } = best);
  }
  if (!points.length) {
    for (let index = 0; index < spec.count; index += 1) {
      const t = spec.count === 1 ? 0.5 : index / (spec.count - 1);
      let cross = level >= 2 ? (index % 2 ? 0.82 : 0.18) : 0.5
        + Math.sin(phase + index * frequency) * (0.22 + rng() * 0.1)
        + (rng() - 0.5) * 0.12;
      cross = clamp(cross, 0.1, 0.9);
      if (index && Math.abs(cross - previousCross) < 0.13) {
        cross = clamp(previousCross + (index % 2 ? 0.2 : -0.2), 0.1, 0.9);
      }
      previousCross = cross;
      const major = majorStart + t * majorLength;
      const crossPixel = crossStart + cross * crossLength;
      const pixel = portrait ? { x: crossPixel, y: major } : { x: major, y: crossPixel };
      points.push(Object.freeze(normalizedPoint(pixel, width, height)));
    }
    solutionStrokes = connectSolutionStrokes(points);
    detourStages = solutionStrokes.map(() => false);
  }

  return Object.freeze({
    kind: 'connect',
    seed: spec.seed,
    complexity: spec.complexity,
    points: Object.freeze(points),
    solutionStrokes: Object.freeze(solutionStrokes),
    detourStages: Object.freeze(detourStages),
    // The visible ring and its forgiving touch target are deliberately
    // larger than the ink. Children can lift at one number and continue at
    // the next without being rejected for landing near the ring edge.
    pointRadius,
    hitRadius,
    clearance,
    routeClearance,
  });
}

function pixelPoint(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

export function pointDistanceInPixels(first, second, width, height) {
  return Math.hypot((first.x - second.x) * width, (first.y - second.y) * height);
}

/** Return the first point where a movement enters a round target. */
export function firstCircleHit(start, end, center, radius, width, height) {
  const a = pixelPoint(start, width, height);
  const b = pixelPoint(end, width, height);
  const c = pixelPoint(center, width, height);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-6) return Math.hypot(fx, fy) <= radius ? { ...start } : null;
  const bb = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - radius * radius;
  const discriminant = bb * bb - 4 * aa * cc;
  if (discriminant < 0) return pointDistanceInPixels(end, center, width, height) <= radius ? { ...end } : null;
  const root = Math.sqrt(discriminant);
  const positions = [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)]
    .filter((value) => value >= 0 && value <= 1)
    .sort((first, second) => first - second);
  if (!positions.length) return pointDistanceInPixels(end, center, width, height) <= radius ? { ...end } : null;
  return { ...end, ...pointOnSegment(start, end, positions[0]) };
}

export function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + dx * position), point.y - (start.y + dy * position));
}

function orientation(first, second, third) {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function segmentsIntersect(a, b, c, d) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  const epsilon = 1e-7;
  if (Math.abs(first) < epsilon && pointToSegmentDistance(c, a, b) < epsilon) return true;
  if (Math.abs(second) < epsilon && pointToSegmentDistance(d, a, b) < epsilon) return true;
  if (Math.abs(third) < epsilon && pointToSegmentDistance(a, c, d) < epsilon) return true;
  if (Math.abs(fourth) < epsilon && pointToSegmentDistance(b, c, d) < epsilon) return true;
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

export function segmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

export function mazeWallCollision(from, to, game, width, height, clearance = 8) {
  if (!from || !to || !game?.walls?.length) return false;
  const a = pixelPoint(from, width, height);
  const b = pixelPoint(to, width, height);
  return game.walls.some((wall) => segmentDistance(
    a,
    b,
    pixelPoint(wall.a, width, height),
    pixelPoint(wall.b, width, height),
  ) <= clearance);
}

function segmentsOf(stroke) {
  const result = [];
  for (let index = 1; index < stroke.length; index += 1) result.push([stroke[index - 1], stroke[index]]);
  return result;
}

function pointOnSegment(start, end, position) {
  return {
    x: start.x + (end.x - start.x) * position,
    y: start.y + (end.y - start.y) * position,
  };
}

/** Keep only the parts of a segment outside a round shared-point safe zone. */
function segmentPartsOutsideCircle(start, end, center, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - center.x;
  const fy = start.y - center.y;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-8) return Math.hypot(fx, fy) > radius ? [[start, end]] : [];
  const bb = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - radius * radius;
  const discriminant = bb * bb - 4 * aa * cc;
  const cuts = [0, 1];
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)]
      .filter((value) => value > 0 && value < 1)
      .forEach((value) => cuts.push(value));
  }
  cuts.sort((first, second) => first - second);
  const parts = [];
  for (let index = 1; index < cuts.length; index += 1) {
    const from = cuts[index - 1];
    const to = cuts[index];
    const middle = pointOnSegment(start, end, (from + to) / 2);
    if (Math.hypot(middle.x - center.x, middle.y - center.y) > radius) {
      parts.push([pointOnSegment(start, end, from), pointOnSegment(start, end, to)]);
    }
  }
  return parts;
}

/** Exclude only the recent physical tail of an active stroke, not a fixed
 * number of pointer samples (fast fingers produce far fewer samples). */
function segmentsBeforeRecentTail(stroke, width, height, tailLength) {
  const result = [];
  let removed = 0;
  for (let index = stroke.length - 1; index > 0; index -= 1) {
    const first = pixelPoint(stroke[index - 1], width, height);
    const second = pixelPoint(stroke[index], width, height);
    const length = Math.hypot(second.x - first.x, second.y - first.y);
    if (removed + length <= tailLength) {
      removed += length;
      continue;
    }
    if (removed < tailLength && length > 0) {
      const retained = (length - (tailLength - removed)) / length;
      result.unshift([first, pointOnSegment(first, second, retained)]);
      removed = tailLength;
    } else {
      result.unshift([first, second]);
    }
  }
  return result;
}

/**
 * Test a new point-game line segment against completed lines and the older
 * part of its own active line. The shared current point is deliberately free.
 */
export function connectTrailCollision(from, to, {
  lockedStrokes = [],
  activeStroke = [],
  anchor = from,
  width = 900,
  height = 620,
  clearance = 10,
  junctionRadius = 22,
  sharedEndpointRadius = null,
} = {}) {
  if (!from || !to) return false;
  const a = pixelPoint(from, width, height);
  const b = pixelPoint(to, width, height);
  const anchorPixel = pixelPoint(anchor, width, height);
  const collidesWithLocked = (first, second) => {
    const c = pixelPoint(first, width, height);
    const d = pixelPoint(second, width, height);
    const safeRadius = sharedEndpointRadius ?? junctionRadius + clearance;
    const outside = segmentPartsOutsideCircle(c, d, anchorPixel, safeRadius);
    return outside.some(([outsideStart, outsideEnd]) => segmentDistance(a, b, outsideStart, outsideEnd) <= clearance);
  };

  for (const stroke of lockedStrokes) {
    if (segmentsOf(stroke).some(([first, second]) => collidesWithLocked(first, second))) return true;
  }
  const olderActiveSegments = segmentsBeforeRecentTail(
    activeStroke,
    width,
    height,
    Math.max(24, clearance * 2.2),
  );
  return olderActiveSegments.some(([first, second]) => segmentDistance(a, b, first, second) <= clearance);
}

export function connectSolutionStrokes(source) {
  if (source?.solutionStrokes) return source.solutionStrokes;
  const points = Array.isArray(source) ? source : source?.points ?? [];
  return points.slice(1).map((point, index) => Object.freeze([
    Object.freeze({ ...points[index] }),
    Object.freeze({ ...point }),
  ]));
}

/**
 * Find a playable next route against the child's actual ink, and check that
 * every later number is still reachable. A precomputed solution alone cannot
 * guarantee this once the child has chosen a different path.
 * Returns null if a completed line would trap a remaining number.
 */
export function planConnectContinuation(game, lockedStrokes, reachedIndex, width, height) {
  const anchor = game.points[reachedIndex];
  const targets = game.points.slice(reachedIndex + 1);
  if (!anchor || !targets.length) return [];
  const clearance = game.clearance;
  const anchorPixel = pixelPoint(anchor, width, height);
  const safeRadius = game.hitRadius + clearance + 6;
  const obstacles = lockedStrokes.flatMap(stroke => segmentsOf(stroke).flatMap(([a, b]) => (
    segmentPartsOutsideCircle(pixelPoint(a, width, height), pixelPoint(b, width, height), anchorPixel, safeRadius)
  )));
  // Bucket the original segments; do not simplify away any real ink. This
  // keeps route checks responsive even after long, densely sampled gestures.
  const buckets = new Map();
  const bucketSize = 32;
  const bucketRange = (a, b, pad = 0) => [
    Math.floor((Math.min(a.x, b.x) - pad) / bucketSize),
    Math.floor((Math.max(a.x, b.x) + pad) / bucketSize),
    Math.floor((Math.min(a.y, b.y) - pad) / bucketSize),
    Math.floor((Math.max(a.y, b.y) + pad) / bucketSize),
  ];
  obstacles.forEach(([a, b], index) => {
    const [x0, x1, y0, y1] = bucketRange(a, b, clearance);
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const key = `${x}:${y}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }
  });
  const clear = (a, b) => {
    const [x0, x1, y0, y1] = bucketRange(a, b);
    const seen = new Set();
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      for (const index of buckets.get(`${x}:${y}`) ?? []) {
        if (seen.has(index)) continue;
        seen.add(index);
        if (segmentDistance(a, b, ...obstacles[index]) <= clearance) return false;
      }
    }
    return true;
  };
  const targetPixels = targets.map(point => pixelPoint(point, width, height));
  const routes = targets.map((target, index) => clear(anchorPixel, targetPixels[index]) ? [anchor, target] : null);
  if (routes.every(Boolean)) return routes[0];

  const inset = connectInkWidthForBoard(width, height) / 2 + 2;
  const spacing = Math.max(7, clearance * 0.8);
  const cols = Math.ceil((width - inset * 2) / spacing) + 1;
  const rows = Math.ceil((height - inset * 2) / spacing) + 1;
  const dx = (width - inset * 2) / (cols - 1);
  const dy = (height - inset * 2) / (rows - 1);
  const position = index => ({ x: inset + (index % cols) * dx, y: inset + Math.floor(index / cols) * dy });
  const neighboursOfPoint = point => {
    const cx = Math.round((point.x - inset) / dx), cy = Math.round((point.y - inset) / dy);
    const result = [];
    for (let y = Math.max(0, cy - 1); y <= Math.min(rows - 1, cy + 1); y += 1) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(cols - 1, cx + 1); x += 1) {
        const index = y * cols + x;
        if (clear(point, position(index))) result.push(index);
      }
    }
    return result;
  };
  const goals = new Map();
  targetPixels.forEach((point, targetIndex) => {
    if (routes[targetIndex]) return;
    for (const node of neighboursOfPoint(point)) {
      if (!goals.has(node)) goals.set(node, []);
      goals.get(node).push(targetIndex);
    }
  });
  const parent = new Int32Array(cols * rows).fill(-2);
  const queue = neighboursOfPoint(anchorPixel);
  queue.forEach(node => { parent[node] = -1; });
  let missing = routes.filter(route => !route).length;
  for (let cursor = 0; cursor < queue.length && missing; cursor += 1) {
    const node = queue[cursor];
    for (const targetIndex of goals.get(node) ?? []) {
      if (routes[targetIndex]) continue;
      const path = [];
      for (let step = node; step !== -1; step = parent[step]) path.push(position(step));
      path.reverse();
      const pixels = [anchorPixel, ...path, targetPixels[targetIndex]];
      // Pull the grid route taut, always checking the whole shortcut.
      const smooth = [pixels[0]];
      for (let i = 0; i < pixels.length - 1;) {
        let next = pixels.length - 1;
        while (next > i + 1 && !clear(pixels[i], pixels[next])) next -= 1;
        smooth.push(pixels[next]);
        i = next;
      }
      routes[targetIndex] = smooth.map(point => normalizedPoint(point, width, height));
      missing -= 1;
    }
    const a = position(node), x = node % cols, y = Math.floor(node / cols);
    for (const [mx, my] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + mx, ny = y + my;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (parent[next] !== -2 || !clear(a, position(next))) continue;
      parent[next] = node;
      queue.push(next);
    }
  }
  return missing ? null : routes[0];
}

/** Choose a hint that also leaves the rest of the puzzle playable. */
export function connectHintRoute(game, lockedStrokes, reachedIndex, width, height) {
  const target = game.points[reachedIndex + 1];
  if (!target) return [];
  const options = {
    lockedStrokes, anchor: game.points[reachedIndex], width, height,
    clearance: game.clearance, sharedEndpointRadius: game.hitRadius + game.clearance + 6,
  };
  const playable = route => {
    if (!route?.length) return null;
    const actual = [route[0]];
    // Match the game's early arrival at the target circle, including its
    // final snap. That shortcut can change which later points stay reachable.
    for (const point of route.slice(1)) {
      const from = actual.at(-1);
      const hit = firstCircleHit(from, point, target, game.hitRadius, width, height);
      const collisionOptions = { ...options, activeStroke: actual };
      if (hit && !connectTrailCollision(hit, target, collisionOptions)) {
        if (connectTrailCollision(from, hit, collisionOptions)) return null;
        actual.push(hit, target);
        return planConnectContinuation(game, [...lockedStrokes, actual], reachedIndex + 1, width, height)
          ? actual : null;
      }
      if (connectTrailCollision(from, point, collisionOptions)) return null;
      actual.push(point);
    }
    return null;
  };
  const original = playable(game.solutionStrokes?.[reachedIndex]);
  if (original) return original;
  const route = playable(planConnectContinuation(game, lockedStrokes, reachedIndex, width, height));
  if (route) return route;
  // A straight shortcut may run over a later number. Protect those centres
  // while finding an alternative, then validate against real ink alone.
  const protectedPoints = game.points.slice(reachedIndex + 2).map(point => (
    Array.from({ length: 17 }, (_, index) => ({
      x: point.x + Math.cos(index * Math.PI / 8) * game.clearance * 1.5 / width,
      y: point.y + Math.sin(index * Math.PI / 8) * game.clearance * 1.5 / height,
    }))
  ));
  const nextOnly = { ...game, points: game.points.slice(0, reachedIndex + 2) };
  return playable(planConnectContinuation(nextOnly, [...lockedStrokes, ...protectedPoints], reachedIndex, width, height));
}

export function nextMazeSolutionPoint(game, current, width = 900, height = 620) {
  if (!game?.cellCenters?.length || !game?.passages?.length) return null;
  const origin = current ?? game.start;
  let startCell = 0;
  let nearestDistance = Infinity;
  game.cellCenters.forEach((point, index) => {
    const value = pointDistanceInPixels(point, origin, width, height);
    if (value < nearestDistance) {
      startCell = index;
      nearestDistance = value;
    }
  });
  const currentCenter = game.cellCenters[startCell];
  if (nearestDistance > Math.max(5, game.cellSize * 0.12)) return currentCenter;
  if (startCell === game.goalCell) return game.goal;

  const neighbours = Array.from({ length: game.cellCenters.length }, () => []);
  game.passages.forEach(([first, second]) => {
    neighbours[first].push(second);
    neighbours[second].push(first);
  });
  const queue = [startCell];
  const parent = new Map([[startCell, null]]);
  while (queue.length && !parent.has(game.goalCell)) {
    const cell = queue.shift();
    neighbours[cell].forEach((next) => {
      if (parent.has(next)) return;
      parent.set(next, cell);
      queue.push(next);
    });
  }
  if (!parent.has(game.goalCell)) return null;
  let next = game.goalCell;
  while (parent.get(next) !== startCell && parent.get(next) !== null) next = parent.get(next);
  return game.cellCenters[next] ?? null;
}
