import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recognizeSudokuInk } from '../js/sudoku-recognition.js';

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/kidoku-freehand.json', import.meta.url)));

function freehandInk(example, { angle = 0, scale = 1, width = 1, shear = 0, x = 150, y = 100, wobble = 0 } = {}) {
  const radians = angle * Math.PI / 180;
  return example.strokes.map((stroke, strokeIndex) => stroke.map(([xx, yy], index) => {
    const dx = (xx - 50) * 1.2 * width, dy = (yy - 50) * 1.2;
    const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
    return {
      x: (x + (rotatedX + shear * rotatedY) * scale + Math.sin(index * 1.4 + strokeIndex) * wobble) / 300,
      y: (y + rotatedY * scale + Math.cos(index * 1.7 + strokeIndex) * wobble) / 200,
    };
  }));
}

test('Kidoku recognises independently sketched handwriting and rejects out-of-set or unfinished drawings', () => {
  const failures = [];
  for (const example of cases) {
    const result = recognizeSudokuInk(freehandInk(example), example.mode);
    if (result.value !== example.value) failures.push(`${example.id}: ${JSON.stringify(result)}`);
  }
  assert.deepEqual(failures, []);
});

test('freehand answers tolerate position, size, slant, proportions and small hand wobble', () => {
  const failures = [];
  const variants = [
    { scale: 0.45, x: 72, y: 56 },
    { scale: 1.15, x: 195, y: 111 },
    { angle: 17 }, { angle: -17 },
    { shear: 0.28 }, { shear: -0.28 },
    { width: 0.7 }, { width: 1.3 }, { wobble: 1.6 },
  ];
  for (const example of cases.filter((item) => item.value !== null)) {
    for (const variant of variants) {
      const result = recognizeSudokuInk(freehandInk(example, variant), example.mode);
      if (result.value !== example.value) failures.push(`${example.id} ${JSON.stringify(variant)}: ${JSON.stringify(result)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('freehand recognition ignores pen direction, stroke order and harmless pen lifts', () => {
  const failures = [];
  for (const example of cases.filter((item) => item.value !== null)) {
    const reversed = freehandInk(example).reverse().map((stroke) => stroke.reverse());
    if (recognizeSudokuInk(reversed, example.mode).value !== example.value) failures.push(`${example.id} reversed`);
    const split = freehandInk(example).flatMap((stroke) => {
      const middle = Math.floor(stroke.length / 2);
      return [stroke.slice(0, middle + 1), stroke.slice(middle)];
    });
    if (recognizeSudokuInk(split, example.mode).value !== example.value) failures.push(`${example.id} split`);
  }
  assert.deepEqual(failures, []);
});

test('out-of-set handwriting stays rejected after a move or slant', () => {
  const failures = [];
  for (const example of cases.filter((item) => item.value === null)) {
    for (const variant of [{ scale: 0.6, x: 85, y: 65 }, { angle: 12 }, { shear: 0.2 }]) {
      const result = recognizeSudokuInk(freehandInk(example, variant), example.mode);
      if (result.value !== null) failures.push(`${example.id} ${JSON.stringify(variant)}: ${JSON.stringify(result)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('recognition is independent of how many pointer samples a segment receives', () => {
  for (const example of cases) {
    const ink = freehandInk(example).map((stroke) => stroke.flatMap((point, index) => {
      const next = stroke[index + 1];
      if (!next) return [point];
      // Simulate lingering on one section and moving quickly over another.
      const count = index % 3 === 0 ? 70 : 2;
      return Array.from({ length: count }, (_, sample) => ({
        x: point.x + (next.x - point.x) * sample / count,
        y: point.y + (next.y - point.y) * sample / count,
      }));
    }));
    assert.equal(recognizeSudokuInk(ink, example.mode).value, example.value, example.id);
  }
});
