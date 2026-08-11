import test from 'node:test';
import assert from 'node:assert/strict';
import {
  connectSolutionStrokes,
  connectTrailCollision,
  createConnectSpec,
  createMazeSpec,
  firstCircleHit,
  layoutConnect,
  layoutMaze,
  mazeWallCollision,
  nextMazeSolutionPoint,
  pointDistanceInPixels,
} from '../js/mini-games.js';

const VIEWPORTS = [
  { width: 280, height: 653 },
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

test('all shipped labyrinths are deterministic, distinct, bounded, and solvable', () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 100; seed += 1) {
    const complexity = 1 + ((seed - 1) % 3);
    const spec = createMazeSpec(seed, complexity);
    assert.deepEqual(createMazeSpec(seed, complexity), spec);
    assert.notEqual(spec.startCell, spec.goalCell);
    assert.equal(spec.solutionCells[0], spec.startCell);
    assert.equal(spec.solutionCells.at(-1), spec.goalCell);
    signatures.add(JSON.stringify([spec.cols, spec.rows, spec.startCell, spec.goalCell, spec.walls]));

    VIEWPORTS.forEach((viewport) => {
      const game = layoutMaze(spec, viewport);
      assert.ok(game.cellSize >= 36, `${seed} corridors became too small on ${viewport.width}x${viewport.height}`);
      assert.ok(game.start.x > 0 && game.start.x < 1 && game.start.y > 0 && game.start.y < 1);
      assert.ok(game.goal.x > 0 && game.goal.x < 1 && game.goal.y > 0 && game.goal.y < 1);
      game.solution.slice(1).forEach((point, index) => {
        assert.equal(
          mazeWallCollision(game.solution[index], point, game, viewport.width, viewport.height, game.wallWidth / 2 + 2),
          false,
          `solution ${seed} hits a wall at step ${index}`,
        );
      });
      game.walls.slice(0, 8).forEach((wall) => {
        const middle = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
        const horizontal = Math.abs(wall.a.y - wall.b.y) < 1e-8;
        const delta = horizontal
          ? { x: 0, y: 10 / viewport.height }
          : { x: 10 / viewport.width, y: 0 };
        assert.equal(mazeWallCollision(
          { x: middle.x - delta.x, y: middle.y - delta.y },
          { x: middle.x + delta.x, y: middle.y + delta.y },
          game,
          viewport.width,
          viewport.height,
          1,
        ), true, `wall ${seed} can be tunneled through`);
      });
    });
  }
  assert.equal(signatures.size, 100);
});

test('all shipped point paths fit every screen and their intended route never crosses itself', () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 100; seed += 1) {
    const complexity = 1 + ((seed - 1) % 3);
    const spec = createConnectSpec(seed, complexity);
    VIEWPORTS.forEach((viewport) => {
      const game = layoutConnect(spec, viewport);
      const strokes = connectSolutionStrokes(game.points);
      assert.ok(game.hitRadius >= 22);
      game.points.forEach((point) => {
        assert.ok(point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98);
      });
      for (let index = 1; index < game.points.length; index += 1) {
        const from = game.points[index - 1];
        const to = game.points[index];
        const lockedStrokes = strokes.slice(0, index - 1);
        assert.equal(connectTrailCollision(from, to, {
          lockedStrokes,
          activeStroke: [from],
          anchor: from,
          width: viewport.width,
          height: viewport.height,
          clearance: 8,
          junctionRadius: game.hitRadius,
        }), false, `point solution ${seed} crosses itself at ${index}`);
        assert.ok(pointDistanceInPixels(from, to, viewport.width, viewport.height) > game.hitRadius * 1.6);
      }
      if (viewport.width === 1024 && viewport.height === 768) signatures.add(JSON.stringify(game.points));
    });
  }
  assert.equal(signatures.size, 100);
});

