import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './load-ink-models.mjs';
import { recognizeSudokuInk } from '../js/sudoku-recognition.js';

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/ink-public-audit.json', import.meta.url)));

test('the offline hybrid improves on the previous recognizer on fixed public handwriting and drawing samples', () => {
  for (const mode of ['numbers','letters','symbols']) {
    const rows = cases.filter(row => row.mode === mode);
    const predicted = rows.map(row => recognizeSudokuInk(row.strokes.map(stroke => stroke.map(([x,y]) => ({x:(90+x*1.2)/300,y:(40+y*1.2)/200}))), mode).value);
    const metric = (answers) => {
      const positive = rows.map((row,i) => row.value ? i : -1).filter(i => i >= 0);
      const negative = rows.map((row,i) => row.value === null ? i : -1).filter(i => i >= 0);
      const recall = positive.filter(i => answers[i] === rows[i].value).length/positive.length;
      const specificity = negative.filter(i => answers[i] === null).length/negative.length;
      return { recall, specificity, balanced:(recall+specificity)/2 };
    };
    const old = metric(rows.map(row => row.previousValue));
    const current = metric(predicted);
    assert.ok(current.balanced >= old.balanced+.1, `${mode}: ${JSON.stringify({old,current})}`);
    assert.ok(current.specificity >= .85, `${mode}: unrelated marks remain rejected`);
    assert.ok(current.recall >= {numbers:.9,letters:.7,symbols:.8}[mode], `${mode}: valid drawings remain usable`);
  }
});
