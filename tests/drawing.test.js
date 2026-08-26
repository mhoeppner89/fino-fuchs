import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoRunDuration,
  demoStageAtProgress,
  DEMO_SPEED_MULTIPLIER,
  DrawingBoard,
  drawingBounds,
  evaluateDrawing,
  feedbackForEvaluation,
  GUIDE_STYLES,
  TEMPLATE_STYLES,
  guidePresentationForTask,
  inkColorAt,
  INK_COLORS,
  judgeStrokeAgainstRoute,
  guideStagesForTask,
  visibleGuideIndexes,
  nextGuideStrokeIndex,
  passesDrawingCriteria,
  pointAlongGuidePath,
  strokeMatchesAnyRoute,
  usesPenFollowingFino,
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

test('a full-name task shows its complete aligned template while Fino stays staged', () => {
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    task: {
      category: 'name',
      layout: 'whole-name-landscape-3',
      strokes: expected.concat(expected, expected),
      completionGroups: [[0], [1], [2]],
    },
    userStrokes: [],
  });
  assert.deepEqual(board.visibleGuideStrokeIndexes(), [0, 1, 2]);
  assert.deepEqual(board.activeGuideStrokeIndexes(), [0]);
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
  assert.ok(result.pathCoverage[2] < 0.8, `missing crossbar coverage was ${result.pathCoverage[2]}`);
  assert.ok(result.completion < 0.7, `missing crossbar completion was ${result.completion}`);
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

test('rotation discards only the unfinished stroke before responsive reflow', () => {
  const finished = [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.4 }];
  const unfinished = [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.62 }];
  let inkState = null;
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    canvas: { releasePointerCapture: () => {} },
    hooks: { onInkChange: (value) => { inkState = value; } },
    activePointerId: 17,
    activeStroke: unfinished,
    activeGuideIndex: 1,
    activeGuideStageAtStart: 1,
    userStrokes: [finished, unfinished],
    strokeColors: ['#111111', '#222222'],
    gameState: null,
    inkRevision: 3,
    evaluationCache: { revision: 3 },
  });
  assert.equal(board.cancelActiveStrokeForResize(), true);
  assert.deepEqual(board.userStrokes, [finished]);
  assert.deepEqual(board.strokeColors, ['#111111']);
  assert.equal(board.activePointerId, null);
  assert.equal(board.activeStroke, null);
  assert.equal(board.inkRevision, 4);
  assert.equal(board.evaluationCache, null);
  assert.equal(inkState, true);
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

test('Fino previews run at four times the base speed', () => {
  assert.equal(DEMO_SPEED_MULTIPLIER, 6.0);
});

test('Fino previews run at one constant speed regardless of path length', () => {
  const speedFor = (length) => demoRunDuration(length, 620) / length;
  assert.ok(Math.abs(speedFor(900) - speedFor(300)) < 0.001, 'long and short strokes must share one speed');
  assert.ok(Math.abs(speedFor(120) - speedFor(700)) < 0.001);
  assert.ok(speedFor(300) < 1000 / 120, 'preview should not crawl below the constant speed');
  assert.ok(demoRunDuration(600, 620) < demoRunDuration(1200, 620), 'longer previews take proportionally longer');
  assert.equal(demoRunDuration(0, 620), 300, 'a single-point dot gets a short readable pause');
  assert.equal(demoRunDuration(500, 620, { reducedMotion: true }), 1);
});

test('letters and numbers follow the pen while drawing and still preview the next stroke', () => {
  // Pen-following now only controls Fino during the child's own stroke;
  // next-stroke previews run for every tracing activity.
  assert.equal(usesPenFollowingFino({ category: 'letters' }), true);
  assert.equal(usesPenFollowingFino({ category: 'numbers' }), true);
  assert.equal(usesPenFollowingFino({ category: 'name' }), false);
  assert.equal(usesPenFollowingFino({ category: 'shapes' }), false);
});

test('Fino jumps from his current position, never from the child pen or the board edge', () => {
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    canvas: {},
    task: {
      category: 'letters',
      strokes: [
        [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }],
        [{ x: 0.1, y: 0.9 }, { x: 0.9, y: 0.9 }],
      ],
    },
    userStrokes: [],
    width: 900,
    height: 620,
    jumpAnimation: null,
    jumpFrame: 0,
    activeStroke: null,
    activeGuideIndex: null,
    isAngularGuide: () => true,
    nextGuideStrokeIndex: () => 1,
  });
  let captured = null;
  board.animateFoxJump = (from, to) => { captured = { from, to }; };

  // Fino waits at the start of the next stroke; the child draws elsewhere.
  board.foxPosition = { x: 0.5, y: 0.9 };
  board.startJumpToNextStroke([{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }]);
  assert.deepEqual(captured.from, { x: 450, y: 558 }, 'jump starts where Fino stands');
  assert.deepEqual(captured.to, { x: 90, y: 558 }, 'jump lands at the next stroke start');

  // With no known position (fresh board), the last pen point is the fallback.
  captured = null;
  board.foxPosition = null;
  board.startJumpToNextStroke([{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }]);
  assert.deepEqual(captured.from, { x: 270, y: 186 }, 'fallback is the child last point');
});

test('stroke-by-stroke recognition accepts a child-like trace on the route', () => {
  const route = [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }];
  const trace = [
    { x: 0.52, y: 0.2 },
    { x: 0.49, y: 0.4 },
    { x: 0.51, y: 0.6 },
    { x: 0.48, y: 0.8 },
  ];
  const fit = judgeStrokeAgainstRoute(trace, route, { width: 900, height: 620, tolerance: 60 });
  assert.ok(fit.coverage > 0.8, `coverage was ${fit.coverage}`);
  assert.ok(fit.precision > 0.8, `precision was ${fit.precision}`);
  assert.equal(strokeMatchesAnyRoute({ strokes: [route] }, trace, { width: 900, height: 620, tolerance: 60 }), true);
});

test('stroke-by-stroke recognition accepts a pen-split partial stroke', () => {
  const route = [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }];
  const firstHalf = [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }];
  assert.equal(strokeMatchesAnyRoute({ strokes: [route] }, firstHalf, { width: 900, height: 620, tolerance: 60 }), true);
});

test('stroke-by-stroke recognition accepts one pen movement over two routes', () => {
  // A lowercase t drawn in one continuous movement covers stem and crossbar.
  const task = { strokes: [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }],
    [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }],
  ] };
  const merged = [
    { x: 0.5, y: 0.18 },
    { x: 0.5, y: 0.82 },
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
  ];
  assert.equal(strokeMatchesAnyRoute(task, merged, { width: 900, height: 620, tolerance: 60 }), true);
});

test('stroke-by-stroke recognition rejects a stroke in the wrong place', () => {
  const route = [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }];
  const wrongPlace = [{ x: 0.12, y: 0.2 }, { x: 0.12, y: 0.8 }];
  assert.equal(strokeMatchesAnyRoute({ strokes: [route] }, wrongPlace, { width: 900, height: 620, tolerance: 60 }), false);
});

test('stroke-by-stroke recognition rejects a crossing scribble', () => {
  const route = [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }];
  const scribble = [
    { x: 0.15, y: 0.9 },
    { x: 0.85, y: 0.9 },
    { x: 0.15, y: 0.1 },
    { x: 0.85, y: 0.1 },
  ];
  assert.equal(strokeMatchesAnyRoute({ strokes: [route] }, scribble, { width: 900, height: 620, tolerance: 60 }), false);
});
