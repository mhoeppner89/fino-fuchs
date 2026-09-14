import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, buildReviewSession, EXERCISE_BANKS } from '../js/curriculum.js';
import { sampleStroke, StrokeProgress } from '../js/stroke-validation.js';

const symbols = [...buildReviewSession(), ...EXERCISE_BANKS.shapes];
const levels = ['easy', 'medium', 'hard'];
const viewports = [{ width: 390, height: 700 }, { width: 844, height: 390 }, { width: 1024, height: 768 }];
const source = (value) => buildReviewSession().find((task) => task.label === value);
const at = (value, viewport = { width: 900, height: 620 }) => adaptTaskToViewport(source(value), viewport);
const submit = (task, options, strokes = task.strokes) => {
  const progress = new StrokeProgress(task, options);
  for (const stroke of strokes) progress.submit(stroke);
  return progress;
};

test('every shipped symbol completes one accepted stroke at a time on every level and screen', () => {
  for (const viewport of viewports) for (const assist of levels) for (const sourceTask of symbols) {
    const task = adaptTaskToViewport(sourceTask, viewport);
    const progress = new StrokeProgress(task, { ...viewport, assist });
    task.strokes.forEach((stroke, i) => {
      const result = progress.submit(stroke);
      assert.equal(result.status, 'accepted', `${task.id}/${assist}/${viewport.width}, stroke ${i}: ${result.reason}`);
      assert.equal(progress.snapshot().acceptedCount, i + 1);
      assert.equal(progress.snapshot().allRequired, i === task.strokes.length - 1);
    });
    assert.equal(progress.snapshot().recognizable, true);
  }
});

test('strict mode rejects an early crossbar and reversed strokes without changing the next step', () => {
  for (const assist of levels) {
    const task = at('A');
    const progress = new StrokeProgress(task, { assist });
    for (const wrong of [task.strokes[1], [...task.strokes[0]].reverse()]) {
      assert.equal(progress.submit(wrong).status, 'rejected');
      assert.equal(progress.nextIndex(), 0);
      assert.equal(progress.snapshot().acceptedCount, 0);
    }
    task.strokes.forEach((stroke) => assert.equal(progress.submit(stroke).status, 'accepted'));
    assert.equal(progress.snapshot().recognizable, true);
    assert.equal(progress.snapshot().rejectedCount, 2);
  }
});

test('relaxed mode allows a different order and direction, with each full stroke still required', () => {
  const task = at('A');
  const progress = new StrokeProgress(task, { strict: false });
  assert.equal(progress.submit([...task.strokes[1]].reverse()).status, 'accepted');
  assert.equal(progress.snapshot().allRequired, false);
  assert.equal(progress.submit([...task.strokes[0]].reverse()).status, 'accepted');
  assert.equal(progress.snapshot().recognizable, true);
});

test('half strokes cannot be accumulated over several pen lifts on either setting', () => {
  for (const strict of [false, true]) for (const assist of levels) for (const value of ['A', 'I', 'O', '2', '4', '8']) {
    const task = at(value);
    const progress = new StrokeProgress(task, { strict, assist });
    const sampled = sampleStroke(task.strokes[0]);
    progress.submit(sampled.slice(0, 33));
    progress.submit(sampled.slice(32));
    assert.equal(progress.snapshot().acceptedCount, 0, `${value}/${assist}/${strict} accumulated halves`);
    assert.equal(progress.submit(task.strokes[0]).status, 'accepted');
  }
});

test('rejected scribbles stay recorded but cannot influence a later correct attempt', () => {
  const task = at('R');
  const progress = new StrokeProgress(task);
  for (let i = 0; i < 6; i += 1) {
    assert.equal(progress.submit([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]).status, 'rejected');
  }
  for (const stroke of task.strokes) assert.equal(progress.submit(stroke).status, 'accepted');
  assert.equal(progress.snapshot().recognizable, true);
  assert.equal(progress.attempts.length, task.strokes.length + 6);
});

test('a cancelled complete-looking stroke is never credited', () => {
  const task = at('I');
  const progress = new StrokeProgress(task);
  assert.equal(progress.submit(task.strokes[0], { cancelled: true }).status, 'rejected');
  assert.equal(progress.snapshot().allRequired, false);
  assert.equal(progress.submit(task.strokes[0]).status, 'accepted');
});

test('closed shape outlines allow arbitrary starting positions and both directions', () => {
  for (const assist of levels) for (const id of ['shape-circle', 'shape-square', 'shape-triangle', 'shape-star']) {
    const task = adaptTaskToViewport(EXERCISE_BANKS.shapes.find((t) => t.id === id), { width: 900, height: 620 });
    const ring = task.strokes[0].slice(0, -1);
    for (const fraction of [0.13, 0.36, 0.71]) for (const reverse of [false, true]) {
      const offset = Math.floor(ring.length * fraction);
      const start = { x: ring[offset].x * 0.7 + ring[(offset + 1) % ring.length].x * 0.3,
        y: ring[offset].y * 0.7 + ring[(offset + 1) % ring.length].y * 0.3 };
      const shifted = [start, ...ring.slice(offset + 1), ...ring.slice(0, offset + 1)];
      if (reverse) shifted.reverse();
      shifted.push(shifted[0]);
      const progress = submit(task, { assist }, [shifted]);
      assert.equal(progress.snapshot().recognizable, true, `${id}/${assist}/${offset}/${reverse}`);
    }
  }
});

