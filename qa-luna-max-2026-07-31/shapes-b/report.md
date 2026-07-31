# Fino schreibt — Shapes B visual QA report

Date: 2026-07-31  
Scope: the second half of the complete Shapes exercise catalog, entries 51–100  
Result: all 50 entries were reached and traced in the live UI. The visual checks pass. One low-severity content inconsistency affects the mirrored arrow instruction.

## Test setup and method

- App: local Fino schreibt build at http://127.0.0.1:8124/?test=1
- UI path: select Formen, difficulty Leicht, start a round, then repeat rounds until every assigned catalog entry appeared.
- Interaction: live pointer traces on the drawing canvas. Each inspected task was traced to completion so the next guide stage and automatic advancement could be checked.
- For every assigned entry:
  - the initial guide view was saved as NNN-shapes-shape-...png;
  - Fino's helper animation was started and a mid-animation view was saved as ...-helper.png;
  - complex tasks with more than two strokes were advanced through their first stage and saved as ...-stage-next.png.
- The browser console showed no warnings or errors during the sweep.
- No application source code was changed by this QA run. The pre-existing worktree modification in js/curriculum.js was preserved.

The evidence folder is screenshots/. The canonical set contains 50 initial screenshots, 50 helper screenshots, and 20 stage-transition screenshots. One early duplicate, 099-shape-rocket-unten.png, is also present from the first manual navigation pass.

## Complete catalog order and split

The catalog is built in listed order as 20 shape families, each with five layouts: groß, kompakt, oben, unten, andersherum. The table below is the complete 100-entry order.

| Entries | Shape family | Layout order |
|---|---|---|
| 1–5 | Kreis | groß, kompakt, oben, unten, andersherum |
| 6–10 | Oval | groß, kompakt, oben, unten, andersherum |
| 11–15 | Viereck | groß, kompakt, oben, unten, andersherum |
| 16–20 | Dreieck | groß, kompakt, oben, unten, andersherum |
| 21–25 | Kreuz | groß, kompakt, oben, unten, andersherum |
| 26–30 | Raute | groß, kompakt, oben, unten, andersherum |
| 31–35 | Herz | groß, kompakt, oben, unten, andersherum |
| 36–40 | Stern | groß, kompakt, oben, unten, andersherum |
| 41–45 | Rechteck | groß, kompakt, oben, unten, andersherum |
| 46–50 | Fünfeck | groß, kompakt, oben, unten, andersherum |
| **51–55** | **Sechseck** | **groß, kompakt, oben, unten, andersherum** |
| **56–60** | **Pfeil** | **groß, kompakt, oben, unten, andersherum** |
| **61–65** | **Haus** | **groß, kompakt, oben, unten, andersherum** |
| **66–70** | **Drachen** | **groß, kompakt, oben, unten, andersherum** |
| **71–75** | **Ballon** | **groß, kompakt, oben, unten, andersherum** |
| **76–80** | **Fisch** | **groß, kompakt, oben, unten, andersherum** |
| **81–85** | **Blume** | **groß, kompakt, oben, unten, andersherum** |
| **86–90** | **Sonne** | **groß, kompakt, oben, unten, andersherum** |
| **91–95** | **Segelboot** | **groß, kompakt, oben, unten, andersherum** |
| **96–100** | **Rakete** | **groß, kompakt, oben, unten, andersherum** |

The split used here is therefore:

- Shapes A: entries 1–50, ending with Fünfeck.
- Shapes B: entries 51–100, beginning with Sechseck and ending with Rakete.

The inspected task IDs match the catalog IDs in js/curriculum.js, for example shapes-shape-hexagon-gross through shapes-shape-rocket-spiegel.

## Overall findings

