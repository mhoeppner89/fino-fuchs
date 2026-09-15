import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISE_BANKS,
  createNameExerciseBank,
  getExerciseBank,
} from '../js/curriculum.js';
import { nextGuideStrokeIndex } from '../js/drawing.js';
import { passes } from './oracle.js';

const assistByMode = { easy: 'easy', medium: 'medium', hard: 'hard' };
const modes = ['easy', 'medium', 'hard'];

function viewportFor(width, height) {
  return { width, height };
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
      modes.forEach((mode) => {
        assert.equal(
          passes(task, task.strokes, { ...viewportFor(width, height), assist: assistByMode[mode] }),
          true,
          `${task.id} exact ${mode} ${width}x${height}`,
        );
      });
    });
  });
});

test('every missing visible symbol remains incomplete', () => {
  allRegressionBanks().forEach((task) => {
    task.completionGroups.forEach((group, groupIndex) => {
      const strokes = omitIndexes(task, group);
      assert.equal(passes(task, strokes, viewportFor(366, 608)), false, `${task.id} missing group ${groupIndex} passed`);
    });
  });
});

test('missing bars, dots, stems, tails, petals, and rays remain incomplete', () => {
  const cases = [
    ['letters', 'letter-A-gross', [1]],
    ['letters', 'letter-H-gross', [2]],
    ['letters', 'letter-I-gross', [0]],
    ['letters', 'letter-b-gross', [0]],
    ['letters', 'letter-i-gross', [1]],
    ['letters', 'letter-j-gross', [1]],
    ['letters', 'letter-t-gross', [1]],
    ['letters', 'letter-Ä-gross', [2, 3]],
    ['letters', 'letter-ä-gross', [1, 2]],
    ['numbers', 'number-4-gross', [0, 1]],
    ['shapes', 'shape-flower', [0, 1, 2, 3, 4]],
    ['shapes', 'shape-sun', [1, 2, 3, 4, 5, 6]],
  ];
  cases.forEach(([bankName, taskId, indexes]) => {
    const task = EXERCISE_BANKS[bankName].find((candidate) => candidate.id === taskId);
    assert.ok(task, `missing test task ${taskId}`);
    indexes.forEach((pathIndex) => {
      const strokes = omitIndexes(task, [pathIndex]);
      assert.equal(passes(task, strokes, viewportFor(366, 608)), false, `${task.id} missing detail ${pathIndex} passed`);
    });
  });
});

test('neighbouring paths cannot fill an omitted character and flexible pen use still passes', () => {
  const fuchs = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-word-FUCHS');
  assert.equal(passes(fuchs, omitIndexes(fuchs, fuchs.completionGroups[2]), viewportFor(366, 608)), false);

  const name = createNameExerciseBank('KÄTHE').find((task) => task.id === 'name-full-KÄTHE-0');
  assert.equal(passes(name, omitIndexes(name, name.completionGroups.at(-1)), viewportFor(366, 608)), false);

  const numberTask = getExerciseBank('numbers', { option: '257' })
    .find((task) => task.id === 'numbers-custom-257-turm-kompakt');
  assert.equal(passes(numberTask, omitIndexes(numberTask, numberTask.completionGroups[1]), viewportFor(366, 608)), false);

  // One continuous pen movement that covers stem and crossbar of a cross is
  // accepted by the joined-parts matcher when the parts connect at the pen
  // path's turning point. The runtime validator only accepts CONSECUTIVE
  // teaching parts in one pen movement — drawing part, returning through it,
  // and drawing the next from the wrong end is not a taught join, so the
  // equivalent runtime-honest input retraces back to the stem top first.
  const cross = [
    [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.82 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.82, y: 0.5 }],
  ];
  const continuous = [[
    { x: 0.5, y: 0.18 }, { x: 0.5, y: 0.5 }, { x: 0.18, y: 0.5 },
    { x: 0.82, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.82 },
  ]];
  const crossTask = { category: 'shapes', id: 'shape-cross', strokes: cross, completionGroups: [[0, 1]] };
  assert.equal(passes(crossTask, continuous, viewportFor(900, 620)), false, 'interleaved pen path is not a taught join');
  // Runtime honesty: a single pen movement can only complete routes that
  // chain end-to-end (its parts must be CONSECUTIVE teaching parts). A
  // cross's stem and crossbar share only a midpoint, so one pen movement —
  // however arranged — cannot honestly finish both; the child lifts the pen
  // and draws the crossbar separately.
  const lConnected = [[
    { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.8 }, { x: 0.45, y: 0.8 },
  ]];
  const lTask = { category: 'shapes', id: 'shape-l', strokes: [[{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.8 }], [{ x: 0.2, y: 0.8 }, { x: 0.45, y: 0.8 }]], completionGroups: [[0, 1]] };
  assert.equal(passes(lTask, lConnected, viewportFor(900, 620)), true, 'consecutive joined strokes must pass');

  // Reversed and split strokes still complete the shape when the order
  // checkbox is off.
  const reversedAndSplit = cross
    .slice()
    .reverse()
    .map((stroke) => stroke.slice().reverse());
  assert.equal(
    passes(crossTask, reversedAndSplit, { ...viewportFor(900, 620), strict: false }),
    true,
    'reversed and split cross must pass with order freedom',
  );
});

