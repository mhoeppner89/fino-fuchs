# Kidoku offline handwriting recognition

## Current letter update: v1.3.55

The letter model now has three convolution layers (24/48/48 channels) and a
128-unit hidden layer. It is trained on the same 86,268 unique source-training
images, mixing scanned images with pen-style renderings and augmentation.
Recognition averages thin and ordinary-width local views. No network service
or additional inference library is used. Total bundled weights are 1,972,324
bytes; number and shape tensors and policies are unchanged.

On **3,200 fresh audit examples**, excluded from the earlier exploratory and
final audits, the complete JavaScript recognizer gives:

| Result | v1.3.54 | v1.3.55 |
|---|---:|---:|
| Correctly recognised A–D (1,000 examples) | 82.5% | **93.1%** |
| Wrong A–D substitutions | 11 | **5** |
| Unrelated letters rejected (2,200 examples) | 98.77% | **98.91%** |

The old version's published 80.0% score came from a different audit. The
82.5% and 93.1% figures above compare both versions on the **same fresh inputs**.
These remain public-data scores, not measured accuracy for children aged 5–8.

The B/D completion check now examines loops in the combined ink image rather
than requiring the endpoints of individual pen movements to meet. It retains
checks for open/mirrored forms and missing A crossbars. This recovers valid
serif and fragmented-stroke forms without depending on pen order or lifts.

On 9,586 source-training validation images, the selected policy raises target
recall from 80.48% to 92.63%, raises unrelated-letter rejection from 98.82% to
99.10%, and reduces wrong A–D substitutions from 9 to 4. A single-width
candidate reached 92.05% recall; the two-view version was selected before the
fresh audit. The full report is `letter-improvement-report.json`, including the
training log, selected policy, ID-list hash, weights hash and measured runtime.

## v1.3.54 selection and results (historical baseline)

The v1.3.54 candidate combines small public-data CNNs with a high-confidence
template backstop and a few completion checks. The original recognizer remains
frozen in `legacy-recognizer.js` for reproducible comparisons; the ordinary
tracing evaluator is unchanged.

The audit contains **9,920 public-data examples**, excluded from training and
from the earlier exploratory comparison. `benchmark-report.json` records counts,
errors, ID-list hashes, training details, latency and the exact weights hash.

| Input | Audit valid / other | Previous: correct valid / reject other | Shipped hybrid: correct valid / reject other |
|---|---:|---:|---:|
| 1–4 | 1,000 / 600 | 56.4% / 87.5% | 96.5% / 96.8% |
| Uppercase A–D | 1,000 / 2,200 | 40.4% / 94.5% | 80.0% / 98.9% |
| Circle, triangle, square, star | 3,500 / 1,620 | 65.4% / 89.1% | 89.2% / 91.2% |

The plain learned classifier has higher public-data recall in some cases
(96.7%, 87.3%, 94.5%). It fails important reference/unfinished-ink regressions,
including the German flagged 1 and incomplete shapes. The hybrid was selected
subject to those gameplay requirements, **not** because it has the highest
standalone image-classification score. It retains all 37 hand-authored examples
and the existing transformed/split/direction/sampling regressions. See the
machine-readable report for the plain classifier's full results.

The existing **DoodleNet** was also evaluated, with its original 345 classes.
We checked the conversion against TensorFlow.js (maximum probability error
about 6e-8) and selected an image extent using separate validation examples.
At the selected extent of 26 pixels it correctly labels 45.7% of the audit
shapes and rejects 99.9% of other drawings. It often names a circular drawing
as a circular object rather than `circle`, so it is not the best fit here.
Its weights are **not** distributed with the game. Its original training IDs
are unavailable, so overlap with its Quick Draw training data cannot be ruled
out; its result is a candidate comparison, not an independent generalization
claim.

Median complete recognition time in the local Node benchmark is approximately
4 ms. Bundled weights occupy 947,428 bytes, plus a small manifest. A checksum
and tensor-shape checks detect incomplete or mismatched files. Browser tests
also exercise pen input, model loading/retry, offline operation and versioned
service-worker caches.

## Data and limitations

- Official EMNIST ByClass archive, with the source train/test partitions kept
  separate. Seeded class sampling keeps up to 4,000 training and 600 test
  images per source class. Digits train on all ten classes; letters train on
  all 26 uppercase classes, matching the game's prompts. A mixed-case
  candidate was tested during exploration and performed worse for this task.
