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

## 2026-08-12 fullscreen completion and rotate action

- Rebuilt the completed-round card as a short two-column landscape layout. At 667×375, the complete card, Fino, summary, and both buttons fit in the fullscreen viewport without scrolling.
- Turned the portrait rotate suggestion into one large accessible button covering the spare area. It pulses subtly, respects reduced-motion settings, and launches the same fullscreen plus orientation-lock flow as the toolbar control.
- Prepared release `v1.3.5` with regression checks for the interactive rotate prompt and compact finish layout.

## 2026-08-12 Funkelpunkte phone performance and tolerance

- Cached the purple Funkelpunkte paper and dot texture at a mobile-friendly resolution, so they are no longer rebuilt on every pointer movement. Slightly coarser pen sampling also reduces growing-stroke redraw cost without allowing a fast line to cross an old trail.
- Matched the collision-free start area to the full forgiving number target. A child can now begin near the number ring without immediately colliding with the line that ends at that number.
- Added a separate Funkelpunkte ink scale: about 7 px on a landscape phone instead of the former 11 px, with a smaller white halo. Hard phone grids use wider physical cells while retaining four required behind-the-line route challenges.
- Verified all 100 hard phone layouts retain their task count and detours. A real phone playtest accepted an edge-of-ring start, advanced through two segments without warnings, and processed the second 35-point drag in about 35 ms. Prepared release `v1.3.6`.

## 2026-08-12 Safari drawing stability

- Prevented Safari/WebKit pointer spikes by ignoring its unreliable coalesced sample list and using the dispatched pointer event in timestamp order.
- Child ink now keeps straight segments but uses safe round joins; all mitered guide paths have a finite limit so nearly straight points cannot create long visual spikes.
- Reduced Safari canvas work with a 2x device-pixel-ratio ceiling and disabled its unstable desynchronized canvas mode. Other browsers retain their existing higher-resolution path.
- Added focused regression tests for Safari samples, joins, canvas settings, and the versioned offline release. Prepared release `v1.3.7`.
- Verification: the complete `npm test` suite, focused 36-test drawing/release run, JavaScript syntax check, and `git diff --check` pass. A landscape-phone browser drag with many sharp turns rendered without spikes and produced no console warnings or errors.

## 2026-08-12 Funkelpunkte iPad corridor tolerance

- Separated route-building clearance from collision judging. Generated corridors retain a wide safety margin, while the live warning now fires only for a visible overlap instead of harmless finger wobble near an old line.
- Fixed the anchor exemption so a wider planning margin cannot silently enlarge the collision-free start circle. Portrait phone challenge grids now follow the screen orientation and retain every required point and detour.
- Verified all 100 layouts at seven phone/tablet sizes, all difficulty tiers, intended routes, true crossings, and required hard detours. A 1024×768 iPad playtest completed a deliberately wobbly stroke through the narrow space beside an old line without warnings or console errors. Prepared release `v1.3.8`.

## 2026-08-13 pen-following Fino for letters and numbers

- Removed every automatic and button-triggered stroke preview from letter and number exercises because children can use different valid stroke orders.
- Fino now enters from the nearest side when the first stroke begins, follows the moving pen, waits at the lifted endpoint, and jumps to the child's next stroke. The fox button is an accessible on/off toggle in these two activities; other activities keep their existing preview button.
- Verified a two-stroke lowercase `t` end to end, including waiting and the second-stroke jump; toggled Fino off and back on for `U`; and confirmed a number `3` opens with no preview. No browser errors occurred. Prepared release `v1.3.9`.

## 2026-08-13 start-marker removal

- Removed the green prescribed starting dot from all tracing activities. Labyrinth and Funkelpunkte retain their own game-specific start targets. Stroke routes, Fino behavior, and evaluation are unchanged. A visual line exercise confirmed the guide renders without the marker. Prepared release `v1.3.10`.

## 2026-08-13 iPad gesture and selection lock