test('corner checks still accept smooth small hand wobble in circles and polygons', () => {
  for (const id of ['shape-circle', 'shape-square', 'shape-triangle', 'shape-pentagon', 'shape-hexagon']) {
    const task = adaptTaskToViewport(EXERCISE_BANKS.shapes.find((t) => t.id === id), { width: 900, height: 620 });
    const size = new StrokeProgress(task).groups[0].size;
    const trace = sampleStroke(task.strokes[0].map((p) => ({ x: p.x * 900, y: p.y * 620 })), 257)
      .map((p, i) => ({ x: (p.x + size * 0.008 * Math.sin(i / 256 * Math.PI * 8)) / 900,
        y: (p.y + size * 0.008 * Math.sin(i / 256 * Math.PI * 6)) / 620 }));
    for (const assist of levels) assert.equal(submit(task, { assist }, [trace]).snapshot().recognizable, true, `${id}/${assist}`);
  }
});

test('coherent shifts, scaling, and small turns pass without moving each part independently', () => {
  for (const assist of levels) for (const viewport of viewports) for (const sourceTask of symbols) {
    const task = adaptTaskToViewport(sourceTask, viewport);
    const all = task.strokes.flat().map((p) => ({ x: p.x * viewport.width, y: p.y * viewport.height }));
    const center = { x: (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2,
      y: (Math.min(...all.map((p) => p.y)) + Math.max(...all.map((p) => p.y))) / 2 };
    const size = Math.max(...all.map((p) => p.y)) - Math.min(...all.map((p) => p.y));
    const angle = Math.PI / 36;
    const strokes = task.strokes.map((stroke) => stroke.map((p) => {
      const x = p.x * viewport.width - center.x, y = p.y * viewport.height - center.y;
      return { x: (center.x + 0.1 * size + 0.88 * (x * Math.cos(angle) - y * Math.sin(angle))) / viewport.width,
        y: (center.y - 0.04 * size + 0.88 * (x * Math.sin(angle) + y * Math.cos(angle))) / viewport.height };
    }));
    // Keep the complete transformed symbol inside the writing area.
    const moved = strokes.flat();
    const dx = Math.max(0, 0.01 - Math.min(...moved.map((p) => p.x))) - Math.max(0, Math.max(...moved.map((p) => p.x)) - 0.99);
    const dy = Math.max(0, 0.01 - Math.min(...moved.map((p) => p.y))) - Math.max(0, Math.max(...moved.map((p) => p.y)) - 0.99);
    strokes.forEach((stroke) => stroke.forEach((p) => { p.x += dx; p.y += dy; }));
    const result = submit(task, { ...viewport, assist }, strokes).snapshot();
    assert.equal(result.recognizable, true, `${task.id}/${assist}/${viewport.width}: ${JSON.stringify(result)}`);
  }
});

test('each umlaut dot is a separate full step, with extra placement room but no reuse', () => {
  for (const assist of levels) {
    const task = at('ä');
    const progress = new StrokeProgress(task, { assist });
    assert.equal(progress.submit(task.strokes[0]).status, 'accepted');
    const dot = task.strokes[1][0];
    const shifted = [{ x: dot.x, y: dot.y - 0.018 }];
    assert.equal(progress.submit(shifted).status, 'accepted', `${assist} rejects displaced tap`);
    assert.equal(progress.snapshot().recognizable, false);
    assert.equal(progress.submit(shifted).status, 'rejected', `${assist} reuses left dot`);
    assert.equal(progress.submit(task.strokes[2]).status, 'accepted');
    assert.equal(progress.snapshot().recognizable, true);
  }
});

test('a disconnected stroke is rejected before it can spoil accepted parts', () => {
  const task = { category: 'letters', strokes: [
    [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.8 }],
    [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.8 }],
  ], completionGroups: [[0, 1]] };
  const progress = new StrokeProgress(task, { width: 600, height: 600 });
  progress.submit(task.strokes[0]);
  const broken = [{ x: 0.335, y: 0.8 }, { x: 0.7, y: 0.8 }];
  const fit = progress.match(broken.map((p) => ({ x: p.x * 600, y: p.y * 600 })), 1, 0);
  assert.equal(fit.fits, true, 'this case must isolate the joint check');
  const rejection = progress.submit(broken);
  assert.equal(rejection.status, 'rejected');
  assert.equal(rejection.reason, 'connections');
  assert.equal(progress.snapshot().acceptedCount, 1);
  assert.equal(progress.submit(task.strokes[1]).status, 'accepted');
});

