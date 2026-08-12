import test from 'node:test';
import assert from 'node:assert/strict';
import { pointerSamples } from '../js/drawing.js';

test('Safari uses only the reliable dispatched pointer event', () => {
  const event = {
    clientX: 120,
    clientY: 80,
    timeStamp: 30,
    getCoalescedEvents: () => [
      { clientX: 0, clientY: 0, timeStamp: 20 },
      { clientX: 110, clientY: 78, timeStamp: 10 },
    ],
  };
  assert.deepEqual(pointerSamples(event, true), [event]);
});

test('other engines sort valid coalesced samples chronologically', () => {
  const first = { clientX: 10, clientY: 15, timeStamp: 10 };
  const second = { clientX: 20, clientY: 25, timeStamp: 20 };
  const event = {
    clientX: 30,
    clientY: 35,
    timeStamp: 30,
    getCoalescedEvents: () => [second, { clientX: Number.NaN, clientY: 0, timeStamp: 15 }, first],
  };
  assert.deepEqual(pointerSamples(event, false), [first, second]);
});