- Fixed the practice page in place and disabled overscroll, native touch movement, pinch gestures, selection, callouts, and dragging across the complete drawing surface. This supplements `touch-action: none` for Safari and Apple Pencil cases where CSS alone was insufficient.
- Safari pointer cancellation now keeps a meaningful partial tracing stroke instead of silently deleting it. Game strokes retain their stricter existing cancellation rules.
- Removed the canvas focus outline and added regression checks for the event-level and CSS gesture guards. An iPad-sized edge-to-edge drag kept both scroll axes at zero, created no selection, retained the stroke, and logged no browser warnings or errors. Prepared release `v1.3.11`.

## 2026-08-13 remaining green-dot removal

- Confirmed the prescribed green canvas start marker is absent from the live renderer, then removed the remaining green circular state from the round progress indicator as well. Completed tasks now use blue, so ordinary tracing screens no longer contain a green dot outside picture artwork.
- Added explicit `v1.3.12` asset URLs for the stylesheet and main module. This gives Safari a new resource URL and prevents an older cached marker build from being reused after deployment.

## 2026-08-14 Safari fullscreen drawing lock

- Moved the drawing-surface touch and gesture guard to a capture-phase window listener, so iPad Safari cannot hand an edge gesture to fullscreen navigation before the canvas sees it. The practice state now also locks touch action, scrolling, selection, and callouts on the root fullscreen element.
- Added a same-page history guard while a round is active. An accidental Safari back swipe stays in the app and opens the existing exit confirmation instead of closing the site.
- Backgrounding or interrupting Safari now finishes and keeps an active tracing stroke instead of deleting it. Prepared release `v1.3.13`.
- Verified the actual fullscreen button path: root and body stayed at position zero with scrolling and touch action locked, an edge-to-edge stroke remained visible and undoable, and backward navigation kept the same URL and opened the exit confirmation. No browser warnings or errors were logged.

## 2026-08-25 Schulschrift font switch

- Replaced the letter and number source font with the approved Schulschrift sheet (`SCHULSCHRIFT.png`, black ink in the alpha channel). New script `scripts/extract_schulschrift_glyphs.py` segments the sheet into all 62 exercisable characters (A-Z, a-z, 0-9; the "10" cell donates the 0) and lays them onto uniform white reference sheets `uppercase-v2.png`, `lowercase-v3.png`, `digits-v2.png`. Umlauts stay derived from the base letters, ß is normalised to "ss" in names, so those pair cells are intentionally skipped.
- Rewrote the stroke-route hints in `scripts/extract_handwriting_templates.py` as a direct transcription of the approved `schreib_anleitung.md`: stroke counts, directions, closed pen motions (O, o, 0, bowls), the figure eight in one stroke, the crossed 7 as two strokes, the two-stroke 9, and the retrace moves ("auf derselben Linie wieder hoch") for h, m, n, r, u.
- Extended the centre-line extractor: teaching strokes now chain through every hint waypoint (this is what keeps retraces on the centre line), chaining may cross shared junctions and bridge detached entry ticks (l) instead of falling back to a straight line, short raster spikes still collapse while waypoint tips and long retraces are protected, and detached raster specks no longer count against the route error. All 62 characters now cover their template within 8 px; worst miss 7.7 px (l).
- Name layout now derives its line model from the sheet itself: per-character crop-top-to-baseline offsets place every letter on one shared baseline, and each glyph's ink is centred inside its advance slot so a narrow I keeps even gaps. Umlaut dots shift the design top by their own rise.
- Recalibrated the test suite to the new font: construction tests assert the Schreibanleitung (one-stroke M/N/Z/W, two-stroke 7/9, tick starts on l and M, retraces on r/u), the double-back rule allows tip turns and true retraces, name baselines are measured scale-free via the exported baseline offsets, and the cross-replacement pool asserts the school-script lowercase pairs and G/Q/O at hard, where all of them separate. `npm test` passes 116 of 116 tests. Prepared release `v1.3.14`.

## 2026-08-26 Fino next-stroke preview for letters and numbers

