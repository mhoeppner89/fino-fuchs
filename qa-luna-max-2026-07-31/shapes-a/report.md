# Fino schreibt — Shapes visual QA (first half)

Date: 2026-07-31  
App under test: local Fino schreibt build at http://localhost:4180/?test  
Scope: Formen catalog, entries 1–50 in the catalog's listed order.

## Result

I inspected all 50 exercises in the first half of the 100-entry shapes bank in the live UI. Each target entry has a cleared-guide screenshot and a helper-animation screenshot in the screenshots folder. The live traces used the actual canvas and pointer drags; the app code was not changed.

Confirmed shape-specific defects: none.

The guide screenshots intentionally show Fino waiting just after the green start point. This is the normal idle helper state, not ink and not a geometry defect. The helper screenshots show Fino farther along the same guide path.

## Reproduction and checks

For each entry: select Formen, start a Leicht session, wait until the catalog entry appeared, inspect the cleared canvas, use “Fino zeigt die Spur,” and inspect the helper path. I checked:

- guide geometry, orientation, scale, and clipping;
- smooth curves versus hard/mitered corners;
- green start-point location;
- one-stroke versus two-stroke staging;
- dotted-guide visibility;
- helper direction, jumps, endpoints, and alignment.

The randomized live session was repeated until every entry in the target split had appeared. Screenshots were captured at the live viewport after clearing and after starting the helper. The two contact sheets are visual indexes: [guide contact sheet](screenshots/guide_contact_sheet.png) and [helper contact sheet](screenshots/helper_contact_sheet.png).

## Catalog order and split

The bank contains 20 base shapes, each with five variants in this order: groß, kompakt, oben, unten, andersherum. The full order is:

- 1–5: Kreis – groß; Kreis – kompakt; Kreis – oben; Kreis – unten; Kreis – andersherum
- 6–10: Oval – groß; Oval – kompakt; Oval – oben; Oval – unten; Oval – andersherum
- 11–15: Viereck – groß; Viereck – kompakt; Viereck – oben; Viereck – unten; Viereck – andersherum
- 16–20: Dreieck – groß; Dreieck – kompakt; Dreieck – oben; Dreieck – unten; Dreieck – andersherum
- 21–25: Kreuz – groß; Kreuz – kompakt; Kreuz – oben; Kreuz – unten; Kreuz – andersherum
- 26–30: Raute – groß; Raute – kompakt; Raute – oben; Raute – unten; Raute – andersherum
- 31–35: Herz – groß; Herz – kompakt; Herz – oben; Herz – unten; Herz – andersherum
- 36–40: Stern – groß; Stern – kompakt; Stern – oben; Stern – unten; Stern – andersherum
- 41–45: Rechteck – groß; Rechteck – kompakt; Rechteck – oben; Rechteck – unten; Rechteck – andersherum
- 46–50: Fünfeck – groß; Fünfeck – kompakt; Fünfeck – oben; Fünfeck – unten; Fünfeck – andersherum
- 51–55: Sechseck – groß; Sechseck – kompakt; Sechseck – oben; Sechseck – unten; Sechseck – andersherum
- 56–60: Pfeil – groß; Pfeil – kompakt; Pfeil – oben; Pfeil – unten; Pfeil – andersherum
- 61–65: Haus – groß; Haus – kompakt; Haus – oben; Haus – unten; Haus – andersherum
- 66–70: Drachen – groß; Drachen – kompakt; Drachen – oben; Drachen – unten; Drachen – andersherum
- 71–75: Ballon – groß; Ballon – kompakt; Ballon – oben; Ballon – unten; Ballon – andersherum
- 76–80: Fisch – groß; Fisch – kompakt; Fisch – oben; Fisch – unten; Fisch – andersherum
- 81–85: Blume – groß; Blume – kompakt; Blume – oben; Blume – unten; Blume – andersherum
- 86–90: Sonne – groß; Sonne – kompakt; Sonne – oben; Sonne – unten; Sonne – andersherum
- 91–95: Segelboot – groß; Segelboot – kompakt; Segelboot – oben; Segelboot – unten; Segelboot – andersherum
- 96–100: Rakete – groß; Rakete – kompakt; Rakete – oben; Rakete – unten; Rakete – andersherum

