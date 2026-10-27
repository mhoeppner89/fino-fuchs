# Kidoku offline handwriting recognition

## Selection and measured results

The shipped candidate combines small public-data CNNs with a high-confidence
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

## Reproduce

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
