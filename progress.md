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