- Letters and numbers use pen-following Fino, which never showed where the next stroke begins: on a fresh task no Fino was visible at all, and between strokes it stayed at the end of the previous stroke. With the old print font the next stroke usually began right there, so the gap was invisible; the Schulschrift entry ticks made it obvious.
- Pen-following Fino now waits on the centre line of the next stroke to take (same 7% waiting spot the shape previews use), and after each finished stroke it jumps from the stroke end to that waiting point. An unfinished stroke keeps Fino at its own start, so "again from here" is shown naturally.
- Fixed the local-test staleness trap underneath it: the service worker's install and script fetches now use `cache: "reload"`, so unversioned modules (drawing.js & co.) can no longer be served heuristically stale from the browser HTTP cache after a deployment. Prepared release `v1.3.15`.
- Verified in the browser: fresh A shows Fino at the baseline start of the first stroke; after tracing the legs Fino jumps to the crossbar start. `npm test` passes 116 of 116 tests.

## 2026-08-26 Fino runs the next stroke and per-stroke recognition

- Fino now demonstrates the next unfinished stroke by running its path in every tracing activity, including Zahlen, Buchstaben, and Mein Name — not only Linien and Formen. Letters and numbers keep their pen-following behaviour while the child draws; the fox button is the same "Fino zeigt die Spur" preview button everywhere and no longer doubles as an on/off toggle.
- Between strokes Fino jumps to the start of the next stroke and the preview begins at exactly that point, so the jump and the demo no longer snap apart. Pen-split and merged strokes stay accepted as progress.
- Recognition now works stroke by stroke: after each completed stroke the app judges only that stroke against the guide routes with the same child-friendly band. A stroke that matches no route (wrong letter, mirrored, far off, or a scribble) flashes the guide and says "Fast! Versuch es noch einmal." instead of silently waiting for the whole task; the whole-task completion check is unchanged.
- Prepared release `v1.3.16`. `npm test` passes 121 of 121 tests; browser checks confirmed the demo runs on a fresh letter, number, and name task, the next-stroke demo starts after an accepted stroke, and a wrong-place stroke is rejected with the guide flash and toast.

## 2026-08-26 constant preview speed, smooth Fino turns, two-stroke 5

- Fino's stroke preview now runs at one constant speed regardless of how long the path is: a short crossbar takes proportionally less time than a long belly (previously the duration was clamped between 600 ms and 3067 ms, so short strokes crawled and long strokes sped up). Only a single-point mark (a dot) keeps a short readable pause because it has no path length. Exported `demoRunDuration()` with a constant-speed regression test.
- Fino's heading now eases toward the guide direction at a fixed turn rate (4.5 rad/s) instead of snapping between frames. This removes the per-frame direction twitch caused by pixel-level waypoint zigzag in the generated centre lines while still following genuine corners like the letter entry ticks.
- Number 5 is now taught as two strokes per request: first from top left down the stem and around the belly, then the top bar from left to right. Updated the route hint in `scripts/extract_handwriting_templates.py` and regenerated the centre lines (route error stays at 1 px); updated the `schreib_anleitung.md` row and added a construction regression test.
- Also fixed the extractor so it runs with the installed Pillow: `get_flattened_data()` is a non-standard API and was replaced with the equivalent `Image.getdata()`.
- Prepared release `v1.3.17`. `npm test` passes 123 of 123 tests; browser checks confirmed the 5 renders two strokes with Fino demoing the belly first and the top bar second at constant speed, and the sampled demo angle turns smoothly at the configured rate.

## 2026-08-26 four-times-faster Fino, straighter routes, 8 and 0 start at the top

- Fino's preview speed was raised fourfold (`DEMO_SPEED_MULTIPLIER` 1.5 → 6.0); the constant-speed rule itself is unchanged.
- Audited every character's centre line against `schreib_anleitung.md` and fixed the generator, not just the data:
  - The 3's waist no longer wiggles: the redundant outer waypoint was removed from its hint, so Fino dips once into the middle ("zur Mitte zurück") and continues instead of oscillating at the skeleton's Y-fork.
  - The f's neck hint was misplaced (it projected onto the crossbar), pulling the body route 6 px onto the crossbar and back; corrected to the actual neck position.
  - The O (and every closed loop) now runs in the reviewed direction: `ordered_euler_trail` matches the first movement to the hint like `hinted_cycle` already did, so the O starts at its upper-right entry and goes counterclockwise instead of clockwise.
  - Closed hints with more than seven waypoints are no longer treated as simple loops, which lets the figure eight chain through every waypoint.
  - 8 now starts at the top: down the left side of the upper loop (counterclockwise), through the crossing into the lower loop (clockwise), and back up the right side to close at the top. 0 starts at the top and runs counterclockwise. Both `schreib_anleitung.md` rows were updated and construction regression tests added.
