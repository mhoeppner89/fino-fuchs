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
