import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_BANKS, adaptTaskToViewport } from '../js/curriculum.js';
import { DrawingBoard, evaluateTaskDrawing, passesDrawingCriteria } from '../js/drawing.js';

const options = (viewport, assist = 'easy') => (
  DrawingBoard.prototype.evaluationOptions.call({ ...viewport, assist })
);
const evaluate = (task, ink, viewport, assist = 'easy') => (
  evaluateTaskDrawing(task, ink, options(viewport, assist))
);
const passes = (result, assist = 'easy', slack = 0) => (
  passesDrawingCriteria(result, assist, { qualityAdjustment: 0.08, slack })
);

test('picture recognition cannot complete an untouched second sail or rocket plume', () => {
  const viewport = { width: 844, height: 390 };
  for (const id of ['shape-sailboat', 'shape-rocket']) {
    const task = adaptTaskToViewport(EXERCISE_BANKS.shapes.find((candidate) => candidate.id === id), viewport);
    const ink = task.strokes.map((stroke, index) => stroke.map((point) => {
      if (id === 'shape-sailboat') {
        // A first sail drawn only 7.8 px to the left previously credited the
        // missing second sail after the whole-picture alignment rescue.
        return { x: point.x - (index === 1 ? 0.02 * viewport.height / viewport.width : 0), y: point.y };
      }
      // Child-like fins drawn a little lower and closer together similarly
      // let their ink stand in for a plume that had not been attempted.
      return {
        x: point.x + (index === 2 || index === 3 ? (0.5 - point.x) * 0.2 : 0),
        y: point.y + (index === 2 || index === 3 ? 0.07 : 0),
      };
    }));
    const incomplete = evaluate(task, ink.slice(0, -1), viewport);
    assert.equal(incomplete.identity.pass, true, `${id}: fixture must exercise the recognition bypass`);
    assert.equal(incomplete.shapePathPresence.at(-1), false, `${id}: final part has no independent ink`);
    assert.equal(incomplete.allRequired, false, `${id}: wait for the final part`);
    assert.equal(passes(incomplete), false, `${id}: incomplete picture must not finish`);
    assert.equal(passes(incomplete, 'easy', 0.08), false, `${id}: retries cannot skip a part`);
    const board = Object.assign(Object.create(DrawingBoard.prototype), {
      ...viewport, task, assist: 'easy', userStrokes: ink.slice(0, -1), rejectedStrokes: new Set(), inkRevision: 1,
    });
    assert.equal(board.nextGuideStrokeIndex(), task.strokes.length - 1, `${id}: Fino points to the missing part`);
    assert.ok(board.activeGuideStrokeIndexes().includes(task.strokes.length - 1), `${id}: final guide is visible`);
    assert.equal(passes(evaluate(task, ink, viewport)), true, `${id}: adding the missing part completes the same drawing`);
  }
});

test('omitting any individual picture part stays incomplete even with easy retry slack', () => {
  for (const viewport of [{ width: 390, height: 700 }, { width: 844, height: 390 }]) {
    for (const source of EXERCISE_BANKS.shapes) {
      const task = adaptTaskToViewport(source, viewport);
      task.strokes.forEach((_, omitted) => {
        const result = evaluate(task, task.strokes.filter((_, index) => index !== omitted), viewport);
        assert.equal(passes(result, 'easy', 0.08), false,
          `${task.id}: omitted part ${omitted} at ${viewport.width}x${viewport.height}`);
      });
    }
  }
});

test('every shipped picture stays incomplete until its final guide part is drawn on every difficulty', () => {
  for (const viewport of [{ width: 390, height: 700 }, { width: 844, height: 390 }]) {
    for (const source of EXERCISE_BANKS.shapes) {
      const task = adaptTaskToViewport(source, viewport);
      for (const assist of ['easy', 'medium', 'hard']) {
        for (let count = 0; count <= task.strokes.length; count += 1) {
          const ink = task.strokes.slice(0, count);
          const result = evaluate(task, ink, viewport, assist);
          assert.equal(passes(result, assist, 0.08), count === task.strokes.length,
            `${task.id}: ${count}/${task.strokes.length} parts at ${assist} ${viewport.width}x${viewport.height}`);
          if (count < task.strokes.length) {
            const board = Object.assign(Object.create(DrawingBoard.prototype), {
              ...viewport, task, assist, userStrokes: ink, rejectedStrokes: new Set(), inkRevision: 1,
              evaluationCache: { revision: 1, result },
            });
            assert.equal(board.nextGuideStrokeIndex(), count, `${task.id}: Fino must show part ${count}`);
          }
        }
      }
    }
  }
});

test('picture completion accepts split, reversed, and joined pen movements', () => {
  const viewport = { width: 390, height: 700 };
  const boat = adaptTaskToViewport(EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-sailboat'), viewport);
  const split = boat.strokes.flatMap((stroke) => {
    const middle = Math.floor(stroke.length / 2);
    return [stroke.slice(0, middle + 1), stroke.slice(middle)];
  }).reverse().map((stroke) => [...stroke].reverse());
  assert.equal(passes(evaluate(boat, split, viewport)), true);

  const cross = adaptTaskToViewport(EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-cross'), viewport);
  const [vertical, horizontal] = cross.strokes;
  const center = { x: vertical[0].x, y: horizontal[0].y };
  const joined = [[vertical[0], center, horizontal[0], horizontal.at(-1), center, vertical.at(-1)]];
  assert.equal(passes(evaluate(cross, joined, viewport)), true);
});