- The letter model is fine-tuned on 25,000 additional **renderings** of existing
  training images, not 25,000 additional independent writers. Its validation
  set similarly includes 5,000 renderings of held-out training-partition images.
- Quick Draw: first 10,000 `recognized=true` examples for each target shape and
  1,800 for each of 12 distractor categories. Each category is split 80/10/10;
  native vectors are rasterized with a consistent pen width. Distractors are
  hexagon, octagon, line, zigzag, squiggle, umbrella, moon, cloud, lightning,
  sun, eye and smiley face.
- The initial exploratory comparison used a deterministic subset of the
  public test partitions. The final audit explicitly excludes those IDs.
  Confidence thresholds use validation data only. Pipeline fixes were driven
  by exploratory data and the existing hand-authored regressions.
- EMNIST has images, not original pen trajectories: its audit strokes are
  reconstructed by skeletonization. The conversion itself loses information.
  Quick Draw uses native vectors, but its prompted/recognized labels are not
  expert judgments of educational completeness.
- **These percentages are not accuracy estimates for children aged 5–8.**
  In particular, handwritten letters remain the weakest group. Real failures
  should be retained as future held-out examples, not used to claim universal
  recognition from the public-data score.

Credits and dataset terms are in `assets/ink-models/NOTICE.md`.

## Reproduce v1.3.54

Training and downloading happen on the developer's machine. Only the resulting
manifest, weights and JavaScript code ship to the browser. No Python, PyTorch,
TensorFlow.js, cloud service or CDN is needed in the installed app.

```sh
python3 -m venv --system-site-packages /tmp/fino-ink-training
/tmp/fino-ink-training/bin/pip install -r scripts/ink-models/requirements.txt
/tmp/fino-ink-training/bin/python scripts/ink-models/prepare.py
/tmp/fino-ink-training/bin/python scripts/ink-models/train.py --mode numbers --epochs 8
/tmp/fino-ink-training/bin/python scripts/ink-models/train.py --mode letters --uppercase --epochs 10
/tmp/fino-ink-training/bin/python scripts/ink-models/train.py --mode letters --uppercase --ink-style --epochs 5
/tmp/fino-ink-training/bin/python scripts/ink-models/train.py --mode symbols --epochs 10
/tmp/fino-ink-training/bin/python scripts/ink-models/train.py --mode export
/tmp/fino-ink-training/bin/python scripts/ink-models/calibrate.py
/tmp/fino-ink-training/bin/python scripts/ink-models/benchmark-data.py --final
node scripts/ink-models/benchmark.mjs --final
/tmp/fino-ink-training/bin/python scripts/ink-models/report.py
```

Default data cache: `/tmp/fino-ink-data`. The benchmark archives and data are
development inputs and are not committed or cached by the app. Training uses
four CPU threads and fixed seeds; numerical differences between PyTorch
versions/platforms can change the exact weights. The committed weights and
their SHA-256 identify the tested artifact.

For DoodleNet, obtain `model.json`, `group1-shard1of1.bin` and `class_names.txt`
from https://github.com/yining1023/doodleNet/tree/master/model-tfjs and store
them in the data cache as `doodlenet.json`, `doodlenet.bin` and
`doodlenet-class-names.txt`. Convert the newline-separated names to the JSON
array `doodlenet-labels.json`. `doodlenet.py --final --extent 26` then evaluates
the unmodified weights locally before `report.py`. Its source model and
preprocessing are documented in that repository's `train/doodleNet.py`.

## Reproduce the letter improvement

Run data preparation as above. Preserve the published v1.3.54 assets as the
baseline (the commit is fixed, so the comparison does not change later):

```sh
mkdir -p /tmp/fino-letter-v154
git show 6eaaaeb:assets/ink-models/models.json > /tmp/fino-letter-v154/models.json
git show 6eaaaeb:assets/ink-models/weights.bin > /tmp/fino-letter-v154/weights.bin
/tmp/fino-ink-training/bin/python scripts/ink-models/letter-validation.py
node scripts/ink-models/letter-inputs.mjs
/tmp/fino-ink-training/bin/python scripts/ink-models/letters-v2.py --epochs 12
/tmp/fino-ink-training/bin/python scripts/ink-models/export-letters-v2.py
/tmp/fino-ink-training/bin/python scripts/ink-models/score-letters-v2.py
node scripts/ink-models/select-letter-policy.mjs
node scripts/ink-models/letter-inputs.mjs --thin
/tmp/fino-ink-training/bin/python scripts/ink-models/score-letters-v2.py --thin
node scripts/ink-models/select-letter-policy.mjs --ensemble
```

