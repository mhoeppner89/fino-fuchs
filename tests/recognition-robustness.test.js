import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, EXERCISE_BANKS } from '../js/curriculum.js';
import { judgeStrokeAgainstRoute, strokeMatchesAnyRoute } from '../js/drawing.js';
import { passes, taskOutcome } from './oracle.js';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 700 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
];

const baseCharacters = [
  ...EXERCISE_BANKS.numbers.filter((task) => task.id.endsWith('-gross')),
  ...EXERCISE_BANKS.letters.filter((task) => task.id.endsWith('-gross')),
];
const basePictures = [...EXERCISE_BANKS.shapes];

/**
 * Mirrors the per-route tolerance `StrokeValidation.match` derives so probe
 * shifts are expressed relative to the validator's own band instead of an
 * arbitrary constant.
 */
function guideBandPixels(task, width, height, assist = 'easy') {
  const bands = { easy: 0.13, medium: 0.09, hard: 0.055 };
  const routes = task.strokes.map((route) => route.map((p) => ({ x: p.x * width, y: p.y * height })));
  const points = routes.flat();
  const size = Math.max(
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
    1e-6,
  );
  const routeLength = (route) => route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y), 0);
  return Math.min(
    ...routes.map((route) => Math.min(size * bands[assist], Math.max(size * 0.025, routeLength(route) * 0.30))),
  );
}

function viewportOptions(viewport) {
  return { width: viewport.width, height: viewport.height, assist: 'easy' };
}

function passesAtAssist(sourceTask, strokes, viewport, assist) {
  return passes(sourceTask, strokes, {
    width: viewport.width,
    height: viewport.height,
    assist,
  });
}

function childVariation(task, viewport) {
  const angle = 6 * Math.PI / 180;
  const scale = 1.06;
  const unit = Math.min(viewport.width, viewport.height);
  const wobble = Math.min(8, unit * 0.015);
  return task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => {
    // Single-point dot marks stay where the template shows them: the child
    // taps the visible grey dot, so rotating the whole glyph must not carry
    // the dot target away with it.
    if (stroke.length === 1) {
      return {
        x: point.x + Math.sin(pointIndex * 1.7 + strokeIndex) * 2 / viewport.width,
        y: point.y + Math.cos(pointIndex * 1.3 + strokeIndex) * 2 / viewport.height,
      };
    }
    const x = (point.x - 0.5) * viewport.width;
    const y = (point.y - 0.5) * viewport.height;
    return {
      x: 0.5 + ((x * Math.cos(angle) - y * Math.sin(angle)) * scale + unit * 0.04 + Math.sin(pointIndex * 1.7 + strokeIndex) * wobble) / viewport.width,
      y: 0.5 + ((x * Math.sin(angle) + y * Math.cos(angle)) * scale - unit * 0.03 + Math.cos(pointIndex * 1.3 + strokeIndex) * wobble) / viewport.height,
    };
  }));
}

test('every shipped character and picture accepts a coherent child-like variation on mobile layouts', () => {
  [...baseCharacters, ...basePictures].forEach((source) => {
    VIEWPORTS.forEach((viewport) => {
      const task = adaptTaskToViewport(source, viewport);
      assert.equal(
        passes(task, childVariation(task, viewport), viewportOptions(viewport)),
        true,
        `${task.id} rejected ${viewport.width}x${viewport.height}`,
      );
    });
  });
});

test('wobbly child strokes inside the guide band pass on easy', () => {
  // A child wanders off the centre line and back. The whole-glyph verdict is
  // the runtime validator: every pen stroke is judged by its closest-line
  // error against the guide band, not by an average perfection.
  const viewport = { width: 900, height: 620 };
  const sources = [
    ...EXERCISE_BANKS.numbers.filter((task) => ['number-7-gross', 'number-8-gross', 'number-5-gross'].includes(task.id)),
    ...EXERCISE_BANKS.letters.filter((task) => ['letter-A-gross', 'letter-R-gross', 'letter-e-gross', 'letter-M-gross'].includes(task.id)),
    EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-square'),
  ];
  sources.forEach((source, sourceIndex) => {
    const task = adaptTaskToViewport(source, viewport);
    const unit = Math.min(viewport.width, viewport.height);
    // A smooth hand drift inside the guide band: a real wobble stays on the
    // route and moves neighbouring points coherently (it must not inflate
    // pen length or break a closed contour the way zigzag noise does).
    const wobbled = task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => ({
      x: point.x + Math.sin(pointIndex * 0.9 + strokeIndex) * unit * 0.03 / viewport.width,
      y: point.y + Math.cos(pointIndex * 0.8 + strokeIndex) * unit * 0.025 / viewport.height,
    })));
    const outcome = taskOutcome(task, wobbled, viewportOptions(viewport));
    assert.equal(outcome.passes, true, `${task.id} rejected an in-band wobble (${sourceIndex})`);
  });
});

