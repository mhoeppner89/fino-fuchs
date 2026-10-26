import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, buildSession, seededRandom } from '../js/curriculum.js';
import {
  SUDOKU_CLUES, SUDOKU_SYMBOLS, SUDOKU_UNITS, countSudokuSolutions, createSudokuPuzzle,
  isSudokuComplete, sudokuCandidates, sudokuConflicts, sudokuHint, validateSudokuEntry,
} from '../js/sudoku.js';
import { recognizeSudokuInk, sudokuReferenceInk } from '../js/sudoku-recognition.js';

test('Sudoku enforces four different values in every row, column and 2×2 box', () => {
  assert.equal(SUDOKU_UNITS.length, 12);
  const values = Array(16).fill(0);
  values[0] = 1;
  assert.deepEqual(sudokuConflicts(values, 3, 1), [0]);
  assert.deepEqual(sudokuConflicts(values, 12, 1), [0]);
  assert.deepEqual(sudokuConflicts(values, 5, 1), [0]);
  assert.deepEqual(sudokuConflicts(values, 10, 1), []);
  assert.deepEqual(sudokuCandidates(values, 5), [2, 3, 4]);
  assert.equal(isSudokuComplete(values), false);
  values[5] = 1;
  assert.equal(countSudokuSolutions(values), 0);
  assert.equal(isSudokuComplete(Array(16).fill(1)), false);
  assert.equal(isSudokuComplete(Array(16).fill(0)), false);
});

test('all difficulties generate the exact clue count, one solution and a deduction-only path', () => {
  for (const difficulty of Object.keys(SUDOKU_CLUES)) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const puzzle = createSudokuPuzzle({ difficulty, rng: seededRandom(seed) });
      assert.equal(puzzle.givens.filter(Boolean).length, SUDOKU_CLUES[difficulty]);
      assert.equal(countSudokuSolutions(puzzle.givens), 1, `${difficulty} seed ${seed}`);
      assert.equal(isSudokuComplete(puzzle.solution), true);
      const values = [...puzzle.givens];
      while (!isSudokuComplete(values)) {
        const hint = sudokuHint(values);
        assert.ok(hint, `${difficulty} seed ${seed} requires guessing`);
        assert.equal(values[hint.index], 0);
        assert.equal(hint.value, puzzle.solution[hint.index]);
        values[hint.index] = hint.value;
      }
      assert.deepEqual(values, puzzle.solution);
    }
  }
});

test('Kidoku uniqueness is independently verified against every valid 4×4 completion', () => {
  // Deliberately do not use the production solver, candidate calculation or
  // unit definitions to build the reference set: a shared bug could otherwise
  // let an ambiguous puzzle pass both generation and its own solver test.
  const rows = [];
  for (const a of [1, 2, 3, 4]) for (const b of [1, 2, 3, 4]) {
    for (const c of [1, 2, 3, 4]) for (const d of [1, 2, 3, 4]) {
      if (new Set([a, b, c, d]).size === 4) rows.push([a, b, c, d]);
    }
  }
  const completions = [];
  const enumerate = (grid) => {
    if (grid.length === 16) { completions.push(grid); return; }
    for (const row of rows) {
      if (row.some((value, col) => grid.some((previous, index) => index % 4 === col && previous === value))) continue;
      if (grid.length % 8 === 4 && [0, 2].some((col) => new Set([
        ...grid.slice(grid.length - 4 + col, grid.length - 2 + col), ...row.slice(col, col + 2),
      ]).size !== 4)) continue;
      enumerate([...grid, ...row]);
    }
  };
  enumerate([]);
  assert.equal(completions.length, 288);
  assert.equal(countSudokuSolutions(Array(16).fill(0)), 2, 'the production checker must detect a second solution');

  for (const [modeIndex, mode] of Object.keys(SUDOKU_SYMBOLS).entries()) {
    for (const difficulty of Object.keys(SUDOKU_CLUES)) {
      for (let seed = 1; seed <= 100; seed += 1) {
        const puzzle = createSudokuPuzzle({ mode, difficulty, rng: seededRandom(seed + modeIndex * 1000) });
        const matching = completions.filter((grid) => puzzle.givens.every((given, index) => !given || given === grid[index]));
        assert.equal(matching.length, 1, `${mode} ${difficulty} seed ${seed} must have exactly one solution`);
        assert.deepEqual(matching[0], puzzle.solution);
      }
    }
  }
});

