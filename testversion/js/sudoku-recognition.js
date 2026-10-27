/** Freehand recognition for Kidoku; no Sudoku solution is available here. */
import { EXERCISE_BANKS, adaptTaskToViewport } from './curriculum.js?v=1.3.54';
import { SUDOKU_SYMBOLS } from './sudoku.js?v=1.3.54';
import { createInkNetwork, rasterizeInk } from './ink-network.js?v=1.3.54';
import { matchInkTemplates } from './ink-templates.js?v=1.3.54';

export const SUDOKU_PAD = Object.freeze({ width: 300, height: 200 });
const VIEWPORT = { width: 900, height: 620 };
const references = new Map();
let network = null;
let loading = null;
let settings = null;

export async function loadSudokuRecognizer(loader = globalThis.fetch) {
  if (network) return true;
  if (loading) return loading;
  loading = (async () => {
    const [description, weights] = await Promise.all([
      loader(new URL('../assets/ink-models/models.json?v=1.3.54', import.meta.url)),
      loader(new URL('../assets/ink-models/weights.bin?v=1.3.54', import.meta.url)),
    ]);
    if (!description.ok || !weights.ok) throw new Error('Ink model files unavailable.');
    const metadata = await description.json();
    const buffer = await weights.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== metadata.weightsSha256) throw new Error('Ink model checksum mismatch.');
    }
    network = createInkNetwork(metadata, buffer);
    settings = metadata;
    return true;
  })();
  try { return await loading; }
  catch (error) { loading = null; throw error; }
}

export function sudokuRecognizerReady() { return Boolean(network); }

function bounds(strokes, viewport) {
  const points = strokes.flat();
  if (!points.length) return null;
  const xs = points.map((p) => p.x * viewport.width), ys = points.map((p) => p.y * viewport.height);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return { width: right-left, height: bottom-top, x: (left+right)/2, y: (top+bottom)/2 };
}

function referenceTask(mode, value) {
  const key = `${mode}-${value}`;
  if (references.has(key)) return references.get(key);
  const symbol = SUDOKU_SYMBOLS[mode]?.[value-1];
  if (!symbol) return null;
  const task = adaptTaskToViewport(EXERCISE_BANKS[symbol.category].find((task) => task.id === symbol.taskId), VIEWPORT);
  references.set(key, task);
  return task;
}

function segmentDistance(point, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy);
}

function completeOutline(strokes) {
  const box = bounds(strokes, SUDOKU_PAD);
  const span = Math.max(box.width, box.height);
  const paths = strokes.map((stroke) => stroke.map((p) => ({ x: p.x*300, y: p.y*200 })))
    .filter((stroke) => stroke.length > 1);
  return paths.length > 0 && paths.every((stroke, index) => {
    if (Math.hypot(stroke[0].x-stroke.at(-1).x, stroke[0].y-stroke.at(-1).y) <= span*.35) return true;
    const nearOther = (p) => paths.some((other, i) => i !== index && other.some((b, j) => j && segmentDistance(p, other[j-1], b) <= span*.18));
    return nearOther(stroke[0]) && nearOther(stroke.at(-1));
  });
}

function enclosedLoop(image, joiningSlack) {
  // One pixel of joining slack keeps small gaps from erasing a real loop.
  const mask = new Uint8Array(784), seen = new Uint8Array(784), stack = [];
  for (let y = 1; y < 27; y += 1) for (let x = 1; x < 27; x += 1) {
    if (image[y*28+x] < .3) continue;
    for (let dy = -joiningSlack; dy <= joiningSlack; dy += 1) for (let dx = -joiningSlack; dx <= joiningSlack; dx += 1) mask[(y+dy)*28+x+dx] = 1;
  }
  for (let i = 0; i < 28; i += 1) stack.push(i, 756+i, i*28, i*28+27);
  while (stack.length) {
    const p = stack.pop();
    if (p < 0 || p >= 784 || seen[p] || mask[p]) continue;
    seen[p] = 1;
    if (p % 28) stack.push(p-1);
    if (p % 28 < 27) stack.push(p+1);
    stack.push(p-28, p+28);
  }
  return mask.reduce((sum, ink, i) => sum+(!ink && !seen[i] ? 1 : 0), 0) >= 2;
}