test('reversed traversal of a finished drawing passes when the order checkbox is off', () => {
  // "Schulschrift genau üben" off: the child may choose their own order and
  // direction. Reversing every route (and reversing pen order) must still
  // complete the glyph.
  const viewport = { width: 900, height: 620 };
  const ids = ['letter-C-gross', 'letter-O-gross', 'letter-S-gross', 'number-8-gross', 'number-0-gross'];
  ids.forEach((id) => {
    const bank = id.startsWith('number') ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters;
    const task = adaptTaskToViewport(bank.find((candidate) => candidate.id === id), viewport);
    const reversed = task.strokes.map((stroke) => [...stroke].reverse());
    assert.equal(
      passes(task, reversed, { ...viewportOptions(viewport), strict: false }),
      true,
      `${id} rejected its reversed trace with order freedom`,
    );
  });
});

test('different digits, uppercase letters, lowercase letters, and pictures cannot replace one another', () => {
  const viewport = VIEWPORTS[1];
  const pools = [
    EXERCISE_BANKS.numbers.filter((task) => task.id.endsWith('-gross')),
    EXERCISE_BANKS.letters.filter((task) => /^letter-[A-ZÄÖÜß]-gross$/.test(task.id)),
    EXERCISE_BANKS.letters.filter((task) => /^letter-[a-zäöü]-gross$/.test(task.id)),
    EXERCISE_BANKS.shapes,
  ].map((pool) => pool.map((task) => adaptTaskToViewport(task, viewport)));
  // Sequential acceptance judges every pen stroke against the target's routes
  // in taught order, and the app celebrates the moment the glyph completes.
  // A different glyph therefore can only be "confused" with the target when
  // its own strokes are a superset drawn in the same taught order (the child
  // effectively finished the target first; extra ink lands on the next task).
  // Those superset pairs are documented exceptions below; every other pair
  // must fail — missing parts, wrong per-route shape, wrong order.
  const supersets = new Set([
    'letters:letter-F-gross<-letter-E-gross',
    'shapes:shape-diamond<-shape-kite',
  ]);
  pools.forEach((pool, poolIndex) => {
    pool.forEach((target) => {
      pool.forEach((candidate) => {
        if (target.id === candidate.id) return;
        const key = `${['numbers', 'letters', 'letters', 'shapes'][poolIndex]}:${target.id}<-${candidate.id}`;
        const expected = supersets.has(key);
        assert.equal(
          passesAtAssist(target, candidate.strokes, viewport, 'hard'),
          expected,
          `${candidate.id} ${expected ? 'should' : 'must not'} complete ${target.id}`,
        );
      });
    });
  });
});

test('missing teaching details remain incomplete', () => {
  const viewport = VIEWPORTS[1];
  const cases = [
    ['letters', 'letter-A-gross', 1],
    ['letters', 'letter-H-gross', 2],
    ['letters', 'letter-i-gross', 1],
    ['letters', 'letter-j-gross', 1],
    ['shapes', 'shape-flower', 1],
    ['shapes', 'shape-sun', 1],
    ['shapes', 'shape-bee', 3],
    ['shapes', 'shape-car', 3],
    ['shapes', 'shape-fish', 1],
  ];
  cases.forEach(([category, id, omitted]) => {
    const source = EXERCISE_BANKS[category].find((task) => task.id === id);
    const task = adaptTaskToViewport(source, viewport);
    const strokes = task.strokes.filter((_, index) => index !== omitted);
    assert.equal(passes(task, strokes, viewportOptions(viewport)), false, `${id} passed without path ${omitted}`);
  });
});

test('a corrected rejected first attempt no longer blocks success on multi-stroke glyphs', () => {
  // The first try can be far off-target and is rejected; the ink stays visible
  // but never enters the accepted ledger. When the child redraws that route
  // successfully, only accepted strokes count — the ghost ink cannot drag the
  // final verdict down.
  const viewport = VIEWPORTS[1];
  const cases = [
    ['numbers', 'number-7-gross'],
    ['letters', 'letter-A-gross'],
    ['letters', 'letter-K-gross'],
  ];
  cases.forEach(([category, id]) => {
    const source = EXERCISE_BANKS[category].find((task) => task.id === id);
    const task = adaptTaskToViewport(source, viewport);
    const badFirst = task.strokes[0].map((point) => ({ x: point.x + 0.28, y: point.y + 0.30 }));
    // 1. The ghost ink alone never completes the glyph.
    assert.equal(passes(task, [badFirst], viewportOptions(viewport)), false, `${id}: ghost ink alone must not pass`);
    // 2. Replaying every template stroke after the rejected attempt completes
    //    the glyph: the ledger holds only accepted strokes.
    assert.equal(
      passes(task, [badFirst, ...task.strokes], viewportOptions(viewport)),
      true,
      `${id}: corrected multi-stroke drawing must pass`,
    );
  });
});