test('child-like in-tolerance jitter still passes at every difficulty', () => {
  const examples = [
    EXERCISE_BANKS.lines.find((task) => task.id === 'lines-line-arch-gross'),
    EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-cross'),
    EXERCISE_BANKS.numbers.find((task) => task.id === 'number-4-gross'),
    EXERCISE_BANKS.letters.find((task) => task.id === 'letter-Ä-gross'),
    createNameExerciseBank('KÄTHE').find((task) => task.id === 'name-full-KÄTHE-0'),
  ];
  examples.forEach((task) => {
    modes.forEach((mode) => {
      const width = 366;
      const height = 608;
      const toleranceFactor = { easy: 0.13, medium: 0.09, hard: 0.055 }[mode];
      // The wobble must sit inside the guide band of the GLYPH, not of the
      // canvas: small name letters span only part of the board, and their
      // band (group size × factor) is smaller than a canvas-scaled
      // amplitude. Measure each glyph's own extent like the validator does.
      const groupSizes = (task.completionGroups ?? [task.strokes.map((_, index) => index)]).map((indexes) => {
        const points = indexes.flatMap((index) => task.strokes[index]);
        const xs = points.map((point) => point.x * width);
        const ys = points.map((point) => point.y * height);
        return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      });
      const glyphBand = Math.min(...groupSizes) * toleranceFactor;
      const amplitude = (glyphBand * 0.5) / width;
      const jittered = task.strokes.map((stroke, strokeIndex) => stroke.length === 1
        ? [...stroke] // a tap is placed by its own dot tolerance, not traced
        : stroke.map((point, pointIndex) => ({
          x: Math.min(0.99, Math.max(0.01, point.x + Math.sin((strokeIndex + 2) * (pointIndex + 3)) * amplitude)),
          y: Math.min(0.99, Math.max(0.01, point.y + Math.cos((strokeIndex + 5) * (pointIndex + 1)) * amplitude)),
        })));
      assert.equal(
        passes(task, jittered, { ...viewportFor(width, height), assist: assistByMode[mode] }),
        true,
        `${task.id} rejected kind ${mode} jitter`,
      );
    });
  });
});

test('Fino never skips an untouched letter in a multi-letter name', () => {
  ['MARTIN', 'KÄTHE'].forEach((name) => {
    const task = createNameExerciseBank(name).find((candidate) => candidate.id === `name-full-${name}-0`);
    const drawn = [];
    task.completionGroups.slice(0, -1).forEach((group, groupIndex) => {
      drawn.push(...group.map((index) => task.strokes[index]));
      const guideIndex = nextGuideStrokeIndex(task.strokes, drawn, {
        width: 366,
        height: 608,
        tolerance: Math.min(366, 608) * 0.11,
        completionGroups: task.completionGroups,
      });
      const nextGroup = task.completionGroups[groupIndex + 1];
      assert.ok(nextGroup.includes(guideIndex), `${name} skipped letter ${groupIndex + 1}`);
    });
  });
});
