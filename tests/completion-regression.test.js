import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISE_BANKS,
  createNameExerciseBank,
  getExerciseBank,
} from '../js/curriculum.js';
import {
  evaluateDrawing,
  nextGuideStrokeIndex,
  passesDrawingCriteria,
} from '../js/drawing.js';

const modes = [
  ['easy', 0.068],
  ['medium', 0.058],
  ['hard', 0.048],
];

function options(task, assist = 'easy', width = 366, height = 608) {
  const toleranceFactor = modes.find(([mode]) => mode === assist)[1];
  return {
    width,
    height,
    tolerance: Math.min(width, height) * toleranceFactor,
    completionGroups: task.completionGroups,
  };
}

function resultFor(task, userStrokes, assist = 'easy', width = 366, height = 608) {
  return evaluateDrawing(task.strokes, userStrokes, options(task, assist, width, height));
}

function omitIndexes(task, indexes) {
  const omitted = new Set(indexes);
  return task.strokes.filter((_, index) => !omitted.has(index));
}

function allRegressionBanks() {
  return [
    ...Object.values(EXERCISE_BANKS).flat(),
    ...getExerciseBank('numbers', { option: '257' }),
    ...getExerciseBank('letters', { option: 'MARTIN' }),
    ...getExerciseBank('letters', { option: 'aä' }),
    ...createNameExerciseBank('MARTIN'),
    ...createNameExerciseBank('KÄTHE'),
    ...createNameExerciseBank('IJKLMNOP'),
  ];
}

test('every completion group partitions its exercise paths exactly once', () => {
  allRegressionBanks().forEach((task) => {
    const indexes = task.completionGroups.flat();
    assert.ok(task.completionGroups.every((group) => group.length > 0), `${task.id} has an empty group`);
    assert.equal(indexes.length, task.strokes.length, `${task.id} does not assign every path once`);
    assert.equal(new Set(indexes).size, task.strokes.length, `${task.id} assigns a path twice`);
    assert.deepEqual([...indexes].sort((a, b) => a - b), task.strokes.map((_, index) => index), `${task.id} has bad group indexes`);
  });
});

test('exact traces pass every static, custom, and name exercise on phone and tablet', () => {
  const banks = allRegressionBanks();
  const viewports = [[366, 608], [1000, 1086]];
  banks.forEach((task) => {
    viewports.forEach(([width, height]) => {
      modes.forEach(([assist]) => {
        const result = resultFor(task, task.strokes, assist, width, height);
        assert.equal(passesDrawingCriteria(result, assist), true, `${task.id} exact ${assist} ${width}x${height}`);
      });
    });
  });
});

test('every missing visible symbol and required path remains incomplete', () => {
  allRegressionBanks().forEach((task) => {
    task.completionGroups.forEach((group, groupIndex) => {
      const result = resultFor(task, omitIndexes(task, group));
      assert.equal(passesDrawingCriteria(result, 'easy'), false, `${task.id} missing group ${groupIndex} passed`);
      assert.equal(passesDrawingCriteria(result, 'easy', { slack: 0.04 }), false, `${task.id} missing group ${groupIndex} passed retry`);
    });
    task.strokes.forEach((_, pathIndex) => {
      const result = resultFor(task, omitIndexes(task, [pathIndex]));
      assert.equal(passesDrawingCriteria(result, 'easy'), false, `${task.id} missing path ${pathIndex} passed`);
      assert.equal(passesDrawingCriteria(result, 'easy', { slack: 0.04 }), false, `${task.id} missing path ${pathIndex} passed retry`);
    });
  });
});

test('neighbouring paths cannot fill an omitted character and flexible pen use still passes', () => {
  const fuchs = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-word-FUCHS');
  const missingC = resultFor(fuchs, omitIndexes(fuchs, fuchs.completionGroups[2]));
  assert.equal(passesDrawingCriteria(missingC, 'easy'), false);

  const name = createNameExerciseBank('KÄTHE').find((task) => task.id === 'name-full-KÄTHE-0');
  const missingE = resultFor(name, omitIndexes(name, name.completionGroups.at(-1)));
  assert.equal(passesDrawingCriteria(missingE, 'easy'), false);

  const numberTask = getExerciseBank('numbers', { option: '257' })
    .find((task) => task.id === 'numbers-custom-257-turm-kompakt');
  const targetPoints = numberTask.completionGroups[1]
    .flatMap((index) => numberTask.strokes[index]);
  const target = targetPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  target.x /= targetPoints.length;
  target.y /= targetPoints.length;
  const displacedNeighbours = omitIndexes(numberTask, numberTask.completionGroups[1]).map((stroke) => (
    stroke.map((point) => ({ x: point.x + (target.x - point.x) * 0.12, y: point.y + (target.y - point.y) * 0.12 }))
  ));
  const missingSeven = resultFor(numberTask, displacedNeighbours);
  assert.equal(passesDrawingCriteria(missingSeven, 'easy'), false);

  const cross = [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.82, y: 0.5 }],
  ];
  const continuous = [[
    { x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }, { x: 0.18, y: 0.5 },
    { x: 0.82, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.82 },
  ]];
  const crossResult = evaluateDrawing(cross, continuous, { width: 900, height: 620, tolerance: 620 * 0.068 });
  assert.equal(passesDrawingCriteria(crossResult, 'easy'), true);

  const reversedAndSplit = cross
    .slice()
    .reverse()
    .map((stroke) => stroke.slice().reverse());
  const reorderedResult = evaluateDrawing(cross, reversedAndSplit, { width: 900, height: 620, tolerance: 620 * 0.068 });
  assert.equal(passesDrawingCriteria(reorderedResult, 'easy'), true);
});

test('child-like in-tolerance jitter still passes at every difficulty', () => {
  const examples = [
    EXERCISE_BANKS.lines.find((task) => task.id === 'lines-line-arch-gross'),
    EXERCISE_BANKS.shapes.find((task) => task.id === 'shapes-shape-cross-gross'),
    EXERCISE_BANKS.numbers.find((task) => task.id === 'number-4-gross'),
    EXERCISE_BANKS.letters.find((task) => task.id === 'letter-Ä-gross'),
    createNameExerciseBank('KÄTHE').find((task) => task.id === 'name-full-KÄTHE-0'),
  ];
  examples.forEach((task) => {
    modes.forEach(([assist, toleranceFactor]) => {
      const width = 366;
      const height = 608;
      const amplitude = (Math.min(width, height) * toleranceFactor * 0.16) / width;
      const jittered = task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => ({
        x: Math.min(0.99, Math.max(0.01, point.x + Math.sin((strokeIndex + 2) * (pointIndex + 3)) * amplitude)),
        y: Math.min(0.99, Math.max(0.01, point.y + Math.cos((strokeIndex + 5) * (pointIndex + 1)) * amplitude)),
      })));
      const result = resultFor(task, jittered, assist, width, height);
      assert.equal(passesDrawingCriteria(result, assist), true, `${task.id} rejected kind ${assist} jitter`);
    });
  });
});

test('Fino follows the first unfinished path for multi-letter names', () => {
  ['MARTIN', 'KÄTHE'].forEach((name) => {
    const task = createNameExerciseBank(name).find((candidate) => candidate.id === `name-full-${name}-0`);
    task.strokes.slice(0, -1).forEach((_, index) => {
      const guideIndex = nextGuideStrokeIndex(task.strokes, task.strokes.slice(0, index + 1), options(task));
      assert.equal(guideIndex, index + 1, `${name} jumped after path ${index}`);
    });
  });
});
