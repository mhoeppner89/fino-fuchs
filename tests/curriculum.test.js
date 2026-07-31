import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adaptTaskToViewport,
  createNameExerciseBank,
  TASKS,
  buildSession,
  createWordTask,
  EXERCISE_BANKS,
  getExerciseBank,
  normalizeName,
  OPTION_SETS,
  SESSION_SIZE,
  seededRandom,
} from '../js/curriculum.js';

const geometryKey = (task) => JSON.stringify(task.strokes.map((stroke) => stroke.map((point) => [
  Number(point.x.toFixed(5)), Number(point.y.toFixed(5)),
])));

test('every activity has distinct exercises, without repeated shape variants', () => {
  const banks = { ...EXERCISE_BANKS, name: createNameExerciseBank('Käthe') };
  const expectedSizes = { lines: 100, shapes: 36, numbers: 100, letters: 100, mixed: 100, name: 100 };
  Object.entries(banks).forEach(([category, bank]) => {
    assert.equal(bank.length, expectedSizes[category], `${category} bank size`);
    assert.equal(new Set(bank.map((task) => task.id)).size, expectedSizes[category], `${category} IDs`);
    assert.equal(new Set(bank.map(geometryKey)).size, expectedSizes[category], `${category} paths`);
  });
  assert.equal(TASKS.length, 436);
  assert.deepEqual(EXERCISE_BANKS.shapes.map((task) => task.id), [
    'shape-circle', 'shape-oval', 'shape-square', 'shape-triangle', 'shape-cross',
    'shape-diamond', 'shape-heart', 'shape-star', 'shape-rectangle', 'shape-pentagon',
    'shape-hexagon', 'shape-arrow', 'shape-house', 'shape-kite', 'shape-balloon',
    'shape-fish', 'shape-flower', 'shape-sun', 'shape-sailboat', 'shape-rocket',
    'shape-tree', 'shape-ice-cream', 'shape-rainbow', 'shape-car', 'shape-butterfly',
    'shape-snail', 'shape-umbrella', 'shape-mushroom', 'shape-bird', 'shape-present',
    'shape-crown', 'shape-castle', 'shape-train', 'shape-planet', 'shape-apple', 'shape-bee',
  ]);
});