The requested split is:

- First half inspected: entries 1–50, Kreis through Fünfeck, all five variants each.
- Second half not inspected in this pass: entries 51–100, Sechseck through Rakete, all five variants each.

## Global observation

### OBS-01 — mirrored labels are visually identical for symmetric outlines (low-priority product observation)

Exact reproduction: open any of the “andersherum” entries in the live Formen session and compare its guide silhouette with the corresponding groß or compact entry. The outline remains the same for the symmetric shape families; the meaningful change is the reversed path direction and, where applicable, the opposite horizontal start side.

Evidence: [Kreis – andersherum](screenshots/05_shape-circle-spiegel_guide.png), [Viereck – andersherum](screenshots/15_shape-square-spiegel_guide.png), [Kreuz – andersherum](screenshots/25_shape-cross-spiegel_helper.png), [Herz – andersherum](screenshots/35_shape-heart-spiegel_helper.png), and [Rechteck – andersherum](screenshots/45_shape-rectangle-spiegel_guide.png).

Likely cause: the catalog correctly applies a horizontal mirror transform to the path, but the outline itself is symmetric. This is expected if “andersherum” teaches stroke direction.

Recommendation: retain the current behavior if reversed motion is the learning objective. If the label is meant to promise a visibly different shape, use an asymmetric exercise or rename the variant to make the direction-training purpose explicit.

## Per-shape report

## 01. Kreis – groß

Evidence: [guide](screenshots/01_shape-circle-gross_guide.png) · [helper](screenshots/01_shape-circle-gross_helper.png)

- Guide geometry: single centered circular loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 02. Kreis – kompakt

Evidence: [guide](screenshots/02_shape-circle-kompakt_guide.png) · [helper](screenshots/02_shape-circle-kompakt_helper.png)

- Guide geometry: single centered circular loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 03. Kreis – oben

Evidence: [guide](screenshots/03_shape-circle-oben_guide.png) · [helper](screenshots/03_shape-circle-oben_helper.png)

- Guide geometry: single centered circular loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 04. Kreis – unten

Evidence: [guide](screenshots/04_shape-circle-unten_guide.png) · [helper](screenshots/04_shape-circle-unten_helper.png)

- Guide geometry: single centered circular loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 05. Kreis – andersherum

Evidence: [guide](screenshots/05_shape-circle-spiegel_guide.png) · [helper](screenshots/05_shape-circle-spiegel_helper.png)

- Guide geometry: single centered circular loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 06. Oval – groß

Evidence: [guide](screenshots/06_shape-oval-gross_guide.png) · [helper](screenshots/06_shape-oval-gross_helper.png)

- Guide geometry: single centered vertical oval loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 07. Oval – kompakt

Evidence: [guide](screenshots/07_shape-oval-kompakt_guide.png) · [helper](screenshots/07_shape-oval-kompakt_helper.png)

- Guide geometry: single centered vertical oval loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 08. Oval – oben

Evidence: [guide](screenshots/08_shape-oval-oben_guide.png) · [helper](screenshots/08_shape-oval-oben_helper.png)

- Guide geometry: single centered vertical oval loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 09. Oval – unten

Evidence: [guide](screenshots/09_shape-oval-unten_guide.png) · [helper](screenshots/09_shape-oval-unten_helper.png)

- Guide geometry: single centered vertical oval loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 10. Oval – andersherum

Evidence: [guide](screenshots/10_shape-oval-spiegel_guide.png) · [helper](screenshots/10_shape-oval-spiegel_helper.png)

- Guide geometry: single centered vertical oval loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth all the way around. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top of the loop; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 11. Viereck – groß

Evidence: [guide](screenshots/11_shape-square-gross_guide.png) · [helper](screenshots/11_shape-square-gross_helper.png)

- Guide geometry: single centered square loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 12. Viereck – kompakt

Evidence: [guide](screenshots/12_shape-square-kompakt_guide.png) · [helper](screenshots/12_shape-square-kompakt_helper.png)

- Guide geometry: single centered square loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 13. Viereck – oben