- Guide geometry: pass for all 50. Closed shapes close cleanly; open multi-stroke pictures use the intended separate marks.
- Hard versus smooth corners: pass for all 50. Polygonal paths and straight components keep hard turns; circles, ovals, fish bodies, balloon bodies, and flower petals remain smooth.
- Start point: pass for all 50. The green marker is placed on the first point of the active stroke and Fino waits just after it. After a completed stroke, the marker moves to the next required stroke.
- Stroke staging: pass. One- and two-stroke exercises show their complete guide. Flower, sun, sailboat, and rocket reveal small groups, keep completed stages visible, and move Fino to the next unfinished stage.
- Dotted guide visibility: pass. The active stage is readable at the tested desktop viewport; later stages are intentionally withheld until the current stage is completed.
- Orientation: pass visually. oben and unten shift the shape vertically without rotating it; andersherum mirrors it horizontally. The mirrored arrow is the one content exception described below.
- Scaling: pass. groß is full-size, kompakt is visibly reduced, and oben/unten remain inside the board with no clipping. The mirrored layouts preserve scale and vertical position.
- Helper animation: pass for all 50. Fino follows the same visible guide path, rotates with curved and angular segments, and makes a visible jump where the task has disconnected strokes.
- Completion: pass for all 50 exact pointer traces. Each task advanced automatically after the final stroke.

## Per-shape report

The family notes describe the shared geometry and staging. Each row records the layout-specific position, scale, orientation, start point, helper behavior, defect status, and evidence.

### Entries 51–55 — Sechseck

Shared check: one closed six-segment angular stroke. The six corners are hard, the start is the upper-left point on the top edge in the base layouts, and there is no hidden stage. All guide dots are visible at once; Fino follows the stored path edge-to-edge.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 51 — shapes-shape-hexagon-gross — Sechseck – groß | Full 1.0 scale, centered. Start at the upper-left top edge; no clipping; helper travels clockwise around the base path. | No defect. [guide](screenshots/051-shapes-shape-hexagon-gross.png) · [helper](screenshots/051-shapes-shape-hexagon-gross-helper.png) |
| 52 — shapes-shape-hexagon-kompakt — Sechseck – kompakt | About 0.76 scale, centered. The six hard corners remain distinct at the smaller size. | No defect. [guide](screenshots/052-shapes-shape-hexagon-kompakt.png) · [helper](screenshots/052-shapes-shape-hexagon-kompakt-helper.png) |
| 53 — shapes-shape-hexagon-oben — Sechseck – oben | About 0.78 scale, shifted upward. The top edge stays inside the board and the start remains on the upper-left edge. | No defect. [guide](screenshots/053-shapes-shape-hexagon-oben.png) · [helper](screenshots/053-shapes-shape-hexagon-oben-helper.png) |
| 54 — shapes-shape-hexagon-unten — Sechseck – unten | About 0.78 scale, shifted downward. The lower edge remains inside the board; orientation is unchanged. | No defect. [guide](screenshots/054-shapes-shape-hexagon-unten.png) · [helper](screenshots/054-shapes-shape-hexagon-unten-helper.png) |
| 55 — shapes-shape-hexagon-spiegel — Sechseck – andersherum | About 0.90 scale, horizontally mirrored. The start moves to the upper-right edge and the helper follows the mirrored, direction-reversed path; no vertical flip occurs. | No defect. [guide](screenshots/055-shapes-shape-hexagon-spiegel.png) · [helper](screenshots/055-shapes-shape-hexagon-spiegel-helper.png) |

### Entries 56–60 — Pfeil

