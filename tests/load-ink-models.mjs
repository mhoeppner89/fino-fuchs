import { readFileSync } from 'node:fs';
import { loadSudokuRecognizer } from '../js/sudoku-recognition.js';

await loadSudokuRecognizer(async (url) => {
  const bytes = readFileSync(url);
  return { ok: true, json: async () => JSON.parse(bytes), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
});
