Original prompt: 1. 100 unique exercises for each activity. These should feel meaningfully different and fun. Get some ideas from gpt 5.6 sol xhigh, pick the best ones, then implement them. 2. Multistroke levels sometimes don't finish automatically, when the drawing was done with less strokes - fix that, after every stroke there should be a quick check if the level is finished. I also want to be less strict about what stroke the kids make if it gets them a good result. 3. Difficulty adjustments: all have pre-drawn lines - just thinner and more transparent -, but allow fewer deviation from the determined path in the final result.

## 2026-07-30

- Starting implementation. Current app has 56 base templates and 20-task rounds.
- Need: 100 meaningful unique exercises per activity, lenient automatic multi-stroke completion, and thin transparent guides at all three levels with stricter final tolerance.
- Implemented 100-task banks for all six activities, including a deterministic name bank.
- Made the stroke check run after every completed stroke and reduced the influence of stroke count on the result.
- All modes now show a thinner, more transparent guide; hit tolerance becomes stricter by mode.
- Logic test suite passes 17 of 17 tests. The local Playwright canvas check launches the practice screen, loads every app asset, and captures Fino on the guide.
- Bug found: global coverage could accept a repeated letter or number before its final copy was drawn. Completion is now checked for each disconnected character/number component.
- Verification: 18 of 18 logic tests pass; Playwright canvas smoke test passes after the completion fix.
- Current work: number and letter setup now uses Alles or an entered custom set; custom sets generate a full 20-task round. Separate pen strokes cycle through a five-color ink palette.
- Verification: 19 of 19 logic tests pass. The Node Playwright canvas runner visually confirmed two separate pen strokes in blue and berry; the optional Python smoke test cannot run here because the Python Playwright module is unavailable.
- Sol high quality review applied: changed selector copy to Alle, added spacing above custom fields, explicit per-symbol completion groups, a green start point, coverage-based Fino jumps, canonicalized awkward starts, lowercase glyphs with a shared em-box, and easy-only single-symbol banks.
- Verification: 24 of 24 tests pass; an omission sweep over static/custom multi-symbol banks keeps every missing copy below the easy completion threshold.
- Fixed the remaining premature-completion defect: completion now requires each expected path independently, and user samples are assigned to their nearest character/path before scoring. Nearby letters or numbers can no longer complete a missing character, bar, tail, or umlaut dot.
- Name prefix, suffix, chunk, and full-name exercises now preserve per-character completion groups. Fino follows the first unfinished path in writing order, while the green start point remains visible beside Fino.
- Added exhaustive regression coverage for static/custom/name banks, phone/tablet, every difficulty, all missing groups/paths, retry slack, jitter, and flexible pen segmentation. `npm test` passes 32 of 32 tests (46.0 s).
- Five independent Sol retests found no premature advancement: number, letters, real stylus/browser timing, negative matrix (25,062 scenarios), and broad name/helper regression. The old shifted 5-7-2, FUCHS-without-C, missing umlaut dots, and missing name letters are all blocked.

## 2026-07-30 follow-up

- Current request: fix mirrored/upside-down-looking symbols and name spacing, make tracing forgiving without reintroducing skipped components, preserve geometry on rotation, keep shape corners hard, repair Safari input focus, stage complex drawings, and let Fino calmly demonstrate then jump to an early pen.
- Added a shared, aspect-fitted 900×620 drawing artboard. Rendering, pointer input, guide lines, ink, Fino, and scoring now use the same transform, so portrait boards no longer stretch glyphs.
- Reworked per-path completion to use an invisible, child-friendly acceptance band plus exclusive path ownership and a maximum uncovered-run guard. Exact traces and every omission regression still pass; an omitted short crossbar or neighbouring symbol cannot complete a component.
- Added semantic narrow-letter advances and centred I/i; polygonal shape strokes now retain hard corners. Complex shapes and multi-symbol exercises reveal one small stage at a time. Automatic checks treat incomplete multi-stroke work as progress instead of a failed attempt.
- Verification: `npm test` passes 37 of 37 tests, including exhaustive exact and missing-path checks across every bank, responsive artboard checks, narrow-I spacing, hard-corner metadata, staged guidance, and the new acceptable-offset tracing band. The local Playwright canvas run loaded all app assets with no console errors and rendered Fino centred on the dotted guide. The optional Python browser smoke script remains unavailable because its Python Playwright package is not installed.