Evidence: [guide](screenshots/13_shape-square-oben_guide.png) · [helper](screenshots/13_shape-square-oben_helper.png)

- Guide geometry: single centered square loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 14. Viereck – unten

Evidence: [guide](screenshots/14_shape-square-unten_guide.png) · [helper](screenshots/14_shape-square-unten_helper.png)

- Guide geometry: single centered square loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 15. Viereck – andersherum

Evidence: [guide](screenshots/15_shape-square-spiegel_guide.png) · [helper](screenshots/15_shape-square-spiegel_helper.png)

- Guide geometry: single centered square loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-right corner (horizontal mirror of the upper-left start). The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 16. Dreieck – groß

Evidence: [guide](screenshots/16_shape-triangle-gross_guide.png) · [helper](screenshots/16_shape-triangle-gross_helper.png)

- Guide geometry: single upright triangular loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 17. Dreieck – kompakt

Evidence: [guide](screenshots/17_shape-triangle-kompakt_guide.png) · [helper](screenshots/17_shape-triangle-kompakt_helper.png)

- Guide geometry: single upright triangular loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 18. Dreieck – oben

Evidence: [guide](screenshots/18_shape-triangle-oben_guide.png) · [helper](screenshots/18_shape-triangle-oben_helper.png)

- Guide geometry: single upright triangular loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 19. Dreieck – unten

Evidence: [guide](screenshots/19_shape-triangle-unten_guide.png) · [helper](screenshots/19_shape-triangle-unten_helper.png)

- Guide geometry: single upright triangular loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 20. Dreieck – andersherum

Evidence: [guide](screenshots/20_shape-triangle-spiegel_guide.png) · [helper](screenshots/20_shape-triangle-spiegel_helper.png)

- Guide geometry: single upright triangular loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 21. Kreuz – groß

Evidence: [guide](screenshots/21_shape-cross-gross_guide.png) · [helper](screenshots/21_shape-cross-gross_helper.png)

- Guide geometry: vertical stem plus horizontal crossbar. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered line ends. Two strokes are staged together in the initial guide, as expected for a simple two-stroke shape; Fino then runs the vertical stroke, jumps, and runs the crossbar.
- Start point and orientation: top of the vertical stroke.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino follows the vertical stroke from the top, jumps at the intersection, then traces the crossbar left-to-right.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 22. Kreuz – kompakt

Evidence: [guide](screenshots/22_shape-cross-kompakt_guide.png) · [helper](screenshots/22_shape-cross-kompakt_helper.png)

- Guide geometry: vertical stem plus horizontal crossbar. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered line ends. Two strokes are staged together in the initial guide, as expected for a simple two-stroke shape; Fino then runs the vertical stroke, jumps, and runs the crossbar.
- Start point and orientation: top of the vertical stroke.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino follows the vertical stroke from the top, jumps at the intersection, then traces the crossbar left-to-right.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 23. Kreuz – oben

Evidence: [guide](screenshots/23_shape-cross-oben_guide.png) · [helper](screenshots/23_shape-cross-oben_helper.png)

- Guide geometry: vertical stem plus horizontal crossbar. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered line ends. Two strokes are staged together in the initial guide, as expected for a simple two-stroke shape; Fino then runs the vertical stroke, jumps, and runs the crossbar.
- Start point and orientation: top of the vertical stroke.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino follows the vertical stroke from the top, jumps at the intersection, then traces the crossbar left-to-right.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 24. Kreuz – unten

Evidence: [guide](screenshots/24_shape-cross-unten_guide.png) · [helper](screenshots/24_shape-cross-unten_helper.png)

- Guide geometry: vertical stem plus horizontal crossbar. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered line ends. Two strokes are staged together in the initial guide, as expected for a simple two-stroke shape; Fino then runs the vertical stroke, jumps, and runs the crossbar.
- Start point and orientation: top of the vertical stroke.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino follows the vertical stroke from the top, jumps at the intersection, then traces the crossbar left-to-right.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 25. Kreuz – andersherum

