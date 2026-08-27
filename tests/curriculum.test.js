import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  adaptTaskToViewport,
  baselineOffsets,
  createNameExerciseBank,
  TASKS,
  buildSession,
  createWordTask,
  EXERCISE_BANKS,
  getExerciseBank,
  normalizeName,
  OPTION_SETS,
  reflowTaskWithInk,
  SESSION_SIZE,
  seededRandom,
} from '../js/curriculum.js';
import {
  CHARACTER_TEMPLATE_CROPS,
  CHARACTER_TEMPLATE_SHEETS,
} from '../js/handwriting-template-data.js';
import {
  CHARACTER_STROKES,
  CHARACTER_STROKE_GEOMETRY,
} from '../js/handwriting-stroke-data.js';
import { characterTemplatePlacement } from '../js/drawing.js';

const geometryKey = (task) => JSON.stringify(task.strokes.map((stroke) => stroke.map((point) => [
  Number(point.x.toFixed(5)), Number(point.y.toFixed(5)),
])));

test('every activity has distinct exercises, without repeated shape variants', () => {
  const banks = { ...EXERCISE_BANKS, name: createNameExerciseBank('Käthe') };
  const expectedSizes = { lines: 100, shapes: 36, numbers: 100, letters: 100, maze: 100, connect: 100, mixed: 100, name: 100 };
  Object.entries(banks).forEach(([category, bank]) => {
    assert.equal(bank.length, expectedSizes[category], `${category} bank size`);
    assert.equal(new Set(bank.map((task) => task.id)).size, expectedSizes[category], `${category} IDs`);
    assert.equal(new Set(bank.map(geometryKey)).size, expectedSizes[category], `${category} paths`);
  });
  assert.equal(TASKS.length, 636);
  assert.deepEqual(EXERCISE_BANKS.shapes.map((task) => task.id), [
    'shape-circle', 'shape-oval', 'shape-square', 'shape-triangle', 'shape-cross',
    'shape-diamond', 'shape-heart', 'shape-star', 'shape-rectangle', 'shape-pentagon',
    'shape-hexagon', 'shape-arrow', 'shape-house', 'shape-kite', 'shape-balloon',
    'shape-fish', 'shape-flower', 'shape-sun', 'shape-sailboat', 'shape-rocket',
    'shape-tree', 'shape-ice-cream', 'shape-rainbow', 'shape-car', 'shape-butterfly',
    'shape-snail', 'shape-umbrella', 'shape-mushroom', 'shape-bird', 'shape-present',
    'shape-crown', 'shape-castle', 'shape-train', 'shape-planet', 'shape-apple', 'shape-bee',
  ]);
});