## 2026-07-30 second follow-up

- Corrected the genuinely inverted capital M path and replaced the lowercase i's off-centre-looking dash with a centred, round dot.
- Increased the child-friendly tracing corridor (with an even touch-sized dot target), while preserving component/path ownership. Ownership now keeps a pen stroke with its intended nearby letter or path, so a broad corridor cannot let a missing neighbour complete the task.
- Name characters have wider breathing room, especially around narrow letters such as i. Rounds now contain 10 tasks and rotate through available symbols/templates before repeating one.
- Portrait layouts no longer leave an invisible flex column under the board; wide desktop layouts put Fino and controls alongside the writing page, keeping the card close to its intended proportions.
- Verification: `npm test` passes 39 of 39 checks, including the all-bank exact/missing-path regression and the wider acceptance band. The final Playwright canvas smoke check reached the 10-task practice round, rendered Fino on the dotted guide, and recorded no console errors.

## 2026-07-30 third follow-up

- Name sessions are now intentionally variable in length: each character is practised in order, including repeated letters, followed by one full-name task.
- Completed guide stages remain on the canvas. Fino demonstrates only the current unfinished stage, while earlier dotted targets stay available as context.
- Verification: `npm test` passes 41 of 41 checks. Focused browser checks confirmed `ANNA` follows A → N → N → A → ANNA and a staged number keeps the completed first digit visible while the second remains dotted; no browser errors were recorded.

## 2026-07-30 fourth follow-up

- Corrected capital N: its diagonal now runs from top-left to bottom-right, with separate natural pen lifts for the two uprights and the diagonal.
- Long names now reduce their letter height as a single centred word once they exceed four characters. Names are no longer clipped at eight letters; all 12 allowed characters fit on the board with gaps that compact only when needed.
- Added an iPad-landscape layout (1024×768): an exact-proportion 900:620 writing board sits beside a compact Fino/control rail instead of becoming a tall card with empty space inside it.
- Verification: `npm test` passes 43 of 43 checks, including new N-direction/pen-lift and long-name-height/full-name regressions. The required final Playwright canvas run recorded no errors, and an iPad landscape visual check measured a 678×467 board (900:620) with Fino and both controls alongside it.

## 2026-07-30 fifth follow-up

- Reworked the lowercase `a`, `r`, and `t`: `a` is now a connected loop and tail, `r` has no break before its shoulder, and `t` gains a small end hook so it no longer resembles a plus sign.
- Verification: `npm test` passes 44 of 44 checks, including connected-path regressions for all three letters. The final Playwright canvas smoke test recorded no errors.

## 2026-07-30 sixth follow-up

- Rebuilt the practice screen around the drawing board: removed the level/title/reference box and Fino's speech bubble, moved clear and show into compact top-bar buttons, and made the board fill all remaining screen space in every orientation.
- Verification: `npm test` passes 45 of 45 checks, including the new board-first practice-view regression. The final Playwright canvas smoke test recorded no errors.

## 2026-07-31 responsive task-layout follow-up

- Current request: use the measured drawing space to choose one, two, or more letter/number targets without distorting their shapes; use portrait diagonals and landscape rows; restrict full-name writing on phones; and remove repeated shape variants.
- QA reports are in `qa-luna-max-2026-07-31/`. They identified faint compact guides and portrait multi-target layouts as the main issues. Note: `js/curriculum.js` already contains uncommitted 7/8/h/k refinements from the visual QA pass; preserve and validate them.
- Implemented measured-board reflow. Tasks now use the full canvas; every rendered component is uniformly scaled from the canonical drawing, preserving glyph and shape proportions. Portrait boards use a staged diagonal (one target only on very narrow boards, otherwise two); landscape boards use a staged row (up to three on phones and four on wide boards).
- Name rounds now use their real drawing-board size: a full name is offered on phones only in landscape and only up to eight letters. Otherwise, after individual letters, the name is practised in short ordered parts.
- Removed the repeated size/position/mirror variants from Formen. The visible shapes catalogue now has 20 distinct shape families, enough for a 10-task round. The mixed bank remains 100 tasks.
- Bumped the offline cache to `fino-schreibt-v1.0.20` so an installed app receives this layout update.
- Verification: `npm test` passes 47 of 47. Playwright checks confirmed a 390×844 phone renders two staged letters diagonally on the full board and an 844×390 phone renders three staged numbers in a row; no console errors occurred. The standard Playwright game client also completed its desktop smoke run and its canvas screenshot was visually inspected.