Evidence: [guide](screenshots/25_shape-cross-spiegel_guide.png) · [helper](screenshots/25_shape-cross-spiegel_helper.png)

- Guide geometry: vertical stem plus horizontal crossbar. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered line ends. Two strokes are staged together in the initial guide, as expected for a simple two-stroke shape; Fino then runs the vertical stroke, jumps, and runs the crossbar.
- Start point and orientation: top of the vertical stroke; the horizontal stroke runs right-to-left. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino follows the vertical stroke from the top, jumps at the intersection, then traces the crossbar right-to-left.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 26. Raute – groß

Evidence: [guide](screenshots/26_shape-diamond-gross_guide.png) · [helper](screenshots/26_shape-diamond-gross_helper.png)

- Guide geometry: single centered diamond loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 27. Raute – kompakt

Evidence: [guide](screenshots/27_shape-diamond-kompakt_guide.png) · [helper](screenshots/27_shape-diamond-kompakt_helper.png)

- Guide geometry: single centered diamond loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 28. Raute – oben

Evidence: [guide](screenshots/28_shape-diamond-oben_guide.png) · [helper](screenshots/28_shape-diamond-oben_helper.png)

- Guide geometry: single centered diamond loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 29. Raute – unten

Evidence: [guide](screenshots/29_shape-diamond-unten_guide.png) · [helper](screenshots/29_shape-diamond-unten_helper.png)

- Guide geometry: single centered diamond loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 30. Raute – andersherum

Evidence: [guide](screenshots/30_shape-diamond-spiegel_guide.png) · [helper](screenshots/30_shape-diamond-spiegel_helper.png)

- Guide geometry: single centered diamond loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 31. Herz – groß

Evidence: [guide](screenshots/31_shape-heart-gross_guide.png) · [helper](screenshots/31_shape-heart-gross_helper.png)

- Guide geometry: single heart-shaped loop with a central notch. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth lobes with a visible notch. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: bottom tip.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 32. Herz – kompakt

Evidence: [guide](screenshots/32_shape-heart-kompakt_guide.png) · [helper](screenshots/32_shape-heart-kompakt_helper.png)

- Guide geometry: single heart-shaped loop with a central notch. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth lobes with a visible notch. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: bottom tip.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 33. Herz – oben

Evidence: [guide](screenshots/33_shape-heart-oben_guide.png) · [helper](screenshots/33_shape-heart-oben_helper.png)

- Guide geometry: single heart-shaped loop with a central notch. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth lobes with a visible notch. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: bottom tip.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 34. Herz – unten

Evidence: [guide](screenshots/34_shape-heart-unten_guide.png) · [helper](screenshots/34_shape-heart-unten_helper.png)

- Guide geometry: single heart-shaped loop with a central notch. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth lobes with a visible notch. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: bottom tip.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 35. Herz – andersherum

Evidence: [guide](screenshots/35_shape-heart-spiegel_guide.png) · [helper](screenshots/35_shape-heart-spiegel_helper.png)

- Guide geometry: single heart-shaped loop with a central notch. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: smooth lobes with a visible notch. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: bottom tip; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 36. Stern – groß

Evidence: [guide](screenshots/36_shape-star-gross_guide.png) · [helper](screenshots/36_shape-star-gross_helper.png)

- Guide geometry: single five-point star loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered points. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top point.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 37. Stern – kompakt

Evidence: [guide](screenshots/37_shape-star-kompakt_guide.png) · [helper](screenshots/37_shape-star-kompakt_helper.png)

- Guide geometry: single five-point star loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered points. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top point.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 38. Stern – oben

Evidence: [guide](screenshots/38_shape-star-oben_guide.png) · [helper](screenshots/38_shape-star-oben_helper.png)

- Guide geometry: single five-point star loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered points. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top point.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 39. Stern – unten

Evidence: [guide](screenshots/39_shape-star-unten_guide.png) · [helper](screenshots/39_shape-star-unten_helper.png)

- Guide geometry: single five-point star loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered points. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top point.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 40. Stern – andersherum

Evidence: [guide](screenshots/40_shape-star-spiegel_guide.png) · [helper](screenshots/40_shape-star-spiegel_helper.png)