test('point collision ignores its shared endpoint but catches an old crossing', () => {
  const lockedStrokes = [[{ x: 0.15, y: 0.5 }, { x: 0.5, y: 0.5 }]];
  assert.equal(connectTrailCollision(
    { x: 0.5, y: 0.5 },
    { x: 0.7, y: 0.3 },
    { lockedStrokes, activeStroke: [{ x: 0.5, y: 0.5 }], anchor: { x: 0.5, y: 0.5 }, width: 900, height: 620 },
  ), false);
  assert.equal(connectTrailCollision(
    { x: 0.7, y: 0.2 },
    { x: 0.3, y: 0.8 },
    { lockedStrokes, activeStroke: [{ x: 0.7, y: 0.2 }], anchor: { x: 0.7, y: 0.2 }, width: 900, height: 620 },
  ), true);
});

test('labyrinth difficulty has clearly separated route lengths', () => {
  const lengths = [1, 2, 3].map((complexity) => (
    Array.from({ length: 100 }, (_, index) => createMazeSpec(index + 1, complexity).solutionCells.length)
  ));
  assert.ok(Math.max(...lengths[0]) < Math.min(...lengths[1]), 'easy and medium labyrinths overlap');
  assert.ok(Math.max(...lengths[1]) < Math.min(...lengths[2]), 'medium and hard labyrinths overlap');
});

test('labyrinth hints always choose a reachable neighbouring cell', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const viewport = VIEWPORTS[seed % VIEWPORTS.length];
    const complexity = 1 + ((seed - 1) % 3);
    const game = layoutMaze(createMazeSpec(seed, complexity), viewport);
    game.cellCenters.forEach((current, cell) => {
      const next = nextMazeSolutionPoint(game, current, viewport.width, viewport.height);
      assert.ok(next, `maze ${seed} has no hint from cell ${cell}`);
      assert.equal(
        mazeWallCollision(current, next, game, viewport.width, viewport.height, game.wallWidth / 2 + 2),
        false,
        `maze ${seed} hint crosses a wall from cell ${cell}`,
      );
    });
  }
});

test('goal-circle intersection stops a fast gesture before its overshoot', () => {
  const hit = firstCircleHit(
    { x: 0.2, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: 0.6, y: 0.5 },
    24,
    800,
    600,
  );
  assert.ok(hit);
  assert.ok(hit.x > 0.55 && hit.x < 0.6);
  assert.equal(hit.y, 0.5);
});

test('sparse point paths still collide away from the shared anchor', () => {
  const lockedStrokes = [[{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }]];
  assert.equal(connectTrailCollision(
    { x: 0.5, y: 0.5 },
    { x: 0.465, y: 0.5 },
    {
      lockedStrokes,
      activeStroke: [{ x: 0.5, y: 0.5 }],
      anchor: { x: 0.5, y: 0.5 },
      width: 900,
      height: 620,
      clearance: 9,
      junctionRadius: 24,
      sharedEndpointRadius: 11,
    },
  ), true);
});

test('a new sparse segment cannot cross an old line far from its anchor', () => {
  const anchor = { x: 0.5, y: 0.5 };
  const lockedStrokes = [[{ x: 0.1, y: 0.5 }, anchor]];
  const activeStroke = [anchor, { x: 0.5, y: 0.8 }];
  assert.equal(connectTrailCollision(
    activeStroke.at(-1),
    { x: 0.25, y: 0.2 },
    { lockedStrokes, activeStroke, anchor, width: 900, height: 620, clearance: 9, junctionRadius: 24 },
  ), true);
});

test('active point path catches a fast self-crossing beyond its recent tail', () => {
  const activeStroke = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];
  assert.equal(connectTrailCollision(
    activeStroke.at(-1),
    { x: 0.5, y: 0.1 },
    {
      activeStroke,
      anchor: activeStroke[0],
      width: 900,
      height: 620,
      clearance: 9,
      junctionRadius: 24,
    },
  ), true);
});
