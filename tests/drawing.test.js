import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDrawing, feedbackForEvaluation } from '../js/drawing.js';

const expected = [[{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]];

test('an exact trace receives a near-perfect score', () => {
  const result = evaluateDrawing(expected, expected, { width: 900, height: 600 });
  assert.ok(result.score > 0.98, `score was ${result.score}`);
  assert.ok(result.coverage > 0.98);
  assert.ok(result.precision > 0.98);
});

test('a slightly imperfect child-like trace remains acceptable', () => {
  const user = [[
    { x: 0.19, y: 0.22 },
    { x: 0.34, y: 0.33 },
    { x: 0.5, y: 0.52 },
    { x: 0.67, y: 0.66 },
    { x: 0.82, y: 0.79 },
  ]];
  const result = evaluateDrawing(expected, user, { width: 900, height: 600 });
  assert.ok(result.score > 0.78, `score was ${result.score}`);
});

test('an unrelated scribble scores substantially lower', () => {
  const scribble = [[
    { x: 0.05, y: 0.9 },
    { x: 0.95, y: 0.9 },
    { x: 0.05, y: 0.1 },
    { x: 0.95, y: 0.1 },
  ]];
  const result = evaluateDrawing(expected, scribble, { width: 900, height: 600 });
  assert.ok(result.score < 0.5, `score was ${result.score}`);
});

test('empty input produces a useful prompt', () => {
  const result = evaluateDrawing(expected, [], { width: 900, height: 600 });
  assert.equal(result.hasInk, false);
  assert.match(feedbackForEvaluation(result), /Zeichne zuerst/);
});

test('stroke direction is measured independently', () => {
  const reverse = [[{ x: 0.8, y: 0.8 }, { x: 0.2, y: 0.2 }]];
  const result = evaluateDrawing(expected, reverse, { width: 900, height: 600 });
  assert.ok(result.direction < 0.1, `direction was ${result.direction}`);
  assert.ok(result.coverage > 0.95);
});