Shared check: two straight angular strokes, a horizontal shaft followed by the separate arrowhead stroke. Both strokes are visible from the start because the task has only two strokes. The helper follows the shaft, then jumps to the head.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 56 — shapes-shape-arrow-gross — Pfeil – groß | Full scale, centered. Green start is at the left end of a right-pointing shaft; the arrowhead has hard turns. | No visual defect. [guide](screenshots/056-shapes-shape-arrow-gross.png) · [helper](screenshots/056-shapes-shape-arrow-gross-helper.png) |
| 57 — shapes-shape-arrow-kompakt — Pfeil – kompakt | About 0.76 scale, centered. The shaft, tip, and two hard head corners remain readable. | No defect. [guide](screenshots/057-shapes-shape-arrow-kompakt.png) · [helper](screenshots/057-shapes-shape-arrow-kompakt-helper.png) |
| 58 — shapes-shape-arrow-oben — Pfeil – oben | About 0.78 scale, shifted upward. The shaft and head remain fully inside the canvas. | No defect. [guide](screenshots/058-shapes-shape-arrow-oben.png) · [helper](screenshots/058-shapes-shape-arrow-oben-helper.png) |
| 59 — shapes-shape-arrow-unten — Pfeil – unten | About 0.78 scale, shifted downward. The green start remains at the left shaft end and Fino follows the horizontal line cleanly. | No defect. [guide](screenshots/059-shapes-shape-arrow-unten.png) · [helper](screenshots/059-shapes-shape-arrow-unten-helper.png) |
| 60 — shapes-shape-arrow-spiegel — Pfeil – andersherum | About 0.90 scale, horizontally mirrored. The guide points left and the green start correctly moves to the right end of the shaft; hard corners and helper direction are correct. | Visual pass; content issue D1 applies. [guide](screenshots/060-shapes-shape-arrow-spiegel.png) · [helper](screenshots/060-shapes-shape-arrow-spiegel-helper.png) |

### Entries 61–65 — Haus

Shared check: two angular strokes, first the roof and then the body outline. The roof peak, wall corners, and bottom corners stay hard. Both guides are visible from the start; the helper jumps from the roof to the body outline.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 61 — shapes-shape-house-gross — Haus – groß | Full scale, centered. Start is the left roof eave; the body begins separately at the left wall. | No defect. [guide](screenshots/061-shapes-shape-house-gross.png) · [helper](screenshots/061-shapes-shape-house-gross-helper.png) |
| 62 — shapes-shape-house-kompakt — Haus – kompakt | About 0.76 scale, centered. Roof and body remain clearly separated without losing corners. | No defect. [guide](screenshots/062-shapes-shape-house-kompakt.png) · [helper](screenshots/062-shapes-shape-house-kompakt-helper.png) |
| 63 — shapes-shape-house-oben — Haus – oben | About 0.78 scale, shifted upward. The roof stays clear of the top edge and the body remains visible below it. | No defect. [guide](screenshots/063-shapes-shape-house-oben.png) · [helper](screenshots/063-shapes-shape-house-oben-helper.png) |
| 64 — shapes-shape-house-unten — Haus – unten | About 0.78 scale, shifted downward. The base remains inside the writing area and the roof orientation is unchanged. | No defect. [guide](screenshots/064-shapes-shape-house-unten.png) · [helper](screenshots/064-shapes-shape-house-unten-helper.png) |
| 65 — shapes-shape-house-spiegel — Haus – andersherum | About 0.90 scale, mirrored horizontally. Start moves to the right roof eave and the body starts at the right wall; no vertical inversion. | No visual defect. [guide](screenshots/065-shapes-shape-house-spiegel.png) · [helper](screenshots/065-shapes-shape-house-spiegel-helper.png) |

### Entries 66–70 — Drachen

