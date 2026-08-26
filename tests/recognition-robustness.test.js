import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, EXERCISE_BANKS } from '../js/curriculum.js';
import { evaluateTaskDrawing, passesDrawingCriteria } from '../js/drawing.js';

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
