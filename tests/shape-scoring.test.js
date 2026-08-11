import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTaskToViewport, EXERCISE_BANKS } from '../js/curriculum.js';
import { evaluateTaskDrawing, passesDrawingCriteria } from '../js/drawing.js';

const IDS = [
  'shape-circle', 'shape-oval', 'shape-square', 'shape-triangle', 'shape-diamond',
  'shape-heart', 'shape-star', 'shape-rectangle', 'shape-pentagon', 'shape-hexagon',
];
const VIEWPORT = { width: 390, height: 700 };
const tasks = IDS.map((id) => adaptTaskToViewport(EXERCISE_BANKS.shapes.find((task) => task.id === id), VIEWPORT));
const passes = (task, strokes) => passesDrawingCriteria(evaluateTaskDrawing(task, strokes, {
  ...VIEWPORT,
  tolerance: 50,
  completionTolerance: 50,
}), 'easy', { qualityAdjustment: 0.045 });

test('a different basic shape cannot complete the requested contour', () => {
  tasks.forEach((target) => {
    tasks.forEach((candidate) => {
      assert.equal(passes(target, candidate.strokes), target.id === candidate.id, `${candidate.id} passed as ${target.id}`);
    });
  });
});

test('basic shapes still accept a shifted, scaled, rotated, child-like trace', () => {
  tasks.forEach((task) => {
    const transformed = task.strokes.map((stroke, strokeIndex) => stroke.map((point, pointIndex) => {
      const x = (point.x - 0.5) * VIEWPORT.width;
      const y = (point.y - 0.5) * VIEWPORT.height;
      const angle = 4 * Math.PI / 180;
      return {
        x: 0.5 + ((x * Math.cos(angle) - y * Math.sin(angle)) * 1.04) / VIEWPORT.width + 0.012 + Math.sin(pointIndex * 1.7 + strokeIndex) * 0.003,
        y: 0.5 + ((x * Math.sin(angle) + y * Math.cos(angle)) * 1.04) / VIEWPORT.height - 0.008 + Math.cos(pointIndex * 1.3 + strokeIndex) * 0.003,
      };
    }));
    assert.equal(passes(task, transformed), true, `${task.id} rejected a kind variation`);
  });
});

test('circle and square templates are physically round and square', () => {
  const aspect = (task) => {
    const points = task.strokes.flat();
    return ((Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * VIEWPORT.width)
      / ((Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * VIEWPORT.height);
  };
  const circle = tasks.find((task) => task.id === 'shape-circle');
  const square = tasks.find((task) => task.id === 'shape-square');
  assert.ok(Math.abs(aspect(circle) - 1) < 0.015);
  assert.ok(Math.abs(aspect(square) - 1) < 0.015);
});
