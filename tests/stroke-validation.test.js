import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const broken = [{ x: 0.39, y: 0.8 }, { x: 0.7, y: 0.8 }];
  const fit = progress.match(broken.map((p) => ({ x: p.x * 600, y: p.y * 600 })), 1, 0);
  assert.equal(fit.fits, true, 'this case must isolate the joint check');
  const rejection = progress.submit(broken);
  assert.equal(rejection.status, 'rejected');
  assert.equal(rejection.reason, 'connections');
  assert.equal(progress.snapshot().acceptedCount, 1);
  assert.equal(progress.submit(task.strokes[1]).status, 'accepted');
});

test('a reasonable first stroke is not rejected against an imaginary future join', () => {
  const task = { category: 'letters', strokes: [
    [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.8 }],
    [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.8 }],
  ], completionGroups: [[0, 1]] };
  const progress = new StrokeProgress(task, { width: 600, height: 600 });
  const crooked = [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.7 }, { x: 0.245, y: 0.8 }];
  assert.equal(progress.match(crooked.map((p) => ({ x: p.x * 600, y: p.y * 600 })), 0, 0).fits, true);
  assert.equal(progress.submit(crooked).status, 'accepted');
  assert.equal(progress.snapshot().acceptedCount, 1);
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
  for (const amplitude of [0.01, 0.05, 0.09, 0.18]) {
    let previous = null;
    for (const scale of [0.4, 1, 1.7]) {
      const options = { width: 900 * scale, height: 620 * scale };
      const drawing = base.map((p, i) => ({ x: (p.x + size * amplitude * Math.sin(i / 128 * Math.PI * 6)) / 900, y: p.y / 620 }));
      const results = levels.map((assist) => submit(reference, { ...options, assist }, [drawing]).snapshot().recognizable);
      if (previous) assert.deepEqual(results, previous, 'screen size changed tolerance');
      assert.ok(Number(results[0]) >= Number(results[1]) && Number(results[1]) >= Number(results[2]));
      if (amplitude === 0.01) assert.deepEqual(results, [true, true, true]);
      if (amplitude === 0.18) assert.equal(results[2], false);
      previous = results;
    }
  }
});

test('a slightly displaced first stroke leaves every guide fixed', () => {
  for (const assist of levels) {
    const task = at('A');
    const progress = new StrokeProgress(task, { assist });
    const moved = task.strokes[0].map((p) => ({ x: p.x + 0.01, y: p.y }));
    assert.equal(progress.submit(moved).status, 'accepted');
    task.strokes.forEach((stroke, i) => assert.deepEqual(progress.guideStroke(i), stroke));
    assert.equal(progress.submit(task.strokes[1]).status, 'accepted');
  }
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


test('small junction gaps and uneven stroke lengths pass without moving the target', () => {
  const task = { category: 'letters', strokes: [
    [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.8 }],
    [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.8 }],
  ] };
  for (const [assist, gap] of [['easy', 0.035], ['medium', 0.025], ['hard', 0.015]]) {
    const progress = new StrokeProgress(task, { width: 600, height: 600, assist });
    assert.equal(progress.submit(task.strokes[0]).status, 'accepted');
    const shortened = [{ x: 0.3 + gap, y: 0.8 }, { x: 0.7, y: 0.8 }];
    assert.equal(progress.submit(shortened).status, 'accepted', assist);
    assert.equal(progress.snapshot().recognizable, true);
    assert.deepEqual(progress.guideStroke(1), task.strokes[1]);
  }
});


const handwritingExamples = ['handwritten-a', 'handwritten-a-rough'].map((name) =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url))));

test('both user-provided A examples and rougher variants succeed on easy', () => {
  for (const fixture of handwritingExamples) for (const scale of [0.4, 1, 1.7]) {
    for (const wobble of [0, 0.025, 0.05]) {
      const { task, width, height } = fixture;
      const options = { width: width * scale, height: height * scale, assist: 'easy', strict: true };
      const size = new StrokeProgress(task, { width, height }).groups[0].size;
      // A shared nonlinear bend keeps the joined parts together while adding
      // visible unevenness. The template stays fixed throughout.
      const strokes = fixture.strokes.map((stroke) => sampleStroke(stroke.map((p) => ({ x: p.x * width, y: p.y * height })), 129)
        .map((p) => ({ x: (p.x + size * wobble * Math.sin(p.y / size * Math.PI * 3)) / width,
          y: (p.y + size * wobble * Math.sin(p.x / size * Math.PI * 3)) / height })));
      const progress = new StrokeProgress(task, options);
      strokes.forEach((stroke, i) => {
        const result = progress.submit(stroke);
        assert.equal(result.status, 'accepted', `${task.id}/${scale}/${wobble}/${i}: ${result.reason}`);
        assert.deepEqual(progress.guideStroke(i), task.strokes[i]);
        assert.equal(progress.snapshot().allRequired, i === 1);
      });
      assert.equal(progress.snapshot().recognizable, true);
    }
  }
});

test('easy accepts uneven curves across the full letter and number library', () => {
  for (const original of buildReviewSession()) {
    const task = adaptTaskToViewport(original, { width: 900, height: 620 });
    const size = new StrokeProgress(task).groups[0].size;
    const drawing = task.strokes.map((stroke) => sampleStroke(stroke.map((p) => ({ x: p.x * 900, y: p.y * 620 })), 97)
      .map((p) => ({ x: (p.x + size * 0.03 * Math.sin(p.y / size * Math.PI * 4)) / 900,
        y: (p.y + size * 0.03 * Math.sin(p.x / size * Math.PI * 4)) / 620 })));
    assert.equal(submit(task, { assist: 'easy' }, drawing).snapshot().recognizable, true, task.id);
  }
});
