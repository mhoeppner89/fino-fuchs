import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoStageAtProgress,
  DEMO_SPEED_MULTIPLIER,
  drawingBounds,
  evaluateDrawing,
  feedbackForEvaluation,
  GUIDE_STYLES,
  TEMPLATE_STYLES,
  guidePresentationForTask,
  inkColorAt,
  INK_COLORS,
  guideStagesForTask,
  visibleGuideIndexes,
  nextGuideStrokeIndex,
  passesDrawingCriteria,
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

test('a child may trace inside a generous band without following the exact centre line', () => {
  const vertical = [[{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }]];
  const kindOffset = [[{ x: 0.56, y: 0.18 }, { x: 0.56, y: 0.82 }]];
  const tooFar = [[{ x: 0.65, y: 0.18 }, { x: 0.65, y: 0.82 }]];
  const options = { width: 900, height: 620, tolerance: 620 * 0.11, completionTolerance: 620 * 0.11 };
  assert.equal(passesDrawingCriteria(evaluateDrawing(vertical, kindOffset, options), 'easy'), true);
  assert.equal(passesDrawingCriteria(evaluateDrawing(vertical, tooFar, options), 'easy'), false);
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
  assert.equal(passesDrawingCriteria(result, 'easy'), true);
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

test('explicit character groups keep close copies incomplete until every copy is traced', () => {
  const stackedOnes = [
    [{ x: 0.5, y: 0.08 }, { x: 0.5, y: 0.31 }],
    [{ x: 0.5, y: 0.37 }, { x: 0.5, y: 0.6 }],
    [{ x: 0.5, y: 0.66 }, { x: 0.5, y: 0.89 }],
  ];
  const result = evaluateDrawing(stackedOnes, stackedOnes.slice(0, 2), {
    width: 900,
    height: 600,
    tolerance: 600 * 0.068,
    completionGroups: [[0], [1], [2]],
  });
  assert.ok(result.coverage > 0.6, `global coverage was ${result.coverage}`);
  assert.ok(result.completion < 0.55, `missing-copy completion was ${result.completion}`);
});

test('Fino selects the first guide stroke that is still uncovered', () => {
  const cross = [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.82, y: 0.5 }],
  ];
  const splitVertical = [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }],
    [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.82 }],
  ];
  assert.equal(nextGuideStrokeIndex(cross, splitVertical, { width: 900, height: 600, tolerance: 600 * 0.068 }), 1);
});

test('a missing required path cannot be forgiven by a quality retry', () => {
  const capitalA = [
    [{ x: 0.25, y: 0.82 }, { x: 0.5, y: 0.16 }],
    [{ x: 0.5, y: 0.16 }, { x: 0.75, y: 0.82 }],
    [{ x: 0.34, y: 0.55 }, { x: 0.66, y: 0.55 }],
  ];
  const result = evaluateDrawing(capitalA, capitalA.slice(0, 2), {
    width: 900,
    height: 620,
    tolerance: 620 * 0.068,
    completionGroups: [[0, 1, 2]],
  });
  assert.equal(result.pathCoverage[2], 0);
  assert.equal(result.completion, 0);
  assert.equal(passesDrawingCriteria(result, 'easy'), false);
  assert.equal(passesDrawingCriteria(result, 'easy', { slack: 0.04 }), false);
});

test('Fino scans the guide in writing order instead of jumping to the emptiest later path', () => {
  const paths = [
    [{ x: 0.16, y: 0.18 }, { x: 0.16, y: 0.82 }],
    [{ x: 0.16, y: 0.18 }, { x: 0.38, y: 0.5 }],
    [{ x: 0.16, y: 0.82 }, { x: 0.38, y: 0.5 }],
    [{ x: 0.68, y: 0.18 }, { x: 0.68, y: 0.82 }],
  ];
  assert.equal(nextGuideStrokeIndex(paths, [paths[0]], {
    width: 900,
    height: 620,
    tolerance: 620 * 0.068,
    completionGroups: [[0, 1, 2], [3]],
  }), 1);
});

