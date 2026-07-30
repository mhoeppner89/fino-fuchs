import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoStageAtProgress,
  evaluateDrawing,
  feedbackForEvaluation,
  pointAlongGuidePath,
} from '../js/drawing.js';

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

test('a complete cross can be recognised even when drawn as one continuous stroke', () => {
  const cross = [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.82, y: 0.5 }],
  ];
  const continuousCross = [[
    { x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }, { x: 0.18, y: 0.5 },
    { x: 0.82, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.82 },
  ]];
  const result = evaluateDrawing(cross, continuousCross, { width: 900, height: 600, tolerance: 600 * 0.068 });
  assert.ok(result.score > 0.7, `score was ${result.score}`);
  assert.equal(result.strokeCount < 1, true);
});

test('a repeated number does not finish while one copy is still missing', () => {
  const repeatedOnes = [
    [{ x: 0.18, y: 0.2 }, { x: 0.18, y: 0.8 }],
    [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }],
    [{ x: 0.82, y: 0.2 }, { x: 0.82, y: 0.8 }],
  ];
  const firstTwo = repeatedOnes.slice(0, 2);
  const result = evaluateDrawing(repeatedOnes, firstTwo, { width: 900, height: 600, tolerance: 600 * 0.068 });
  assert.ok(result.coverage > 0.6, `global coverage was ${result.coverage}`);
  assert.ok(result.completion < 0.05, `missing-copy completion was ${result.completion}`);
  assert.equal(result.componentCoverage.length, 3);
});

test('the helper follows the same rounded curve as the dotted guide', () => {
  const stroke = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  const guide = pointAlongGuidePath(stroke, 0.2, 100, 100);
  const curveT = Math.sqrt(guide.point.x / 50);
  const expectedY = 200 * curveT - 100 * curveT ** 2;
  assert.ok(guide.point.x > 0 && guide.point.x < 50);
  assert.ok(Math.abs(guide.point.y - expectedY) < 0.001);
});

test('the starting helper includes a jump between distinct strokes', () => {
  const stage = demoStageAtProgress(2, 0.5);
  assert.equal(stage.type, 'jump');
  assert.equal(stage.fromStroke, 0);
  assert.equal(stage.toStroke, 1);
  assert.ok(Math.abs(stage.progress - 0.5) < 0.0001);
});
