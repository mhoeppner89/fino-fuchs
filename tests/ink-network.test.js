import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInkNetwork, rasterizeInk } from '../js/ink-network.js';

const metadata = JSON.parse(readFileSync(new URL('../assets/ink-models/models.json', import.meta.url)));
const bytes = readFileSync(new URL('../assets/ink-models/weights.bin', import.meta.url));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength);

test('bundled weights are intact and a truncated model cannot be used', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.weightsSha256);
  assert.throws(() => createInkNetwork(metadata, buffer.slice(0, -4)), /Invalid ink model weights/);
  assert.deepEqual(bytes, readFileSync(new URL('../testversion/assets/ink-models/weights.bin', import.meta.url)));
  assert.deepEqual(metadata, JSON.parse(readFileSync(new URL('../testversion/assets/ink-models/models.json', import.meta.url))));
});

test('JavaScript inference agrees with the PyTorch reference for every model', () => {
  const network = createInkNetwork(metadata, buffer);
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/ink-network-parity.json', import.meta.url)));
  for (const example of fixtures) {
    const input = Float32Array.from(Buffer.from(example.pixels, 'base64'), value => value/255);
    const predicted = network.predict(input, example.mode);
    for (const item of predicted) {
      const index = metadata.models[example.mode].labels.indexOf(item.label);
      assert.ok(Math.abs(item.score-example.probabilities[index]) < 2e-5, `${example.mode}: ${item.label}`);
    }
  }
});

test('ink images preserve proportions and ignore pad position, scale, colour and pen order', () => {
  const original = [[{x:.31,y:.28},{x:.63,y:.33},{x:.52,y:.79}]];
  const image = rasterizeInk(original);
  const changed = original.map(stroke => stroke.map(p => ({x:.11+p.x*.7,y:.06+p.y*.7})).reverse()).reverse();
  const other = rasterizeInk(changed);
  assert.ok(image.every((value, index) => Math.abs(value-other[index]) < 1e-6));
  assert.equal(rasterizeInk([]), null);
  assert.equal(rasterizeInk([[{x:.5,y:.5}]]), null);
  const wide = rasterizeInk([[{x:.2,y:.4},{x:.8,y:.4},{x:.8,y:.6},{x:.2,y:.6},{x:.2,y:.4}]]);
  const occupied = Array.from(wide, (value,index) => value ? index : -1).filter(index => index >= 0);
  const width = Math.max(...occupied.map(i => i%28))-Math.min(...occupied.map(i => i%28));
  const height = Math.max(...occupied.map(i => Math.floor(i/28)))-Math.min(...occupied.map(i => Math.floor(i/28)));
  assert.ok(width > height*2, 'a wide drawing is not stretched into a square');
});
