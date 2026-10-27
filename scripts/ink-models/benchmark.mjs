import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInkNetwork, rasterizeInk } from '../../js/ink-network.js';
import { recognizeSudokuInk as legacy } from './legacy-recognizer.js';
import { loadSudokuRecognizer, recognizeSudokuInk } from '../../js/sudoku-recognition.js';

await loadSudokuRecognizer(async (url) => {
  const bytes = readFileSync(url);
  return { ok: true, json: async () => JSON.parse(bytes), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
});

const folder = process.env.FINO_INK_DATA ?? '/tmp/fino-ink-data';
const metadata = JSON.parse(readFileSync('assets/ink-models/models.json'));
const bytes = readFileSync('assets/ink-models/weights.bin');
const network = createInkNetwork(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const final = process.argv.includes('--final');
const source = process.argv.includes('--challenge-only') ? [] : JSON.parse(readFileSync(`${folder}/benchmark${final ? '-final' : ''}.json`));
const rows = [];
for (const example of source) {
  const points = example.strokes.flat();
  if (!points.length) continue;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const scale = 120 / Math.max(1, right-left, bottom-top);
  const ink = example.strokes.map(stroke => stroke.map(([x, y]) => ({x: (150+(x-(left+right)/2)*scale)/300, y: (100+(y-(top+bottom)/2)*scale)/200})));
  const start = performance.now();
  const old = legacy(ink, example.mode);
  const baselineMs = performance.now()-start;
  const image = rasterizeInk(ink);
  const then = performance.now();
  const scores = network.predict(image, example.mode);
  const modelMs = performance.now()-then;
  const hybridStart = performance.now();
  const decision = recognizeSudokuInk(ink, example.mode);
  const hybridMs = performance.now()-hybridStart;
  rows.push({...example, strokes: undefined, old: old.value, cnn: decision.value, reason: decision.reason, scores: scores.slice(0, 2), baselineMs, modelMs, hybridMs});
}
if (rows.length) writeFileSync(`${folder}/benchmark${final ? '-final' : ''}-scores.json`, JSON.stringify(rows));
console.log('Scored', rows.length, 'public-data examples');

const fixtures = JSON.parse(readFileSync('tests/fixtures/kidoku-freehand.json')).cases;
const challenges = fixtures.map(example => {
  const ink = example.strokes.map(stroke => stroke.map(([x,y]) => ({x:(90+x*1.2)/300,y:(40+y*1.2)/200})));
  return { id: example.id, mode: example.mode, value: example.value, old: legacy(ink, example.mode).value,
    cnn: recognizeSudokuInk(ink, example.mode).value, scores: network.predict(rasterizeInk(ink), example.mode).slice(0,2) };
});
writeFileSync(`${folder}/challenge-scores.json`, JSON.stringify(challenges,null,2));
console.log('Scored',challenges.length,'hand-authored regression examples');