- Prepared release `v1.3.18`. `npm test` passes 124 of 124 tests; the spike scan now reports only genuine corners and taught retraces (h/m/n/r/u, W/w valleys, B stem return, 1 flag).

## 2026-08-26 fox jump origin, 8 crossing, full glyph audit

- Fino now jumps from his actual on-screen position: his resting spot is tracked (`foxPosition`) at the demo end, at the next-stroke wait point, and while following the pen, and every jump (child pen-down, next-stroke hop) starts from there. He no longer appears from the board edge or from the child's last pen point ("he already waits at the bottom left of an A, then appears from the side").
- The 8's crossing no longer twitches: the hint waypoint at the figure-eight crossing protected a small out-and-back nub (the route dipped ~4 px into the lower loop and immediately returned). `remove_reversal_spurs` now removes tight protected reversals (both legs under 5 px) while still keeping genuine waypoint corners (the 3's waist at ~6-7 px legs, W peaks, the 1 flag). Regenerated stroke data; template-alignment errors unchanged.
- Full audit of all 62 glyphs against `schreib_anleitung.md`: stroke counts and start/end directions all match (A-Z, a-z, umlauts, ß, 0-9); the only route defect found was the 8 crossing. The previously reported "u" screenshot is the taught hook retrace ("auf derselben Linie wieder hoch") — correct per the document.
- Added regression tests: 8 crossing without a short reversal, and the jump origin starts from Fino's current position. `npm test` passes 125 of 125 tests. Prepared release `v1.3.19`.

## 2026-08-26 smooth Fino's heading: remove raster stair-stepping

- Root cause of the persistent "Fino twitches, especially at intersections": the route centre lines were raster-staircased. Each route point was snapped to a skeleton pixel, so long diagonals and curved loops alternated direction every few pixels; Fino's heading follows route direction, so he wobbled back and forth even though his position looked fine. Numbers and letters both exhibited it (m/o/w/y/v/p/s/e at 13-25 turns, the 8 at 30).
- The fix is in the extractor, not the renderer: `smooth_route` applies a centred moving average to every route and clamps each point to a 3 px budget from its original position. A corner guard (cosine < 0.75) keeps genuine corners exactly — the M valley, W apex, 3's waist, letter entry ticks, and retrace turnarounds (h/m/n/r/u) — so shapes don't round off. Endpoints never move, so the jump and wait positions stay exact. Regenerated all 62 glyphs; template-alignment errors are unchanged from baseline and `maximumRouteError` is identical, confirming shape fidelity.
- Measured effect on the fox's eased heading: high-frequency per-glyph wobble peaks dropped ~2-3× on the worst offenders (d 1.93→0.75 rad, 9 1.82→0.63, B 1.33→0.44, Q 1.30→0.41) and the staircase reversal count fell 24%. Verified live in the browser: sampling the demo fox through a letter run stays flat at ≤0.02 rad/frame (~1.2°/frame) with no snapping.
- All 125 tests still pass (recognition, stroke order/direction, robustness on all 62 characters). Regenerated the QA contact sheet. Prepared release `v1.3.20`.

## 2026-08-26 correct the Schreibanleitung: one-stroke a/d/p/q, three-stroke k/K