The selected candidate is exported to `/tmp/fino-ink-data/letters-v2-export/`.
The ensemble only replaces the single-view policy if its validation recall is
higher at the required rejection/error limits. Copy the selected manifest and
weights to `assets/ink-models/`, then freeze the pipeline before auditing:

```sh
/tmp/fino-ink-training/bin/python scripts/ink-models/letter-validation.py --audit
node scripts/ink-models/letter-inputs.mjs --audit
node scripts/ink-models/evaluate-letter-audit.mjs
```

The audit input preparation records v1.3.54 predictions. The final audit uses
the actual production JavaScript path, including both views and completion
checks. Do not use these audit results to select new thresholds. Future model
development should reserve further data or collect independent child examples.

## Per-character improvement (v1.3.56)

The target set is Kidoku's twelve choices: uppercase A–D, 1–4, circle,
triangle, square and five-point star. A result is correct only when the runtime
returns the labeled value. Rejections of valid drawings count as errors, as do
substitutions. Other inputs must remain rejectable; the four target scores are
never renormalized to force a choice, and the Sudoku solution is not an input.

The final artifacts passed the 185-test full suite followed by 20 focused
recognition checks. Ten final browser entries include the tilted, footless 1.
With Chrome slowed to 4× CPU, offline recognition p95 was 79.3 ms for letters,
40.4 ms for numbers and 42.9 ms for symbols; this is a desktop simulation, not
a phone measurement.

The new models have three convolution layers (24/48/48 channels), a 128-unit
hidden layer and four targets plus an explicit `other` output. The selected
letter recognizer averages a specialized A–D model and the existing 26-capital
model, using one local pen-width view of each. Its out-of-set probabilities
are pooled into `other`. This takes two predictions, as did v1.3.55's two-width
letter model. The selected digit and shape models use one prediction. The model bundle is
5,343,140 bytes and has no browser library, CDN or recognition-service dependency.

Training now includes more EMNIST source-training examples, native stylus input
from UJI Pen Characters v2, and a larger Quick Draw training partition. UJI's
40 training writers are split into 30 for training and 10 for validation; its
20 official test writers are separate. No source test image or test-writer
trajectory is used to fit weights. Training also varies slant, proportions,
pen width and pen-style renderings. Generated flagged-1 forms cover the common
German form without a foot. The broadest flag reference was rejected because
it could accept a rotated 7.

Geometric completion checks now recognize closure across a starting segment,
measure gaps relative to ink length, and require at least five outer tips for
a star. This prevents an internal crossing alone from completing a star.
Close template matches can rescue ordinary handwriting. A looser shape match
requires supporting neural evidence and still passes the completion checks.
A larger shape model trained on generated incomplete outlines was tried and
rejected: it became too strict on rough but recognizable drawings.

### Evaluation protocol and limits

The final fresh benchmark contains **36,155** drawings. Every target exceeds
95% observed correct recognition:

| Choice | Correct / tested | Accuracy |
|---|---:|---:|
| A | 483 / 502 | 96.22% |
| B | 86 / 88 | 97.73% |
| C | 526 / 540 | 97.41% |
| D | 209 / 219 | 95.43% |
| 1 | 979 / 1000 | 97.90% |
| 2 | 970 / 1000 | 97.00% |
| 3 | 970 / 1000 | 97.00% |
| 4 | 982 / 1000 | 98.20% |
| circle | 4813 / 5000 | 96.26% |
| triangle | 4804 / 5000 | 96.08% |
| square | 4801 / 5000 | 96.02% |
| star | 4797 / 5000 | 95.94% |

Unrelated-input rejection is 96.59% for letters, 97.75% for numbers and
95.60% for symbols. These results include rejected valid drawings as errors.


