import { CHARACTER_STROKES, CHARACTER_STROKE_GEOMETRY } from '../js/handwriting-stroke-data.js';

const reversals = [];
Object.entries(CHARACTER_STROKES).forEach(([character, strokes]) => {
  const found = [];
  strokes.forEach((stroke, strokeIndex) => {
    for (let index = 1; index < stroke.length - 1; index += 1) {
      const first = {
        x: (stroke[index].x - stroke[index - 1].x) * 900,
        y: (stroke[index].y - stroke[index - 1].y) * 620,
      };
      const second = {
        x: (stroke[index + 1].x - stroke[index].x) * 900,
        y: (stroke[index + 1].y - stroke[index].y) * 620,
      };
      const firstLength = Math.hypot(first.x, first.y);
      const secondLength = Math.hypot(second.x, second.y);
      if (firstLength <= 1 || secondLength <= 1) continue;
      const cosine = (first.x * second.x + first.y * second.y) / (firstLength * secondLength);
      if (cosine < -0.8) found.push({ stroke: strokeIndex, point: index, cosine, firstLength, secondLength });
    }
  });
  if (found.length) reversals.push({ character, found });
});

const errors = Object.entries(CHARACTER_STROKE_GEOMETRY)
  .filter(([, geometry]) => geometry.maximumRouteError > 8)
  .map(([character, geometry]) => ({ character, error: geometry.maximumRouteError }));

console.log(JSON.stringify({ reversals, errors }, null, 2));
if (reversals.length || errors.length) process.exitCode = 1;