Shared check: a hard-corner diamond in the first stroke and a separate angular tail in the second. Both strokes are visible initially; Fino traces the diamond and then jumps to the tail.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 66 — shapes-shape-kite-gross — Drachen – groß | Full scale, centered. Start is the top diamond vertex; the tail is visible below the lower vertex. | No defect. [guide](screenshots/066-shapes-shape-kite-gross.png) · [helper](screenshots/066-shapes-shape-kite-gross-helper.png) |
| 67 — shapes-shape-kite-kompakt — Drachen – kompakt | About 0.76 scale, centered. The tail remains separate and touch-sized. | No defect. [guide](screenshots/067-shapes-shape-kite-kompakt.png) · [helper](screenshots/067-shapes-shape-kite-kompakt-helper.png) |
| 68 — shapes-shape-kite-oben — Drachen – oben | About 0.78 scale, shifted upward. The top start remains inside the board and the tail is not clipped. | No defect. [guide](screenshots/068-shapes-shape-kite-oben.png) · [helper](screenshots/068-shapes-shape-kite-oben-helper.png) |
| 69 — shapes-shape-kite-unten — Drachen – unten | About 0.78 scale, shifted downward. The tail remains inside the board and the diamond stays legible. | No defect. [guide](screenshots/069-shapes-shape-kite-unten.png) · [helper](screenshots/069-shapes-shape-kite-unten-helper.png) |
| 70 — shapes-shape-kite-spiegel — Drachen – andersherum | About 0.90 scale, horizontally mirrored. The diamond is symmetric; the tail bends in the mirrored direction while the top start remains correct. | No defect. [guide](screenshots/070-shapes-shape-kite-spiegel.png) · [helper](screenshots/070-shapes-shape-kite-spiegel-helper.png) |

### Entries 71–75 — Ballon

Shared check: a smooth closed oval followed by a short angular string. The oval has a smooth guide and the string has hard turns. Both are visible at once; Fino completes the oval, then jumps to the string.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 71 — shapes-shape-balloon-gross — Ballon – groß | Full scale, centered. Start is at the top of the oval; the string joins at the lower center. | No defect. [guide](screenshots/071-shapes-shape-balloon-gross.png) · [helper](screenshots/071-shapes-shape-balloon-gross-helper.png) |
| 72 — shapes-shape-balloon-kompakt — Ballon – kompakt | About 0.76 scale, centered. The oval remains smooth and the small hard string is still readable. | No defect. [guide](screenshots/072-shapes-shape-balloon-kompakt.png) · [helper](screenshots/072-shapes-shape-balloon-kompakt-helper.png) |
| 73 — shapes-shape-balloon-oben — Ballon – oben | About 0.78 scale, shifted upward. The oval and string stay inside the board; start remains at the oval top. | No defect. [guide](screenshots/073-shapes-shape-balloon-oben.png) · [helper](screenshots/073-shapes-shape-balloon-oben-helper.png) |
| 74 — shapes-shape-balloon-unten — Ballon – unten | About 0.78 scale, shifted downward. The string remains visible and is not clipped by the lower board edge. | No defect. [guide](screenshots/074-shapes-shape-balloon-unten.png) · [helper](screenshots/074-shapes-shape-balloon-unten-helper.png) |
| 75 — shapes-shape-balloon-spiegel — Ballon – andersherum | About 0.90 scale, mirrored horizontally. The oval stays smooth and the string's small bend mirrors correctly. | No defect. [guide](screenshots/075-shapes-shape-balloon-spiegel.png) · [helper](screenshots/075-shapes-shape-balloon-spiegel-helper.png) |

### Entries 76–80 — Fisch

Shared check: a smooth closed fish body plus a separate hard triangular tail. The body starts at its top point; the helper follows the smooth loop and jumps to the tail. Tail corners remain hard.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 76 — shapes-shape-fish-gross — Fisch – groß | Full scale, centered. Start is at the top of the body; the angular tail connects visually at the right side. | No defect. [guide](screenshots/076-shapes-shape-fish-gross.png) · [helper](screenshots/076-shapes-shape-fish-gross-helper.png) |
| 77 — shapes-shape-fish-kompakt — Fisch – kompakt | About 0.76 scale, centered. Body curve and tail triangle remain distinct. | No defect. [guide](screenshots/077-shapes-shape-fish-kompakt.png) · [helper](screenshots/077-shapes-shape-fish-kompakt-helper.png) |
| 78 — shapes-shape-fish-oben — Fisch – oben | About 0.78 scale, shifted upward. The tail and body remain fully inside the board. | No defect. [guide](screenshots/078-shapes-shape-fish-oben.png) · [helper](screenshots/078-shapes-shape-fish-oben-helper.png) |
| 79 — shapes-shape-fish-unten — Fisch – unten | About 0.78 scale, shifted downward. The lower body remains clear of the board edge; orientation is unchanged. | No defect. [guide](screenshots/079-shapes-shape-fish-unten.png) · [helper](screenshots/079-shapes-shape-fish-unten-helper.png) |
| 80 — shapes-shape-fish-spiegel — Fisch – andersherum | About 0.90 scale, mirrored horizontally. The tail moves to the left and the body start moves with the mirrored path. | No defect. [guide](screenshots/080-shapes-shape-fish-spiegel.png) · [helper](screenshots/080-shapes-shape-fish-spiegel-helper.png) |

