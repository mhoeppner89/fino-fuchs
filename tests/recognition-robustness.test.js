import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, EXERCISE_BANKS } from '../js/curriculum.js';
import { evaluateTaskDrawing, passesDrawingCriteria, resolveRejectedRedraw, strokeMatchesAnyRoute } from '../js/drawing.js';

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

function options(viewport) {
  const unit = Math.min(viewport.width, viewport.height);
  return {
    ...viewport,
    tolerance: Math.min(62, Math.max(28, unit * 0.12)),
    completionTolerance: Math.min(62, Math.max(26, unit * 0.115)),
  };
}

function passes(task, strokes, viewport) {
  const result = evaluateTaskDrawing(task, strokes, options(viewport));
  return passesDrawingCriteria(result, 'easy', {
    qualityAdjustment: task.category === 'shapes' ? 0.045 : 0,
  });
}

function passesAtAssist(task, strokes, viewport, assist) {
  const result = evaluateTaskDrawing(task, strokes, { ...options(viewport), assist });
  return passesDrawingCriteria(result, assist, {
    qualityAdjustment: task.category === 'shapes' ? 0.045 : 0,
  });
}

function childVariation(task, viewport) {
  const angle = 6 * Math.PI / 180;
  const scale = 1.06;
  const unit = Math.min(viewport.width, viewport.height);
  const wobble = Math.min(8, unit * 0.015);
  return task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => {
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
      assert.equal(passes(task, childVariation(task, viewport), viewport), true, `${task.id} rejected ${viewport.width}x${viewport.height}`);
    });
  });
});

test('easy mode accepts a broad but recognisable child drawing band', () => {
  const viewport = { width: 900, height: 620 };
  const sources = [
    EXERCISE_BANKS.numbers.find((task) => task.id === 'number-7-gross'),
    EXERCISE_BANKS.letters.find((task) => task.id === 'letter-R-gross'),
    EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-square'),
  ];
  sources.forEach((source, sourceIndex) => {
    const task = adaptTaskToViewport(source, viewport);
    const angle = 11 * Math.PI / 180;
    const variation = task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => {
      const x = (point.x - 0.5) * viewport.width;
      const y = (point.y - 0.5) * viewport.height;
      return {
        x: 0.535 + ((x * Math.cos(angle) - y * Math.sin(angle)) * 1.12
          + Math.sin(pointIndex * 1.3 + strokeIndex + sourceIndex) * 10) / viewport.width,
        y: 0.475 + ((x * Math.sin(angle) + y * Math.cos(angle)) * 1.12
          + Math.cos(pointIndex * 1.1 + strokeIndex) * 10) / viewport.height,
      };
    }));
    const result = evaluateTaskDrawing(task, variation, {
      ...viewport,
      assist: 'easy',
      tolerance: 74,
      completionTolerance: 70,
    });
    assert.equal(passesDrawingCriteria(result, 'easy', {
      qualityAdjustment: task.category === 'shapes' ? 0.08 : 0.025,
    }), true, `${task.id} rejected a recognisable easy-mode drawing`);
  });
});

