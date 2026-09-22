# Stroke acceptance audit

## Current runtime status (v1.3.43)

The live child-facing evaluator is back on the earlier symmetric closest-line
MSE implementation in `js/drawing.js`. The later sequential `StrokeProgress`
experiment and its main-menu strictness switch were removed after they caused
false rejections on ordinary beginner handwriting. The calibration recorder is
still available separately at `calibration.html` and does not change the child
runtime.

### Corrections to the restored MSE approach

- **Display scale:** scoring now uses a fixed comparison board whose shorter
  side is 390 units, preserving the previous phone-scale tolerance. Both axes
  scale uniformly. The previous 36-pixel identity cap rejected the reconstructed
  A and R at screenshot size while accepting exactly the same paths smaller.
  Sampling, tolerance, dot sizes and contour checks now share this coordinate
  system. Rendering and the fixed template are untouched.
- **Stroke length:** each sample represents half the arc length on either side
  of it. MSE is `sum(weight * (distance / tolerance)^2) / sum(weight)` in each
  direction. Coverage and the recognition fit use the same weights. Extra
  pointer events and short pen fragments no longer inflate their contribution.
  Short required parts still have their individual presence check; dots retain
  a finite weight. This is not an additional stroke-length rejection threshold.
- **Sampling:** keep stroke endpoints, preserve represented ink length when
  reducing the recognition samples, and retain later strokes when the endpoint
  count exceeds the normal sample budget. Hard-level reverse coverage moves
  from 87% to 88% to preserve the existing a/u separation with length weighting.
- **Dots:** accept true stationary taps and small marks; require distinct
  compact marks for separate umlaut dots. Repeated taps at one location or a
  connecting bar cannot supply both dots. Placement remains generous.
- **Input:** retain the actual pointer-up endpoint; no synthetic horizontal
  segment is added to a stationary tap.

Developer `evaluationSnapshot()` includes MSE in both directions, coverage,
precision and the existing recognition diagnostics. Tolerance diagnostics use
comparison-board units; reported ink lengths remain in actual board pixels.
The A/R fixtures are approximate screenshot reconstructions, not original pen
recordings. These fixes do not replace calibration against labeled handwriting.

The sections below document the superseded sequential experiment for history;
their acceptance rules are not active in the current app.

Original audit: **v1.3.36**, **14 September 2026**.

## Correction in v1.3.40: joined parts and R guide

The user explicitly changed the pen-lift policy after supplying an R whose
bowl and diagonal were one continuous stroke. Consecutive connected teaching
parts may now be joined even with strict mode on. The evaluator partitions
that pen movement, applies the existing rules to every part, and commits the
whole match together. Failed combined attempts leave the ledger unchanged.
Undo removes the physical stroke and all steps it completed. Dots still need
separate marks, and a joined movement cannot advance into a different character.

A separate R guide defect was also reproduced: its diagonal's extraction hint
began inside the bowl, contrary to the written guide's stem-midpoint start.
The generator hint and only R's generated routes were corrected. The first
point of the diagonal now equals the bowl's final point.

**Verification:** 156 tests and 34 browser scenarios passed, including joined
Undo/resize and the earlier A examples. The R browser screenshot was inspected.

`tests/fixtures/handwritten-r.json` reconstructs the supplied screenshot and
covers both joined and separate input. The screenshot does not provide original
pointer events. This section supersedes earlier statements requiring a pen lift
between every teaching part; partial strokes still cannot accumulate over lifts.

## Correction in v1.3.39: handwritten examples, closest-line MSE

The user's two A examples exposed a real false rejection in v1.3.38.
An approximate centerline reconstruction of the first screenshot passed the
stroke distance score but failed the check against future junctions. Its
horizontal crossbar was only 62% of the template route length, which includes
small diagonal extensions at the ends; the 72% easy minimum rejected it.
Neither failure was an appropriate easy-level requirement.

- Restored **symmetric closest-line MSE** as the primary per-stroke geometry
  score. The v1.3.36–38 implementation instead paired points at equal fractions
  of path length, which penalized harmless changes in where bends occurred.
- Removed all checks against imaginary future strokes. Existing endpoint joins
  are checked against the child's actual lines with level-dependent room.
