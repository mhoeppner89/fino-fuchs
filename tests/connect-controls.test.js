import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingBoard } from '../js/drawing.js';
import { connectTrailCollision, planConnectContinuation, connectHintRoute, layoutConnect, createConnectSpec } from '../js/mini-games.js';

const width = 900, height = 620;
const point = (x, y) => ({ x, y });
const gameFor = points => ({ points, pointRadius: 34, hitRadius: 50, clearance: 10 });
function boardFor(game, viewport = { width, height }) {
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    ...viewport, task: { category: 'connect', gameMode: 'connect', game },
    gameState: { reachedIndex: 0, status: 'ready', collisions: 0 },
    activePointerId: null, activeStroke: null, gameDragOffset: null,
    userStrokes: [], strokeColors: [], inkColor: null, inkRevision: 0,
    canvas: { setPointerCapture() {} }, hooks: {},
    pointFromEvent: e => ({ x: e.clientX / viewport.width, y: e.clientY / viewport.height }),
    render() {}, requestRender() {}, stopDemo() {}, releasePointer() {}, flashGuide() {},
    showGameError(reason) { this.error = reason; },
    startGameHint() { this.hinted = true; },
  });
  return board;
}
const eventAt = (p, viewport = { width, height }) => ({ clientX: p.x * viewport.width, clientY: p.y * viewport.height, pointerId: 1, preventDefault() {} });
const move = (board, p) => board.onGamePointerMove(eventAt(p, board));

function assertClear(route, game, lockedStrokes, index = 0) {
  assert.ok(route?.length > 1);
  for (let i = 1; i < route.length; i++) {
    assert.equal(connectTrailCollision(route[i - 1], route[i], {
      lockedStrokes, activeStroke: route.slice(0, i), anchor: game.points[index],
      width, height, clearance: game.clearance,
      sharedEndpointRadius: game.hitRadius + game.clearance + 6,
    }), false, `route collides at segment ${i}`);
  }
}

test('Fino stays at the number on pickup and follows drag direction from every side', () => {
  for (const [ox, oy] of [[-40, 0], [40, 0], [0, -40], [0, 40]]) {
    const current = point(0.4, 0.5), board = boardFor(gameFor([current, point(0.85, 0.5)]));
    const pickup = point(current.x + ox / width, current.y + oy / height);
    board.onGamePointerDown(eventAt(pickup), pickup);
    assert.equal(board.activeStroke.length, 1, 'pickup must not draw a spur');
    assert.equal(board.activeStroke[0].x, current.x);
    move(board, point(pickup.x + 20 / width, pickup.y));
    assert.ok(Math.abs(board.activeStroke.at(-1).x - current.x - 20 / width) < 1e-9);
    assert.ok(Math.abs(board.activeStroke.at(-1).y - current.y) < 1e-9);
    assert.equal(board.error, undefined);
  }
});

test('a fast drag completes on pen-up even without a pointermove', () => {
  const game = gameFor([point(0.2, 0.5), point(0.7, 0.5)]), board = boardFor(game);
  board.onGamePointerDown(eventAt(game.points[0]), game.points[0]);
  board.onGamePointerUp(eventAt(game.points[1]));
  assert.equal(board.gameState.status, 'complete');
  assert.equal(board.gameState.reachedIndex, 1);
});

test('a generous target hit never snaps through an old line', () => {
  const game = gameFor([point(0.3, 0.5), point(0.62, 0.5)]), board = boardFor(game);
  board.userStrokes = [[point(0.6, 0), point(0.6, 1)]];
  board.strokeColors = ['#485469'];
  board.onGamePointerDown(eventAt(game.points[0]), game.points[0]);
  move(board, point(0.57, 0.5));
  assert.equal(board.gameState.reachedIndex, 0);
  assert.equal(board.gameState.status, 'drawing');
  move(board, point(0.61, 0.5));
  assert.equal(board.error, 'crossing');
  assert.equal(board.userStrokes.length, 1);
});

test('route hints go around the child’s ink instead of following an obsolete solution', () => {
  const game = gameFor([point(0.4, 0.75), point(0.4, 0.25)]);
  const ink = [[point(0.1, 0.5), point(0.85, 0.5)]];
  const route = connectHintRoute(game, ink, 0, width, height);
  assertClear(route, game, ink);
  assert.ok(route.length >= 3);
});

test('continuation checks detect a trapped later number, even if the next one is reachable', () => {
  const game = gameFor([point(0.2, 0.3), point(0.2, 0.7), point(0.8, 0.5)]);
  assert.equal(planConnectContinuation(game, [[point(0.5, 0), point(0.5, 1)]], 0, width, height), null);
});

