# Approved handwriting references

The PNG source sheets define the letterforms. `clean-stroke-paths.json` defines
69 teaching paths in each glyph's **crop pixel coordinates**, before layout.
The source sheets, masks, and crop positions are unchanged.

- `M` starts one pen-down movement, `L` is an exact straight segment, and `C`
  is a cubic Bézier curve. Dots are single `M` points at the source dot centres.
- Shared endpoints close bowls and join branches. Intentional retraces reuse
  the same straight segment. M/W retain their sharp corners; curves have
  matching tangents at smooth joins. `corners` records deliberate curve joins
  where the pen changes direction sharply.
- These paths were drawn and fitted against the approved source images, then
  reviewed in source overlays. They preserve each source's slant, proportions,
  hooks, and separate umlaut geometry. They are not a replacement font.
- Fino, the evaluator, and the calibration recorder all consume the same
  generated `js/handwriting-stroke-data.js`. Curves are sampled finely for
  canvas rendering. Straight segments retain only their endpoints.

Regenerate after editing the canonical paths:

```sh
python3 scripts/extract_handwriting_templates.py
python3 scripts/audit_handwriting_paths.py
npm test
```

Python requires Pillow, NumPy, and SciPy. The audit reads the approved source
images independently, checks their SHA-256 hashes, checks that paths stay in
source ink, and checks smooth curve joins. Skeleton distance is a secondary
fidelity measurement; skeletons **never generate the paths**. Small raster
junction wedges do not become pen detours. Inspect the regenerated
`qa-stroke-system-2026-07-31/all-character-centrelines.png` before release.

`tests/fixtures/reference-traces-v1.3.43.json` freezes the old paths in source
crop pixels. Those independent traces and the reconstructed handwritten A/R
fixtures protect acceptance while the reference geometry changes. Synthetic
hand wobble uses travelled distance, so adding curve samples cannot change a
handwriting test into high-frequency scribbling.