## 2026-07-31 Kiwi handwriting follow-up

- Current request: make every letter and digit match the supplied Kiwi School Handwriting character map, including the troublesome 1, 7 and 9; use reliable handwriting guidance for Fino's starting points and stroke routes.
- Downloaded Kiwi School Handwriting v3.0 and its companion "with Guides" font from the author's published download. The source font was used for inspection only and is not bundled in the public app.
- Rebuilt the guide centre lines for all A–Z, a–z and 0–9. The routes now follow the companion guide font's published start dots, direction and pen lifts: e.g. 1 is a single slanted downstroke, 7 has no crossbar, and 9 is a top loop followed by a descending tail. Fino already follows first points and jumps between separate paths, so the teaching route is now used directly in the game without adding screen clutter or voice-over.
- Added regression checks for Kiwi's M/i construction and the distinctive 1, 7 and 9 forms; updated the source attribution in the README.
- Verification: `npm test` passes 48 of 48; `git diff --check` passes. The required Playwright game-client smoke check showed the live dotted guide with Fino and no browser console errors. A separate local contact-sheet render visually inspected every rebuilt uppercase, lowercase and digit guide with no rendering errors.

## 2026-07-31 helper contrast and version follow-up

- Added a deliberately quiet `v1.0.22` label beside the privacy note on the home screen. The service-worker cache version now matches, so installed copies can receive the update.
- Strengthened the dotted guide colour and opacity at all three difficulty levels. The path stays clearly visible on a light board; difficulty still comes from the drawing assessment rather than from hiding the guide.
- Verification: `npm test` passes 50 of 50 and `git diff --check` passes. Local browser screenshots visually confirmed the home-screen version label and a high-contrast dotted guide with Fino; the Playwright smoke run recorded no console errors.

## 2026-07-31 multistage picture shapes follow-up

- Added 16 genuinely different picture tasks to Formen: Baum, Eis, Regenbogen, Auto, Schmetterling, Schnecke, Regenschirm, Pilz, Vogel, Geschenk, Krone, Burg, Zug, Planet, Apfel, and Biene. The shapes bank now has 36 distinct drawings, without size, position, or mirror duplicates.
- Every new picture has at least three simple marks. Fino reveals them in calm two-mark stages; the completed dotted marks remain visible as the next stage appears.
- Added planned per-stroke colours. Picture guides show these colours, and the child's ink uses the same planned colour for the next unfinished path. Responsive reflow keeps colours matched to their shapes.
- Kept the mixed bank at 100 unique tasks while including the expanded shape collection. Bumped the app and offline cache to `v1.0.23`.
- Verification: `npm test` passes 52 of 52; `git diff --check` passes. Browser checks visually confirmed staged and coloured Apple/Car drawings and a finished red-yellow-blue Rainbow, with no console errors. The required Playwright game-client smoke run also completed without console errors.

## 2026-07-31 round controls and one-stroke preview follow-up

- Added previous and next buttons directly beside the round progress. Next skips without marking an exercise as completed; back returns to the prior task. Completed dots remain accurate even if a child revisits a task.
- Replaced the top-right tools with a trash can for clearing everything, a curved undo arrow for the last stroke, and Fino's face for showing the route again.
- Fino now demonstrates precisely one unfinished stroke, then waits. After the child finishes that mark, he previews the next one. Preview speed is 1.5× the previous speed (50% faster), with matching shorter duration bounds.
- Bumped the app and offline cache to `v1.0.24`.
- Verification: `npm test` passes 53 of 53; browser interaction checks confirm skip/back, undo, clear, one-stroke initial preview, and the next-stroke preview after child progress. Both desktop and 390×844 phone screenshots fit the complete header without browser errors. The required game-client smoke run completed without console errors.

