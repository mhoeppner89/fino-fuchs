import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_BANKS } from '../js/curriculum.js';
import { evaluateDrawing, passesDrawingCriteria } from '../js/drawing.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TASKS = [...CHARACTERS].map((character) => {
  const number = /\d/.test(character);
  const task = (number ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters)
    .find((candidate) => candidate.id === `${number ? 'number' : 'letter'}-${character}-gross`);
  assert.ok(task, `missing task for ${character}`);
  return task;
});

const assistFactor = { easy: 0.12, medium: 0.105, hard: 0.09 };
const assistMaximum = { easy: 62, medium: 56, hard: 50 };

function options(task, assist, width, height) {
  const unit = Math.min(width, height);
  return {
    width,
    height,
    tolerance: Math.min(assistMaximum[assist], Math.max(assist === 'easy' ? 28 : 24, unit * assistFactor[assist])),
    completionTolerance: Math.min(62, Math.max(26, unit * 0.115)),
    completionGroups: task.completionGroups,
  };
}

function translatedAndJittered(task, config, seed) {
  const { width, height, tolerance } = config;
  return task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => ({
    x: point.x + (
      tolerance * 0.3
        + Math.sin((seed + strokeIndex + 1) * (pointIndex + 2)) * tolerance * 0.08
    ) / width,
    y: point.y + (
      tolerance * 0.18
        + Math.cos((seed + strokeIndex + 2) * (pointIndex + 1)) * tolerance * 0.08
    ) / height,
  })));
}

function pointAtLength(stroke, target, width, height) {
  if (stroke.length === 1) return stroke[0];
  let travelled = 0;
  for (let index = 1; index < stroke.length; index += 1) {
    const start = stroke[index - 1];
    const end = stroke[index];
    const length = Math.hypot((end.x - start.x) * width, (end.y - start.y) * height);
    if (travelled + length >= target) {
      const ratio = length ? (target - travelled) / length : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    travelled += length;
  }
  return stroke.at(-1);
}

function strokeLength(stroke, width, height) {
  return stroke.reduce((sum, point, index) => (
    index ? sum + Math.hypot(
      (point.x - stroke[index - 1].x) * width,
      (point.y - stroke[index - 1].y) * height,
    ) : sum
  ), 0);
}

function strokePart(stroke, from, to, width, height) {
  if (stroke.length === 1) return from === 0 ? stroke : [];
  const total = strokeLength(stroke, width, height);
  const startLength = total * from;
  const endLength = total * to;
  const result = [pointAtLength(stroke, startLength, width, height)];
  let travelled = 0;
  for (let index = 1; index < stroke.length - 1; index += 1) {
    travelled += Math.hypot(
      (stroke[index].x - stroke[index - 1].x) * width,
      (stroke[index].y - stroke[index - 1].y) * height,
    );
    if (travelled > startLength && travelled < endLength) result.push(stroke[index]);
  }
  result.push(pointAtLength(stroke, endLength, width, height));
  return result;
}

function transformedChildTrace(task, config, seed) {
  const points = task.strokes.flat();
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= points.length;
  center.y /= points.length;
  const angle = Math.sin(seed * 1.71) * (Math.PI / 180) * 1.25;
  const scaleX = 1 + Math.sin(seed * 0.83) * 0.022;
  const scaleY = 1 + Math.cos(seed * 0.97) * 0.022;
  const shiftX = Math.cos(seed * 1.13) * config.tolerance * 0.22 / config.width;
  const shiftY = Math.sin(seed * 1.31) * config.tolerance * 0.22 / config.height;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => {
    const sourceX = (point.x - center.x) * scaleX;
    const sourceY = (point.y - center.y) * scaleY;
    const noiseX = Math.sin(seed + strokeIndex * 2.1 + pointIndex * 0.43) * config.tolerance * 0.055 / config.width;
    const noiseY = Math.cos(seed + strokeIndex * 1.7 + pointIndex * 0.39) * config.tolerance * 0.055 / config.height;
    return {
      x: center.x + sourceX * cosine - sourceY * sine + shiftX + noiseX,
      y: center.y + sourceX * sine + sourceY * cosine + shiftY + noiseY,
    };
  }));
}

test('all 62 characters accept a coherent child-sized deviation on every screen and difficulty', () => {
  const viewports = [[366, 608], [900, 620], [1000, 1086], [844, 390]];
  viewports.forEach(([width, height], viewportIndex) => {
    ['easy', 'medium', 'hard'].forEach((assist) => {
      TASKS.forEach((task, taskIndex) => {
        const config = options(task, assist, width, height);
        const user = translatedAndJittered(task, config, viewportIndex * 100 + taskIndex);
        const result = evaluateDrawing(task.strokes, user, config);
        assert.equal(passesDrawingCriteria(result, assist), true, `${task.label} rejected ${assist} at ${width}x${height}`);
      });
    });
  });
});