test('new picture shapes are staged and use planned, fitting stroke colours', () => {
  const pictureIds = [
    'shape-tree', 'shape-ice-cream', 'shape-rainbow', 'shape-car', 'shape-butterfly',
    'shape-snail', 'shape-umbrella', 'shape-mushroom', 'shape-bird', 'shape-present',
    'shape-crown', 'shape-castle', 'shape-train', 'shape-planet', 'shape-apple', 'shape-bee',
  ];
  pictureIds.forEach((id) => {
    const task = EXERCISE_BANKS.shapes.find((candidate) => candidate.id === id);
    assert.ok(task, `missing ${id}`);
    assert.ok(task.strokes.length >= 3, `${id} should have several drawing stages`);
    assert.equal(task.strokeColors.length, task.strokes.length, `${id} needs a colour for every stroke`);
    assert.ok(task.strokeColors.every((color) => /^#[0-9A-F]{6}$/i.test(color)), `${id} has an invalid colour`);
  });
  const rainbow = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-rainbow');
  assert.equal(new Set(rainbow.strokeColors).size, 3, 'rainbow arcs should switch colour');
});

test('picture-shape colours remain aligned with their paths after responsive reflow', () => {
  const apple = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-apple');
  [[390, 844], [1180, 680]].forEach(([width, height]) => {
    const fitted = adaptTaskToViewport(apple, { width, height });
    assert.equal(fitted.strokes.length, fitted.strokeColors.length);
    assert.deepEqual(fitted.strokeColors, apple.strokeColors);
    assert.deepEqual(fitted.completionGroups.flat(), fitted.strokes.map((_, index) => index));
  });
});

test('custom number and letter sets retain enough unique exercises for a full round', () => {
  const numbers = getExerciseBank('numbers', { option: '257' });
  const letters = getExerciseBank('letters', { option: 'MARTIN' });
  const lowerCaseLetters = getExerciseBank('letters', { option: 'aä' });
  assert.ok(numbers.length >= SESSION_SIZE);
  assert.ok(letters.length >= SESSION_SIZE);
  assert.ok(numbers.every((task) => /^[257 ]+$/.test(task.label)));
  assert.ok(letters.every((task) => /^[MARTIN ]+$/.test(task.label)));
  assert.ok(lowerCaseLetters.every((task) => /^[aä ]+$/.test(task.label)));
});

test('the number and letter selector consistently says Alle and has spaced custom inputs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.ok(OPTION_SETS.numbers.some((option) => option.value === 'all' && option.label === 'Alle'));
  assert.ok(OPTION_SETS.letters.some((option) => option.value === 'all' && option.label === 'Alle'));
  assert.equal((html.match(/>Alle<\/span>/g) ?? []).length, 2);
  assert.match(styles, /\.custom-set-field\s*\{[^}]*margin-top:\s*15px/s);
  assert.match(html, /id="child-name"[^>]*enterkeyhint="go"/);
  assert.match(html, /id="number-set"[^>]*inputmode="numeric"[^>]*enterkeyhint="done"/);
  assert.doesNotMatch(app, /setTimeout\(\(\) => elements\.childName\.focus/);
  assert.match(app, /if \(custom && focus\) input\.focus/);
});

test('practice view keeps only the board and compact top-bar actions', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="mentor-message"/);
  assert.doesNotMatch(html, /id="task-mode"/);
  assert.doesNotMatch(html, /id="task-title"/);
  assert.doesNotMatch(html, /id="reference-chip"/);
  assert.match(html, /id="previous-task-button"[\s\S]*id="progress-dots"[\s\S]*id="next-task-button"/);
  assert.match(html, /class="practice-actions"[\s\S]*id="clear-button"[\s\S]*id="undo-button"[\s\S]*id="show-button"/);
  assert.match(html, /id="show-button"[\s\S]*assets\/fox-face\.svg/);
  assert.match(styles, /\.practice-layout\s*\{\s*display:\s*flex;\s*flex:\s*1 1 auto;/s);
});

test('the home screen shows the current app version discreetly', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  assert.ok(html.includes(`class="app-version" aria-label="App-Version ${packageVersion}">v${packageVersion}</small>`));
  assert.match(styles, /\.app-version\s*\{[^}]*opacity:\s*\.5/s);
});

test('lowercase letters are included in the regular 100-exercise letter bank', () => {
  const labels = new Set(EXERCISE_BANKS.letters.map((task) => task.label.replace(/\s/g, '')));
  ['a', 'm', 'z', 'ä', 'ö', 'ü'].forEach((letter) => assert.ok(labels.has(letter), `missing ${letter}`));
  assert.equal(EXERCISE_BANKS.letters.length, 100);
});

test('M and lowercase i keep the published Kiwi handwriting construction', () => {
  const m = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-M-gross');
  assert.ok(m.strokes[0][0].y > m.strokes[0][1].y, 'M should begin at the lower-left then travel up');
  assert.equal(m.strokes.length, 2, 'M should lift after its first rising slant');
  assert.ok(m.strokes[1][1].y > m.strokes[1][0].y, 'M middle should dip below its two top points');

  const i = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-i-gross');
  const dotX = i.strokes[1].reduce((sum, point) => sum + point.x, 0) / i.strokes[1].length;
  assert.ok(Math.abs(dotX - i.strokes[0][0].x) < 0.025, 'i dot must sit over the top of its slanted stem');
  assert.ok(Math.max(...i.strokes[1].map((point) => point.y)) < Math.min(...i.strokes[0].map((point) => point.y)), 'i dot should sit above its stem');
});