## 2026-07-31 undo and next-preview correction

- Undo and clear now cancel any pending automatic completion check before changing the board, so a delayed check cannot race either control.
- After a child completes a mark, the quick completion check runs after 90 ms and Fino starts the next one-stroke preview 50 ms later (previously 260 ms and 180 ms respectively).
- Verified with an actual pointer trace on the four-stroke snail: after the first mark, Fino began previewing stroke two within 170 ms; undo then removed that same pointer stroke and disabled itself on the clean board.
- Bumped the app and offline cache to `v1.0.25`.
- Verification: `npm test` passes 53 of 53 and `git diff --check` passes. The required Playwright game-client smoke run rendered Fino on the guide with no console errors.

## 2026-07-31 solid character-template follow-up

- Letters, numbers, and name exercises now show a broad, semi-transparent handwriting template instead of dotted letter paths. Writing guidelines are quiet solid rules as well. Lines and shapes retain their dotted routes because their staged movement cues remain useful there.
- The visible template, Fino's route, the starting point, jump animation, and scoring all share the same underlying stroke centre lines. The template changes only what children see; the generous evaluation corridor is unchanged.
- Applied the approved lowercase corrections: `l` is upright with a small rightward exit, and `q` has a plain vertical descender. Added a regression test for both forms.
- Bumped the app and offline cache to `v1.0.26`.
- Verification: `npm test` passes 55 of 55. The standard game Playwright client could not start Chromium in this environment (host process error), so the local in-app-browser check was used: it visually confirmed the solid X, q, and corrected l templates with Fino on their centre line and no console errors.

## 2026-07-31 approved image-template correction

- Replaced the thick rendered centre lines that had been posing as character templates. Standard A–Z, a–z, and 0–9 are now transparent masks extracted directly from the approved print reference sheets; paper, grid, and writing guides are removed from the image assets.
- A template is proportionally scaled as an image for each visible character group. It is therefore the actual approved letterform, while Fino, pen input, staged reveals, and scoring keep using a separate centre-line model beneath it.
- Added the three image masks and generated crop map to the offline app shell, plus a regression that verifies all 62 standard glyphs and assets are present. The extraction script is kept in `scripts/` so a later revised reference sheet can be regenerated deterministically.
- Bumped the app and offline cache to `v1.0.27`.
- Verification: `npm test` passes 56 of 56. The required Playwright game-client smoke run completed without errors. Browser visual checks confirmed a reference-image q and 7, with Fino on their independent route and no console errors.

## 2026-07-31 exact stroke-system rebuild

- Replaced the separate hand-authored runtime alphabet with centre lines generated directly from the 62 approved raster templates. The generator skeletonizes each mask, projects reviewed teaching routes onto that skeleton, writes `js/handwriting-stroke-data.js`, and produces a full visual QA contact sheet.
- The template crop and route now share source-pixel bounds. Character placement uses one physical scale in both axes, so letters and digits keep their exact proportions. Narrow and wide letters use measured source geometry for word spacing.
- Replaced the former path-count/average scoring with a symmetric closest-line MSE: template-to-child distance catches unfinished forms, and child-to-template distance catches scribbles. Structural checks work per visible character, scale their tolerance to that character, and inspect longitudinal support for bars, dots, stems, tails, petals, and rays. Stroke order, direction, splitting, and pen lifts do not decide completion.
- Added exhaustive checks for all 62 characters across phone, tablet, portrait, landscape, and all difficulties. The matrix covers coherent offsets and jitter, out-of-band traces, reversed/split strokes, under-half partial forms, added scribbles, missing multi-character groups, and critical small details.
- A final canvas-alignment check found and fixed the zero-width lowercase `i` case: a perfectly vertical centre line now takes its scale from height, so the raster template, Fino, and scoring occupy the same full bounds instead of shrinking the image.
- Final verification: the generator reproduced byte-identical masks, route data, and contact sheet; `npm test` passes 67 of 67 checks. The matrix covers every static/custom/name exercise, every visible group, all 62 characters, four screen shapes, three difficulties, natural shifts/turns/scaling/hand wobble, large missing sections, far-off traces, and added scribbles. The standard browser-game client reached the live canvas, saved two state snapshots and screenshots, and recorded no error artifact; the final screenshot was visually inspected.