- The Schreibanleitung taught the wrong stroke counts. Corrected in `schreib_anleitung.md`: small a, d, p and q are now one continuous stroke (the round body runs without lifting into the stem or tail), and k/K are three strokes (stem; upper diagonal; lower diagonal). ä follows from a (now 3 strokes total with its two dots).
- The route hints in `scripts/extract_handwriting_templates.py` were updated and the stroke data regenerated. a/d/p/q keep separate round-body and stem/tail hints (their junction confuses the waypoint follower), and `main()` joins the two extracted routes afterwards — dropping the closed loop's redundant return point so Fino does not do a tiny loop at the junction. The taught retraces (the d/p stem, the q tail) run on the centre line. The k/K diagonals are anchored at the stem, which also cut their route error (k 3.16→1.64 px, K 2.0→1.41 px).
- The one-stroke a exposed a real recognition hole: a drawn as one pen motion passed as a u at hard (the a's closed round body covers the open U, and the extra top arch was within the old precision band). The hard identity precision threshold was tightened 0.83→0.87 so extra ink beyond the template is rejected; true positives all sit at 1.000, and the full confusion matrix is clean again.
- Updated the construction tests (a is one stroke; q's descender is the tail of its single stroke; missing b stem / g tail replace the old p/q detail cases; ä dots shifted to paths 1-2). `npm test` passes 125 of 125 tests. Prepared release `v1.3.21`.

## 2026-08-26 one-stroke g

- Following the same correction as a/d/p/q, small `g` is now taught as one continuous stroke: the round body runs without lifting into the descender tail. Updated `schreib_anleitung.md` (g was incorrectly listed as 2 strokes) and added `g` to `ONE_STROKE_CHARACTERS` in `scripts/extract_handwriting_templates.py`; the two extracted routes are joined in `main()`, dropping the redundant circle-close point. Regenerated stroke data; `g` now reports `routeCount: 1` with template-alignment error unchanged (2.2 px).
- Removed the stale "g missing detail" completion-regression case (g no longer has a separable tail stroke). `npm test` passes 125 of 125 tests. Prepared release `v1.3.22`.

## 2026-08-26 Eingabefeld „Eigene Buchstaben" zeigt Kleinbuchstaben an

- Bug: Im Hauptmenü zeigte das Eingabefeld „Eigene Buchstaben" eingegebene Kleinbuchstaben nur als Großbuchstaben an, obwohl die tatsächliche Auswahl und die Übungen gemischt klein/groß korrekt waren (die Feld-Ausgabe- und Erkennungs-Pipeline hat bereits beide Fälle unterstützt; z. B. ergab „aBc" korrekt wechselnde 'a'- und 'B'-Aufgaben).
- Ursache: in `styles.css` setzte `.name-field input { text-transform: uppercase; }` alle Eingabefelder mit der Klasse `name-field` visuell auf Großbuchstaben, inklusive des „Eigene-Buchstaben"-Felds (das `name-field custom-set-field` nutzt). Die Ausnahme `.custom-set-field input { text-transform: none; }` verlor, weil beide Selektoren gleiche Spezifität haben und die uppercase-Regel später im Blatt steht.
- Fix: die Ausnahme auf `input#letter-set` spezifischer gemacht, sodass das Buchstabenfeld eingegebene Schreibweise genau anzeigt. Das Namensfeld „Mein Name" (`#child-name`) bleibt wie gewollt groß. `npm test` passes 125 of 125 tests. Prepared release `v1.3.23`.

## 2026-08-26 one-stroke 9

- Following the same correction as a/d/p/q/g, the digit `9` is now taught as one continuous stroke: the small round head runs without lifting into the descender tail that curls left at the bottom. Updated `schreib_anleitung.md` (9 was listed as 2 strokes) and added `9` to `ONE_STROKE_CHARACTERS` in `scripts/extract_handwriting_templates.py`; `main()` joins the two extracted routes, dropping the redundant circle-close point. Regenerated stroke data; `9` now reports `routeCount: 1` with template-alignment error unchanged (3.6 px). The merged route hugs the template (round head up top, tail down to the bottom-left) and the fox heading shows only the taught junction turn.
- Updated the digit construction test (`number-9-gross` is one stroke; its round head closes back toward the start, then the tail descends to the bottom-left). `npm test` passes 125 of 125 tests. Prepared release `v1.3.24`.