test('the helper follows the same rounded curve as the dotted guide', () => {
  const stroke = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  const guide = pointAlongGuidePath(stroke, 0.2, 145, 100);
  const bounds = drawingBounds(145, 100);
  const curveT = Math.sqrt((guide.point.x - bounds.x) / (bounds.width / 2));
  const expectedY = bounds.y + bounds.height * (2 * curveT - curveT ** 2);
  assert.ok(guide.point.x > bounds.x && guide.point.x < bounds.x + bounds.width / 2);
  assert.ok(Math.abs(guide.point.y - expectedY) < 0.001);
});

test('the starting helper includes a jump between distinct strokes', () => {
  const stage = demoStageAtProgress(2, 0.5);
  assert.equal(stage.type, 'jump');
  assert.equal(stage.fromStroke, 0);
  assert.equal(stage.toStroke, 1);
  assert.ok(Math.abs(stage.progress - 0.5) < 0.0001);
});

test('the drawing board uses the full measured rectangle in portrait and landscape', () => {
  const portrait = drawingBounds(366, 608);
  const landscape = drawingBounds(844, 390);
  assert.deepEqual(portrait, { x: 0, y: 0, width: 366, height: 608 });
  assert.deepEqual(landscape, { x: 0, y: 0, width: 844, height: 390 });
});

test('complex pictures and multi-symbol tasks reveal guides in small stages', () => {
  const flower = {
    category: 'shapes',
    strokes: Array.from({ length: 5 }, () => [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]),
    completionGroups: [[0], [1], [2], [3], [4]],
  };
  const word = {
    category: 'letters',
    strokes: Array.from({ length: 4 }, () => [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]),
    completionGroups: [[0], [1], [2], [3]],
  };
  assert.deepEqual(guideStagesForTask(flower), [[0, 1], [2, 3], [4]]);
  assert.deepEqual(guideStagesForTask(word), [[0], [1], [2], [3]]);
});

test('completed guide stages stay visible while Fino works on the next stage', () => {
  const stages = [[0, 1], [2], [3, 4]];
  assert.deepEqual(visibleGuideIndexes(stages, 0), [0, 1]);
  assert.deepEqual(visibleGuideIndexes(stages, 1), [0, 1, 2]);
  assert.deepEqual(visibleGuideIndexes(stages, 2), [0, 1, 2, 3, 4]);
});

test('each new pen stroke receives a different friendly ink color', () => {
  assert.ok(INK_COLORS.length >= 4);
  for (let index = 0; index < INK_COLORS.length * 2; index += 1) {
    assert.notEqual(inkColorAt(index), inkColorAt(index + 1));
  }
});

test('dotted shape and line routes stay clearly visible at every difficulty', () => {
  assert.deepEqual(Object.keys(GUIDE_STYLES), ['easy', 'medium', 'hard']);
  assert.ok(GUIDE_STYLES.easy.alpha >= 0.75);
  assert.ok(GUIDE_STYLES.medium.alpha >= 0.65);
  assert.ok(GUIDE_STYLES.hard.alpha >= 0.55);
  assert.ok(GUIDE_STYLES.easy.alpha > GUIDE_STYLES.medium.alpha);
  assert.ok(GUIDE_STYLES.medium.alpha > GUIDE_STYLES.hard.alpha);
});

test('letters, numbers, and names use solid transparent templates', () => {
  assert.deepEqual(Object.keys(TEMPLATE_STYLES), ['easy', 'medium', 'hard']);
  ['letters', 'numbers', 'name'].forEach((category) => {
    const presentation = guidePresentationForTask({ category }, 'easy');
    assert.equal(presentation.template, true);
    assert.deepEqual(presentation.dash, []);
    assert.ok(presentation.width > GUIDE_STYLES.easy.width);
    assert.ok(presentation.alpha >= 0.2 && presentation.alpha < 0.4);
  });
  const shapePresentation = guidePresentationForTask({ category: 'shapes' }, 'easy');
  assert.equal(shapePresentation.template, false);
  assert.deepEqual(shapePresentation.dash, GUIDE_STYLES.easy.dash);
});

test('Fino previews are set to one-and-a-half times the former speed', () => {
  assert.equal(DEMO_SPEED_MULTIPLIER, 1.5);
});
