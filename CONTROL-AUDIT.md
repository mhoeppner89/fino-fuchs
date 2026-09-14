# Stroke acceptance audit

Local app version: **1.3.36**. Audit and implementation: **14 September 2026**.

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

The new live validator is in `js/stroke-validation.js`. The board, UI, and
session changes are in `js/drawing.js`, `js/app.js`, `index.html`, and
`js/curriculum.js`. The old whole-image geometry functions remain available
for diagnostics and their existing regression tests; they no longer grant
live exercise completion.

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