### Entries 81–85 — Blume

Shared check: five strokes. The first two petal loops are smooth; the stem and two leaves are hard straight strokes. Staging is [0,1], then [2,3], then [4]. Completed guides stay visible while the next stage is demonstrated.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 81 — shapes-shape-flower-gross — Blume – groß | Full scale, centered. Start is at the top of the outer petal loop; later stem/leaf stages appear below. | No defect. [guide](screenshots/081-shapes-shape-flower-gross.png) · [helper](screenshots/081-shapes-shape-flower-gross-helper.png) · [stage](screenshots/081-shapes-shape-flower-gross-stage-next.png) |
| 82 — shapes-shape-flower-kompakt — Blume – kompakt | About 0.76 scale, centered. Petal loops stay smooth and the stage transition remains readable at the smaller size. | No defect. [guide](screenshots/082-shapes-shape-flower-kompakt.png) · [helper](screenshots/082-shapes-shape-flower-kompakt-helper.png) · [stage](screenshots/082-shapes-shape-flower-kompakt-stage-next.png) |
| 83 — shapes-shape-flower-oben — Blume – oben | About 0.78 scale, shifted upward. The top petal loop remains inside the board; stem stages remain visible below. | No defect. [guide](screenshots/083-shapes-shape-flower-oben.png) · [helper](screenshots/083-shapes-shape-flower-oben-helper.png) · [stage](screenshots/083-shapes-shape-flower-oben-stage-next.png) |
| 84 — shapes-shape-flower-unten — Blume – unten | About 0.78 scale, shifted downward. The lower stem and leaves remain inside the board and do not clip. | No defect. [guide](screenshots/084-shapes-shape-flower-unten.png) · [helper](screenshots/084-shapes-shape-flower-unten-helper.png) · [stage](screenshots/084-shapes-shape-flower-unten-stage-next.png) |
| 85 — shapes-shape-flower-spiegel — Blume – andersherum | About 0.90 scale, horizontally mirrored. The petal loops remain smooth and leaf strokes mirror while the stage order stays stable. | No defect. [guide](screenshots/085-shapes-shape-flower-spiegel.png) · [helper](screenshots/085-shapes-shape-flower-spiegel-helper.png) · [stage](screenshots/085-shapes-shape-flower-spiegel-stage-next.png) |

### Entries 86–90 — Sonne