test('a first stroke must leave usable attachment points for later strokes', () => {
  const task = { category: 'letters', strokes: [
    [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.8 }],
    [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.8 }],
  ], completionGroups: [[0, 1]] };
  const progress = new StrokeProgress(task, { width: 600, height: 600 });
  const crooked = [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.7 }, { x: 0.26, y: 0.8 }];
  assert.equal(progress.match(crooked.map((p) => ({ x: p.x * 600, y: p.y * 600 })), 0, 0).fits, true);
  assert.equal(progress.submit(crooked).status, 'rejected');
  assert.equal(progress.snapshot().acceptedCount, 0);
  progress.submit(task.strokes[0]);
  assert.equal(progress.submit(progress.guideStroke(1)).status, 'accepted');
});

test('a later character cannot be drawn before the current character is complete', () => {
  const first = at('A');
  const task = { ...first, strokes: [...first.strokes, ...first.strokes.map((s) => s.map((p) => ({ x: p.x + 0.4, y: p.y })))], completionGroups: [[0, 1], [2, 3]] };
  for (const strict of [false, true]) {
    const progress = new StrokeProgress(task, { strict });
    assert.equal(progress.submit(task.strokes[2]).status, 'rejected');
    assert.equal(progress.nextIndex(), 0);
    progress.submit(task.strokes[0]);
    assert.equal(progress.submit(task.strokes[2]).status, 'rejected');
    progress.submit(task.strokes[1]);
    assert.equal(progress.nextIndex(), 2);
  }
});

test('strict mode rejects wrong starts and reversed traversal around a letter loop', () => {
  const task = at('O');
  const reversed = [...task.strokes[0]].reverse();
  assert.equal(submit(task, { strict: true }, [reversed]).snapshot().recognizable, false);
  assert.equal(submit(task, { strict: false }, [reversed]).snapshot().recognizable, true);
});

test('the same wobble is judged consistently at different sizes and more strictly on higher levels', () => {
  const reference = at('S');
  const size = new StrokeProgress(reference).groups[0].size;
  const base = sampleStroke(reference.strokes[0].map((p) => ({ x: p.x * 900, y: p.y * 620 })), 129);
  for (const amplitude of [0.01, 0.05, 0.09]) {
    let previous = null;
    for (const scale of [0.4, 1, 1.7]) {
      const options = { width: 900 * scale, height: 620 * scale };
      const drawing = base.map((p, i) => ({ x: (p.x + size * amplitude * Math.sin(i / 128 * Math.PI * 6)) / 900, y: p.y / 620 }));
      const results = levels.map((assist) => submit(reference, { ...options, assist }, [drawing]).snapshot().recognizable);
      if (previous) assert.deepEqual(results, previous, 'screen size changed tolerance');
      assert.ok(Number(results[0]) >= Number(results[1]) && Number(results[1]) >= Number(results[2]));
      if (amplitude === 0.01) assert.deepEqual(results, [true, true, true]);
      if (amplitude === 0.05) assert.deepEqual(results, [true, true, false]);
      previous = results;
    }
  }
});

test('an accepted shift and scale also move the next guide stroke', () => {
  const task = at('A');
  const progress = new StrokeProgress(task);
  const moved = task.strokes.map((s) => s.map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.9 + 0.04, y: 0.5 + (p.y - 0.5) * 0.9 - 0.02 })));
  assert.equal(progress.submit(moved[0]).status, 'accepted');
  const guide = progress.guideStroke(1);
  guide.forEach((point, i) => {
    assert.ok(Math.hypot(point.x - moved[1][i].x, point.y - moved[1][i].y) < 1e-8);
  });
  assert.equal(progress.submit(guide).status, 'accepted');
});

test('complete wrong characters and shapes cannot be accepted as another target', () => {
  const tasks = buildReviewSession().map((task) => adaptTaskToViewport(task, { width: 900, height: 620 }));
  const pools = [/^[A-Z]$/, /^[a-z]$/, /^\d$/].map((pattern) => tasks.filter((task) => pattern.test(task.label)));
  pools.push(EXERCISE_BANKS.shapes.map((task) => adaptTaskToViewport(task, { width: 900, height: 620 })));
  for (const assist of levels) for (const pool of pools) for (const target of pool) for (const candidate of pool) {
    if (target === candidate) continue;
    const progress = submit(target, { assist, strict: false }, candidate.strokes);
    // A target can be a valid prefix: the O in Q, or the F in E. The live
    // board completes at that prefix and locks input. Later marks are not
    // accepted as part of the target (and rejected ink is deliberately ignored).
    const everyMarkAccepted = progress.attempts.every((attempt) => attempt.status === 'accepted');
    assert.equal(progress.snapshot().recognizable && everyMarkAccepted, false, `${candidate.label} became ${target.label}/${assist}`);
  }
});
