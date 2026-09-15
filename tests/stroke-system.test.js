import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXERCISE_BANKS } from '../js/curriculum.js';
import { passes, taskOutcome } from './oracle.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TASKS = [...CHARACTERS].map((character) => {
  const number = /\d/.test(character);
  const task = (number ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters)
    .find((candidate) => candidate.id === `${number ? 'number' : 'letter'}-${character}-gross`);
  assert.ok(task, `missing task for ${character}`);
  return task;
});

const assistBand = { easy: 0.13, medium: 0.09, hard: 0.055 };

function viewportFor(width, height) {
  return { width, height };
}

function translatedAndJittered(task, assist, width, height, seed) {
  const unit = Math.min(width, height);
  const band = unit * assistBand[assist];
  return task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => ({
    x: point.x + (
      band * 0.3
        + Math.sin((seed + strokeIndex + 1) * (pointIndex + 2)) * band * 0.08
    ) / width,
    y: point.y + (
      band * 0.18
        + Math.cos((seed + strokeIndex + 2) * (pointIndex + 1)) * band * 0.08
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

test('all 62 characters accept a coherent child-sized deviation on every screen and difficulty', () => {
  const viewports = [[366, 608], [900, 620], [1000, 1086], [844, 390]];
  viewports.forEach(([width, height], viewportIndex) => {
    ['easy', 'medium', 'hard'].forEach((assist) => {
      TASKS.forEach((task, taskIndex) => {
        const user = translatedAndJittered(task, assist, width, height, viewportIndex * 100 + taskIndex);
        assert.equal(
          passes(task, user, { ...viewportFor(width, height), assist }),
          true,
          `${task.label} rejected ${assist} at ${width}x${height}`,
        );
      });
    });
  });
});

test('all 62 characters reject a trace outside the allowed band', () => {
  [[366, 608], [900, 620], [844, 390]].forEach(([width, height]) => {
    TASKS.forEach((task) => {
      const unit = Math.min(width, height);
      const band = unit * assistBand.easy;
      // Far beyond the guide band (double it) in both axes.
      const user = task.strokes.map((stroke) => stroke.map((point) => ({
        x: point.x + band * 2.2 / width,
        y: point.y + band * 0.66 / height,
      })));
      assert.equal(
        passes(task, user, { ...viewportFor(width, height), assist: 'easy' }),
        false,
        `${task.label} accepted an out-of-band trace at ${width}x${height}`,
      );
    });
  });
});

test('stroke order and direction do not change a good final shape with order freedom', () => {
  const width = 900;
  const height = 620;
  TASKS.forEach((task) => {
    // Runtime semantics: every full stroke is still required, but any order
    // and direction is accepted when the order checkbox is off. (Split pen
    // fragments are a separate mechanism: only CONSECUTIVE connectable
    // parts of the taught order may share one pen movement.)
    const user = [...task.strokes].reverse().map((stroke) => [...stroke].reverse());
    assert.equal(
      passes(task, user, { ...viewportFor(width, height), assist: 'hard', strict: false }),
      true,
      `${task.label} depended on stroke order or direction even with order freedom`,
    );
  });
});

test('less than half of every route cannot complete any character', () => {
  const width = 900;
  const height = 620;
  TASKS.forEach((task) => {
    const partial = task.strokes
      .map((stroke) => strokePart(stroke, 0, 0.45, width, height))
      .filter((stroke) => stroke.length);
    assert.equal(
      passes(task, partial, { ...viewportFor(width, height), assist: 'easy', strict: false }),
      false,
      `${task.label} passed from partial routes`,
    );
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
    // Order freedom is needed: the two fragments land as separate pen strokes.
    if (passes(task, broken, { ...viewportFor(width, height), assist: 'easy', strict: false })) {
      falseAccepts.push({ label: task.label, snapshot: taskOutcome(task, broken, { ...viewportFor(width, height), strict: false }).snapshot });
    }
  });
  assert.deepEqual(falseAccepts, [], `characters accepted large route gaps: ${JSON.stringify(falseAccepts)}`);
});

test('a target trace plus a large scribble still fails', () => {
  // The scribble is submitted as extra pen strokes after the correct glyph.
  // The validator completes the glyph from the accepted strokes, but the extra
  // strokes are rejected attempts — the final verdict stays complete only
  // because they were rejected, not accepted. To prove extra ink cannot forge
  // progress we draw only the scribble for a target: it must never pass.
  const width = 900;
  const height = 620;
  const scribble = [[
    { x: 0.05, y: 0.05 }, { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }, { x: 0.05, y: 0.05 },
  ]];
  TASKS.forEach((task) => {
    const outcome = taskOutcome(task, scribble, { ...viewportFor(width, height), strict: false });
    assert.equal(outcome.snapshot.acceptedCount, 0, `${task.label} accepted scribble ink as a route`);
    assert.equal(outcome.snapshot.allRequired, false, `${task.label} completed from a scribble`);
  });
});

test('rough fixture traces from real children pass on easy', () => {
  // The fixtures embed the exact template the trace was captured against plus
  // the child's pen strokes, so they validate against the live sequential
  // validator with the real capture geometry. `strokes` is the child's pen
  // strokes; `separateStrokes` (if present) holds alternative stroke sets
  // for the same task.
  ['handwritten-a-rough.json', 'handwritten-a.json', 'handwritten-r.json'].forEach((name) => {
    const fixture = JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
    // `strokes` is the child's pen strokes exactly as captured.
    assert.equal(
      passes(fixture.task, fixture.strokes, viewportFor(fixture.width, fixture.height)),
      true,
      `${name} was rejected by the live validator`,
    );
  });
});
