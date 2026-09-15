import { StrokeProgress } from '../js/stroke-validation.js';

/**
 * Test oracle for recognition. Drives the live sequential stroke validator
 * (`StrokeProgress`) exactly like the app does at pen-up: every stroke is
 * submitted in pen order (including matchJoined multi-route pen movements),
 * and the verdict is the same gate the app's `checkDrawing` uses —
 * `snapshot().allRequired && snapshot().recognizable`.
 *
 * `strict` mirrors the "Schulschrift genau üben" checkbox (default on): with
 * it, strokes must follow the taught order and direction. Set `strict: false`
 * to exercise the checkbox-off behaviour where any order and reverse
 * traversal are allowed.
 */
export function taskOutcome(sourceTask, userStrokes, {
  width = 900,
  height = 620,
  assist = 'easy',
  strict = true,
} = {}) {
  const progress = new StrokeProgress(sourceTask, { width, height, assist, strict });
  const attempts = userStrokes.map((stroke) => progress.submit(stroke));
  const snapshot = progress.snapshot();
  return {
    progress,
    attempts,
    snapshot,
    passes: snapshot.allRequired && snapshot.recognizable,
  };
}

export function passes(sourceTask, userStrokes, options = {}) {
  return taskOutcome(sourceTask, userStrokes, options).passes;
}
