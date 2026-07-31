# Visual QA report: uppercase A–M and lowercase a–m

Date: 31 July 2026

Result: 26 individual exercises inspected in the live workspace app. I also inspected a two-copy uppercase layout, a four-cell lowercase layout, and a hard-mode guide. The original QA pass did not change app code; this follow-up changes only the lowercase `h` and `k` guides. The evidence folder contains a moving-helper capture and a settled-start-point capture for every letter.

Follow-up: after visual feedback, the lowercase `h` shoulder and lowercase `k` arm stroke were revised. The 45 automated tests still pass, and the revised visual evidence is in the `*-v2.png` files.

## Test conditions

- App inspected: the workspace copy of Fino schreibt, served at `http://localhost:9876/?test=1`.
- Viewport: the browser's default desktop viewport, 1280 × 720 screenshots.
- Individual pass: Buchstaben → Eigene Buchstaben → one letter → Leicht. Each letter was started separately.
- The `*-easy.png` files capture the early helper state. The `*-easy-postdemo.png` files were captured after the helper had finished, so the green next-start marker could be checked.
- Multi-letter pass: uppercase `A` in Mittel mode, including a compact pair; lowercase `a` in Mittel mode, including a compact four-cell grid. I completed the first visible copy in each layout to reveal the next copy's start marker.
- Hard-mode pass: uppercase `M` in Knifflig mode, with a three-item row visible in the captured run.
- Checked in every state: helper path, green start point, dotted guide visibility, stroke order, corners and curves, baseline/x-height, spacing, scaling, orientation/mirroring, and dot placement.
- The inspected tab produced no warning or error console entries.

Severity: P1 blocks the exercise; P2 makes the exercise materially harder to understand or use; P3 is a smaller readability or polish risk.

## Findings

### F-01 — P2: Lowercase `a` start state hides the short tail

What is visible: after the helper finishes, the green start dot sits on the right edge of the loop and Fino overlaps the short downward tail. In the settled single-letter capture the guide can read like a closed `o` until the child starts drawing. The same overlap is visible in the first and second cells of the medium four-cell layout.

Exact reproduction:

1. Choose Buchstaben.
2. Choose Eigene Buchstaben and enter `a`.
3. Choose Leicht and start the round.
4. Wait about 5 seconds for the helper to finish.
5. Observe the right side of the lowercase `a`.
6. For the multi-letter version, repeat with Mittel; the captured first task is `Viererfeld – kompakt`. Finish the first `a` and observe the next green start marker.

Evidence: `screenshots/a-lowercase-easy-postdemo.png`, `screenshots/a-lowercase-medium-four-grid-start.png`, and `screenshots/a-lowercase-medium-four-grid-second-start.png`.

Likely cause: the path begins at the loop's rightmost point and the helper fox is placed just after the start. The tail is short enough that the fox and the green marker cover most of it.

Recommendation: move the helper slightly farther along the tail, reduce its size when it sits over a short branch, or move the start marker to a visibly open point on the loop. Keep at least a short dotted section of the tail visible before the fox.

### F-02 — P3: Hard-mode dots are close to the background color

What is visible: in the hard-mode `M` capture, the dotted guide is present and correctly shaped, but the upper diagonals and the left stem are very faint against the white board. This is usable at the captured desktop size, but it leaves little contrast margin for a child, a dim display, or a smaller screen.

Exact reproduction of the captured run: choose Buchstaben, choose Eigene Buchstaben, enter `M`, choose Knifflig, start the round, and inspect the first `Dreierreihe` task.

Evidence: `screenshots/M-uppercase-hard-three-row.png`.

Likely cause: the hard guide intentionally uses the lowest guide alpha and the palest guide color.

Recommendation: raise the minimum contrast slightly in hard mode, or add a subtle outline/stronger dot edge while keeping the guide visually lighter than Medium.

## Per-letter results

### Uppercase

| Letter | Visual result | Evidence |
|---|---|---|
| A | Pass. Three strokes form a clear apex and crossbar. Bottom-left start, diagonals, and scale are correct; no mirroring. | `screenshots/A-uppercase-easy.png`, `screenshots/A-uppercase-easy-postdemo.png` |
| B | Pass. The left stem and two rounded bowls are distinct; the bowls stay on the correct sides of the stem. | `screenshots/B-uppercase-easy.png`, `screenshots/B-uppercase-easy-postdemo.png` |
| C | Pass. The curve remains open on the right, with smooth spacing between guide dots and no accidental closure. | `screenshots/C-uppercase-easy.png`, `screenshots/C-uppercase-easy-postdemo.png` |
| D | Pass. The straight left stem and right-facing curve meet at the top and baseline with the intended orientation. | `screenshots/D-uppercase-easy.png`, `screenshots/D-uppercase-easy-postdemo.png` |
| E | Pass. Top, middle, and bottom bars are ordered correctly; the middle bar is shorter and centered. | `screenshots/E-uppercase-easy.png`, `screenshots/E-uppercase-easy-postdemo.png` |
| F | Pass. The missing lower bar is clear, so the guide reads as `F` rather than `E`; proportions remain consistent. | `screenshots/F-uppercase-easy.png`, `screenshots/F-uppercase-easy-postdemo.png` |
| G | Pass. The open curve and inner right-hand hook are visible; the hook is aligned around the midline. | `screenshots/G-uppercase-easy.png`, `screenshots/G-uppercase-easy-postdemo.png` |
| H | Pass. Two vertical stems and the center crossbar are evenly spaced and aligned to the writing lines. | `screenshots/H-uppercase-easy.png`, `screenshots/H-uppercase-easy-postdemo.png` |
| I | Pass. The narrow centered stem is vertically stable and uses the same writing height as neighboring capitals. | `screenshots/I-uppercase-easy.png`, `screenshots/I-uppercase-easy-postdemo.png` |
| J | Pass. The top bar, right stem, and curved descender are oriented correctly and reach the baseline cleanly. | `screenshots/J-uppercase-easy.png`, `screenshots/J-uppercase-easy-postdemo.png` |
| K | Pass. The vertical stem and two diagonals meet at the intended mid-point; neither arm is mirrored. | `screenshots/K-uppercase-easy.png`, `screenshots/K-uppercase-easy-postdemo.png` |
| L | Pass. The vertical stroke and bottom bar sit on the baseline with no extra upper bar. | `screenshots/L-uppercase-easy.png`, `screenshots/L-uppercase-easy-postdemo.png` |
| M | Pass. The guide reads as an upright `M`: left stem up, center valley, right peak, and right stem down. The hard-mode row preserves the same orientation. | `screenshots/M-uppercase-easy.png`, `screenshots/M-uppercase-easy-postdemo.png`, `screenshots/M-uppercase-hard-three-row.png` |

