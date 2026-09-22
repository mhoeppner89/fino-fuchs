import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTER_STROKES, CHARACTER_STROKE_GEOMETRY } from '../js/handwriting-stroke-data.js';
import { EXERCISE_BANKS, adaptTaskToViewport } from '../js/curriculum.js';
import { DrawingBoard, evaluateTaskDrawing, passesDrawingCriteria, pointAlongGuidePath } from '../js/drawing.js';

const vectors = JSON.parse(readFileSync(new URL('../design/print-handwriting-reference/clean-stroke-paths.json', import.meta.url)));
const oldTraces = JSON.parse(readFileSync(new URL('./fixtures/reference-traces-v1.3.43.json', import.meta.url)));
const getTask = (ch) => [...EXERCISE_BANKS.letters, ...EXERCISE_BANKS.numbers]
  .find((t) => t.id === `${/\d/.test(ch) ? 'number' : 'letter'}-${ch}-gross`);
const bounds = (strokes) => {
  const points = strokes.flat();
  return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
};

test('straight glyphs have only their intended straight segments and corners', () => {
  const counts = { A: [3, 2], E: [2, 2, 2, 2], F: [2, 2, 2], H: [2, 2, 2], I: [2], K: [2, 2, 2],
    L: [3], M: [5], N: [4], T: [2, 2], V: [3], W: [5], X: [2, 2], Y: [2, 3], Z: [4],
    v: [3], w: [5], x: [2, 2], y: [2, 2], z: [4], 1: [3], 4: [3, 2], 7: [3, 2] };
  for (const [ch, sizes] of Object.entries(counts)) {
    assert.deepEqual(CHARACTER_STROKES[ch].map((s) => s.length), sizes, ch);
    assert.ok(vectors.paths[ch].every((p) => !p.includes('C')), `${ch} must not bend its straight lines`);
  }
});

test('all previous reference traces still pass against the clean targets on every difficulty', () => {
  const viewport = { width: 900, height: 620 };
  for (const [ch, strokes] of Object.entries(oldTraces)) {
    const task = adaptTaskToViewport(getTask(ch), viewport);
    const target = bounds(task.strokes);
    const g = CHARACTER_STROKE_GEOMETRY[ch];
    const scale = (target.maxY-target.minY)*viewport.height/g.routeHeight;
    // Preserve physical source coordinates, including the old path's defects.
    // The new route's crop registration places them; no shape-fitting is used.
    const pen = strokes.map((s) => s.map(([x, y]) => ({
      x: target.minX+(x-g.routeX)*scale/viewport.width,
      y: target.minY+(y-g.routeY)*scale/viewport.height,
    })));
    for (const assist of ['easy', 'medium', 'hard']) {
      const config = DrawingBoard.prototype.evaluationOptions.call({ ...viewport, assist });
      assert.equal(passesDrawingCriteria(evaluateTaskDrawing(task, pen, config), assist), true, `${ch} ${assist}`);
    }
  }
});

test('the independently reconstructed handwritten A and joined R pass the current clean targets', () => {
  for (const name of ['handwritten-a', 'handwritten-a-rough', 'handwritten-r']) {
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
    const viewport = { width: fixture.width, height: fixture.height };
    const task = adaptTaskToViewport(getTask(name.endsWith('-r') ? 'R' : 'A'), viewport);
    const from = bounds(fixture.task.strokes);
    const to = bounds(task.strokes);
    const scale = (to.maxY-to.minY)/(from.maxY-from.minY);
    const centerX = (to.minX+to.maxX)/2;
    const pen = fixture.strokes.map((s) => s.map((p) => ({
      x: centerX+(p.x-(from.minX+from.maxX)/2)*scale,
      y: to.minY+(p.y-from.minY)*scale,
    })));
    const config = DrawingBoard.prototype.evaluationOptions.call({ ...viewport, assist: 'easy' });
    assert.equal(passesDrawingCriteria(evaluateTaskDrawing(task, pen, config), 'easy'), true, name);
  }
});


test('Fino reaches the exact M corners without rounding or cutting across them', () => {
  const stroke = CHARACTER_STROKES.M[0];
  const lengths = stroke.slice(1).map((p, i) => Math.hypot((p.x-stroke[i].x)*900, (p.y-stroke[i].y)*620));
  const total = lengths.reduce((a, b) => a+b, 0);
  let travelled = 0;
  stroke.forEach((p, i) => {
    if (i) travelled += lengths[i-1];
    const guide = pointAlongGuidePath(stroke, travelled/total, 900, 620, true);
    assert.ok(Math.hypot(guide.point.x-p.x*900, guide.point.y-p.y*620) < 1e-6);
  });
});

test('lowercase b draws its bowl without retracing the upright', () => {
  const [stem, bowl] = CHARACTER_STROKES.b;
  assert.equal(CHARACTER_STROKES.b.length, 2);
  assert.deepEqual(bowl.at(-1), stem.at(-1));
  assert.ok(bowl.at(-1).y > bowl[0].y, 'the open reversed C ends at the foot');
  const stemX = (y) => stem[0].x + (stem[1].x - stem[0].x) * (y - stem[0].y) / (stem[1].y - stem[0].y);
  for (const point of bowl.slice(2, -2)) {
    assert.ok((point.x - stemX(point.y)) * 900 > 0.2, 'the bowl must stay off the stem between its endpoints');
  }
});

test('3 has no crossing waist spur and 6 closes exactly at its loop junction', () => {
  const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for (const ch of ['3', '6']) {
    const path = CHARACTER_STROKES[ch][0];
    for (let i = 1; i < path.length; i++) {
      for (let j = i + 2; j < path.length; j++) {
        const a = path[i-1], b = path[i], c = path[j-1], d = path[j];
        const crossing = cross(a, b, c)*cross(a, b, d) < -1e-18 && cross(c, d, a)*cross(c, d, b) < -1e-18;
        assert.equal(crossing, false, `${ch}: reference crosses itself at ${i}/${j}`);
      }
    }
  }
  const six = CHARACTER_STROKES['6'][0];
  const closure = six.findIndex((p, i) => i < six.length - 2 && p.x === six.at(-1).x && p.y === six.at(-1).y);
  assert.ok(closure > 1, '6 ends at the existing junction with no curled continuation');
});
