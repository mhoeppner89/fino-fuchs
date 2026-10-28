/** Small, uniquely solvable 4×4 Sudokus. Values are always 1–4 internally. */
export const SUDOKU_CLUES = Object.freeze({ easy: 12, medium: 9, hard: 6 });
export const SUDOKU_SYMBOLS = Object.freeze({
  numbers: Object.freeze(['1', '2', '3', '4'].map((label) => Object.freeze({ label, name: label, category: 'numbers', taskId: `number-${label}-gross` }))),
  letters: Object.freeze(['A', 'B', 'C', 'D'].map((label) => Object.freeze({ label, name: label, category: 'letters', taskId: `letter-${label}-gross` }))),
  symbols: Object.freeze([
    { label: '○', name: 'Kreis', category: 'shapes', taskId: 'shape-circle' },
    { label: '△', name: 'Dreieck', category: 'shapes', taskId: 'shape-triangle' },
    { label: '□', name: 'Quadrat', category: 'shapes', taskId: 'shape-square' },
    { label: '☆', name: 'Stern', category: 'shapes', taskId: 'shape-star' },
  ].map(Object.freeze)),
});

export const SUDOKU_UNITS = Object.freeze([
  ...Array.from({ length: 4 }, (_, row) => ({ kind: 'row', cells: Array.from({ length: 4 }, (_, col) => row * 4 + col) })),
  ...Array.from({ length: 4 }, (_, col) => ({ kind: 'column', cells: Array.from({ length: 4 }, (_, row) => row * 4 + col) })),
  ...Array.from({ length: 4 }, (_, box) => ({ kind: 'box', cells: Array.from({ length: 4 }, (_, cell) => (
    Math.floor(box / 2) * 8 + (box % 2) * 2 + Math.floor(cell / 2) * 4 + cell % 2
  )) })),
].map((unit) => Object.freeze({ ...unit, cells: Object.freeze(unit.cells) })));
const PEERS = Array.from({ length: 16 }, (_, index) => [...new Set(SUDOKU_UNITS
  .filter((unit) => unit.cells.includes(index)).flatMap((unit) => unit.cells))].filter((other) => other !== index));
const VALID_VALUE = (value) => Number.isInteger(value) && value >= 1 && value <= 4;

export function sudokuConflicts(values, index, value) {
  return VALID_VALUE(value) && PEERS[index]
    ? PEERS[index].filter((peer) => values[peer] === value)
    : [];
}

function validGrid(values) {
  return Array.isArray(values) && values.length === 16 && values.every((value, index) => (
    value === 0 || (VALID_VALUE(value) && sudokuConflicts(values, index, value).length === 0)
  ));
}

export function sudokuCandidates(values, index) {
  if (!PEERS[index]) return [];
  return [1, 2, 3, 4].filter((value) => !sudokuConflicts(values, index, value).length);
}

function search(values, limit) {
  let count = 0;
  let solution = null;
  const visit = () => {
    let index = -1;
    let choices = null;
    for (let cell = 0; cell < 16; cell += 1) {
      if (values[cell]) continue;
      const candidates = sudokuCandidates(values, cell);
      if (!candidates.length) return;
      if (!choices || candidates.length < choices.length) {
        index = cell;
        choices = candidates;
      }
    }
    if (index === -1) {
      count += 1;
      solution ??= [...values];
      return;
    }
    for (const value of choices) {
      values[index] = value;
      visit();
      values[index] = 0;
      if (count >= limit) return;
    }
  };
  visit();
  return { count, solution };
}

export function countSudokuSolutions(values, limit = 2) {
  return validGrid(values) ? search([...values], Math.max(1, limit)).count : 0;
}

export function isSudokuComplete(values) {
  return validGrid(values) && values.every(VALID_VALUE);
}

/** A visible group with three entries; never computes or returns its answer. */
export function sudokuHintUnit(values, preferredIndex = -1) {
  if (!validGrid(values)) return null;
  const units = SUDOKU_UNITS.filter((unit) => unit.cells.filter((index) => values[index]).length === 3);
  return units.find((unit) => unit.cells.includes(preferredIndex)) ?? units[0] ?? null;
}