function hasLoop(image) {
  return enclosedLoop(image, 0) || enclosedLoop(image, 1);
}

function hasLeftStem(strokes) {
  const box = bounds(strokes, SUDOKU_PAD);
  const left = box.x-box.width/2, top = box.y-box.height/2;
  let covered = 0;
  for (let bin = 0; bin < 10; bin += 1) {
    const y = top+box.height*(.1+.8*(bin+.5)/10);
    const hit = strokes.some((stroke) => stroke.some((p, i) => {
      if (!i) return false;
      const a = stroke[i-1], dy = (p.y-a.y)*200;
      if (Math.abs(dy) < .001) return false;
      const t = (y-a.y*200)/dy;
      return t >= 0 && t <= 1 && (a.x+(p.x-a.x)*t)*300 <= left+box.width*.45;
    }));
    if (hit) covered += 1;
  }
  return covered >= 7;
}

export function sudokuReferenceInk(mode, value) {
  const task = referenceTask(mode, value);
  if (!task) return [];
  const box = bounds(task.strokes, VIEWPORT);
  const scale = Math.min(SUDOKU_PAD.width * 0.7 / Math.max(1, box.width), SUDOKU_PAD.height * 0.74 / Math.max(1, box.height));
  return task.strokes.map((stroke) => stroke.map((point) => ({
    x: 0.5 + (point.x * VIEWPORT.width - box.x) * scale / SUDOKU_PAD.width,
    y: 0.5 + (point.y * VIEWPORT.height - box.y) * scale / SUDOKU_PAD.height,
  })));
}

export function recognizeSudokuInk(strokes, mode) {
  if (!network) return { value: null, reason: 'loading', matches: [] };
  if (!SUDOKU_SYMBOLS[mode]) return { value: null, reason: 'unrecognized', matches: [] };
  const image = rasterizeInk(strokes);
  if (!image) return { value: null, reason: 'empty', matches: [] };
  const template = matchInkTemplates(strokes, mode);
  const scores = network.predict(image, mode);
  const values = mode === 'numbers' ? ['1','2','3','4'] : mode === 'letters' ? ['A','B','C','D'] : ['circle','triangle','square','star'];
  const matches = scores.filter((item) => values.includes(item.label)).map((item) => ({ ...item, value: values.indexOf(item.label)+1 }));
  const best = scores[0];
  let value = values.indexOf(best.label)+1;
  const policy = settings.policies?.[mode] ?? { confidence: .5, margin: .05 };
  // Keep very clear Schulschrift and geometric forms, including the German
  // flagged 1, which are underrepresented in the public handwriting data.
  const strongTemplate = template.value && template.matches[0].score >= (policy.templateConfidence ?? .93);
  if (strongTemplate) value = template.value;
  if (strongTemplate) {
    return { value, matches, recognizer: 'public-data-cnn+template' };
  }
  if (!value) return { value: null, reason: 'out-of-set', alternative: best.label, matches };
  if (best.score < policy.confidence || best.score-scores[1].score < policy.margin) return { value: null, reason: 'ambiguous', matches };
  if (template.reason === 'out-of-set' && best.score < (policy.disagreementConfidence ?? .7)) return { value: null, reason: 'ambiguous', matches };
  // Recognition alone can label an unfinished outline. Require its ends to
  // meet, allowing ordinary small gaps, separate sides and pen lifts.
  if (mode === 'symbols' && !completeOutline(strokes)) return { value: null, reason: 'incomplete', matches };
  if (mode === 'letters' && [2,4].includes(value) && !completeOutline(strokes) && !hasLeftStem(strokes)) return { value: null, reason: 'incomplete', matches };
  if (mode === 'letters' && value === 1 && template.alternative === 'letter-A-gross' && !hasLoop(image)) return { value: null, reason: 'incomplete', matches };
  return { value, matches, recognizer: 'public-data-cnn' };
}