test('new picture shapes are staged and use planned, fitting stroke colours', () => {
  const pictureIds = [
    'shape-tree', 'shape-ice-cream', 'shape-rainbow', 'shape-car', 'shape-butterfly',
    'shape-snail', 'shape-umbrella', 'shape-mushroom', 'shape-bird', 'shape-present',
    'shape-crown', 'shape-castle', 'shape-train', 'shape-planet', 'shape-apple', 'shape-bee',
  ];
  pictureIds.forEach((id) => {
    const task = EXERCISE_BANKS.shapes.find((candidate) => candidate.id === id);
    assert.ok(task, `missing ${id}`);
    assert.ok(task.strokes.length >= 3, `${id} should have several drawing stages`);
    assert.equal(task.strokeColors.length, task.strokes.length, `${id} needs a colour for every stroke`);
    assert.ok(task.strokeColors.every((color) => /^#[0-9A-F]{6}$/i.test(color)), `${id} has an invalid colour`);
  });
  const rainbow = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-rainbow');
  assert.equal(new Set(rainbow.strokeColors).size, 3, 'rainbow arcs should switch colour');
});

test('picture-shape colours remain aligned with their paths after responsive reflow', () => {
  const apple = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-apple');
  [[390, 844], [1180, 680]].forEach(([width, height]) => {
    const fitted = adaptTaskToViewport(apple, { width, height });
    assert.equal(fitted.strokes.length, fitted.strokeColors.length);
    assert.deepEqual(fitted.strokeColors, apple.strokeColors);
    assert.deepEqual(fitted.completionGroups.flat(), fitted.strokes.map((_, index) => index));
  });
});

test('custom number and letter sets retain enough unique exercises for a full round', () => {
  const numbers = getExerciseBank('numbers', { option: '257' });
  const letters = getExerciseBank('letters', { option: 'MARTIN' });
  const lowerCaseLetters = getExerciseBank('letters', { option: 'aä' });
  assert.ok(numbers.length >= SESSION_SIZE);
  assert.ok(letters.length >= SESSION_SIZE);
  assert.ok(numbers.every((task) => /^[257 ]+$/.test(task.label)));
  assert.ok(letters.every((task) => /^[MARTIN ]+$/.test(task.label)));
  assert.ok(lowerCaseLetters.every((task) => /^[aä ]+$/.test(task.label)));
});

test('the number and letter selector consistently says Alle and has spaced custom inputs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.ok(OPTION_SETS.numbers.some((option) => option.value === 'all' && option.label === 'Alle'));
  assert.ok(OPTION_SETS.letters.some((option) => option.value === 'all' && option.label === 'Alle'));
  assert.equal((html.match(/>Alle<\/span>/g) ?? []).length, 2);
  assert.match(styles, /\.custom-set-field\s*\{[^}]*margin-top:\s*15px/s);
  assert.match(html, /id="child-name"[^>]*enterkeyhint="go"/);
  assert.match(html, /id="number-set"[^>]*inputmode="numeric"[^>]*enterkeyhint="done"/);
  assert.doesNotMatch(app, /setTimeout\(\(\) => elements\.childName\.focus/);
  assert.match(app, /if \(custom && focus\) focusForKeyboard\(input\)/);
  assert.match(app, /input\.scrollIntoView\(\{ block: 'center'/);
});

test('practice view keeps only the board and compact top-bar actions', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="mentor-message"/);
  assert.doesNotMatch(html, /id="task-mode"/);
  assert.doesNotMatch(html, /id="task-title"/);
  assert.doesNotMatch(html, /id="reference-chip"/);
  assert.match(html, /id="previous-task-button"[\s\S]*id="progress-dots"[\s\S]*id="next-task-button"/);
  assert.match(html, /class="practice-actions"[\s\S]*id="clear-button"[\s\S]*id="undo-button"[\s\S]*id="show-button"/);
  assert.match(html, /id="show-button"[\s\S]*assets\/fox-face\.svg/);
  assert.match(styles, /\.practice-layout\s*\{\s*display:\s*flex;\s*flex:\s*1 1 auto;/s);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(0, \.75fr\)/);
  assert.match(styles, /@media \(min-width: 300px\) and \(max-width: 340px\)[\s\S]*grid-template-columns:\s*repeat\(6, 46px\)/);
  assert.match(styles, /@media \(max-width: 299px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(styles, /body\s*\{[^}]*min-width:\s*0/s);
  assert.match(app, /visualViewport[\s\S]*addEventListener\('resize', reveal/);
  assert.match(app, /cancelActiveStrokeForResize\(\)/);
  assert.match(app, /practiceScreen\.inert = true/);
});

test('home screen exposes all eight child activities without emoji art', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/class="activity-card/g) ?? []).length, 8);
  ['maze', 'connect'].forEach((category) => assert.match(html, new RegExp(`data-category="${category}"`)));
  assert.match(html, />Labyrinth</);
  assert.match(html, />Funkelpunkte</);
});

test('the home screen shows the current app version discreetly', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  assert.ok(html.includes(`class="app-version" aria-label="App-Version ${packageVersion}">v${packageVersion}</small>`));
  assert.match(styles, /\.app-version\s*\{[^}]*opacity:\s*\.5/s);
});

test('approved reference images supply every standard letter and digit template', () => {
  const expectedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöü0123456789';
  assert.deepEqual(Object.keys(CHARACTER_TEMPLATE_CROPS).sort(), [...expectedCharacters].sort());
  assert.deepEqual(Object.keys(CHARACTER_STROKES).sort(), [...expectedCharacters].sort());
  assert.deepEqual(Object.keys(CHARACTER_STROKE_GEOMETRY).sort(), [...expectedCharacters].sort());
  Object.values(CHARACTER_TEMPLATE_CROPS).forEach((crop) => {
    assert.ok(crop.width > 8 && crop.height > 8, 'template crop must contain a real glyph');
    assert.ok(CHARACTER_TEMPLATE_SHEETS[crop.sheet], `unknown template sheet ${crop.sheet}`);
  });
  ['uppercase-mask.png', 'lowercase-mask.png', 'digits-mask.png'].forEach((file) => {
    assert.equal(existsSync(new URL(`../assets/handwriting-templates/${file}`, import.meta.url)), true, `${file} is missing`);
  });
  Object.entries(CHARACTER_STROKE_GEOMETRY).forEach(([character, geometry]) => {
    assert.ok(CHARACTER_STROKES[character].length > 0, `${character} has no Fino route`);
    // Umlaut bases are the smaller Z-row letters whose thin apexes sit just
    // outside the skeleton's reach; the dot routes are points inside their
    // dots. The Schulschrift M keeps a short wedge where its left bar's apex
    // meets the first diagonal; the taught zigzag walk passes the junction
    // just below that tip. Allow the wider band there, keep the strict one
    // for the standalone letters and digits.
    const errorLimit = 'ÄÖÜäöüM'.includes(character) ? 12 : 8;
    assert.ok(geometry.maximumRouteError <= errorLimit, `${character} misses its template by ${geometry.maximumRouteError}px`);
    assert.ok(geometry.routeWidth > 0 && geometry.routeHeight > 0, `${character} has invalid source bounds`);
    CHARACTER_STROKES[character].forEach((stroke, strokeIndex) => {
      for (let index = 1; index < stroke.length - 1; index += 1) {
        const incoming = {
          x: (stroke[index].x - stroke[index - 1].x) * 900,
          y: (stroke[index].y - stroke[index - 1].y) * 620,
        };
        const outgoing = {
          x: (stroke[index + 1].x - stroke[index].x) * 900,
          y: (stroke[index + 1].y - stroke[index].y) * 620,
        };
        const denominator = Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y);
        if (denominator <= 1) continue;
        const cosine = (incoming.x * outgoing.x + incoming.y * outgoing.y) / denominator;
        if (cosine >= -0.8) continue;
        // The Schreibanleitung legitimately doubles back: retraces ("auf
        // derselben Linie wieder hoch") run back over the same centre line,
        // and vertex tips (the 1's flag, the W apex) turn sharply inside a
        // few pixels.  Only a reversal that neither turns within a tip-sized
        // run nor retraces its own path is a routing defect.
        const minSegment = Math.min(Math.hypot(incoming.x, incoming.y), Math.hypot(outgoing.x, outgoing.y));
        const distanceToPath = (point, from, to) => {
          const edgeX = (to.x - from.x) * 900;
          const edgeY = (to.y - from.y) * 620;
          const length2 = edgeX * edgeX + edgeY * edgeY;
          const t = length2 ? Math.max(0, Math.min(1, (
            ((point.x - from.x) * 900) * edgeX + ((point.y - from.y) * 620) * edgeY
          ) / length2)) : 0;
          return Math.hypot(
            ((point.x - from.x) * 900) - t * edgeX,
            ((point.y - from.y) * 620) - t * edgeY,
          );
        };
        const retrace = Math.min(
          distanceToPath(stroke[index - 1], stroke[index], stroke[index + 1]),
          distanceToPath(stroke[index + 1], stroke[index - 1], stroke[index]),
        ) < 8;
        assert.ok(minSegment < 12 || retrace, `${character} stroke ${strokeIndex + 1} doubles back at point ${index}`);
      }
    });
  });
});

test('every placed character preserves the source template aspect ratio', () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöü0123456789';
  [...characters].forEach((character) => {
    const number = /\d/.test(character);
    const task = (number ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters)
      .find((candidate) => candidate.id === `${number ? 'number' : 'letter'}-${character}-gross`);
    assert.ok(task, `missing gross task for ${character}`);
    const points = task.strokes.flat();
    const width = (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * 900;
    const height = (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * 620;
    const expected = CHARACTER_STROKE_GEOMETRY[character];
    if (width < 0.5) {
      assert.ok(expected.routeWidth <= 1, `${character} unexpectedly collapsed horizontally`);
      return;
    }
    const placedAspect = width / height;
    const sourceAspect = expected.routeWidth / expected.routeHeight;
    assert.ok(Math.abs(placedAspect - sourceAspect) < 0.002, `${character} was distorted: ${placedAspect} / ${sourceAspect}`);
  });
});

test('every visible template lands on the same canvas bounds as Fino and scoring', () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöü0123456789';
  [...characters].forEach((character) => {
    const number = /\d/.test(character);
    const task = (number ? EXERCISE_BANKS.numbers : EXERCISE_BANKS.letters)
      .find((candidate) => candidate.id === `${number ? 'number' : 'letter'}-${character}-gross`);
    const points = task.strokes.flat();
    const bounds = {
      minX: Math.min(...points.map((point) => point.x * 900)),
      maxX: Math.max(...points.map((point) => point.x * 900)),
      minY: Math.min(...points.map((point) => point.y * 620)),
      maxY: Math.max(...points.map((point) => point.y * 620)),
    };
    bounds.width = Math.max(1, bounds.maxX - bounds.minX);
    bounds.height = Math.max(1, bounds.maxY - bounds.minY);
    const crop = CHARACTER_TEMPLATE_CROPS[character];
    const geometry = CHARACTER_STROKE_GEOMETRY[character];
    const placement = characterTemplatePlacement(bounds, crop, geometry);
    const mappedRight = placement.x + (geometry.routeX + geometry.routeWidth) * placement.scale;
    const mappedBottom = placement.y + (geometry.routeY + geometry.routeHeight) * placement.scale;
    assert.ok(placement.scaleDifference < 0.02, `${character} has conflicting horizontal and vertical scales: ${JSON.stringify(placement)}`);
    if (placement.horizontalScaleIsReliable) {
      assert.ok(Math.abs(mappedRight - bounds.maxX) < 0.45, `${character} template misses Fino horizontally`);
    } else {
      assert.ok(Math.abs(placement.x + geometry.routeX * placement.scale - bounds.minX) < 1e-6, `${character} vertical centre line moved`);
    }
    if (placement.verticalScaleIsReliable) {
      assert.ok(Math.abs(mappedBottom - bounds.maxY) < 0.45, `${character} template misses Fino vertically`);
    }
    assert.ok(
      Math.abs((placement.width / placement.height) - (crop.width / crop.height)) < 1e-12,
      `${character} template image was distorted`,
    );
  });
});

test('lowercase letters are included in the regular 100-exercise letter bank', () => {
  const labels = new Set(EXERCISE_BANKS.letters.map((task) => task.label.replace(/\s/g, '')));
  ['a', 'm', 'z', 'ä', 'ö', 'ü'].forEach((letter) => assert.ok(labels.has(letter), `missing ${letter}`));
  assert.equal(EXERCISE_BANKS.letters.length, 100);
});

const relativeStroke = (stroke) => {
  const xs = stroke.map((point) => point.x);
  const ys = stroke.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return stroke.map((point) => ({
    x: (point.x - minX) / Math.max(1e-9, maxX - minX),
    y: (point.y - minY) / Math.max(1e-9, maxY - minY),
  }));
};

test('M and lowercase i follow the approved Schulschrift construction', () => {
  const m = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-M-gross');
  assert.equal(m.strokes.length, 1, 'M bleibt laut Anleitung in einem Zug');
  const mStroke = relativeStroke(m.strokes[0]);
  assert.ok(mStroke[0].x < 0.15 && mStroke[0].y > 0.7, 'M beginnt unten links auf der Grundlinie');
  assert.ok(mStroke[1].y < mStroke[0].y, 'M zieht zuerst nach oben zur Spitze');
  const mMiddle = mStroke.filter((point) => point.x > 0.3 && point.x < 0.65);
  assert.ok(mMiddle.some((point) => point.y > 0.75), 'M mittlerer Scheitel erreicht die Grundlinie');
  assert.ok(mStroke.at(-1).y > 0.85 && mStroke.at(-1).x > 0.8, 'M endet unten rechts auf der Grundlinie');

  const i = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-i-gross');
  const dotX = i.strokes[1].reduce((sum, point) => sum + point.x, 0) / i.strokes[1].length;
  assert.ok(Math.abs(dotX - i.strokes[0][0].x) < 0.025, 'i dot must sit over the top of its stem');
  assert.ok(Math.max(...i.strokes[1].map((point) => point.y)) < Math.min(...i.strokes[0].map((point) => point.y)), 'i dot should sit above its stem');
});

test('approved digits 1, 7, and 9 retain their Schulschrift forms', () => {
  const one = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-1-gross');
  const seven = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-7-gross');
  const nine = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-9-gross');
  assert.equal(one.strokes.length, 1, '1 ist ein Strich: Fahne und Schaft ohne Absetzen');
  const oneStroke = relativeStroke(one.strokes[0]);
  assert.ok(oneStroke[0].x < 0.15, '1 should begin with its left lead-in');
  assert.ok(oneStroke[1].y < oneStroke[0].y && oneStroke[1].x > oneStroke[0].x, '1 flag rises to the right');
  assert.ok(oneStroke.at(-1).x > 0.5 && oneStroke.at(-1).y > 0.9, '1 upright finishes on the baseline right of centre');
  assert.equal(seven.strokes.length, 2, '7 hat die Mittellinie als eigenen zweiten Strich');
  assert.ok(seven.strokes[0][0].x < seven.strokes[0][1].x, '7 should begin with a top bar');
  assert.ok(seven.strokes[0].at(-1).x < Math.max(...seven.strokes[0].map((point) => point.x)) - 0.1, '7 should descend to the left');
  assert.ok(seven.strokes[1][0].x < seven.strokes[1].at(-1).x, '7 crossbar should be drawn from left to right');
  assert.equal(nine.strokes.length, 1, '9 ist ein Strich: das Rund läuft ohne Absetzen in Schaft und Auslauf');
  assert.ok(nine.strokes[0][0].x > 0.4 && nine.strokes[0][0].y < 0.3, '9 beginnt mit dem kleinen Rund oben rechts');
  assert.ok(Math.abs(nine.strokes[0][0].x - nine.strokes[0][27].x) < 0.1
    && nine.strokes[0][27].y > nine.strokes[0][0].y, '9 Rund schließt sich zurück zum Ausgangspunkt (ohne Absetzen)');
  assert.ok(nine.strokes[0].at(-1).y > nine.strokes[0][27].y, '9 Schaft läuft vom Rund aus nach unten in den Auslauf');
  assert.ok(nine.strokes[0].at(-1).x < nine.strokes[0][0].x && nine.strokes[0].at(-1).y > 0.8, '9 Auslauf endet unten und nach links ausgerichtet');
});

test('digit 5 is drawn as a belly first and its top bar second', () => {
  const five = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-5-gross');
  assert.equal(five.strokes.length, 2, '5 zeichnet erst Körper und Bauch, dann den oberen Strich');
  const body = relativeStroke(five.strokes[0]);
  assert.ok(body[0].x < 0.2, '5 beginnt oben links');
  assert.ok(body[1].y > body[0].y + 0.02, '5 zieht zuerst nach unten');
  assert.ok(Math.max(...body.map((point) => point.x)) > 0.9, '5 Bauch reicht nach rechts');
  assert.ok(body.at(-1).x < 0.25 && body.at(-1).y > 0.8, '5 endet unten links');
  const bar = five.strokes[1];
  assert.ok(bar[0].x < bar.at(-1).x, '5 oberer Strich läuft von links nach rechts');
  assert.ok(Math.max(...bar.map((point) => point.y)) < 0.2, '5 oberer Strich liegt oben');
});

test('digits 8 and 0 start at the top and 3 passes its waist once', () => {
  const eight = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-8-gross');
  const eightRel = relativeStroke(eight.strokes[0]);
  assert.ok(eightRel[0].y < 0.05, '8 beginnt oben an der Acht');
  assert.ok(eightRel[1].x < eightRel[0].x && eightRel[1].y > eightRel[0].y, '8 führt zuerst nach links unten um den oberen Bauch');
  assert.ok(Math.hypot(eightRel[0].x - eightRel.at(-1).x, eightRel[0].y - eightRel.at(-1).y) < 0.05, '8 schließt oben am Startpunkt');

  const zero = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-0-gross');
  const zeroRel = relativeStroke(zero.strokes[0]);
  assert.ok(zeroRel[0].y < 0.05, '0 beginnt oben');
  assert.ok(zeroRel[1].x < zeroRel[0].x, '0 läuft zuerst nach links über den oberen Bogen');

  const three = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-3-gross');
  const threeRel = relativeStroke(three.strokes[0]);
  // In der Taille (mittleres Höhenband) darf die Route nur einmal die
  // Laufrichtung wechseln.  Der alte Hinweis zwang Fino dort zu einem
  // Hin-und-her-Zucken am Kreuzungspunkt.
  const band = threeRel.filter((point) => point.y > 0.3 && point.y < 0.7);
  let changes = 0;
  let lastStep = 0;
  for (let i = 1; i < band.length; i += 1) {
    const step = Math.sign(band[i].x - band[i - 1].x);
    if (step !== 0 && step !== lastStep) changes += 1;
    if (step !== 0) lastStep = step;
  }
  assert.ok(changes <= 2, `3 Taille läuft einmal in die Mitte und einmal heraus (${changes} Wechsel)`);

  // Die Acht kreuzt sich in der Mitte.  Fruher erzeugte der Wegpunkt am
  // Kreuzungspunkt ein kleines Hin-und-her-Zucken direkt dort (Fino stiess
  // kurz in den unteren Bauch und kam sofort zurueck).  Die Route muss die
  // Kreuzung ohne kurze Umkehr passieren.
  const crossing = eightRel.filter((point) => point.y > 0.34 && point.y < 0.58);
  for (let i = 1; i < crossing.length - 1; i += 1) {
    const first = {
      x: crossing[i].x - crossing[i - 1].x,
      y: crossing[i].y - crossing[i - 1].y,
    };
    const second = {
      x: crossing[i + 1].x - crossing[i].x,
      y: crossing[i + 1].y - crossing[i].y,
    };
    const lengthFirst = Math.hypot(first.x, first.y);
    const lengthSecond = Math.hypot(second.x, second.y);
    if (lengthFirst < 0.004 || lengthSecond < 0.004) continue;
    const cosine = (first.x * second.x + first.y * second.y) / (lengthFirst * lengthSecond);
    assert.ok(
      cosine >= -0.7 || lengthFirst >= 0.02 || lengthSecond >= 0.02,
      `8 Kreuzung ohne kurze Umkehr (${cosine.toFixed(2)} bei ${lengthFirst.toFixed(3)}/${lengthSecond.toFixed(3)})`,
    );
  }
});

test('lowercase a, r, and t retain the approved Schulschrift details', () => {
  const a = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-a-gross');
  const r = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-r-gross');
  const t = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-t-gross');
  assert.equal(a.strokes.length, 1, 'a ist in einem Zug: Rund läuft ohne Absetzen in den Schaft');
  const aStroke = a.strokes[0];
  assert.ok(aStroke[0].y < 0.35 && aStroke[0].x > 0.45, 'a beginnt oben rechts am Rund');
  assert.ok(aStroke[1].x < aStroke[0].x, 'a läuft zuerst nach links über den Bogen');
  assert.ok(Math.min(...aStroke.map((point) => point.x)) < 0.38, 'a Rund reicht bis nach links');
  // One continuous pen motion: the round body comes back up its right side
  // before the single stroke continues down the stem.
  assert.ok(aStroke.slice(8, -4).some((point) => point.y < 0.35 && point.x > 0.52), 'a Rund schließt oben, bevor der Schaft beginnt');
  assert.ok(Math.max(...aStroke.map((point) => point.y)) > 0.65, 'a Schaft erreicht die Grundlinie');
  assert.ok(aStroke.at(-1).x > aStroke.at(-2).x, 'a Schaft schwingt unten nach rechts aus');
  assert.equal(r.strokes.length, 1, 'r bleibt in einem Zug: Schaft, Wiederhochfahren, Schulter');
  const rStroke = relativeStroke(r.strokes[0]);
  assert.ok(rStroke[0].y < 0.3, 'r beginnt an der Mittellinie');
  assert.ok(Math.max(...rStroke.map((point) => point.y)) > 0.9, 'r stem reaches the baseline');
  assert.ok(rStroke.at(-1).x > rStroke[0].x + 0.5, 'r needs a clear right shoulder');
  assert.equal(t.strokes.length, 2, 't needs a stem and one crossbar');
  assert.ok(t.strokes[0].at(-1).x > t.strokes[0][0].x + 0.04, 't should finish with a friendly exit hook');
});

test('approved lowercase l and q retain their distinct exits', () => {
  const l = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-l-gross');
  const q = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-q-gross');
  const lStroke = relativeStroke(l.strokes[0]);
  assert.ok(lStroke[0].x < 0.35, 'l beginnt oben am Stamm (Schreibanleitung: oben beginnen)');
  assert.ok(lStroke[1].y > lStroke[0].y, 'l first travels down the stem');
  assert.ok(l.strokes[0].at(-1).x > l.strokes[0].at(-2).x, 'l should finish with a small rightward curve');
  assert.equal(q.strokes.length, 1, 'q ist ein Strich: Rund läuft in den Schwanz');
  const qDescenderXs = q.strokes[0].slice(-4).map((point) => point.x);
  assert.ok(Math.max(...qDescenderXs) - Math.min(...qDescenderXs) < 0.02, 'q descender should be vertical');
});

test('N is drawn in one continuous zigzag from the bottom left', () => {
  const n = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-N-gross');
  assert.equal(n.strokes.length, 1, 'N bleibt laut Anleitung in einem Zug');
  const stroke = relativeStroke(n.strokes[0]);
  assert.ok(stroke[0].y > 0.7, 'N beginnt unten links');
  assert.ok(stroke[1].y < stroke[0].y, 'N first travels up the left upright');
  const bottomVisit = stroke.filter((point) => point.y > 0.85);
  assert.ok(bottomVisit.some((point) => point.x > 0.5), 'N diagonal reaches the baseline before rising');
  assert.ok(stroke.at(-1).x > 0.8 && stroke.at(-1).y < 0.25, 'N finishes at the top of its right upright');
});

test('curriculum uses text and drawing data instead of emoji decorations', () => {
  const pictographic = /\p{Extended_Pictographic}/u;
  TASKS.forEach((task) => {
    assert.equal('decorations' in task, false, `${task.id} should not include decorations`);
    assert.equal(pictographic.test(`${task.label} ${task.title} ${task.speech}`), false, `${task.id} includes an emoji`);
  });
});

test('every category creates a 10-task session', () => {
  const cases = [
    { category: 'lines', difficulty: 'easy' },
    { category: 'shapes', difficulty: 'medium' },
    { category: 'numbers', difficulty: 'hard', option: 'all' },
    { category: 'letters', difficulty: 'medium', option: 'all' },
    { category: 'maze', difficulty: 'easy' },
    { category: 'connect', difficulty: 'hard' },
    { category: 'mixed', difficulty: 'hard' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 4) });
    assert.equal(session.length, SESSION_SIZE);
    assert.equal(session.at(-1).assist, 'easy');
    assert.ok(session.every((task) => task.strokes.length > 0));
  });
});