Shared check: seven strokes: one smooth circle and six hard rays. Staging is [0,1], [2,3], [4,5], [6]. The first view shows the circle and first ray; later rays are revealed in small groups. Fino follows the circle and then jumps between rays.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 86 — shapes-shape-sun-gross — Sonne – groß | Full scale, centered. Start is at the top of the smooth circle; the top ray is visible in the first stage. | No defect. [guide](screenshots/086-shapes-shape-sun-gross.png) · [helper](screenshots/086-shapes-shape-sun-gross-helper.png) · [stage](screenshots/086-shapes-shape-sun-gross-stage-next.png) |
| 87 — shapes-shape-sun-kompakt — Sonne – kompakt | About 0.76 scale, centered. Circle remains smooth; hard rays and stage groups remain legible. | No defect. [guide](screenshots/087-shapes-shape-sun-kompakt.png) · [helper](screenshots/087-shapes-shape-sun-kompakt-helper.png) · [stage](screenshots/087-shapes-shape-sun-kompakt-stage-next.png) |
| 88 — shapes-shape-sun-oben — Sonne – oben | About 0.78 scale, shifted upward. Top ray remains inside the board and the lower stages do not clip. | No defect. [guide](screenshots/088-shapes-shape-sun-oben.png) · [helper](screenshots/088-shapes-shape-sun-oben-helper.png) · [stage](screenshots/088-shapes-shape-sun-oben-stage-next.png) |
| 89 — shapes-shape-sun-unten — Sonne – unten | About 0.78 scale, shifted downward. Bottom ray remains inside the board; circle and rays keep their orientation. | No defect. [guide](screenshots/089-shapes-shape-sun-unten.png) · [helper](screenshots/089-shapes-shape-sun-unten-helper.png) · [stage](screenshots/089-shapes-shape-sun-unten-stage-next.png) |
| 90 — shapes-shape-sun-spiegel — Sonne – andersherum | About 0.90 scale, horizontally mirrored. Symmetric rays look unchanged, but the helper and start behavior remain valid. | No defect. [guide](screenshots/090-shapes-shape-sun-spiegel.png) · [helper](screenshots/090-shapes-shape-sun-spiegel-helper.png) · [stage](screenshots/090-shapes-shape-sun-spiegel-stage-next.png) |

### Entries 91–95 — Segelboot

Shared check: three hard angular strokes: hull, mast/right sail, and left sail. Staging is [0,1], then [2]. The initial guide exposes the hull and first sail stage; the final sail is revealed after the first stage is completed.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 91 — shapes-shape-sailboat-gross — Segelboot – groß | Full scale, centered. Start is at the left hull point; hard hull and sail corners are clear. | No defect. [guide](screenshots/091-shapes-shape-sailboat-gross.png) · [helper](screenshots/091-shapes-shape-sailboat-gross-helper.png) · [stage](screenshots/091-shapes-shape-sailboat-gross-stage-next.png) |
| 92 — shapes-shape-sailboat-kompakt — Segelboot – kompakt | About 0.76 scale, centered. Hull, mast, and staged third sail remain separated and readable. | No defect. [guide](screenshots/092-shapes-shape-sailboat-kompakt.png) · [helper](screenshots/092-shapes-shape-sailboat-kompakt-helper.png) · [stage](screenshots/092-shapes-shape-sailboat-kompakt-stage-next.png) |
| 93 — shapes-shape-sailboat-oben — Segelboot – oben | About 0.78 scale, shifted upward. Mast and sails remain inside the top boundary; hull remains visible below. | No defect. [guide](screenshots/093-shapes-shape-sailboat-oben.png) · [helper](screenshots/093-shapes-shape-sailboat-oben-helper.png) · [stage](screenshots/093-shapes-shape-sailboat-oben-stage-next.png) |
| 94 — shapes-shape-sailboat-unten — Segelboot – unten | About 0.78 scale, shifted downward. Hull remains inside the lower boundary and the mast stays connected visually. | No defect. [guide](screenshots/094-shapes-shape-sailboat-unten.png) · [helper](screenshots/094-shapes-shape-sailboat-unten-helper.png) · [stage](screenshots/094-shapes-shape-sailboat-unten-stage-next.png) |
| 95 — shapes-shape-sailboat-spiegel — Segelboot – andersherum | About 0.90 scale, mirrored horizontally. Start moves to the right hull point and the sail arrangement mirrors left-to-right. | No defect. [guide](screenshots/095-shapes-shape-sailboat-spiegel.png) · [helper](screenshots/095-shapes-shape-sailboat-spiegel-helper.png) · [stage](screenshots/095-shapes-shape-sailboat-spiegel-stage-next.png) |

### Entries 96–100 — Rakete

Shared check: four strokes: a hard angular shell, a smooth circular window, and two hard fins. Staging is [0,1], then [2,3]. The first stage is readable without overwhelming the board; after the shell and window are traced, the fins appear and the green marker moves to the first fin.