/** A naked or hidden single, including the row/column/box that explains it. */
export function sudokuHint(values) {
  if (!validGrid(values)) return null;
  const candidates = values.map((value, index) => value ? [] : sudokuCandidates(values, index));
  for (const unit of SUDOKU_UNITS) {
    const empty = unit.cells.filter((index) => !values[index]);
    if (empty.length === 1 && candidates[empty[0]].length === 1) {
      return { index: empty[0], value: candidates[empty[0]][0], unit };
    }
  }
  const single = candidates.findIndex((choices) => choices.length === 1);
  if (single >= 0) return { index: single, value: candidates[single][0], unit: null };
  for (const unit of SUDOKU_UNITS) {
    for (const value of [1, 2, 3, 4]) {
      const possible = unit.cells.filter((index) => !values[index] && candidates[index].includes(value));
      if (possible.length === 1) return { index: possible[0], value, unit };
    }
  }
  return null;
}

export function sudokuSolvesWithSingles(givens) {
  const values = [...givens];
  for (let step = 0; step < 16; step += 1) {
    if (isSudokuComplete(values)) return true;
    const hint = sudokuHint(values);
    if (!hint) return false;
    values[hint.index] = hint.value;
  }
  return isSudokuComplete(values);
}

function shuffled(values, rng) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function completeGrid(rng) {
  const symbols = shuffled([1, 2, 3, 4], rng);
  const rows = shuffled([0, 1], rng).flatMap((band) => shuffled([band * 2, band * 2 + 1], rng));
  const cols = shuffled([0, 1], rng).flatMap((stack) => shuffled([stack * 2, stack * 2 + 1], rng));
  const transpose = rng() < 0.5;
  return rows.flatMap((row) => cols.map((col) => {
    const r = transpose ? col : row;
    const c = transpose ? row : col;
    return symbols[(r * 2 + Math.floor(r / 2) + c) % 4];
  }));
}

export function createSudokuPuzzle({ difficulty = 'easy', mode = 'numbers', rng = Math.random } = {}) {
  if (!(difficulty in SUDOKU_CLUES) || !(mode in SUDOKU_SYMBOLS)) throw new Error('Unknown Sudoku difficulty or symbol set.');
  const solution = completeGrid(rng);
  const target = SUDOKU_CLUES[difficulty];
  // Backtracking over clue removals guarantees the requested clue count;
  // every removal preserves uniqueness and a deduction-only solution.
  const order = shuffled(Array.from({ length: 16 }, (_, index) => index), rng);
  const givens = [...solution];
  const remove = (start, remaining) => {
    if (!remaining) return true;
    if (order.length - start < remaining) return false;
    for (let position = start; position <= order.length - remaining; position += 1) {
      const index = order[position];
      const previous = givens[index];
      givens[index] = 0;
      if (countSudokuSolutions(givens) === 1 && sudokuSolvesWithSingles(givens) && remove(position + 1, remaining - 1)) return true;
      givens[index] = previous;
    }
    return false;
  };
  if (!remove(0, 16 - target)) throw new Error('Unable to generate a Sudoku.');
  return Object.freeze({
    size: 4,
    boxSize: 2,
    mode,
    difficulty,
    clueCount: target,
    givens: Object.freeze(givens),
    solution: Object.freeze(solution),
  });
}

export function validateSudokuEntry(puzzle, values, index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= 16 || !VALID_VALUE(value)) return { accepted: false, reason: 'invalid', conflicts: [] };
  if (puzzle.givens[index]) return { accepted: false, reason: 'given', conflicts: [] };
  const conflicts = sudokuConflicts(values, index, value);
  if (conflicts.length) return { accepted: false, reason: 'duplicate', conflicts };
  return value === puzzle.solution[index]
    ? { accepted: true, conflicts: [] }
    : { accepted: false, reason: 'incorrect', conflicts: [] };
}