test('Kiwi digits 1, 7, and 9 retain their distinct published forms', () => {
  const one = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-1-gross');
  const seven = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-7-gross');
  const nine = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-9-gross');
  assert.equal(one.strokes.length, 1, '1 is one slanted downstroke, without a hook or foot');
  assert.ok(one.strokes[0][0].x > one.strokes[0].at(-1).x, '1 should lean left as it descends');
  assert.equal(seven.strokes.length, 1, '7 has no middle crossbar in the source font');
  assert.ok(seven.strokes[0][0].x < seven.strokes[0][1].x, '7 should begin with a top bar');
  assert.ok(seven.strokes[0].at(-1).x < seven.strokes[0][1].x, '7 should descend to the left');
  assert.equal(nine.strokes.length, 1, '9 remains one loop-and-tail movement');
  assert.ok(nine.strokes[0][0].y < nine.strokes[0].at(-1).y, '9 tail should finish below its loop');
  assert.ok(nine.strokes[0][0].x > nine.strokes[0].at(-1).x, '9 tail should finish left of its upper loop');
});

test('lowercase a, r, and t use connected, recognisable handwriting paths', () => {
  const a = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-a-gross');
  const r = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-r-gross');
  const t = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-t-gross');
  assert.equal(a.strokes.length, 1, 'a loop and tail should be one continuous trace');
  assert.ok(a.strokes[0].at(-1).y > a.strokes[0][0].y + 0.1, 'a should end with a clear right-hand tail');
  assert.equal(r.strokes.length, 1, 'r upright and shoulder should be continuous');
  const rJoin = r.strokes[0].findIndex((point) => point.y < 0.42);
  assert.ok(rJoin > 0 && r.strokes[0][rJoin - 1].x <= r.strokes[0][rJoin].x, 'r shoulder should leave its upright without a gap');
  assert.equal(t.strokes.length, 2, 't needs a stem and one crossbar');
  assert.ok(t.strokes[0].at(-1).x > t.strokes[0][0].x + 0.04, 't should finish with a friendly exit hook');
});

test('approved lowercase l and q retain their distinct exits', () => {
  const l = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-l-gross');
  const q = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-q-gross');
  assert.ok(l.strokes[0].at(-1).x > l.strokes[0].at(-2).x, 'l should finish with a small rightward curve');
  assert.ok(Math.abs(q.strokes[1][0].x - q.strokes[1].at(-1).x) < 0.001, 'q descender should be vertical');
});

test('N uses the normal downward-right diagonal with natural pen lifts', () => {
  const n = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-N-gross');
  assert.equal(n.strokes.length, 3, 'N should have two uprights and one diagonal');
  const [left, diagonal, right] = n.strokes;
  assert.ok(left[0].y < left.at(-1).y, 'left upright should travel downward');
  assert.ok(diagonal[0].x < diagonal.at(-1).x && diagonal[0].y < diagonal.at(-1).y, 'N diagonal should travel down to the right');
  assert.ok(right[0].y > right.at(-1).y, 'right upright should finish upward');
});

test('curriculum uses text and drawing data instead of emoji decorations', () => {
  const pictographic = /\p{Extended_Pictographic}/u;
  TASKS.forEach((task) => {
    assert.equal('decorations' in task, false, `${task.id} should not include decorations`);
    assert.equal(pictographic.test(`${task.label} ${task.title} ${task.speech}`), false, `${task.id} includes an emoji`);
  });
});

test('every category creates a 10-task session', () => {
  const cases = [
    { category: 'lines', difficulty: 'easy' },
    { category: 'shapes', difficulty: 'medium' },
    { category: 'numbers', difficulty: 'hard', option: 'all' },
    { category: 'letters', difficulty: 'medium', option: 'all' },
    { category: 'mixed', difficulty: 'hard' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 4) });
    assert.equal(session.length, SESSION_SIZE);
    assert.equal(session.at(-1).assist, 'easy');
    assert.ok(session.every((task) => task.strokes.length > 0));
  });
});