- Guide geometry: single five-point star loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered points. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top point; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 41. Rechteck – groß

Evidence: [guide](screenshots/41_shape-rectangle-gross_guide.png) · [helper](screenshots/41_shape-rectangle-gross_helper.png)

- Guide geometry: single horizontal rectangular loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 42. Rechteck – kompakt

Evidence: [guide](screenshots/42_shape-rectangle-kompakt_guide.png) · [helper](screenshots/42_shape-rectangle-kompakt_helper.png)

- Guide geometry: single horizontal rectangular loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 43. Rechteck – oben

Evidence: [guide](screenshots/43_shape-rectangle-oben_guide.png) · [helper](screenshots/43_shape-rectangle-oben_helper.png)

- Guide geometry: single horizontal rectangular loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 44. Rechteck – unten

Evidence: [guide](screenshots/44_shape-rectangle-unten_guide.png) · [helper](screenshots/44_shape-rectangle-unten_helper.png)

- Guide geometry: single horizontal rectangular loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-left corner.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 45. Rechteck – andersherum

Evidence: [guide](screenshots/45_shape-rectangle-spiegel_guide.png) · [helper](screenshots/45_shape-rectangle-spiegel_helper.png)

- Guide geometry: single horizontal rectangular loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: upper-right corner (horizontal mirror of the upper-left start). The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 46. Fünfeck – groß

Evidence: [guide](screenshots/46_shape-pentagon-gross_guide.png) · [helper](screenshots/46_shape-pentagon-gross_helper.png)

- Guide geometry: single upright five-sided loop. baseline centered size (scale 1.00). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 47. Fünfeck – kompakt

Evidence: [guide](screenshots/47_shape-pentagon-kompakt_guide.png) · [helper](screenshots/47_shape-pentagon-kompakt_helper.png)

- Guide geometry: single upright five-sided loop. centered smaller size (scale about 0.76). No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 48. Fünfeck – oben

Evidence: [guide](screenshots/48_shape-pentagon-oben_guide.png) · [helper](screenshots/48_shape-pentagon-oben_helper.png)

- Guide geometry: single upright five-sided loop. smaller size (scale about 0.78), shifted upward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 49. Fünfeck – unten

Evidence: [guide](screenshots/49_shape-pentagon-unten_guide.png) · [helper](screenshots/49_shape-pentagon-unten_helper.png)

- Guide geometry: single upright five-sided loop. smaller size (scale about 0.78), shifted downward about 10% of the drawing area. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.

## 50. Fünfeck – andersherum

Evidence: [guide](screenshots/50_shape-pentagon-spiegel_guide.png) · [helper](screenshots/50_shape-pentagon-spiegel_helper.png)

- Guide geometry: single upright five-sided loop. centered size (scale about 0.90), horizontally mirrored path direction. No clipping, unexpected rotation, or off-canvas placement was observed.
- Corners and stroke staging: hard/mitered corners. One stroke is shown as a complete guide; no premature hiding or extra staging was observed.
- Start point and orientation: top vertex; the path direction is horizontally reversed. The outline is horizontally symmetric, so the mirror is most visible in the start/direction of the helper path rather than in the final silhouette.
- Dotted guide and helper path: The pale dotted guide stayed readable in the captured live frame, and the green start point landed on the first expected stroke. Fino waits just after the green start point, then follows the same dotted path continuously; no off-guide drift, clipped turn, or wrong endpoint was seen.
- Result: PASS — no shape-specific visual defect observed.
- Recommendation: retain the current geometry, scale, staging, and helper path; no correction required for this entry.


## Evidence inventory

- 50 guide screenshots: screenshots/01_shape-circle-gross_guide.png through screenshots/50_shape-pentagon-spiegel_guide.png.
- 50 helper screenshots: screenshots/01_shape-circle-gross_helper.png through screenshots/50_shape-pentagon-spiegel_helper.png.
- Visual indexes: screenshots/guide_contact_sheet.png and screenshots/helper_contact_sheet.png.
- One earlier out-of-order diagnostic screenshot is also present: screenshots/observed_balloon_mirror_unordered.png.