test('the two path games reserve genuinely harder content for higher difficulties', () => {
  for (const category of ['maze', 'connect']) {
    const easy = buildSession({ category, difficulty: 'easy', rng: seededRandom(701) });
    const medium = buildSession({ category, difficulty: 'medium', rng: seededRandom(702) });
    const hard = buildSession({ category, difficulty: 'hard', rng: seededRandom(703) });
    assert.ok(easy.every((task) => task.complexity === 1), `${category} easy leaked a harder task`);
    assert.ok(medium.every((task) => [2, 3].includes(task.complexity)), `${category} medium leaked an easy task`);
    assert.ok(hard.every((task) => task.complexity === 4), `${category} hard is not the very-hard tier`);
  }
});

test('practice canvas keeps the iPad writing-page ratio and phone orientation layouts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(html, /class="rotate-suggestion"[\s\S]*Dreh das Gerät ins Querformat/);
  assert.match(styles, /\.drawing-section\s*\{[\s\S]*?aspect-ratio:\s*900\s*\/\s*620/s);
  assert.match(styles, /@media \(orientation: portrait\) and \(max-width: 640px\)[\s\S]*?\.rotate-suggestion\s*\{[\s\S]*?display:\s*flex/s);
  assert.match(styles, /@media \(orientation: landscape\) and \(max-height: 620px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 112px/s);
  assert.match(styles, /@media \(orientation: landscape\) and \(max-height: 620px\)[\s\S]*?\.practice-header\s*\{[\s\S]*?flex-direction:\s*column/s);
});

test('name rounds adapt to the name: each character comes first, then the whole name', () => {
  const session = buildSession({ category: 'name', difficulty: 'medium', name: 'Anna', rng: seededRandom(17) });
  assert.equal(session.length, 5);
  assert.deepEqual(session.slice(0, -1).map((task) => task.label), ['A', 'n', 'n', 'a']);
  assert.deepEqual(session.slice(0, -1).map((task) => task.layout), ['single-letter', 'single-letter', 'single-letter', 'single-letter']);
  assert.equal(session.at(-1).label, 'Anna');
  assert.equal(session.at(-1).layout, 'whole-name');
  assert.equal(session.at(-1).assist, 'easy');
});

test('a playthrough samples 10 distinct exercises without repetition', () => {
  const session = buildSession({ category: 'letters', difficulty: 'hard', option: 'all', rng: seededRandom(42) });
  assert.equal(new Set(session.map((task) => task.id)).size, SESSION_SIZE);
});

test('mixed rounds include both new games without crowding out the base activities', () => {
  const session = buildSession({ category: 'mixed', difficulty: 'medium', rng: seededRandom(541) });
  const counts = session.reduce((result, task) => ({ ...result, [task.family]: (result[task.family] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { lines: 2, shapes: 2, numbers: 2, letters: 2, maze: 1, connect: 1 });
});

test('rounds rotate through available symbols before repeating one', () => {
  const cases = [
    { category: 'numbers', difficulty: 'medium', option: 'all' },
    { category: 'letters', difficulty: 'hard', option: 'all' },
    { category: 'shapes', difficulty: 'medium' },
    { category: 'maze', difficulty: 'medium' },
    { category: 'connect', difficulty: 'hard' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(90 + index) });
    assert.equal(new Set(session.map((task) => task.value)).size, SESSION_SIZE, `${config.category} repeated before needed`);
  });
});

test('easy number and letter rounds show exactly one symbol per task', () => {
  const cases = [
    { category: 'numbers', option: 'all' },
    { category: 'numbers', option: '5' },
    { category: 'letters', option: 'all' },
    { category: 'letters', option: 'aä' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, difficulty: 'easy', rng: seededRandom(index + 70) });
    session.forEach((task) => {
      assert.equal([...task.label].length, 1, `${task.id} should show one symbol`);
      assert.equal(task.completionGroups.length, 1, `${task.id} should require one symbol`);
    });
  });
});

test('a non-line round does not begin with a forced line warm-up', () => {
  const cases = [
    { category: 'shapes', difficulty: 'easy' },
    { category: 'numbers', difficulty: 'medium', option: '257' },
    { category: 'letters', difficulty: 'hard', option: 'MARTIN' },
    { category: 'name', difficulty: 'easy', name: 'I' },
    { category: 'maze', difficulty: 'easy' },
    { category: 'connect', difficulty: 'medium' },
    { category: 'mixed', difficulty: 'medium' },
  ];
  cases.forEach((config, index) => {
    const session = buildSession({ ...config, rng: seededRandom(index + 17) });
    assert.notEqual(session[0].category, 'lines', `${config.category} started with ${session[0].id}`);
  });
});

test('name normalization stays local and preserves natural capitalization', () => {
  assert.equal(normalizeName('  käthe  '), 'käthe');
  assert.equal(normalizeName('Zoë 7!'), 'Zoe');
  assert.equal(normalizeName('Anna-Lena'), 'Anna-Lena');
});

test('word task composes supported letters into the board', () => {
  const word = createWordTask('Löwe');
  assert.ok(word);
  assert.equal(word.label, 'Löwe');
  assert.ok(word.strokes.length >= 4);
  word.strokes.flat().forEach((point) => {
    assert.ok(point.x >= 0 && point.x <= 1);
    assert.ok(point.y >= 0 && point.y <= 1);
  });
});

test('name spacing keeps narrow I centred between its neighbours', () => {
  const word = createWordTask('MIM');
  const [leftGroup, iGroup, rightGroup] = word.completionGroups;
  const boundsFor = (group) => group.flatMap((index) => word.strokes[index]).reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
  }), { minX: Infinity, maxX: -Infinity });
  const left = boundsFor(leftGroup);
  const middle = boundsFor(iGroup);
  const right = boundsFor(rightGroup);
  const before = middle.minX - left.maxX;
  const after = right.minX - middle.maxX;
  assert.ok(before > 0 && after > 0, 'letters should not overlap');
  assert.ok(Math.abs(before - after) < 0.035, `uneven gaps around I: ${before} / ${after}`);
});