### Lowercase

| Letter | Visual result | Evidence |
|---|---|---|
| a | F-01. The loop and tail are geometrically correct, but the start marker and fox obscure the short tail at the starting position. | `screenshots/a-lowercase-easy-postdemo.png`, `screenshots/a-lowercase-medium-four-grid-start.png` |
| b | Pass. The tall left ascender and right bowl are distinct; the loop stays at the x-height. | `screenshots/b-lowercase-easy.png`, `screenshots/b-lowercase-easy-postdemo.png` |
| c | Pass. The open curve is clear, with a stable x-height and no mirrored opening. | `screenshots/c-lowercase-easy.png`, `screenshots/c-lowercase-easy-postdemo.png` |
| d | Pass. The loop sits at the x-height and the ascender is correctly on the right. | `screenshots/d-lowercase-easy.png`, `screenshots/d-lowercase-easy-postdemo.png` |
| e | Pass. The small loop and crossbar are visible and fit the shared lowercase height. | `screenshots/e-lowercase-easy.png`, `screenshots/e-lowercase-easy-postdemo.png` |
| f | Pass. The ascender hook, downstroke, and crossbar are separated and correctly oriented. | `screenshots/f-lowercase-easy.png`, `screenshots/f-lowercase-easy-postdemo.png` |
| g | Pass. The upper loop is clear and the descender extends below the baseline without mirroring. | `screenshots/g-lowercase-easy.png`, `screenshots/g-lowercase-easy-postdemo.png` |
| h | Pass after revision. The shoulder now starts at the x-height and forms a rounder arch instead of a low, bent shoulder. | `screenshots/h-lowercase-easy-v2.png`, `screenshots/h-lowercase-easy-v2-postdemo.png` |
| i | Pass. The stem is centered and the two small guide dots sit above it on the same vertical axis. They are visible, though small. | `screenshots/i-lowercase-easy.png`, `screenshots/i-lowercase-easy-postdemo.png` |
| j | Pass. The stem and curved descender are correctly placed; the separate dot is above the stem and not mirrored. | `screenshots/j-lowercase-easy.png`, `screenshots/j-lowercase-easy-postdemo.png` |
| k | Pass after revision. The second stroke now starts at the stem, travels up to the upper arm, returns to the stem, and exits through the lower arm. | `screenshots/k-lowercase-easy-v2.png`, `screenshots/k-lowercase-easy-v2-postdemo.png` |
| l | Pass. The single tall stroke is centered and reaches the same ascender height as `b`, `d`, and `h`. | `screenshots/l-lowercase-easy.png`, `screenshots/l-lowercase-easy-postdemo.png` |
| m | Pass. Both humps are evenly spaced, share the x-height, and finish on the baseline. | `screenshots/m-lowercase-easy.png`, `screenshots/m-lowercase-easy-postdemo.png` |

## Multi-letter and layout checks

- Uppercase pair: the first `A` is shown at the larger left position, and after it is completed the second `A` appears at the same scale with its own green start point. The gap is clear and the two copies do not touch. Evidence: `screenshots/A-uppercase-medium-pair-compact.png` and `screenshots/A-uppercase-medium-pair-second-start.png`.
- Lowercase grid: the compact four-cell `a` layout keeps equal cell spacing and consistent size. The active guide is revealed one cell at a time; after the first cell is completed, the next cell receives its own start marker. Evidence: `screenshots/a-lowercase-medium-four-grid-start.png`, `screenshots/a-lowercase-medium-four-grid-second-start.png`, and `screenshots/a-lowercase-medium-four-grid-postdemo.png`.
- Helper behavior: the moving captures show Fino following the dotted path rather than a mirrored or offset path. Settled captures show the green marker at the next stroke start for angular, curved, ascender, descender, and dotted letters.
- No spacing, scaling, corner, curve, or orientation defect was found in the inspected A–M/a–m set beyond F-01 and the hard-mode contrast risk F-02.

## Evidence index

- Individual screenshots: `screenshots/<letter>-uppercase-easy.png` and `screenshots/<letter>-lowercase-easy.png`.
- Settled start-point screenshots: matching `*-easy-postdemo.png` files.
- Uppercase overview: `screenshots/uppercase-a-m-overview.png`.
- Lowercase overview: `screenshots/lowercase-a-m-overview.png`.
- Multi-letter supplemental captures: files beginning `A-uppercase-medium-` and `a-lowercase-medium-`.
- Hard-mode supplemental capture: `screenshots/M-uppercase-hard-three-row.png`.
- Revised h/k captures: `screenshots/h-lowercase-easy-v2.png`, `screenshots/h-lowercase-easy-v2-postdemo.png`, `screenshots/k-lowercase-easy-v2.png`, and `screenshots/k-lowercase-easy-v2-postdemo.png`.