test('a line that traps a remaining point is rolled back without losing previous links', () => {
  const game = gameFor([point(0.1, 0.1), point(0.2, 0.2), point(0.8, 0.5)]), board = boardFor(game);
  const previous = [point(0.05, 0.05), game.points[0]];
  board.activeStroke = [game.points[0], point(0.5, 0), point(0.5, 1), game.points[1]];
  board.userStrokes = [previous, board.activeStroke];
  board.strokeColors = ['#3F8FB5', '#DE6352'];
  board.activePointerId = 1;
  board.finishGameStroke(eventAt(game.points[1]));
  assert.equal(board.error, 'blocked');
  assert.equal(board.hinted, true);
  assert.equal(board.gameState.reachedIndex, 0);
  assert.deepEqual(board.userStrokes, [previous]);
  assert.deepEqual(board.strokeColors, ['#3F8FB5']);
});

test('chosen ink applies to future strokes and Bunt restores planned colours', () => {
  const game = gameFor([point(0.2, 0.5), point(0.7, 0.5)]), board = boardFor(game);
  board.task.strokeColors = ['#3F8FB5'];
  board.setInkColor('#DE6352');
  board.onGamePointerDown(eventAt(game.points[0]), game.points[0]);
  board.onGamePointerUp(eventAt(game.points[1]));
  assert.deepEqual(board.strokeColors, ['#DE6352']);
  board.setInkColor('#58A765');
  assert.deepEqual(board.strokeColors, ['#DE6352'], 'existing ink keeps its colour');
  assert.equal(board.colorForStroke(0), '#58A765');
  board.setInkColor(null);
  assert.equal(board.colorForStroke(0), '#3F8FB5');
});

test('previously trapped generated puzzles leave every future number reachable', () => {
  for (const [seed, w, h] of [[64, 537, 370], [44, 1024, 768], [76, 1024, 768], [92, 1024, 768]]) {
    const spec = createConnectSpec(seed, 4), game = layoutConnect(spec, { width: w, height: h });
    assert.equal(game.points.length, spec.count);
    for (let stage = 0; stage < game.points.length - 1; stage++) {
      assert.ok(planConnectContinuation(game, game.solutionStrokes.slice(0, stage), stage, w, h), `${seed}/${stage}`);
    }
  }
});

test('all 100 point puzzles complete through real input logic and live hints on phone and tablet', () => {
  for (const viewport of [{ width: 900, height: 620 }, { width: 537, height: 370 }, { width: 280, height: 653 }]) {
    for (let seed = 1; seed <= 100; seed++) {
      const game = layoutConnect(createConnectSpec(seed, 1 + (seed - 1) % 4), viewport);
      const board = boardFor(game, viewport);
      for (let stage = 0; stage < game.points.length - 1; stage++) {
        const label = `${seed}/${stage} on ${viewport.width}x${viewport.height}`;
        const route = connectHintRoute(game, board.userStrokes, stage, viewport.width, viewport.height);
        assert.ok(route?.length, `no safe hint at ${label}`);
        const offset = { x: (stage % 2 ? -18 : 18) / viewport.width, y: 12 / viewport.height };
        const pickup = point(route[0].x + offset.x, route[0].y + offset.y);
        board.onGamePointerDown(eventAt(pickup, viewport), pickup);
        for (let i = 1; i < route.length && board.activeStroke; i++) {
          const a = route[i - 1], b = route[i];
          const steps = Math.ceil(Math.hypot((b.x - a.x) * viewport.width, (b.y - a.y) * viewport.height) / 6);
          for (let j = 1; j <= steps && board.activeStroke; j++) {
            move(board, point(a.x + (b.x - a.x) * j / steps + offset.x, a.y + (b.y - a.y) * j / steps + offset.y));
          }
        }
        assert.equal(board.gameState.reachedIndex, stage + 1, `${label}: ${board.error ?? 'did not arrive'}`);
      }
      assert.equal(board.gameState.status, 'complete');
    }
  }
});

test('an off-centre grab can still steer Fino along the canvas edge', () => {
  const game = gameFor([point(0.3, 0.1), point(0.8, 0.1)]), board = boardFor(game);
  board.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
  board.pointFromEvent = DrawingBoard.prototype.pointFromEvent;
  const pickup = point(0.3, 0.1 - 35 / height);
  board.onGamePointerDown(eventAt(pickup), pickup);
  move(board, point(0.35, (8 - 35) / height));
  assert.ok(Math.abs(board.activeStroke.at(-1).y * height - 8) < 1e-8);
});