test('all 62 characters accept varied small shifts, turns, scaling, and smooth hand wobble', () => {
  const configurations = [
    ['easy', 366, 608],
    ['hard', 844, 390],
    ['medium', 1024, 768],
  ];
  configurations.forEach(([assist, width, height], configurationIndex) => {
    TASKS.forEach((task, taskIndex) => {
      const config = options(task, assist, width, height);
      for (let variation = 0; variation < 3; variation += 1) {
        const user = transformedChildTrace(task, config, 17 + configurationIndex * 701 + taskIndex * 11 + variation);
        const result = evaluateDrawing(task.strokes, user, config);
        assert.equal(
          passesDrawingCriteria(result, assist),
          true,
          `${task.label} rejected natural variation ${variation} in ${assist} at ${width}x${height}`,
        );
      }
    });
  });
});

test('all 62 characters reject a trace outside the allowed band', () => {
  [[366, 608], [900, 620], [844, 390]].forEach(([width, height]) => {
    TASKS.forEach((task) => {
      const config = options(task, 'easy', width, height);
      // The scorer deliberately aligns coherent offset traces (capped at
      // ~0.85 tolerances); the shift must exceed that rescue window.
      const user = task.strokes.map((stroke) => stroke.map((point) => ({
        x: point.x + config.tolerance * 2.2 / width,
        y: point.y + config.tolerance * 0.66 / height,
      })));
      const result = evaluateDrawing(task.strokes, user, config);
      assert.equal(passesDrawingCriteria(result, 'easy'), false, `${task.label} accepted an out-of-band trace at ${width}x${height}`);
    });
  });
});

test('stroke order, direction, splitting, and pen lifts do not change a good final shape', () => {
  const width = 900;
  const height = 620;
  TASKS.forEach((task) => {
    const user = task.strokes
      .flatMap((stroke) => stroke.length === 1
        ? [stroke]
        : [strokePart(stroke, 0, 0.5, width, height), strokePart(stroke, 0.5, 1, width, height)])
      .reverse()
      .map((stroke) => [...stroke].reverse());
    const result = evaluateDrawing(task.strokes, user, options(task, 'hard', width, height));
    assert.equal(passesDrawingCriteria(result, 'hard'), true, `${task.label} depended on stroke order or pen lifts`);
  });
});

test('less than half of every route cannot complete any character', () => {
  const width = 900;
  const height = 620;
  TASKS.forEach((task) => {
    const partial = task.strokes
      .map((stroke) => strokePart(stroke, 0, 0.45, width, height))
      .filter((stroke) => stroke.length);
    const result = evaluateDrawing(task.strokes, partial, options(task, 'easy', width, height));
    assert.equal(passesDrawingCriteria(result, 'easy'), false, `${task.label} passed from partial routes`);
  });
});

test('a missing middle section cannot be hidden by drawing both ends of every route', () => {
  const width = 900;
  const height = 620;
  const falseAccepts = [];
  TASKS.forEach((task) => {
    const broken = task.strokes.flatMap((stroke) => {
      if (stroke.length === 1) return [];
      return [
        strokePart(stroke, 0, 0.24, width, height),
        strokePart(stroke, 0.76, 1, width, height),
      ];
    }).filter((stroke) => stroke.length);
    const result = evaluateDrawing(task.strokes, broken, options(task, 'easy', width, height));
    if (passesDrawingCriteria(result, 'easy')) {
      falseAccepts.push({
        label: task.label,
        completion: result.completion,
        targetMse: result.targetMse,
        pathCoverage: result.pathCoverage,
        longestGaps: result.pathLongestGaps,
      });
    }
  });
  assert.deepEqual(falseAccepts, [], `characters accepted large route gaps: ${JSON.stringify(falseAccepts)}`);
});

test('a target trace plus a large scribble fails the reverse-distance check', () => {
  const width = 900;
  const height = 620;
  const scribble = [[
    { x: 0.05, y: 0.05 }, { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }, { x: 0.05, y: 0.05 },
  ]];
  TASKS.forEach((task) => {
    const result = evaluateDrawing(
      task.strokes,
      [...task.strokes, ...scribble],
      options(task, 'easy', width, height),
    );
    assert.ok(result.userMse > result.targetMse, `${task.label} did not penalise extra ink`);
    assert.equal(passesDrawingCriteria(result, 'easy'), false, `${task.label} accepted a surrounding scribble`);
  });
});

test('symmetric closest-line MSE separates exact, kind, partial, and scribbled results', () => {
  const task = EXERCISE_BANKS.letters.find((candidate) => candidate.id === 'letter-R-gross');
  const config = options(task, 'easy', 900, 620);
  const exact = evaluateDrawing(task.strokes, task.strokes, config);
  const kind = evaluateDrawing(task.strokes, translatedAndJittered(task, config, 91), config);
  const partial = evaluateDrawing(
    task.strokes,
    task.strokes.map((stroke) => strokePart(stroke, 0, 0.45, 900, 620)),
    config,
  );
  const scribbled = evaluateDrawing(task.strokes, [
    ...task.strokes,
    [{ x: 0.03, y: 0.05 }, { x: 0.97, y: 0.95 }, { x: 0.03, y: 0.95 }],
  ], config);
  assert.ok(exact.symmetricMse < kind.symmetricMse);
  assert.ok(kind.symmetricMse < partial.symmetricMse);
  assert.ok(partial.targetMse > kind.targetMse, 'partial input should miss target geometry');
  assert.ok(scribbled.userMse > kind.userMse, 'scribble should add off-target ink');
});
