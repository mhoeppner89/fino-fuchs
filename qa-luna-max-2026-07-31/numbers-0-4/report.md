# Visual QA: numbers 0–4

Date: 31 July 2026  
App: Fino schreibt, current workspace build  
Scope: individual digits, repeated/multi-number layouts, helper animation, start points, dotted guides, corners and curves, scaling, and portrait/landscape orientation.

## Overall result

The digit paths are geometrically sound. I found no broken curves, clipped strokes, mirrored numbers, or wrong stroke order in 0, 1, 2, 3, or 4. The main risks are guide visibility and responsive sizing:

- P2: Later numbers in a multi-number task are hidden until the preceding number is completed. This looks like a missing guide on first view.
- P2: Knifflig mode makes the dotted guide and start point very faint; Fino also covers the start marker on some two-stroke numbers.
- P2: Compact multi-number layouts become very small in phone portrait mode, especially `Zahlenturm – kompakt`.
- P3: After the first stroke of 4, the second-stroke start point is not clearly visible because Fino sits on it.

No app code was changed. The screenshots below are the live UI. Desktop captures are 1280×720; phone captures are 390×844 and 844×390; the tablet capture is 1024×1228 visible viewport.

## Defects and reproduction

### D-01 — Later guides are invisible until the previous number is finished

Severity: P2, usability risk (possibly intentional staged guidance)

Reproduction:

1. Open Zahlen, choose Eigene Zahlen, enter `0 1 2 3 4`, choose Mittel, and start a round.
2. On `Deine Zahlen – Diagonale`, only the first small number guide is visible. The other two numbers in the diagonal are not visible yet.
3. Trace the first number. The second guide appears.
4. Trace the second number. The third guide appears.

Evidence:

- [medium-01-multi.png](screenshots/medium-01-multi.png) — only the first guide is visible.
- [medium-01-after-first-number.png](screenshots/medium-01-after-first-number.png) — the second guide appears after completion.
- [medium-01-after-second-number.png](screenshots/medium-01-after-second-number.png) — the third guide appears after completion.

Likely cause: the helper intentionally exposes one completion group at a time. Recommendation: keep the staged behavior if desired, but show very faint previews or a small “2 weitere Zahlen” cue so the child knows the exercise is not missing content.

### D-02 — Knifflig guide and start point are too faint

Severity: P2

Reproduction:

1. Use the same custom set and choose Knifflig.
2. Start the round and inspect `Deine Zahlen – Diagonale` before and during “Fino zeigt die Spur”.
3. The dotted 2 guide is visible only with close attention. The green start point is easy to lose under or beside Fino.

Evidence:

- [hard-01-current.png](screenshots/hard-01-current.png)
- [hard-01-helper.png](screenshots/hard-01-helper.png)

Likely cause: the zarte guide opacity is reduced below a comfortable child-facing contrast, while Fino is centered on the same start coordinate. Recommendation: set a minimum guide contrast/alpha and offset Fino slightly from the green point; keep the point visible throughout the demo.

### D-03 — Compact layouts become too small in phone portrait

Severity: P2

Reproduction:

1. Start a multi-number round and reach `Deine Zahlen – Zahlenturm – kompakt`.
2. Resize to 390×844 portrait.
3. The visible number cluster is only a small group near the middle of a very tall board, with large unused space above and below. The same task is more usable in landscape.

Evidence:

- [medium-07-phone-portrait.png](screenshots/medium-07-phone-portrait.png)
- [medium-07-phone-landscape.png](screenshots/medium-07-phone-landscape.png)
- [hard-01-tablet-portrait.png](screenshots/hard-01-tablet-portrait.png) — the tablet avoids clipping but still leaves the compact diagonal content in a small upper-left area.

Likely cause: normalized desktop cell layouts are retained after the board letterboxes to the portrait aspect ratio. Recommendation: apply a portrait-specific minimum cell width/height, or reduce the number of cells per task on narrow screens.

### D-04 — 4’s repeated start point is partly occluded

Severity: P3

Reproduction:

1. Open an individual 4 or a multi-number layout containing 4.
2. Draw the vertical stroke first.
3. The next required stroke starts again at the top of the vertical. Fino sits on that location, and the green marker is not clearly separable from the fox.

Evidence:

- [easy-05-digit-4-after-first-stroke.png](screenshots/easy-05-digit-4-after-first-stroke.png)
- [medium-01-four-after-first-stroke.png](screenshots/medium-01-four-after-first-stroke.png)
- [medium-03-pair-four-first.png](screenshots/medium-03-pair-four-first.png)

Recommendation: move Fino a few pixels away from the marker after a pen lift, or render a small ring/arrow for the next start point.

## Per-number findings

### 0 — pass, with responsive-size risk

The oval is smooth and consistently starts at the top. The helper travels around the oval in the same direction as the dotted path. I checked a large individual 0, a second placement, and small 0s in stair, snake, and compact diagonal layouts. No flattening, gap, or orientation error was visible.

Evidence: [easy-01-digit-0.png](screenshots/easy-01-digit-0.png), [easy-01-digit-0-helper.png](screenshots/easy-01-digit-0-helper.png), [easy-07-digit-0.png](screenshots/easy-07-digit-0.png), [medium-04-diagonal-compact-after-four.png](screenshots/medium-04-diagonal-compact-after-four.png), [medium-05-snake-after-four.png](screenshots/medium-05-snake-after-four.png).

### 1 — pass

The diagonal lead-in joins the long vertical cleanly. The start point is visible to the left of the hook in the individual view. The compact stair placement remains recognizable and was reachable after the preceding 4 and 0 were completed. No clipping or accidental rotation was visible.

Evidence: [easy-06-digit-1.png](screenshots/easy-06-digit-1.png), [medium-06-stair-compact-after-zero.png](screenshots/medium-06-stair-compact-after-zero.png).

### 2 — pass on geometry; staged-guide risk in multi layouts

The upper curve, diagonal return, and bottom horizontal have clear corners and smooth joins. The individual helper follows the intended path. In the diagonal layout, the 2 is large enough and cleanly separated from the later 3 and 4 once those stages are revealed.

Evidence: [easy-02-digit-2.png](screenshots/easy-02-digit-2.png), [easy-03-digit-2-helper.png](screenshots/easy-03-digit-2-helper.png), [medium-01-after-first-number.png](screenshots/medium-01-after-first-number.png), [medium-04-diagonal-compact-after-three.png](screenshots/medium-04-diagonal-compact-after-three.png).

### 3 — pass

Both curves are smooth. The central handoff between the upper and lower bowls is clear, and the lower curve does not flatten at small sizes. I checked individual placements and 3s in diagonal, stair, and side-by-side layouts.

Evidence: [easy-01-digit-3.png](screenshots/easy-01-digit-3.png), [easy-04-digit-3.png](screenshots/easy-04-digit-3.png), [easy-01-digit-3-helper.png](screenshots/easy-01-digit-3-helper.png), [medium-02-stair-after-first.png](screenshots/medium-02-stair-after-first.png), [medium-03-pair-after-three.png](screenshots/medium-03-pair-after-three.png).

### 4 — pass on path; start-marker clarity issue

The vertical stroke, diagonal, and horizontal crossbar form the intended 4. The crossbar remains visible after the vertical is completed, and the two ink colors make the separate strokes easy to distinguish. The only issue is D-04: the repeated start point at the top is partly covered by Fino.

Evidence: [easy-05-digit-4.png](screenshots/easy-05-digit-4.png), [easy-05-digit-4-after-first-stroke.png](screenshots/easy-05-digit-4-after-first-stroke.png), [medium-01-four-after-first-stroke.png](screenshots/medium-01-four-after-first-stroke.png), [medium-06-stair-compact-four-first.png](screenshots/medium-06-stair-compact-four-first.png).

## Coverage notes

I checked individual and multi-number views in `Diagonale`, `Zahlentreppe`, `zwei nebeneinander – kompakt`, `Diagonale – kompakt`, `Zahlenschlange`, `Zahlentreppe – kompakt`, and `Zahlenturm – kompakt`. I also checked the helper button, automatic helper demo, start points after pen lifts, separate ink colors, and staged guide reveal. No clipping or horizontal overflow was seen in phone portrait, phone landscape, or tablet portrait.

Recommended follow-up: address D-02 and D-03 first, then repeat the same screenshots at 390×844 and in Knifflig mode. D-01 should be confirmed as intentional product behavior before changing it.