## 2026-08-04 mobile polish and new games

- Current request: make the complete app polished and publishable across mobile devices, improve the existing drawing, number, and letter experience, and add two child-friendly games: a solvable labyrinth and a sequential point-connection game where the new line may not touch earlier lines.
- Added 100 deterministic, solvable labyrinths and 100 non-crossing Funkelpunkte paths. Both games have mobile-safe geometry, collision checks that cannot be skipped by a fast pointer movement, progressive hints, undo/reset support, and mixed-round integration.
- Rebuilt the mobile layout down to 280 CSS pixels, including safe areas, 46-pixel controls, compact progress, full-board practice mode, responsive symbol counts, portrait diagonals, landscape rows, and rotation-safe task/ink reflow.
- Rebuilt character recognition around one coherent similarity transform and symmetric nearest-line error. It accepts a child's small shift, turn, scaling and hand wobble, but rejects missing details, large scribbles, different glyphs, mirrored forms and distant traces.
- Rebuilt all 62 Fino routes from the approved raster templates with a topology-aware centre-line graph. Shared intersections no longer send Fino onto the wrong branch; deliberate pen lifts replace unavoidable retracing. The worst template miss is 5.385 source pixels and the route audit finds no abrupt reversal.
- Expanded release coverage to 93 tests, including complete wrong-character/picture matrices, every visible path omission, all four reference viewports, all 200 minigame boards, PWA icon dimensions, offline dependencies and version/cache consistency. `npm test`, JavaScript syntax checks, the route audit and `git diff --check` pass.
- Released locally as `v1.2.1`. A fresh browser automation run was unavailable because the Codex browser quota was exhausted; the earlier successful client-smoke screenshots remain in `qa-mobile-release/client-smoke/` and the final change set contains no browser-only logic changes after the latest automated checks.

## 2026-08-12 minigame delivery fix

- Confirmed that GitHub Pages contained both Labyrinth and Funkelpunkte, but an installed `v1.2.1` service worker could combine the new network-loaded menu with older cache-first JavaScript. In that mixed state the two new activity buttons were visible but could not start their games reliably.
- Moved service-worker registration into the document head, disabled HTTP caching for worker updates, and added a one-time reload when a newer worker takes control of an already installed app. Scripts, styles, workers, and the manifest now use network-first delivery with offline fallback.
- Released as `v1.2.2`. The full 94-test suite and JavaScript syntax checks pass. Browser tests started both games locally without console errors; an actual Funkelpunkte stroke reached point 2 of 6. The standard game client also selected and rendered both new activities without errors. The optional Python smoke runner remains unavailable because Python Playwright is not installed.

## 2026-08-12 harder games and fixed iPad page

- Added a fourth generator tier. Easy games use tier 1, medium games now use only tiers 2–3, and hard games use the new tier 4. Hard labyrinths grow to as much as 12×9 cells and have route lengths strictly above every tier-3 route.
- Funkelpunkte now separates 5–6, 8–10, 12–14, and 17–20-point tiers. The two upper tiers wind inward so later segments run close to older lines; hard mode also uses a slightly wider no-touch clearance.
- Enlarged the visible numbered circles and expanded their invisible touch area. A browser finger test started a new stroke at the outside of the visible ring and reached point 3 of 17 without a false error.
- Standardized the practice page at the iPad-tuned 900:620 ratio. It scales without changing shape on every device. Portrait phones show a quiet rotate suggestion in the spare space; landscape phones move exit, progress, navigation, erase, undo, and Fino into a right-side rail so the board can use the full screen height.
- Browser QA confirmed a 990×682 iPad board, a 537×370 landscape-phone board with all controls at the side, and a 376×259 portrait-phone board with the rotate suggestion. All measured ratios were 900:620, there was no page overflow, and no console errors were recorded. The standard game client was attempted as required but its bundled headless Chromium exited at launch on this host; the connected browser supplied the full interaction and screenshot checks instead.
- Prepared release `v1.3.0` with expanded generator, layout, difficulty, target-size, and interaction regression coverage.

