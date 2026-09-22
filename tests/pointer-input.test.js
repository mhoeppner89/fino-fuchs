import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingBoard, pointerSamples } from '../js/drawing.js';

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

test('pen-up records the final position even when there was no pointermove', () => {
  let ended = 0;
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    width: 390, height: 700, activePointerId: 1,
    activeStroke: [{ x: 0.25, y: 0.5 }],
    task: { category: 'letters' }, inkRevision: 0,
    pointFromEvent: (event) => ({ x: event.clientX / 390, y: event.clientY / 700 }),
    releasePointer() {}, startJumpToNextStroke() {}, render() {},
    hooks: { onStrokeEnd() { ended += 1; } },
  });
  board.userStrokes = [board.activeStroke];
  board.onPointerUp({ pointerId: 1, clientX: 292.5, clientY: 350, preventDefault() {} });
  assert.deepEqual(board.userStrokes[0], [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }]);
  assert.equal(ended, 1);
  assert.equal(board.activePointerId, null);
});

test('a stationary pen tap stays a real point instead of an invented horizontal line', () => {
  const dot = { x: 0.5, y: 0.5 };
  const board = Object.assign(Object.create(DrawingBoard.prototype), {
    width: 390, height: 700, activePointerId: 2,
    activeStroke: [dot], task: { category: 'letters' }, inkRevision: 0,
    pointFromEvent: () => ({ ...dot }),
    releasePointer() {}, startJumpToNextStroke() {}, render() {}, hooks: {},
  });
  board.userStrokes = [board.activeStroke];
  board.onPointerUp({ pointerId: 2, clientX: 195, clientY: 350, preventDefault() {} });
  assert.deepEqual(board.userStrokes[0], [dot]);
});