| # / task | Layout-specific observation | Defect / evidence |
|---|---|---|
| 96 — shapes-shape-rocket-gross — Rakete – groß | Full scale, centered. Start is at the nose; shell corners are hard and the window is smooth. | No defect. [guide](screenshots/096-shapes-shape-rocket-gross.png) · [helper](screenshots/096-shapes-shape-rocket-gross-helper.png) · [stage](screenshots/096-shapes-shape-rocket-gross-stage-next.png) |
| 97 — shapes-shape-rocket-kompakt — Rakete – kompakt | About 0.76 scale, centered. Shell, window, and later fins remain distinct and touch-sized. | No defect. [guide](screenshots/097-shapes-shape-rocket-kompakt.png) · [helper](screenshots/097-shapes-shape-rocket-kompakt-helper.png) · [stage](screenshots/097-shapes-shape-rocket-kompakt-stage-next.png) |
| 98 — shapes-shape-rocket-oben — Rakete – oben | About 0.78 scale, shifted upward. The nose remains inside the board and the lower fin stage stays visible. | No defect. [guide](screenshots/098-shapes-shape-rocket-oben.png) · [helper](screenshots/098-shapes-shape-rocket-oben-helper.png) · [stage](screenshots/098-shapes-shape-rocket-oben-stage-next.png) |
| 99 — shapes-shape-rocket-unten — Rakete – unten | About 0.78 scale, shifted downward. The lower shell and fin stage remain inside the board; no upside-down or stretched appearance. | No defect. [guide](screenshots/099-shapes-shape-rocket-unten.png) · [helper](screenshots/099-shapes-shape-rocket-unten-helper.png) · [stage](screenshots/099-shapes-shape-rocket-unten-stage-next.png) |
| 100 — shapes-shape-rocket-spiegel — Rakete – andersherum | About 0.90 scale, horizontally mirrored. Symmetric shell and fins retain the correct vertical orientation; helper starts at the nose and follows the mirrored path. | No defect. [guide](screenshots/100-shapes-shape-rocket-spiegel.png) · [helper](screenshots/100-shapes-shape-rocket-spiegel-helper.png) · [stage](screenshots/100-shapes-shape-rocket-spiegel-stage-next.png) |

## Defects and recommendations

### D1 — Mirrored arrow keeps the right-pointing speech (P3, low severity)

Affected entry: 60, shapes-shape-arrow-spiegel / Pfeil – andersherum.

Observed behavior: the live guide is correctly mirrored and points left. The green start point moves to the right side, and Fino follows the mirrored left-pointing shaft. The task's generated speech text still begins with “Male einen Pfeil nach rechts.” and only appends “andersherum.”.

Exact reproduction:

1. Open Formen and start a round.
2. Continue until Pfeil – andersherum appears, or inspect catalog entry 60.
3. Observe the left-pointing guide and right-side start point in [060-shapes-shape-arrow-spiegel.png](screenshots/060-shapes-shape-arrow-spiegel.png).
4. Compare it with the task instruction generated for the same entry: the inherited template says “Pfeil nach rechts”.

The current build has synthetic speech disabled, so this does not produce audible wrong guidance in the tested UI. It will become a user-facing contradiction if speech is enabled or if the task speech is displayed.

Likely cause: the variant generator mirrors the strokes but reuses the template speech unchanged. The relevant construction is in js/curriculum.js around shape-arrow and variantBank(); the layout transform is mirrorX, while the speech is always composed from the original template sentence.

Recommendation: make directional speech layout-aware. For spiegel, either say “Male einen Pfeil nach links” or use neutral wording such as “Male den Pfeil andersherum.” Keep the current visual geometry and helper behavior.

No other defects were observed in entries 51–100.

## Handoff

Report: qa-luna-max-2026-07-31/shapes-b/report.md  
Screenshots: qa-luna-max-2026-07-31/shapes-b/screenshots/  
Canonical coverage: 50/50 assigned entries, each with guide and helper evidence; 20 complex entries also include a stage-transition screenshot.
