import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNameExerciseBank,
  TASKS,
  buildSession,
  createWordTask,
  EXERCISE_BANKS,
  getExerciseBank,
  normalizeName,
  SESSION_SIZE,
  seededRandom,
} from '../js/curriculum.js';

const geometryKey = (task) => JSON.stringify(task.strokes.map((stroke) => stroke.map((point) => [
  Number(point.x.toFixed(5)), Number(point.y.toFixed(5)),
])));

test('every activity has a 100-exercise bank with unique IDs and paths', () => {
  const banks = { ...EXERCISE_BANKS, name: createNameExerciseBank('Käthe') };
  Object.entries(banks).forEach(([category, bank]) => {
    assert.equal(bank.length, 100, `${category} bank size`);
    assert.equal(new Set(bank.map((task) => task.id)).size, 100, `${category} IDs`);
    assert.equal(new Set(bank.map(geometryKey)).size, 100, `${category} paths`);
  });
  assert.equal(TASKS.length, 500);
});

test('custom number and letter sets retain enough unique exercises for a full round', () => {
  const numbers = getExerciseBank('numbers', { option: '257' });
  const letters = getExerciseBank('letters', { option: 'MARTIN' });
  assert.equal(numbers.length, SESSION_SIZE);
  assert.equal(letters.length, SESSION_SIZE);
  assert.ok(numbers.every((task) => /^[257 ]+$/.test(task.label)));
  assert.ok(letters.every((task) => /^[MARTIN ]+$/.test(task.label)));
});

test('curriculum uses text and drawing data instead of emoji decorations', () => {
  const pictographic = /\p{Extended_Pictographic}/u;
  TASKS.forEach((task) => {
    assert.equal('decorations' in task, false, `${task.id} should not include decorations`);
    assert.equal(pictographic.test(`${task.label} ${task.title} ${task.speech}`), false, `${task.id} includes an emoji`);
  });
});

test('every category creates a 20-task session', () => {
  const cases = [
    { category: 'lines', difficulty: 'easy' },
    { category: 'shapes', difficulty: 'medium' },
    { category: 'numbers', difficulty: 'hard', option: 'all' },
    { category: 'letters', difficulty: 'medium', option: 'all' },
    { category: 'name', difficulty: 'easy', name: 'Martin' },
    { category: 'mixed', difficulty: 'hard' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 4) });
    assert.equal(session.length, SESSION_SIZE);
    assert.equal(session.at(-1).assist, 'easy');
    assert.ok(session.every((task) => task.strokes.length > 0));
  });
});

test('a playthrough samples 20 distinct exercises without repetition', () => {
  const session = buildSession({ category: 'letters', difficulty: 'hard', option: 'all', rng: seededRandom(42) });
  assert.equal(new Set(session.map((task) => task.id)).size, SESSION_SIZE);
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

test('restricted choices still form a repetition-free round', () => {
  const cases = [
    { category: 'numbers', difficulty: 'easy', option: '5' },
    { category: 'name', difficulty: 'easy', name: 'I' },
  ];
  cases.forEach((config, caseIndex) => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const session = buildSession({ ...config, rng: seededRandom(seed + caseIndex * 1000) });
      assert.equal(new Set(session.map((task) => task.id)).size, SESSION_SIZE);
    }
  });
});