test('name rounds adapt to the name: each character comes first, then the whole name', () => {
  const session = buildSession({ category: 'name', difficulty: 'medium', name: 'Anna', rng: seededRandom(17) });
  assert.equal(session.length, 5);
  assert.deepEqual(session.slice(0, -1).map((task) => task.label), ['A', 'N', 'N', 'A']);
  assert.deepEqual(session.slice(0, -1).map((task) => task.layout), ['single-letter', 'single-letter', 'single-letter', 'single-letter']);
  assert.equal(session.at(-1).label, 'ANNA');
  assert.equal(session.at(-1).layout, 'whole-name');
  assert.equal(session.at(-1).assist, 'easy');
});

test('a playthrough samples 10 distinct exercises without repetition', () => {
  const session = buildSession({ category: 'letters', difficulty: 'hard', option: 'all', rng: seededRandom(42) });
  assert.equal(new Set(session.map((task) => task.id)).size, SESSION_SIZE);
});

test('rounds rotate through available symbols before repeating one', () => {
  const cases = [
    { category: 'numbers', difficulty: 'medium', option: 'all' },
    { category: 'letters', difficulty: 'hard', option: 'all' },
    { category: 'shapes', difficulty: 'medium' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(90 + index) });
    assert.equal(new Set(session.map((task) => task.value)).size, SESSION_SIZE, `${config.category} repeated before needed`);
  });
});

test('easy number and letter rounds show exactly one symbol per task', () => {
  const cases = [
    { category: 'numbers', option: 'all' },
    { category: 'numbers', option: '5' },
    { category: 'letters', option: 'all' },
    { category: 'letters', option: 'aä' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, difficulty: 'easy', rng: seededRandom(index + 70) });
    session.forEach((task) => {
      assert.equal([...task.label].length, 1, `${task.id} should show one symbol`);
      assert.equal(task.completionGroups.length, 1, `${task.id} should require one symbol`);
    });
  });
});

test('a non-line round does not begin with a forced line warm-up', () => {
  const cases = [
    { category: 'shapes', difficulty: 'easy' },
    { category: 'numbers', difficulty: 'medium', option: '257' },
    { category: 'letters', difficulty: 'hard', option: 'MARTIN' },
    { category: 'name', difficulty: 'easy', name: 'I' },
    { category: 'mixed', difficulty: 'medium' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 17) });
    assert.notEqual(session[0].category, 'lines', `${config.category} started with ${session[0].id}`);
  });
});

test('name normalization remains local and accepts German uppercase letters', () => {
  assert.equal(normalizeName('  käthe  '), 'KÄTHE');
  assert.equal(normalizeName('Zoë 7!'), 'ZOE');
  assert.equal(normalizeName('Anna-Lena'), 'ANNA-LENA');
});

test('word task composes supported letters into the board', () => {
  const word = createWordTask('Löwe');
  assert.ok(word);
  assert.equal(word.label, 'LÖWE');
  assert.ok(word.strokes.length >= 4);
  word.strokes.flat().forEach((point) => {
    assert.ok(point.x >= 0 && point.x <= 1);
    assert.ok(point.y >= 0 && point.y <= 1);
  });
});

test('name spacing keeps narrow I centred between its neighbours', () => {
  const word = createWordTask('MIM');
  const [leftGroup, iGroup, rightGroup] = word.completionGroups;
  const boundsFor = (group) => group.flatMap((index) => word.strokes[index]).reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
  }), { minX: Infinity, maxX: -Infinity });
  const left = boundsFor(leftGroup);
  const middle = boundsFor(iGroup);
  const right = boundsFor(rightGroup);
  const before = middle.minX - left.maxX;
  const after = right.minX - middle.maxX;
  assert.ok(before > 0 && after > 0, 'letters should not overlap');
  assert.ok(Math.abs(before - after) < 0.035, `uneven gaps around I: ${before} / ${after}`);
});