`per-character-report.json` contains counts, per-character scores, rejection
rates, artifact hashes and source breakdowns. Read those counts rather than
an average across the twelve targets. The production JavaScript rasterizer,
network and decoder are used for audits. PyTorch/JavaScript parity is checked
separately. Hand-authored tests cover direction, pen lifts, slant, wobble,
unfinished drawings and out-of-set input.

Earlier audits are development data now, not reusable untouched test sets.
For this round, the letter audit reserves EMNIST test IDs outside every earlier
600-per-class corpus, plus UJI's official test writers. Quick Draw reserves
5,000 new examples of each target and 7,200 new unrelated drawings. The initial
digit audit exposed an overly strict cutoff; validation then selected a better
balance between per-digit recall and unrelated-input rejection. Subsequent
EMNIST confirmation sets exclude every prior audit ID. The native-pen digit
results are explicitly marked diagnostic after their first use.

Public-data recognition is **not measured accuracy for children aged 5–8**.
EMNIST trajectories are reconstructed from images, which loses information.
Quick Draw's recognition labels include some incomplete drawings. UJI includes
unusual cursive forms: three cursive A examples remain rejected, producing
37/40 for A in that small native-pen subset, despite the combined A audit being
above 95%. Those failures remain in the report. Different source strata must
not be hidden by the larger image dataset.

### Reproduction

Use the existing requirements and `/tmp/fino-ink-data` preparation above.
Development data for this round are kept in `/tmp/fino-ink-v3`, outside the app.
The scripts use fixed seeds; the committed tensors and SHA-256 identify the
exact tested artifact. PyTorch/platform differences can still change training.

1. Prepare the previous letter backbone with `letters-v2.py` and preserve the
   v1.3.55 manifest/weights as `v155-models.json` and `v155-weights.bin` in the new
   cache. The frozen v1.3.55 decision path and templates are in this directory.
2. Run `uji-data.py`, `expand-shapes.py`, `prepare-full-chars.py` and
   `prepare-v3-validation.py`. The original EMNIST archives remain in the
   earlier cache. Only the first two scripts download data.
3. Run `train-chars-v3.py --mode letters`, `train-chars-v3.py --mode numbers`,
   and `train-shapes-v3.py`. Preserve the selected initial shape checkpoint
   as `symbols-v3-epoch7.pt` before further training.
4. Run `refine-v3.py --mode numbers` and `refine-v3.py --mode symbols`, followed
   by `refine-flags.py --prepare-only`, `paired-flags.py` and
   `refine-flags.py --paired --start 9 --first 19 --epochs 4`. Checkpoint numbers identify stages, not a single
   uninterrupted training run. The rejected incomplete-outline experiment is
   reproducible with `partial-shapes.py` and `refine-partial-shapes.py`.
5. Run `prepare-v3-known.mjs`, then `v3-inputs.mjs MODE validation` and
   `v3-inputs.mjs MODE known`. `score-v3.py --mode MODE --epoch N` generates
   validation probabilities; add `--split known` for existing regressions.
   `calibrate-v3.mjs MODE N` selects cutoffs using those development inputs.
   `MIN_RECALL` sets the candidate coverage target. Compare the minimum of all
   four recalls and other rejection, requiring every known regression to pass.
6. `score-letter-baseline.py` scores the existing 26-capital model. Letter
   `mix-letter-v3.mjs` builds candidate 508 as the equal average of checkpoint 8's normal view and the
   old model's thin view. Its policy is selected using the same validation
   rows. This composition is encoded explicitly by `export-v3.py --letters 508`.
7. The selected checkpoints are letters 508, numbers 21 and symbols 12.
   Export with `export-v3.py --letters 508 --numbers 21 --symbols 12`; copy the manifest,
   weights and generated parity fixture from the export directory. Freeze the
   candidate before `prepare-v3-audit.py` / `prepare-number-confirmation.py`.
   `audit-v3.mjs MODE FROZEN_FOLDER` runs the actual runtime. `AUDIT_PARTS` and
   `AUDIT_PART` divide an audit without changing samples; `merge-v3-audit.mjs`
   verifies complete ID coverage before merging counts. Never use audit scores
   to select thresholds and still describe that audit as untouched.

Only `assets/ink-models/` and the JavaScript inference modules ship. None of the
source datasets, generated training examples or Python tooling are needed by
an installed offline app.
