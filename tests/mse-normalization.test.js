import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptTaskToViewport, buildReviewSession, EXERCISE_BANKS } from '../js/curriculum.js';
import { DrawingBoard, evaluateDrawing, evaluateTaskDrawing, passesDrawingCriteria } from '../js/drawing.js';

const options = (width, height, assist = 'easy') => (
  DrawingBoard.prototype.evaluationOptions.call({ width, height, assist })
);
const fixtures = ['handwritten-a', 'handwritten-a-rough', 'handwritten-r'].map((name) => (
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))
));

test('screenshot A and joined R reconstructions pass easy at every display scale', () => {
  for (const fixture of fixtures) {
    let baseline;
    for (const factor of [0.25, 0.5, 1, 2]) {
      const config = options(fixture.width * factor, fixture.height * factor);
      const result = evaluateTaskDrawing(fixture.task, fixture.strokes, config);
      assert.equal(passesDrawingCriteria(result, 'easy'), true, `${fixture.task.id} at ${factor}`);
      baseline ??= result;
      assert.ok(Math.abs(result.symmetricMse - baseline.symmetricMse) < 1e-10);
      assert.ok(Math.abs(result.identity.groups[0].coreMse - baseline.identity.groups[0].coreMse) < 1e-10);
      const incomplete = evaluateTaskDrawing(fixture.task, fixture.strokes.slice(0, 1), config);
      assert.equal(passesDrawingCriteria(incomplete, 'easy'), false, 'first movement alone is incomplete');
    }
  }
});

test('MSE integrates ink length, independent of pointer density and short pen fragments', () => {
  const expected = [
    [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }],
    [{ x: 0.1, y: 0.8 }, { x: 0.2, y: 0.8 }],
  ];
  const offset = expected[1].map((point) => ({ ...point, y: point.y + 20 / 390 }));
  const dense = Array.from({ length: 101 }, (_, i) => ({
    x: offset[0].x + i / 100 * (offset[1].x - offset[0].x), y: offset[0].y,
  }));
  const variants = [[expected[0], offset], [expected[0], dense],
    [expected[0], ...dense.slice(1).map((point, i) => [dense[i], point])]];
  for (const user of variants) {
    const result = evaluateDrawing(expected, user, { width: 390, height: 390, tolerance: 30 });
    // One ninth of the ink is displaced by 20 px inside a 30 px band.
    assert.ok(Math.abs(result.userMse - (20 / 30) ** 2 / 9) < 1e-10);
    assert.ok(Math.abs(result.targetMse - result.userMse) < 1e-10);
  }
});

test('identity sampling keeps the end of a drawing after many short pen movements', () => {
  const task = { category: 'letters', strokes: [[{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]], completionGroups: [[0]] };
  const parts = Array.from({ length: 150 }, (_, i) => [
    { x: 0.2 + 0.6 * i / 150, y: 0.2 + 0.6 * i / 150 },
    { x: 0.2 + 0.6 * (i + 1) / 150, y: 0.2 + 0.6 * (i + 1) / 150 },
  ]);
  for (const assist of ['easy', 'medium', 'hard']) {
    const result = evaluateTaskDrawing(task, parts, options(390, 700, assist));
    assert.equal(passesDrawingCriteria(result, assist), true);
  }
});

test('dots accept taps and small wobbly marks, but one mark cannot complete two dots', () => {
  const viewport = { width: 390, height: 700 };
  for (const symbol of ['i', 'j', 'ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü']) {
    const task = adaptTaskToViewport(EXERCISE_BANKS.letters.find((t) => t.id === `letter-${symbol}-gross`), viewport);
    const dots = task.strokes.filter((stroke) => stroke.length === 1).flat();
    const body = task.strokes.filter((stroke) => stroke.length > 1);
    for (const assist of ['easy', 'medium', 'hard']) {
      const config = options(viewport.width, viewport.height, assist);
      const check = (strokes) => passesDrawingCriteria(evaluateTaskDrawing(task, strokes, config), assist);
      assert.equal(check(task.strokes), true, `${symbol} stationary taps ${assist}`);
      const smallMarks = dots.map((dot) => [
        { x: dot.x + 3 / viewport.width, y: dot.y - 3 / viewport.height },
        { x: dot.x + 6 / viewport.width, y: dot.y },
        { x: dot.x + 3 / viewport.width, y: dot.y + 3 / viewport.height },
      ]);
      assert.equal(check([...body, ...smallMarks]), true, `${symbol} small marks ${assist}`);
      assert.equal(check(body), false, `${symbol} no dots ${assist}`);
      if (dots.length === 2) {
        const middle = { x: (dots[0].x + dots[1].x) / 2, y: (dots[0].y + dots[1].y) / 2 };
        for (const wrong of [[[middle]], [[middle], [middle]], [[dots[0]], [dots[0]]], [dots]]) {
          assert.equal(check([...body, ...wrong]), false, `${symbol} missing or merged dots ${assist}`);
        }
      }
    }
  }
  const dot = [[{ x: 0.5, y: 0.5 }]];
  assert.equal(passesDrawingCriteria(evaluateDrawing(dot, dot), 'easy'), true);
  const longLine = [[{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }]];
  assert.equal(passesDrawingCriteria(evaluateDrawing(longLine, dot), 'easy'), false);
});

test('all 69 review characters retain exact-trace acceptance on three levels and display scales', () => {
  for (const assist of ['easy', 'medium', 'hard']) {
    for (const source of buildReviewSession({ assist })) {
      const task = adaptTaskToViewport(source, { width: 390, height: 700 });
      for (const scale of [0.75, 1, 3]) {
        const result = evaluateTaskDrawing(task, task.strokes, options(390 * scale, 700 * scale, assist));
        assert.equal(passesDrawingCriteria(result, assist), true, `${task.id} ${assist} ${scale}`);
      }
    }
  }
});