- The template and guide stay fixed. No first-stroke fitting or target movement.
- Easy/medium/hard distance bands are 13%/9%/5.5% of symbol size. Short strokes
  have a separate cap; dots retain their own larger placement allowance.
- Length limits are broad guardrails (easy 50–240%, medium 60–200%, hard
  70–165%). Endpoint reach, coverage in both directions, and a loose monotone
  path comparison still reject halves and missing major parts. That comparison
  can move bends along the route; it does not require equal path positions.
- Strict order and direction remain optional and independent of MSE. Simple
  closed shapes retain corner, notch, and proportion checks.
- Diagnostic snapshots now include the last normalized MSE, length ratio,
  traversal error, and rejection reason.

**Verification:** all 152 tests and 28 Chromium/WebKit browser scenarios passed.
Both screenshot reconstructions succeed on easy, including additional nonlinear
wobble of 5% of symbol size. Tests cover three render scales and uneven curves
for all 69 letters/numbers. All 7,950 exact wrong-target comparisons still reject
complete substitutions. Screenshots of the browser replay were visually checked.

Fixtures in `tests/fixtures/handwritten-a*.json` are approximate reconstructions
from the supplied screenshots, not recordings of the original pointer events.
The user's first-stroke direction and continuity were explicitly confirmed.
The developer review remains 69 letters/numbers only; the runtime snapshot is
refreshed in `testversion/`.

The earlier correction and original audit below are historical; their evaluator
rules and tolerance values are superseded by this section.

## Correction in v1.3.37

The first-stroke fit was a mistaken interpretation of placement tolerance.
It has been removed from both scoring and rendering: the template and Fino
remain fixed throughout the exercise. All strokes use the original coordinates.

The original thresholds were too conservative to justify as child-friendly.
The distance bands are now 8.5%, 6%, and 4% of symbol size; junction/closure
allowances are 7.5%, 5%, and 3.5%. Length limits are 72–180%, 78–160%,
and 84–145%; full-path and endpoint checks still reject partial strokes.
Short-stroke caps increased from 12% to 20% of route length. Dot placement
allowances are 12%, 10%, and 8%, still limited by nearby marks.
These are provisional engineering settings, not calibration against children.

Correction verification: all **149 tests** and **20 browser scenarios** passed,
including 7,950 wrong-target comparisons, fixed-guide assertions, and small
junction gaps. The displaced-stroke browser screenshot was visually inspected.

The remainder documents the original v1.3.36 audit; its moving-template policy
and original tolerance values are superseded by this correction.

The previous implementation did not enforce the agreed teaching rules. It
estimated progress from all visible ink and allowed changes in stroke order,
direction, and pen lifts. The live drawing board now records each pen movement
as accepted or rejected and advances only from accepted strokes.

## Agreed behavior

- Audience: children aged 5–8 using a pen.
- One continuous teaching stroke is one step. Lifting partway through requires
  a complete retry; two incomplete attempts cannot be combined.
- **Schulschrift genau üben** defaults to on. It enforces stroke order, starts,
  and direction for letters, numbers, and names. Off permits any unfinished
  stroke, in either direction, within the current character.
- Shapes permit a different order of their parts. Closed outlines may start
  anywhere and run in either direction. Each complete outline remains one step.
- The selected difficulty stays fixed for every exercise, including the last
  exercise and a complete name. Retries never lower the acceptance threshold.
- Rejected strokes stay visually unchanged and are immediately excluded from
  progress, alignment, and recognition. Undo removes the latest visible attempt;
  removing an accepted attempt reopens its step.
- A modest common shift, resize, or turn is allowed. Fino and the template move
  together to reflect the accepted placement. The whole target must fit on the
  canvas, and adjacent characters retain separate writing regions.

## Findings and repairs