test('a dot tap is recognised instead of rejected on easy', () => {
  // The dot of an i/J or umlaut is a single-point route, and a child's tap is
  // nearly point-like too. A tap on the dot must count as a successful attempt
  // (not be rejected as "too short to judge"), or the level feels impossible.
  const viewport = VIEWPORTS[1];
  const tolerance = Math.min(62, Math.max(28, Math.min(viewport.width, viewport.height) * 0.12));
  const cases = ['letter-i-gross', 'letter-j-gross', 'letter-ä-gross', 'letter-ö-gross', 'letter-ü-gross'];
  cases.forEach((id) => {
    const task = adaptTaskToViewport(EXERCISE_BANKS.letters.find((candidate) => candidate.id === id), viewport);
    const leftmost = Math.min(...task.strokes.flat().map((point) => point.x));
    const farX = Math.max(0, leftmost - (tolerance + 10) / viewport.width);
    task.strokes.forEach((route, routeIndex) => {
      if (route.length > 1) return; // only the dot marks
      const dot = route[0];
      const tap = [
        { x: dot.x, y: dot.y },
        { x: dot.x + 3 / viewport.width, y: dot.y + 2 / viewport.height },
        { x: dot.x + 1 / viewport.width, y: dot.y + 3 / viewport.height },
      ];
      assert.equal(
        strokeMatchesAnyRoute(task, tap, { width: viewport.width, height: viewport.height, tolerance }),
        true,
        `${id} rejected a tap on dot ${routeIndex}`,
      );
      const far = [
        { x: farX, y: dot.y },
        { x: farX, y: Math.min(1, dot.y + 0.1) },
      ];
      assert.equal(
        strokeMatchesAnyRoute(task, far, { width: viewport.width, height: viewport.height, tolerance }),
        false,
        `${id} accepted a tap far from dot ${routeIndex}`,
      );
    });
  });
});

test('a missing small mark cannot be hidden by a long neighbour stroke on any viewport', () => {
  // The diagonal of a "7" passes through the crossbar area. Without dedicated
  // per-route acceptance the diagonal used to stand in for the crossbar. The
  // sequential validator requires every route to be accepted individually, so
  // the missing crossbar always stays incomplete.
  const cases = [
    ['numbers', 'number-7-gross', 1],
    ['letters', 'letter-A-gross', 1],
    ['letters', 'letter-i-gross', 1],
    ['letters', 'letter-j-gross', 1],
  ];
  VIEWPORTS.forEach((viewport) => {
    cases.forEach(([category, id, omitted]) => {
      const source = EXERCISE_BANKS[category].find((task) => task.id === id);
      const task = adaptTaskToViewport(source, viewport);
      const strokes = task.strokes.filter((_, index) => index !== omitted);
      assert.equal(
        passes(task, strokes, viewportOptions(viewport)),
        false,
        `${id} passed without path ${omitted} on ${viewport.width}x${viewport.height}`,
      );
    });
  });
});

test('alignment does not rescue far-away, mirrored, or upside-down directed characters', () => {
  const viewport = VIEWPORTS[1];
  const ids = ['number-2-gross', 'number-3-gross', 'number-4-gross', 'number-5-gross', 'number-6-gross', 'number-7-gross', 'number-9-gross', 'letter-F-gross', 'letter-G-gross', 'letter-J-gross', 'letter-N-gross', 'letter-q-gross'];
  ids.forEach((id) => {
    const bank = id.startsWith('number') ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters;
    const task = adaptTaskToViewport(bank.find((candidate) => candidate.id === id), viewport);
    // The shift must exceed the validator's own per-task guide band (computed
    // the same way match() derives it), not an arbitrary global constant.
    const band = guideBandPixels(task, viewport.width, viewport.height, 'easy');
    const shift = band * 2.2;
    const far = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: point.x + shift / viewport.width })));
    const mirrored = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: 1 - point.x })));
    const upsideDown = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: 1 - point.x, y: 1 - point.y })));
    assert.equal(passes(task, far, viewportOptions(viewport)), false, `${id} passed far from its template`);
    assert.equal(passes(task, mirrored, viewportOptions(viewport)), false, `${id} passed mirrored`);
    assert.equal(passes(task, upsideDown, viewportOptions(viewport)), false, `${id} passed upside down`);
  });
});