test('each symbol mode and difficulty produces ten fresh session puzzles', () => {
  for (const mode of Object.keys(SUDOKU_SYMBOLS)) {
    assert.equal(new Set(SUDOKU_SYMBOLS[mode].map((symbol) => symbol.label)).size, 4);
    for (const difficulty of Object.keys(SUDOKU_CLUES)) {
      const session = buildSession({ category: 'sudoku', option: mode, difficulty, rng: seededRandom(17) });
      assert.equal(session.length, 10);
      assert.equal(new Set(session.map((task) => task.game.givens.join(''))).size, 10);
      assert.ok(session.every((task) => task.game.mode === mode && task.game.clueCount === SUDOKU_CLUES[difficulty]));
      assert.deepEqual(adaptTaskToViewport(session[0], { width: 390, height: 844 }).game, session[0].game, 'responsive layout preserves the puzzle');
      assert.deepEqual(session, buildSession({ category: 'sudoku', option: mode, difficulty, rng: seededRandom(17) }));
    }
  }
});

test('fixed clues cannot be changed and Sudoku entries are checked after recognition', () => {
  const puzzle = createSudokuPuzzle({ difficulty: 'hard', rng: seededRandom(8) });
  const given = puzzle.givens.findIndex(Boolean), empty = puzzle.givens.indexOf(0);
  assert.equal(validateSudokuEntry(puzzle, puzzle.givens, given, puzzle.solution[given]).reason, 'given');
  assert.equal(validateSudokuEntry(puzzle, puzzle.givens, empty, puzzle.solution[empty]).accepted, true);
  assert.equal(validateSudokuEntry(puzzle, puzzle.givens, empty, 0).accepted, false);
  for (const wrong of [1, 2, 3, 4].filter((value) => value !== puzzle.solution[empty])) {
    assert.equal(validateSudokuEntry(puzzle, puzzle.givens, empty, wrong).accepted, false);
  }
  assert.deepEqual(puzzle.givens, [...puzzle.givens]);
});

test('handwriting identifies all twelve choices without using a cell solution', () => {
  for (const mode of Object.keys(SUDOKU_SYMBOLS)) {
    for (let value = 1; value <= 4; value += 1) {
      const ink = sudokuReferenceInk(mode, value);
      assert.equal(recognizeSudokuInk(ink, mode).value, value, `${mode} ${value}`);
      const moved = ink.map((stroke, index) => stroke.map((p, i) => ({
        x: 0.1 + p.x * 0.78 + Math.sin(i * 1.7 + index) * 0.004,
        y: 0.06 + p.y * 0.78 + Math.cos(i * 1.3 + index) * 0.004,
      })));
      assert.equal(recognizeSudokuInk(moved, mode).value, value, `${mode} ${value} child-like`);
    }
  }
});

test('unrecognizable scribbles and unfinished marks cannot fill Sudoku cells', () => {
  for (const mode of Object.keys(SUDOKU_SYMBOLS)) {
    assert.equal(recognizeSudokuInk([], mode).value, null);
    assert.equal(recognizeSudokuInk([[{ x: 0.5, y: 0.5 }]], mode).value, null);
    const scribble = [[{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.8 }, { x: 0.2, y: 0.3 }, { x: 0.8, y: 0.1 }, { x: 0.2, y: 0.9 }]];
    assert.equal(recognizeSudokuInk(scribble, mode).value, null);
  }
  assert.equal(recognizeSudokuInk(sudokuReferenceInk('letters', 1).slice(0, 1), 'letters').value, null, 'A still needs its crossbar');
  assert.equal(recognizeSudokuInk([[{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }]], 'numbers').value, 1, 'a plain handwritten 1 is accepted');
});