test('long names become shorter as a whole instead of squeezing tall letters into narrow slots', () => {
  const shortName = createWordTask('MIA');
  const longName = createWordTask('ELISABETH');
  const verticalSpan = (task) => {
    const points = task.strokes.flat();
    return Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
  };
  assert.equal(longName.label, 'ELISABETH', 'a full long name should not be clipped');
  assert.equal(longName.completionGroups.length, 9, 'every letter in a long name should remain required');
  assert.ok(verticalSpan(longName) < verticalSpan(shortName) * 0.5, 'long-name letters should be visibly shorter');
  assert.ok(verticalSpan(longName) > 0.2, 'long-name letters should remain easy to trace');
});

test('straight-edged shape guides preserve hard corners', () => {
  const cross = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-cross');
  const circle = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-circle');
  assert.deepEqual(cross.angularStrokes, [0, 1]);
  assert.deepEqual(circle.angularStrokes, []);
});

test('measured board space chooses fewer targets in portrait and a row in landscape', () => {
  const source = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-4-vierer');
  const portrait = adaptTaskToViewport({ ...source, slot: 0 }, { width: 390, height: 844 });
  const insetPortrait = adaptTaskToViewport({ ...source, slot: 0 }, { width: 362, height: 766 });
  const landscape = adaptTaskToViewport({ ...source, slot: 0 }, { width: 844, height: 390 });
  assert.equal(portrait.completionGroups.length, 2, 'phone portrait should not overwhelm with four targets');
  assert.equal(insetPortrait.completionGroups.length, 2, 'a padded 390px phone board should still allow two targets');
  assert.equal(landscape.completionGroups.length, 3, 'phone landscape may use a three-target row');

  const groupCenter = (task, group) => {
    const points = group.flatMap((index) => task.strokes[index]);
    return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  };
  const portraitCenters = portrait.completionGroups.map((group) => groupCenter(portrait, group));
  const landscapeCenters = landscape.completionGroups.map((group) => groupCenter(landscape, group));
  assert.ok(Math.abs(portraitCenters[0].x - portraitCenters[1].x) > 0.15, 'portrait targets should form a diagonal');
  assert.ok(Math.abs(portraitCenters[0].y - portraitCenters[1].y) > 0.2, 'portrait targets should use the board height');
  assert.ok(landscapeCenters[0].x < landscapeCenters[1].x && landscapeCenters[1].x < landscapeCenters[2].x, 'landscape targets should form a row');

  const word = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-word-FUCHS');
  const wideWord = adaptTaskToViewport(word, { width: 1250, height: 632 });
  assert.equal(wideWord.completionGroups.length, 5, 'a wide board should keep a short word intact');
});

test('phone name rounds keep the full name to landscape names of eight letters or fewer', () => {
  const portrait = buildSession({ category: 'name', difficulty: 'easy', name: 'ELISABETH', viewport: { width: 390, height: 844 } });
  const shortLandscape = buildSession({ category: 'name', difficulty: 'easy', name: 'MARTIN', viewport: { width: 844, height: 390 } });
  const longLandscape = buildSession({ category: 'name', difficulty: 'easy', name: 'ELISABETH', viewport: { width: 844, height: 390 } });
  assert.ok(!portrait.some((task) => task.layout === 'whole-name'));
  assert.ok(shortLandscape.some((task) => task.layout === 'whole-name'));
  assert.ok(!longLandscape.some((task) => task.layout === 'whole-name'));
});

test('restricted choices still form a repetition-free round', () => {
  const cases = [
    { category: 'numbers', difficulty: 'easy', option: '5' },
    { category: 'name', difficulty: 'easy', name: 'I' },
  ];
  cases.forEach((config, caseIndex) => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const session = buildSession({ ...config, rng: seededRandom(seed + caseIndex * 1000) });
      assert.equal(new Set(session.map((task) => task.id)).size, session.length);
      const expectedLength = config.category === 'name'
        ? normalizeName(config.name).replace(/[- ]/g, '').length + 1
        : SESSION_SIZE;
      assert.equal(session.length, expectedLength);
    }
  });
});
