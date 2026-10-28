import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const output = 'test-artifacts/sudoku/hints';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.FINO_CHROME_PATH ? { executablePath: process.env.FINO_CHROME_PATH } : {}) });
const solution = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const scenarios = [
  { mode: 'numbers', viewport: { width: 390, height: 844 } },
  { mode: 'letters', viewport: { width: 1024, height: 768 } },
  { mode: 'symbols', viewport: { width: 844, height: 390 } },
  { mode: 'symbols', viewport: { width: 320, height: 568 }, directory: '/testversion' },
];
const report = [];
try {
  for (const { mode, viewport, directory = '' } of scenarios) {
    const key = `${directory ? 'testversion-' : ''}${mode}`;
    const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`${process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173'}${directory}/?test`);
      await page.locator('[data-category="sudoku"]').click();
      await page.locator(`label:has(input[name="sudoku-symbols"][value="${mode}"])`).click();
      await page.locator('#start-button').click();
      await page.waitForFunction(() => window.__fuchsschrift?.sudoku.snapshot() && !window.__fuchsschrift.sudoku.locked);
      const submit = page.getByRole('button', { name: 'Einsetzen', exact: true });
      const mobile = viewport.width <= 700 || (viewport.width > viewport.height && viewport.height <= 500);
      const submitBox = await submit.boundingBox();
      const lastGuideBox = await page.locator('[data-sudoku-guide="4"]').boundingBox();
      if (mobile) {
        assert.ok(Math.abs(submitBox.y - lastGuideBox.y) <= 1, 'phone checkmark shares the guide row');
        assert.ok(submitBox.x >= lastGuideBox.x + lastGuideBox.width, 'checkmark follows the four guide buttons');
        assert.ok(submitBox.width >= 44 && submitBox.height >= 44, 'checkmark has a usable touch target');
        assert.equal(await page.locator('.sudoku-submit-label').isVisible(), false);
      } else {
        const padBox = await page.locator('#sudoku-canvas').boundingBox();
        assert.ok(submitBox.y > padBox.y + padBox.height, 'tablet keeps the full submit button below the pad');
        assert.equal(await page.locator('.sudoku-submit-label').isVisible(), true);
      }
      assert.ok(submitBox.x >= 0 && submitBox.y >= 0 && submitBox.x + submitBox.width <= viewport.width && submitBox.y + submitBox.height <= viewport.height, 'submit fits the screen');
      assert.equal(await submit.isDisabled(), true, 'an empty pad cannot be submitted');
      const snapshot = () => page.evaluate(() => window.__fuchsschrift.sudoku.snapshot());
      const guidePixels = () => page.locator('#sudoku-canvas').evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          // The guide is blue-grey; exclude the beige baseline and any
          // fractional backing-store edge pixels.
          if (pixels[i] > 140 && pixels[i] < 210 && pixels[i + 2] > pixels[i + 1] && pixels[i + 1] > pixels[i]) count++;
        }
        return count;
      });
      const reset = async (cells) => page.evaluate(({ cells, solution }) => {
        const game = window.__fuchsschrift.sudoku;
        const givens = solution.map((value, index) => cells.includes(index) ? value : 0);
        game.setTask({ ...game.task, game: { ...game.puzzle, solution, givens, clueCount: cells.length } });
      }, { cells, solution });
      const tap = async (selector) => {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${key}: ${selector} fits`);
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      };
      for (const [kind, cells] of [['row', [0, 1, 2]], ['column', [0, 4, 8]], ['box', [0, 1, 4]]]) {
        await reset(cells);
        const before = await snapshot();
        assert.equal(await guidePixels(), 0);
        await tap('#show-button');
        const after = await snapshot();
        assert.equal(after.hintUnit.kind, kind);
        assert.equal(after.hintUnit.cells.length, 4);
        assert.equal(await page.locator('.sudoku-cell.is-hint').count(), 4);
        assert.equal(after.selected, before.selected);
        assert.equal(after.guideValue, null);
        assert.deepEqual(after.values, before.values);
        assert.equal(await guidePixels(), 0, 'Fino does not sketch an answer');
        assert.match(await page.locator('.sudoku-feedback').textContent(), /Welches Zeichen fehlt\?/);
        await page.screenshot({ path: `${output}/${key}-${kind}.png` });
      }
      // Valid grid, two entries in each row, column and box: no three-entry hint.
      await reset([0, 3, 5, 6, 9, 10, 12, 15]);
      const initial = await snapshot();
      assert.equal(await guidePixels(), 0);
      for (let value = 1; value <= 4; value++) {
        await tap(`[data-sudoku-guide="${value}"]`);
        const after = await snapshot();
        assert.equal(after.guideValue, value, 'every choice is available, including incorrect answers');
        assert.deepEqual(after.values, initial.values);
        assert.equal(after.draftStrokes, 0);
        assert.equal(after.selected, initial.selected);
        assert.equal(await page.locator('[data-sudoku-guide][aria-pressed="true"]').count(), 1);
        assert.ok(await guidePixels() > 100, 'the chosen guide is drawn on the canvas');
        assert.equal(await page.locator('.sudoku-placeholder').isVisible(), false);
        const box = await page.locator(`[data-sudoku-guide="${value}"]`).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, 'guides are pen/touch targets');
      }
      // Keyboard activation can hide the guide again.
      await page.locator('[data-sudoku-guide="4"]').focus();
      await page.keyboard.press('Space');
      assert.equal((await snapshot()).guideValue, null);
      assert.equal(await guidePixels(), 0);
      await tap('[data-sudoku-guide="3"]');
      assert.ok(await guidePixels() > 100);
      await tap('#show-button');
      assert.match(await page.locator('.sudoku-feedback').textContent(), /^\?/);
      assert.equal((await snapshot()).hintUnit, null);
      assert.equal((await snapshot()).guideValue, 3, 'Fino never changes the chosen guide');
      assert.equal(await page.locator('.sudoku-cell.is-hint').count(), 0);
      assert.ok(await guidePixels() > 100);
      await page.screenshot({ path: `${output}/${key}-unknown-guide.png` });
      // A real pen/mouse stroke remains intact when guides or hints change.
      const rect = await page.locator('#sudoku-canvas').boundingBox();
      await page.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .3);
      await page.mouse.down();
      await page.mouse.move(rect.x + rect.width * .7, rect.y + rect.height * .7, { steps: 8 });
      assert.equal(await page.locator('[data-sudoku-guide]:disabled').count(), 4);
      await page.mouse.up();
      const ink = await page.evaluate(() => JSON.stringify(window.__fuchsschrift.sudoku.drafts));
      await tap('[data-sudoku-guide="2"]');
      await tap('#show-button');
      assert.equal(await page.evaluate(() => JSON.stringify(window.__fuchsschrift.sudoku.drafts)), ink);
      assert.deepEqual((await snapshot()).values, initial.values);
      await tap('#clear-button');
      assert.equal((await snapshot()).draftStrokes, 0);
      assert.equal((await snapshot()).guideValue, null);
      const answer = solution[initial.selected];
      const drawing = await page.evaluate(async ({ mode, answer, version }) => {
        const { sudokuReferenceInk } = await import(`./js/sudoku-recognition.js?v=${version}`);
        const game = window.__fuchsschrift.sudoku;
        game.resize();
        const rect = game.canvas.getBoundingClientRect();
        return sudokuReferenceInk(mode, answer).map(stroke => stroke.map(point => ({
          x: rect.x + game.transform.x + point.x * 300 * game.transform.scale,
          y: rect.y + game.transform.y + point.y * 200 * game.transform.scale,
        })));
      }, { mode, answer, version });
      for (const stroke of drawing) {
        await page.mouse.move(stroke[0].x, stroke[0].y);
        await page.mouse.down();
        for (const point of stroke.slice(1)) await page.mouse.move(point.x, point.y);
        await page.mouse.up();
      }
      await page.waitForFunction(() => !document.querySelector('.sudoku-submit').disabled);
      await tap('.sudoku-submit');
      assert.equal((await snapshot()).values[initial.selected], answer, 'the checkmark inserts the handwritten answer');
      assert.equal(await page.locator('.sudoku-feedback').getAttribute('data-kind'), 'success');
      await tap('[data-sudoku-guide="1"]');
      await tap('[data-sudoku-cell="7"]');
      assert.equal((await snapshot()).guideValue, null, 'a new cell starts without a guide');
      assert.deepEqual(errors, []);
      report.push({ mode, viewport, directory, row: true, column: true, box: true, unknown: true, allGuides: true, inkPreserved: true, errors });
    } catch (error) {
      await page.screenshot({ path: `${output}/${key}-failure.png` });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.length} Kidoku guide/hint scenarios`);