test('a complete name uses one shared type scale and baseline', () => {
  const word = createWordTask('Lilli');
  const groupBounds = word.completionGroups.map((group) => {
    const points = group.flatMap((index) => word.strokes[index]);
    return {
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
  });
  // The route's lowest point sits a glyph-specific distance above the true
  // baseline (tapered exits, foot curves).  Recover the baseline by scaling
  // the approved ink-top→baseline offset into each letter's rendered height.
  const baselines = word.completionGroups.map((group, index) => {
    const letter = 'Lilli'[index];
    const offset = baselineOffsets[letter];
    const routeHeight = CHARACTER_STROKE_GEOMETRY[letter].routeHeight;
    return groupBounds[index].minY + offset * (groupBounds[index].maxY - groupBounds[index].minY) / routeHeight;
  });
  assert.ok(Math.max(...baselines) - Math.min(...baselines) < 0.008, `name baselines differ: ${baselines.join(', ')}`);
  // Compare the source ink heights (route heights differ with each glyph's
  // tapered ends even when the drawn letters share their line).
  const inkHeight = (letter) => (CHARACTER_STROKE_GEOMETRY[letter].cropHeight - 8) / 620;
  const capitalHeight = inkHeight('L');
  const lowerLHeight = inkHeight('l');
  const lowerIHeight = inkHeight('i');
  assert.ok(Math.abs(capitalHeight - lowerLHeight) < 0.012, 'capital and ascender should share a visual line height');
  assert.ok(lowerIHeight < lowerLHeight * 0.78, 'lowercase i should keep its natural source proportions');
});

test('long names become shorter as a whole instead of squeezing tall letters into narrow slots', () => {
  const shortName = createWordTask('MIA');
  const longName = createWordTask('ELISABETH');
  const verticalSpan = (task) => {
    const points = task.strokes.flat();
    return Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
  };
  assert.equal(longName.label, 'ELISABETH', 'a full long name should not be clipped');
  assert.equal(longName.completionGroups.length, 9, 'every letter in a long name should remain required');
  assert.ok(verticalSpan(longName) < verticalSpan(shortName) * 0.5, 'long-name letters should be visibly shorter');
  assert.ok(verticalSpan(longName) > 0.2, 'long-name letters should remain easy to trace');
});

test('straight-edged shape guides preserve hard corners', () => {
  const cross = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-cross');
  const circle = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-circle');
  assert.deepEqual(cross.angularStrokes, [0, 1]);
  assert.deepEqual(circle.angularStrokes, []);
});

test('the refined picture catalogue keeps clear child-readable silhouettes', () => {
  const arrow = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-arrow');
  const tree = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-tree');
  const butterfly = EXERCISE_BANKS.shapes.find((task) => task.id === 'shape-butterfly');
  assert.deepEqual(arrow.strokes[0].map((point) => point.y), [0.5, 0.5]);
  assert.equal(tree.strokes.length, 3);
  assert.ok(tree.strokes[1].length > 60, 'tree crown should be a smooth leafy silhouette');
  assert.ok(Math.max(...butterfly.strokes[0].map((point) => point.x)) <= 0.5);
  assert.ok(Math.min(...butterfly.strokes[1].map((point) => point.x)) >= 0.5);
});

test('measured board space chooses fewer targets in portrait and a row in landscape', () => {
  const source = EXERCISE_BANKS.numbers.find((task) => task.id === 'number-4-vierer');
  const portrait = adaptTaskToViewport({ ...source, slot: 0 }, { width: 390, height: 844 });
  const insetPortrait = adaptTaskToViewport({ ...source, slot: 0 }, { width: 362, height: 766 });
  const landscape = adaptTaskToViewport({ ...source, slot: 0 }, { width: 844, height: 390 });
  assert.equal(portrait.completionGroups.length, 2, 'phone portrait should not overwhelm with four targets');
  assert.equal(insetPortrait.completionGroups.length, 2, 'a padded 390px phone board should still allow two targets');
  assert.equal(landscape.completionGroups.length, 3, 'phone landscape may use a three-target row');

  const groupCenter = (task, group) => {
    const points = group.flatMap((index) => task.strokes[index]);
    return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  };
  const portraitCenters = portrait.completionGroups.map((group) => groupCenter(portrait, group));
  const landscapeCenters = landscape.completionGroups.map((group) => groupCenter(landscape, group));
  assert.ok(Math.abs(portraitCenters[0].x - portraitCenters[1].x) > 0.15, 'portrait targets should form a diagonal');
  assert.ok(Math.abs(portraitCenters[0].y - portraitCenters[1].y) > 0.2, 'portrait targets should use the board height');
  assert.ok(landscapeCenters[0].x < landscapeCenters[1].x && landscapeCenters[1].x < landscapeCenters[2].x, 'landscape targets should form a row');

  const word = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-word-FUCHS');
  const wideWord = adaptTaskToViewport(word, { width: 1250, height: 632 });
  assert.equal(wideWord.completionGroups.length, 5, 'a wide board should keep a short word intact');
});

test('an in-progress task and its ink reflow together without rotation distortion', () => {
  const source = EXERCISE_BANKS.letters.find((task) => task.id === 'letter-O-gross');
  const portrait = adaptTaskToViewport(source, { width: 390, height: 740 });
  const reflowed = reflowTaskWithInk(portrait, portrait.strokes, { width: 780, height: 330 });
  const physicalAspect = (strokes, width, height) => {
    const points = strokes.flat();
    return ((Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * width)
      / ((Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * height);
  };
  const before = physicalAspect(portrait.strokes, 390, 740);
  const after = physicalAspect(reflowed.task.strokes, 780, 330);
  assert.ok(Math.abs(before - after) / before < 0.001, `${before} became ${after}`);
  assert.deepEqual(reflowed.task.strokes, reflowed.userStrokes);
});

test('phone name rounds keep the full name to landscape names of eight letters or fewer', () => {
  const portrait = buildSession({ category: 'name', difficulty: 'easy', name: 'ELISABETH', viewport: { width: 390, height: 844 } });
  const shortLandscape = buildSession({ category: 'name', difficulty: 'easy', name: 'MARTIN', viewport: { width: 844, height: 390 } });
  const longLandscape = buildSession({ category: 'name', difficulty: 'easy', name: 'ELISABETH', viewport: { width: 844, height: 390 } });
  assert.ok(!portrait.some((task) => task.layout === 'whole-name'));
  assert.ok(shortLandscape.some((task) => task.layout === 'whole-name'));
  assert.ok(!longLandscape.some((task) => task.layout === 'whole-name'));
});

test('restricted choices still form a repetition-free round', () => {
  const cases = [
    { category: 'numbers', difficulty: 'easy', option: '5' },
    { category: 'name', difficulty: 'easy', name: 'I' },
  ];
  cases.forEach((config, caseIndex) => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const session = buildSession({ ...config, rng: seededRandom(seed + caseIndex * 1000) });
      assert.equal(new Set(session.map((task) => task.id)).size, session.length);
      const expectedLength = config.category === 'name'
        ? normalizeName(config.name).replace(/[- ]/g, '').length + 1
        : SESSION_SIZE;
      assert.equal(session.length, expectedLength);
    }
  });
});

test('responsive custom rounds keep ten visibly different placements', () => {
  const physicalBounds = (task, viewport) => {
    const points = task.strokes.flat();
    return [
      Math.min(...points.map((point) => point.x * viewport.width)),
      Math.max(...points.map((point) => point.x * viewport.width)),
      Math.min(...points.map((point) => point.y * viewport.height)),
      Math.max(...points.map((point) => point.y * viewport.height)),
    ];
  };
  [
    { category: 'numbers', difficulty: 'easy', option: '5' },
    { category: 'numbers', difficulty: 'medium', option: '5' },
    { category: 'letters', difficulty: 'easy', option: 'i' },
    { category: 'letters', difficulty: 'medium', option: 'i' },
  ].forEach((config, index) => {
    [{ width: 390, height: 700 }, { width: 266, height: 542 }].forEach((viewport) => {
      const session = buildSession({ ...config, viewport, rng: seededRandom(170 + index) });
      const bounds = session.map((task) => physicalBounds(adaptTaskToViewport(task, viewport), viewport));
      const signatures = bounds.map((values) => values.map((value) => Math.round(value)).join(':'));
      assert.equal(new Set(signatures).size, session.length, `${config.category}/${config.difficulty} repeats responsive geometry at ${viewport.width}px`);
      bounds.forEach(([left, right, top, bottom]) => {
        assert.ok(Math.min(left, viewport.width - right, top, viewport.height - bottom) >= 18, `${config.category}/${config.difficulty} touches an edge at ${viewport.width}px`);
      });
    });
  });
});

test('multiple custom symbols keep an even size and baseline', () => {
  const viewport = { width: 390, height: 700 };
  const session = buildSession({ category: 'letters', difficulty: 'medium', option: 'i', viewport, rng: seededRandom(29) });
  session.map((task) => adaptTaskToViewport(task, viewport)).filter((task) => task.completionGroups.length > 1).forEach((task) => {
    const boxes = task.completionGroups.map((group) => {
      const points = group.flatMap((index) => task.strokes[index]);
      return {
        width: (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * viewport.width,
        height: (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * viewport.height,
        bottom: Math.max(...points.map((point) => point.y)) * viewport.height,
      };
    });
    boxes.slice(1).forEach((box) => {
      assert.ok(Math.abs(box.width - boxes[0].width) < 0.2);
      assert.ok(Math.abs(box.height - boxes[0].height) < 0.2);
    });
  });
});