## 2026-08-12 Funkelpunkte corridor difficulty

- Reworked Funkelpunkte difficulty so it is no longer mainly a point-count ladder. Medium, hard, and very hard layouts first create blocking lines, then deliberately place later numbered targets behind those lines.
- The child must guide the new line around an endpoint or through an open corridor. The straight shortcut is rejected because it touches an older line, while every generated task has a verified safe route. Difficulty tiers guarantee at least one, two, or four such detours.
- Fino now previews the actual safe route for the current point instead of pointing straight through a blocking line. The task snapshot reports whether the current target needs a detour, which makes this behavior testable.
- Reduced the upper point counts to 8, 9–11, and 12–14 so the challenge comes from spatial planning rather than repetitive length. The visible circles and forgiving touch targets remain large.
- Prepared release `v1.3.1`. The full test suite passes. A real pointer playtest drew the first barrier, rejected a straight line to the hidden target with the correct feedback, displayed Fino inside the corridor, and accepted the safe bent route. The standard game client also rendered a live canvas without console errors.

## 2026-08-12 mobile fullscreen, forgiving recognition, and visual QA

- Added a fullscreen button to the practice toolbar, including enter/exit icons, `f` keyboard support, browser fullscreen, optional landscape orientation lock, prefixed Safari support, and a useful standalone-mode hint for older iPhones without the element fullscreen API. The button stays available in the compact landscape side rail.
- Recalibrated recognition around a visibly wider child drawing band. Easy mode now accepts larger coherent shifts, rotation, scale differences, and hand wobble while still requiring the recognisable parts of every character or picture. Medium and hard remain progressively tighter. A gentle completion is offered after two close attempts instead of three.
- Rebuilt whole-name layout as one typographic line. All letters now use one physical source scale with shared cap line, x-height, baseline, ascenders, and descenders. Responsive reflow transforms the entire word together, and the full transparent name template is visible from the start while Fino remains staged one letter at a time.
- Ran a visual catalogue review over all 36 shapes/pictures plus representative digits, letters, and names. Found and removed a renderer bug that rounded every finished child stroke, which had distorted squares, triangles, polygons, houses, vehicles, crowns, and castles. Refined the arrow, leafy tree, and butterfly silhouettes.
- Added a reusable visual catalogue at `qa-visual-2026-08-12/catalog.html`. Phone portrait, phone landscape, home, every activity, full-name writing, the fullscreen control, and the compact side rail were checked in the browser without console errors.
- Prepared release `v1.3.2`. The expanded full test suite, JavaScript syntax checks, diff checks, and the required game-client canvas run pass; its final screenshot and text state were inspected.

## 2026-08-12 mobile black-canvas fix

- Changed the accelerated drawing canvas from transparent to opaque and painted a warm-white paper background into every frame. This prevents mobile Safari, fullscreen, and dark-mode compositors from showing the board as black.
- Added a matching CSS fallback and an explicit light color-scheme declaration. Prepared release `v1.3.3` with a regression check for all three safeguards.

## 2026-08-12 landscape-phone and labyrinth fix

- Reworked the compact landscape menu so activity icons and labels stay inside their cards down to a 667×375 phone. Number and letter samples no longer wrap into the label, and very narrow layouts use smaller two-line labels where needed.
- Restored exact centring for the practice back arrow after the toolbar changes into a landscape side rail.
- Split the labyrinth into cached background and wall layers. Static gradients, dots, shadows, and wall geometry are built once per task/size instead of once per pointer move, and the cached art is capped at 2× resolution to reduce memory bandwidth on 3× mobile screens.
- A real 82-point phone drag completed an easy labyrinth in about 90 ms without console warnings or visible flicker. Prepared release `v1.3.4`.
