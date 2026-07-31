# Visual QA report: N–Z and n–z

Date: 2026-07-31  
App: Fino schreibt, current workspace build  
Viewport: 1280 × 720 CSS pixels

## Scope and method

I inspected all 26 requested letters in the live app: uppercase N–Z and lowercase n–z.

- Individual tasks used a custom one-letter set with the clear guide.
- Multi-letter tasks used the same custom set at medium difficulty. I traced the first visible copy with pointer input so the next copy appeared, then checked spacing, scale, and alignment.
- I checked the dotted guide, green start point, helper fox, stroke direction, corners, curves, baseline/x-height, ascenders, descenders, orientation, and mirroring.
- No letter in this range has a separate typographic dot like i or j. Green start-point placement was still checked for every letter.
- The browser initially exposed a stale cached build on port 4173. The evidence below comes from a fresh local origin on port 4177, which matches the current workspace files and the 10-task UI.
- The app code was not changed during this QA pass. The existing working-tree change in `js/curriculum.js` was preserved.

## Result

25 letters passed the visual checks. Lowercase `p` has one medium-severity educational defect: its guide does not include an ascender.

The multi-letter helper reveals one character at a time by design. The `multi-next-character` screenshots show the first copy drawn and the next copy dotted; this is the state used to judge spacing and scaling.

## Finding

### F-01 — lowercase p has no ascender

Severity: P2 — noticeable visual/teaching defect, but the task remains usable.

Exact reproduction:

1. Choose **Buchstaben** → **Eigene Buchstaben**.
2. Enter `p`, choose **Leicht**, and start the round.
3. Wait for the helper path to settle.
4. Observe the individual lowercase p guide. The green start point is around the x-height, and the vertical stem runs down to the descender. There is no dotted stem from the ascender line down to the x-height.

Evidence: [lowercase p individual guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-p-individual-guide.png) and [lowercase p in a multi-letter task](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-p-multi-next-character.png).

Likely cause: `lowerLetterStrokes.p` starts its stem at normalized y=0.40 and ends at y=0.94 in [js/curriculum.js:350](/Users/mhoeppner/Desktop/fuchsschrift/js/curriculum.js:350). The lower-case fitting then places the start near the x-height rather than the shared ascender line.

Recommendation: extend the p stem to the same upper start used by the other ascenders, while keeping the loop attached at the x-height and the descender at the shared baseline. Recheck the green start point and the second-copy spacing in the medium multi-letter layout.

## Per-letter findings

### Uppercase

| Letter | Individual guide | Multi-letter state | Finding |
|---|---|---|---|
| N | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-N-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-N-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-N-multi-next-character.png) | Pass. Left stem, top-left to bottom-right diagonal, and rising right stem are correctly oriented. The second N keeps the same height and has clear separation. |
| O | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-O-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-O-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-O-multi-next-character.png) | Pass. The oval is closed, centered, and reaches the intended top and baseline. No mirroring or flattening observed. |
| P | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-P-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-P-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-P-multi-next-character.png) | Pass. The bowl joins the stem cleanly and stays in the upper half; the stem reaches the baseline. |
| Q | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Q-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Q-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Q-multi-next-character.png) | Pass. The tail leaves the lower-right of the oval in the correct direction and does not mirror or detach visually. |
| R | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-R-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-R-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-R-multi-next-character.png) | Pass. The bowl and diagonal leg meet the stem at the expected points. The leg reaches down without crowding the neighboring copy. |
| S | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-S-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-S-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-S-multi-next-character.png) | Pass. Both curves are smooth, with the start point at the upper-right and no angular break or reversal. |
| T | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-T-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-T-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-T-multi-next-character.png) | Pass. The crossbar is level, the stem is centered, and the two copies remain separated in the sampled layout. |
| U | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-U-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-U-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-U-multi-next-character.png) | Pass. Both stems are equal in height and the lower curve reaches the baseline without a corner. |
| V | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-V-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-V-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-V-multi-next-character.png) | Pass. The two diagonals meet at the lower point and rise to matching top positions; no mirror error observed. |
| W | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-W-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-W-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-W-multi-next-character.png) | Pass. All four turns are visible, with the inner valley raised and the outer endpoints aligned. |
| X | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-X-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-X-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-X-multi-next-character.png) | Pass. The diagonals cross at the center and reach the intended opposite corners. |
| Y | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Y-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Y-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Y-multi-next-character.png) | Pass. The fork meets centrally and the stem drops straight to the baseline. |
| Z | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Z-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Z-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/upper-Z-multi-next-character.png) | Pass. Top and bottom bars are level, the diagonal runs down-left, and the corners remain distinct. |

### Lowercase

| Letter | Individual guide | Multi-letter state | Finding |
|---|---|---|---|
| n | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-n-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-n-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-n-multi-next-character.png) | Pass. The stem starts at the baseline, rises to the x-height, and joins the rounded shoulder without a gap. |
| o | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-o-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-o-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-o-multi-next-character.png) | Pass. The oval stays within the x-height band, closes cleanly, and keeps a consistent width in the multi-letter view. |
| p | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-p-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-p-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-p-multi-next-character.png) | **Finding F-01.** The loop and descender are present, but the stem begins around the x-height instead of extending up to the ascender line. |
| q | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-q-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-q-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-q-multi-next-character.png) | Pass. The loop is on the x-height and the right-hand descender reaches the baseline; it is not mirrored into p. |
| r | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-r-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-r-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-r-multi-next-character.png) | Pass. The shoulder begins where the upright ends, so no visible break appears at the join. |
| s | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-s-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-s-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-s-multi-next-character.png) | Pass. The small S curve is smooth, centered on the x-height, and not mirrored. |
| t | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-t-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-t-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-t-multi-next-character.png) | Pass. The ascender reaches the upper guide, the crossbar is centered, and the small exit hook is visible. |
| u | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-u-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-u-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-u-multi-next-character.png) | Pass. The bowl is rounded, both uprights meet the x-height, and the baseline is consistent. |
| v | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-v-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-v-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-v-multi-next-character.png) | Pass. The two diagonals meet at the lower point without overshoot or mirroring. |
| w | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-w-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-w-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-w-multi-next-character.png) | Pass. The two humps and lower valleys remain distinct at x-height scale. |
| x | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-x-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-x-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-x-multi-next-character.png) | Pass. The crossing is centered and both diagonals remain inside the cell. |
| y | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-y-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-y-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-y-multi-next-character.png) | Pass. The fork is centered and the descender falls cleanly to the baseline without shifting the upper arms. |
| z | [guide](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-z-individual-guide.png) | [initial](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-z-multi-initial.png) · [next copy](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/lower-z-multi-next-character.png) | Pass. The top and bottom bars are level and the diagonal keeps the intended direction. |

## Contact sheets

- [Uppercase individual guides](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/contact-upper-individual.png)
- [Lowercase individual guides](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/contact-lower-individual.png)
- [Uppercase multi-letter spacing](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/contact-upper-multi-next.png)
- [Lowercase multi-letter spacing](/Users/mhoeppner/Desktop/fuchsschrift/qa-luna-max-2026-07-31/letters-n-z/screenshots/contact-lower-multi-next.png)

The `upper-*` and `lower-*` files are the authoritative per-letter evidence names. The directory also contains a few earlier diagnostic captures from the stale-build check; they are not used for the findings above.
