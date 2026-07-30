import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TASKS,
  buildSession,
  createWordTask,
  normalizeName,
  seededRandom,
} from '../js/curriculum.js';

test('curriculum contains all planned core templates', () => {
  assert.equal(TASKS.length, 56);
  assert.equal(TASKS.filter((task) => task.category === 'letters').length, 29);
  assert.equal(TASKS.filter((task) => task.category === 'numbers').length, 10);
});

test('curriculum uses text and drawing data instead of emoji decorations', () => {
  const pictographic = /\p{Extended_Pictographic}/u;
  TASKS.forEach((task) => {
    assert.equal('decorations' in task, false, `${task.id} should not include decorations`);
    assert.equal(pictographic.test(`${task.label} ${task.title} ${task.speech}`), false, `${task.id} includes an emoji`);
  });
});

test('every category creates a seven-task session', () => {
  const cases = [
    { category: 'lines', difficulty: 'easy' },
    { category: 'shapes', difficulty: 'medium' },
    { category: 'numbers', difficulty: 'hard', option: '0-9' },
    { category: 'letters', difficulty: 'medium', option: 'all' },
    { category: 'name', difficulty: 'easy', name: 'Martin' },
    { category: 'mixed', difficulty: 'hard' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 4) });
    assert.equal(session.length, 7);
    assert.equal(session.at(-1).assist, 'easy');
    assert.ok(session.every((task) => task.strokes.length > 0));
  });
});

test('controlled randomization avoids immediate repetition and caps repeats', () => {
  const session = buildSession({ category: 'letters', difficulty: 'hard', option: 'all', rng: seededRandom(42) });
  for (let index = 1; index < session.length; index += 1) {
    assert.notEqual(session[index].id, session[index - 1].id);
  }
  const counts = new Map();
  session.forEach((task) => counts.set(task.id, (counts.get(task.id) ?? 0) + 1));
  assert.ok([...counts.values()].every((count) => count <= 2));
});

test('a non-line round does not begin with a forced line warm-up', () => {
  const cases = [
    { category: 'shapes', difficulty: 'easy' },
    { category: 'numbers', difficulty: 'medium', option: '1-3' },
    { category: 'letters', difficulty: 'hard', option: 'straight' },
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

test('small selections are interleaved instead of repeating immediately', () => {
  const cases = [
    { category: 'numbers', difficulty: 'easy', option: '1-3' },
    { category: 'name', difficulty: 'easy', name: 'I' },
  ];
  cases.forEach((config, caseIndex) => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const session = buildSession({ ...config, rng: seededRandom(seed + caseIndex * 1000) });
      for (let index = 1; index < session.length; index += 1) {
        assert.notEqual(session[index].id, session[index - 1].id);
      }
    }
  });
});
