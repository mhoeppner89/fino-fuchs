# Visual QA report: number exercises 5–9

Date: 2026-07-31  
App: Fino schreibt, live workspace preview at `http://localhost:4180/`  
Scope: individual and multi-number exercises using `5 6 7 8 9`

## Test setup

- Opened `Zahlen` → `Eigene Zahlen` and entered `56789`.
- Used `Leicht` for the individual-number pass. The sampled order was 8, 7, 6, 9, 5.
- Used `Mittel` for multi-number layouts. Checked `einmal groß`, `Zahlenschlange`, `Zahlentreppe`, and `Diagonale – kompakt`.
- Used `Knifflig` at 390×844 portrait and 844×390 landscape.
- Checked the visible start point, dotted guide, Fino helper path, path handoff after each pen lift, corners, curves, scale, and orientation.
- Browser console had no warnings or errors.
- No app code was changed. Only this report and screenshots were created.

## Findings summary

| ID | Severity | Finding | Affected numbers |
|---|---|---|---|
| N-01 | High | Multi-number digits become too small in portrait mode because the landscape drawing area is letterboxed inside a tall board. | 5–9; directly visible with 7 in the hard compact sample |
| N-02 | Medium | Medium and hard dotted guides are very low contrast, especially in compact cells and on the phone viewport. | 5–9; most noticeable with 7 and the compact multi layouts |
| N-03 | Low | The start point is less clear at self-intersections or loop junctions, especially for 8 and 9. | 8, 9 |

## N-01 — portrait multi-number digits are too small

Severity: High

Reproduction:

1. Set the viewport to 390×844.
2. Choose `Zahlen` → `Eigene Zahlen`, enter `56789`, choose `Knifflig`, and start.
3. Observe the first `Zahlenturm – kompakt` exercise.

What is visible: the drawing board fills most of the portrait screen, but the actual 900:620 writing area remains a short landscape band in the middle. The active compact digit occupies only a small part of that band, with a large unused area above and below. In landscape, the board is more usable, but the compact glyph is still small.

Evidence:

- [Phone portrait hard compact sample](screenshots/25-phone-portrait-hard-number.png)
- [Phone landscape hard compact sample](screenshots/26-phone-landscape-hard-number.png)

Likely cause: the drawing surface keeps a fixed landscape design aspect ratio while the compact multi-number cells keep their reduced dimensions in portrait mode.

Recommendation: add a portrait-specific drawing layout. Stack or enlarge multi-number cells when the viewport is tall, and enforce a minimum on-screen glyph size. Keep the writing area within the visible board rather than preserving a wide letterboxed band.

## N-02 — dotted guide contrast is too weak at medium/hard difficulty

Severity: Medium

Reproduction:

1. Choose `Zahlen` → `Eigene Zahlen` with `56789`.
2. Start a `Mittel` round and inspect a compact or multi-number layout; then repeat at `Knifflig` on a phone-sized viewport.
3. Compare the dotted guide against the off-white board background.

What is visible: the guide is readable at full-size `Leicht`, but the pale dots become difficult to follow at `Mittel` and especially `Knifflig`. In compact cells the guide can look like a few isolated pale marks rather than a continuous path. The problem is strongest in the phone landscape hard sample, where the top bar and diagonal of the compact 7 are barely visible.

Evidence:

- [Large multi-number fine guide](screenshots/15-multi-layout-einmal-gross.png)
- [Helper on the fine guide](screenshots/16-multi-layout-helper-fine-guide.png)
- [Compact diagonal layout](screenshots/23-multi-layout-diagonal-kompakt.png)
- [Phone portrait hard compact sample](screenshots/25-phone-portrait-hard-number.png)
- [Phone landscape hard compact sample](screenshots/26-phone-landscape-hard-number.png)

Likely cause: the low-opacity, low-saturation guide palette loses contrast against the light board after the glyph is scaled down.

Recommendation: increase guide contrast or opacity for `Mittel` and `Knifflig`, increase the minimum dot size in compact cells, and recheck on a 390×844 viewport. The guide can remain subtler than `Leicht` without becoming nearly invisible.

## N-03 — start-point clarity at loop crossings

Severity: Low

Reproduction:

1. Start the individual `8` or `9` exercise at `Leicht`.
2. Inspect the green start point before drawing and then press `Fino zeigt die Spur`.

What is visible: 8 starts at the central crossing of its two loops. 9 starts at the right-side junction of the upper loop and descending tail. The green point is present, but the dotted path immediately returns close to the same area, and Fino moves slightly ahead of the exact start. The helper demonstrates the direction, but the first movement is less obvious than for the open-ended 5 or 7.

Evidence:

- [8 initial state](screenshots/02-number-8-initial.png)
- [8 helper path](screenshots/03-number-8-helper-path.png)
- [9 initial state](screenshots/09-number-9-initial.png)
- [9 helper path](screenshots/10-number-9-helper-path.png)

Likely cause: a single combined stroke is used for each closed/looped digit, while the fox is positioned a short distance along the path instead of holding exactly on the start marker.

Recommendation: briefly pulse or arrow the green start point for 8 and 9, or let Fino pause on the green point before moving along the first segment.

## Per-number results

### 5 — pass at full size; compact layouts inherit N-01/N-02

The two-stroke 5 is visually clear at full size. The top bar and downstroke form a readable corner, and the lower curve has a smooth, continuous loop. The green start point is clear at the top-right. After the first pen lift, the next green point appears at the shoulder, and Fino jumps to the correct handoff location.

Evidence:

- [5 initial](screenshots/11-number-5-initial.png)
- [5 helper path](screenshots/12-number-5-helper-path.png)
- [5 next start point after first stroke](screenshots/13-number-5-next-start-point.png)
- [5 traced state](screenshots/14-number-5-traced.png)
- [5 large multi-number layout](screenshots/15-multi-layout-einmal-gross.png)

No standalone 5 defect was found at the default desktop size. In small multi-number cells, the 5 will be affected by N-01 and N-02.

### 6 — pass at full size; curves and orientation are clear

The 6 has a smooth upper curve, full lower loop, and distinct inner return. Its green start point is visible at the upper-right, and Fino follows the curve counter-clockwise with a sensible orientation. No clipping, broken curve, or incorrect handoff was seen at full size.

Evidence:

- [6 initial](screenshots/07-number-6-initial.png)
- [6 helper path](screenshots/08-number-6-helper-path.png)

No standalone 6 defect was found. Small compact versions should be checked with the contrast and minimum-size fixes in N-01/N-02.

### 7 — pass at full size; hard compact version is too faint/small

The 7’s top bar and diagonal are easy to distinguish at full size. The start point is at the upper-left, Fino travels across the top bar, and the helper turns down the diagonal in the expected direction. The corner is visible and stays inside the writing area.

Evidence:

- [7 initial](screenshots/05-number-7-initial.png)
- [7 helper path](screenshots/06-number-7-helper-path.png)
- [Hard compact 7 in phone landscape](screenshots/26-phone-landscape-hard-number.png)

The standalone 7 passes at desktop. The compact hard 7 is the clearest example of N-01 and N-02: the guide is small and low contrast, so the intended corner and diagonal are hard to see.

### 8 — pass; central start crossing is a minor guidance risk

The 8 remains readable as one continuous self-crossing path. The green start point is located at the central crossing, the helper moves into the upper loop and then the lower loop, and the loops stay within the board. Compact 8s in the snake and staircase layouts remain recognizable after scaling.

Evidence:

- [8 initial](screenshots/02-number-8-initial.png)
- [8 helper path](screenshots/03-number-8-helper-path.png)
- [8 traced state](screenshots/04-number-8-traced.png)
- [8 first digit in the number snake](screenshots/18-snake-first-digit-traced.png)
- [8 first digit in the staircase](screenshots/21-staircase-first-digit-traced.png)

No shape defect was found. The central start crossing is covered by N-03 as a low-severity guidance improvement.

### 9 — pass; right loop junction is a minor guidance risk

The 9’s upper loop and descending tail are smooth and legible at full size. Fino follows the upper curve and then the tail in the expected direction. The 9 also remained readable in the compact multi-number snake/staircase samples.

Evidence:

- [9 initial](screenshots/09-number-9-initial.png)
- [9 helper path](screenshots/10-number-9-helper-path.png)
- [9 second digit in the number snake](screenshots/19-snake-second-digit-traced.png)
- [9 second digit in the staircase](screenshots/22-staircase-second-digit-traced.png)

No shape defect was found. The start at the right-side loop junction is covered by N-03, and small compact versions inherit N-01/N-02.

## Multi-number and responsive checks

- `Zahlenschlange` showed the 8 → 9 → 5 sequence with a visible green handoff after each completed digit. See [snake initial](screenshots/17-multi-layout-zahlenschlange.png), [first digit](screenshots/18-snake-first-digit-traced.png), and [second digit](screenshots/19-snake-second-digit-traced.png).
- `Zahlentreppe` showed the same 8 → 9 → 5 sequence across three diagonal cells. See [staircase initial](screenshots/20-multi-layout-zahlentreppe.png), [first digit](screenshots/21-staircase-first-digit-traced.png), and [second digit](screenshots/22-staircase-second-digit-traced.png).
- The app stages multi-number guides one digit at a time. Later digits are not shown until the current digit is completed. This was consistent across the checked layouts and was treated as intended focus behavior, not filed as a defect.
- Desktop screens had no clipping or HUD overlap. Portrait hides the text form of the progress count to preserve width; landscape shows it again. The main responsive defect is the scale and contrast of compact multi-number guides, covered by N-01 and N-02.

## Final assessment

The individual 5–9 shapes, helper directions, corners, curves, and pen-lift handoffs are correct and readable at the default desktop size. The main release risk is responsive: compact multi-number exercises become too small and too faint on phone-sized boards, with 8/9 also needing a small start-point clarity improvement.

## Post-fix verification — 2026-07-31

The 7 and 8 path definitions were revised after visual feedback. The checks below are the current-state verification and supersede the earlier 7/8 start-point notes where they differ.

### 7 — revised form verified

The 7 now has a clear top bar, diagonal downstroke, and separate crossbar. It reads as a conventional handwritten 7 instead of a bare angled corner. The form stays inside the writing area and remains legible at both desktop and 390×844 portrait size.

Evidence:

- [Desktop revised 7](screenshots/27-number-7-redesigned.png)
- [390×844 portrait revised 7](screenshots/30-number-7-redesigned-phone.png)

### 8 — top start point verified

The 8 is now one continuous joined path that starts at the top center, travels through the upper loop, continues through the lower loop, and returns to the top. The top start is visible in the live guide, and the loops remain balanced without clipping at desktop or 390×844 portrait size.

Evidence:

- [Desktop 8 with top start](screenshots/28-number-8-top-start.png)
- [Desktop 8 start-marker/helper state](screenshots/29-number-8-top-start-marker.png)
- [390×844 portrait 8 with top start](screenshots/31-number-8-top-start-phone.png)

The earlier N-03 concern about the 8 starting at the central crossing is resolved by this path change. The 9’s junction start remains a separate low-severity guidance issue.

### Regression check

The live UI was checked at the default desktop viewport and at 390×844 portrait. `git diff --check` passed, and all 45 automated tests passed.