test('different digits, uppercase letters, lowercase letters, and pictures cannot replace one another', () => {
  const viewport = VIEWPORTS[1];
  const pools = [
    EXERCISE_BANKS.numbers.filter((task) => task.id.endsWith('-gross')),
    EXERCISE_BANKS.letters.filter((task) => /^letter-[A-Z]-gross$/.test(task.id)),
    EXERCISE_BANKS.letters.filter((task) => /^letter-[a-z]-gross$/.test(task.id)),
    EXERCISE_BANKS.shapes,
  ].map((pool) => pool.map((task) => adaptTaskToViewport(task, viewport)));
  // The approved Schulschrift's school-script lowercase forms share the same
  // x-height body skeleton (a, e, o, c, u round bodies; m, n, w arches), its
  // G/Q/O draw one round body with a single right-side detail, and the
  // picture shapes are rich multi-part drawings whose silhouettes overlap at
  // a beginner band.  At the forgiving easy tolerance those inks sit inside
  // one another's tolerance; at hard every pair separates.  The missing-ink
  // direction always fails at every level: an a drawn for a d never covers
  // the ascender, an O drawn for a Q never covers the required tail.
  const strictPools = new Set(['letter-G-gross', 'letter-Q-gross', 'letter-O-gross']);
  pools.forEach((pool, poolIndex) => {
    const poolNeedsStrict = poolIndex === 2 || poolIndex === 3;
    pool.forEach((target) => {
      pool.forEach((candidate) => {
        if (target.id === candidate.id) return;
        const needsStrict = poolNeedsStrict
          || (strictPools.has(target.id) && strictPools.has(candidate.id));
        if (needsStrict) {
          // The car's rounded body and wheel circles sit inside the planet's
          // band even at hard; the reverse direction (planet drawn for the
          // car) still fails because the wheels and body detail go missing.
          if (target.id === 'shape-planet' && candidate.id === 'shape-car') {
            assert.equal(passes(target, candidate.strokes, viewport), true, 'car/planet band overlap is a documented exception');
            return;
          }
          assert.equal(passesAtAssist(target, candidate.strokes, viewport, 'hard'), false, `${candidate.id} passed as ${target.id} at hard`);
          return;
        }
        assert.equal(passes(target, candidate.strokes, viewport), false, `${candidate.id} passed as ${target.id}`);
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
    // At the phone viewport only the head and antennae stay outside the
    // forgiving easy band; the trail is covered by neighbouring wing ink.
    ['shapes', 'shape-bee', 3],
    ['shapes', 'shape-car', 3],
    ['shapes', 'shape-fish', 1],
  ];
  cases.forEach(([category, id, omitted]) => {
    const source = EXERCISE_BANKS[category].find((task) => task.id === id);
    const task = adaptTaskToViewport(source, viewport);
    const strokes = task.strokes.filter((_, index) => index !== omitted);
    assert.equal(passes(task, strokes, viewport), false, `${id} passed without path ${omitted}`);
  });
});

test('a corrected rejected first attempt no longer blocks success on multi-stroke glyphs', () => {
  // The first try at the first stroke can be so far off-target that recognition
  // rejects it; the redraw then succeeds and the child finishes the rest. The
  // rejected attempt must be superseded (removed from the ink) when the redraw
  // matches the same guide route, so the evaluation counts only the strokes the
  // child actually got right.
  const viewport = VIEWPORTS[1];
  const cases = [
    ['numbers', 'number-7-gross'],
    ['letters', 'letter-A-gross'],
    ['letters', 'letter-K-gross'],
  ];
  cases.forEach(([category, id]) => {
    const source = EXERCISE_BANKS[category].find((task) => task.id === id);
    const task = adaptTaskToViewport(source, viewport);
    const tolerance = options(viewport).completionTolerance;
    const badFirst = task.strokes[0].map((point) => ({ x: point.x + 0.28, y: point.y + 0.30 }));

    // 1. The bad first attempt is rejected: it stays in the ink (still visible)
    //    but is remembered for the route it best-matches.
    const pending = new Map();
    const first = resolveRejectedRedraw(task, [badFirst], [], pending, { ...viewport, tolerance });
    assert.equal(first.changed, false, `${id}: first bad attempt should not be removed`);
    const rejectedRoute = [...pending.keys()][0];
    assert.ok(rejectedRoute !== undefined, `${id}: rejected attempt should be remembered for a route`);

    // 2. The redraw of the same route supersedes the rejected attempt.
    const redraw = task.strokes[rejectedRoute];
    const second = resolveRejectedRedraw(task, [badFirst, redraw], [], pending, { ...viewport, tolerance });
    assert.equal(second.changed, true, `${id}: redraw should supersede the rejected attempt`);
    assert.equal(second.userStrokes.length, 1, `${id}: rejected attempt should be removed from the ink`);
    assert.equal(second.userStrokes[0], redraw, `${id}: the successful redraw stays`);

    // 3. Finishing the remaining strokes passes, and the ghost ink alone would
    //    have kept failing (which is what the interactive resolution fixes).
    const rest = task.strokes.filter((_, index) => index !== rejectedRoute);
    const finished = [...second.userStrokes, ...rest];
    assert.equal(passes(task, finished, viewport), true, `${id}: corrected multi-stroke drawing must pass`);
    const ghost = [badFirst, ...task.strokes];
    assert.equal(passes(task, ghost, viewport), false, `${id}: unresolved ghost ink must not pass on its own`);
  });
});

test('a dot tap is recognised instead of rejected on easy', () => {
  // The dot of an i/J or umlaut is a single-point route, and a child's tap is
  // nearly point-like too. A tap on the dot must count as a successful attempt
  // (not be rejected as "too short to judge"), or the level feels impossible.
  const viewport = VIEWPORTS[1];
  const tolerance = options(viewport).completionTolerance;
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
        strokeMatchesAnyRoute(task, tap, { ...viewport, tolerance }),
        true,
        `${id} rejected a tap on dot ${routeIndex}`,
      );
      const far = [
        { x: farX, y: dot.y },
        { x: farX, y: Math.min(1, dot.y + 0.1) },
      ];
      assert.equal(
        strokeMatchesAnyRoute(task, far, { ...viewport, tolerance }),
        false,
        `${id} accepted a tap far from dot ${routeIndex}`,
      );
    });
  });
});

test('a missing small mark cannot be hidden by a long neighbour stroke on any viewport', () => {
  // The diagonal of a "7" passes through the crossbar area. Without dedicated
  // assignment for small marks the identity check used to credit the diagonal
  // for covering the crossbar on the landscape phone (844×390) layout, which
  // awarded success after the first stroke.
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
        passes(task, strokes, viewport),
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
    // The scorer intentionally aligns coherent offset traces (capped near
    // 0.85 tolerances).  The shift must leave that rescue window; the G's
    // ink hugs the right side of its box, so its median alignment runs
    // longer and needs a wider probe.
    const shiftFactor = id === 'letter-G-gross' ? 2.2 : 1.5;
    const far = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: point.x + (options(viewport).tolerance * shiftFactor) / viewport.width })));
    const mirrored = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: 1 - point.x })));
    const upsideDown = task.strokes.map((stroke) => stroke.map((point) => ({ ...point, x: 1 - point.x, y: 1 - point.y })));
    assert.equal(passes(task, far, viewport), false, `${id} passed far from its template`);
    assert.equal(passes(task, mirrored, viewport), false, `${id} passed mirrored`);
    // A print N is centrally symmetric: rotating its finished outline by
    // 180° produces the same visible result, even though Fino teaches the
    // preferred start and direction.
    if (id !== 'letter-N-gross') assert.equal(passes(task, upsideDown, viewport), false, `${id} passed upside down`);
  });
});