| Finding | Consequence before the change | Implemented repair |
| --- | --- | --- |
| Per-stroke acceptance used coverage **or** precision against any route | A short correct fragment or a stroke crossing much of a route could count as progress | Complete-route comparison, endpoints, traversal, length, and closure are checked together |
| The next guide was inferred from raw ink coverage | Unaccepted or out-of-order ink could move guidance forward | Explicit accepted route indices drive Fino and stage progression |
| Rejected ink was removed only after a matching redraw | Failed attempts could obstruct later recognition, and then disappeared automatically | Visible history and accepted geometry are separate; only Undo removes the visible attempt |
| Selected difficulty mixed assistance levels within a round | A hard round could use easy scoring, including its final task | Every task uses the selected level |
| Repeated attempts enabled a looser success check | An unchanged near miss could eventually succeed | Removed the retry-based relaxation from live acceptance |
| Stroke and final checks used different dot rules | A dot could fail before reaching the more generous final check | One shared dot policy with separate mark assignment and separation checks |
| Individual shape checks did not secure connections before progression | An accepted part could leave a poor attachment point for the next stroke | Check existing **and future** junctions, then the combined silhouette, before accepting a stroke |
| Distance alone can confuse a polygon with a circle | Generous matching accepted some pentagon/hexagon outlines as circles | Structural corner counts distinguish simple closed shapes after removing small hand wobble |
| The pen-up endpoint was not recorded directly | Short movements ending between move events could be evaluated incompletely | Include the final pointer position and support genuine stationary taps |

The historical validator was in `js/stroke-validation.js`. The sequential
board and UI experiment touched `js/drawing.js`, `js/app.js`, `index.html`, and
`js/curriculum.js`. Those rules are retained here only as audit history; the
old whole-image geometry evaluator now grants live exercise completion again.

## Tolerance and whole-result checks

The main distance allowance is relative to the symbol's larger dimension:
5% on Leicht, 3.6% on Mittel, and 2.4% on Knifflig. Short strokes also have a
length-based cap. Comparison samples are evenly spaced along the path, so
writing speed and pointer-event frequency do not determine the score.

Dots have a separate placement allowance of up to 10%, 8.5%, or 7% of symbol
size. Nearby required marks reduce that allowance. Each dot needs its own
attempt; a second tap in the same place cannot satisfy both umlaut dots.
Oversized marks and long strokes cannot substitute for dots.

A shared fit allows approximately 78–125% scale and up to 12 degrees of rotation.
Translation is bounded by symbol size, neighboring characters, and the canvas.
These are placement freedoms; each level still applies its own precision rules.
Later strokes use the same coordinate system instead of independently moving
into the right place during scoring.

Before committing a stroke, the validator checks its full route, relevant
attachment points, and the silhouette formed with the accepted strokes. This
includes attachment points needed by future strokes. Completion requires every
route and a successful combined-shape check for every character or picture.
There is no end-of-character rejection after all strokes have been committed.

## Verification

- Baseline: all **132** previous tests passed despite the mismatch with the new
  teaching rules. They primarily tested finished geometry rather than sequential
  acceptance.
- Updated suite: **149 tests passed**, including all 69 shipped letters/numbers
  and 36 shapes on three levels and three screen sizes: **945 exact drawings**
  and **945 coherently shifted, scaled, and rotated drawings**.
- New regressions cover wrong order and direction, incomplete strokes, repeated
  failures, stationary dots, duplicate dots, existing/future joins, later-character
  gating, consistent tolerance across sizes, and stricter precision by level.
- **7,950** wrong-target comparisons across uppercase, lowercase, digits, and shapes
  did not accept every stroke of one complete symbol as another. A valid
  prefix, such as O before the tail of Q, completes at O; the live board then
  locks input. This follows the decision to exclude rejected and later ink.
- **20 browser scenarios passed** across Chromium and WebKit: menu defaults,
  both settings, three levels, retries, Undo, resize, dots, shapes, guide placement,
  and clean browser consoles. Screenshots were inspected at phone and tablet sizes.
- Chromium used browser pen events and completed an offline reload. WebKit used
  mouse-driven pointer events; its offline cache contains the new module. WebKit's
  automation runtime returned an internal error on offline navigation, so an
  offline WebKit reload is not claimed as verified.

Commands:

```sh
npm test
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers node tests/stroke-browser.mjs
```

Browser evidence is under `test-artifacts/stroke-acceptance/`.

## Scope of the evidence

Recognition is a local geometric comparison with the approved templates, not
a general handwriting/OCR model. Verification used generated traces and browser
input; no recorded children's handwriting or physical Apple Pencil session was
provided. Those tests establish the control rules, not age-specific empirical
error rates.

Allowing size variation has an inherent ambiguity: a shorter straight I can
also be a complete smaller I. The scale and length limits define that boundary;
half-stroke attempts are explicitly tested and rejected.

The changes are local. The separate `testversion/` snapshot and the published
site have not been updated.
