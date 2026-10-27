# Offline ink models — 27 October 2026

These are newly trained compact models, not the pretrained DoodleNet weights.
The application bundles these tensors and its own JavaScript inference code.
No handwriting is sent to a server. No CDN or third-party recognition service
is used at runtime.

## Training data

- **EMNIST ByClass**, by Gregory Cohen, Saeed Afshar, Jonathan Tapson and
  André van Schaik, derived from NIST Special Database 19. Numbers use all ten
  digits; letters use all 26 uppercase letters. The in-game choices are 1–4
  or A–D, and other predicted classes can be rejected.
  Source: https://www.nist.gov/itl/products-and-services/emnist-dataset
  Citation: Cohen et al. (2017), *EMNIST: an extension of MNIST to handwritten
  letters*, https://arxiv.org/abs/1702.05373
  NIST terms: https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications
- **The Quick, Draw! Dataset**, Google Creative Lab and Quick, Draw! players,
  distributed under **Creative Commons Attribution 4.0 International**.
  Source: https://github.com/googlecreativelab/quickdraw-dataset
  License: https://creativecommons.org/licenses/by/4.0/
  Modifications: selected recognized drawings, converted strokes to normalized
  images, added rotation/slant/size/thickness augmentation, and trained a small
  classifier on circle, triangle, square, star and an additional other class.

EMNIST images were cropped and proportionally resized. Letter training also
uses skeleton-derived pen-style renderings from the source training partition.
The source datasets and their notices are not relicensed by this file.
Data citations do not imply endorsement by NIST, Google or the original authors.

## Intended use and limits

Recognising a complete freehand Kidoku entry, independently of the puzzle's
solution. The letter model targets uppercase A–D, matching the displayed tasks.
These models were evaluated on public data, not on a representative sample of
children aged 5–8. Dataset recognition labels do not establish educational
correctness. Small geometric checks and close reference-template matches
complement the models. See `scripts/ink-models/README.md` and the benchmark
report for results, candidate comparisons and reproduction instructions.
