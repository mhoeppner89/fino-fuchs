import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const output = 'test-artifacts/sudoku/browser';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.FINO_CHROME_PATH ? { executablePath: process.env.FINO_CHROME_PATH } : {}) });
const report = [];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }];
const modes = process.env.FINO_SUDOKU_MODE ? [process.env.FINO_SUDOKU_MODE] : ['numbers', 'letters', 'symbols'];
const difficulties = ['easy', 'medium', 'hard'];
const cases = modes.flatMap((mode) => difficulties.map((difficulty, d) => ({ mode, difficulty, viewport: viewports[(['numbers','letters','symbols'].indexOf(mode) + d) % 4], directory: '' })));
cases.push({ mode: process.env.FINO_SUDOKU_MODE ?? 'symbols', difficulty: 'hard', viewport: { width: 667, height: 375 }, directory: '/testversion' });

try {
  for (const [caseIndex, scenario] of cases.entries()) {
    const { mode, difficulty, viewport, directory } = scenario;
    const key = `${directory ? 'testversion-' : ''}${mode}-${difficulty}-${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`${process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173'}${directory}/?test`);
      await page.locator('[data-category="sudoku"]').click();
      await page.locator(`label:has(input[name="sudoku-symbols"][value="${mode}"])`).click();
      await page.locator(`label:has(input[name="difficulty"][value="${difficulty}"])`).click();
      await page.locator('#start-button').click();
      await page.waitForFunction(() => window.__fuchsschrift?.getState().task?.startsWith('sudoku-'));
      const task = await page.evaluate(() => window.__fuchsschrift.getCurrentTask());
      const initial = await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot());
      assert.equal(initial.symbols, mode);
      assert.equal(initial.clueCount, { easy: 12, medium: 9, hard: 6 }[difficulty]);
      assert.equal(await page.locator('.sudoku-cell').count(), 16);
      assert.equal(await page.locator('.sudoku-cell:disabled').count(), initial.clueCount);

      const checkBounds = async () => {
        for (const selector of ['.sudoku-grid', '#sudoku-canvas', '.sudoku-submit']) {
          const rect = await page.locator(selector).boundingBox();
          const size = page.viewportSize();
          assert.ok(rect && rect.width > 30 && rect.height > 30, `${key}: ${selector} has usable size`);
          assert.ok(rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= size.width + 1 && rect.y + rect.height <= size.height + 1,
            `${key}: ${selector} is inside the viewport: ${JSON.stringify(rect)}`);
        }
      };
      await checkBounds();
      await page.screenshot({ path: `${output}/${key}-puzzle.png` });
      await page.locator('#show-button').click();
      const hint = await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot());
      assert.equal(hint.guideValue, null, 'Fino never chooses a tracing guide');
      assert.equal(hint.selected, initial.selected, 'Fino leaves the choice of cell to the child');
      assert.deepEqual(hint.values, initial.values, 'Fino does not enter an answer');
      if (hint.hintUnit) {
        assert.equal(hint.hintUnit.cells.filter((index) => initial.values[index]).length, 3);
        assert.equal(await page.locator('.sudoku-cell.is-hint').count(), 4);
      } else {
        assert.match(await page.locator('.sudoku-feedback').textContent(), /^\?/);
      }
      assert.equal(await page.locator('.sudoku-feedback').getAttribute('data-kind'), 'hint');

      const select = async (index) => {
        const rect = await page.locator(`[data-sudoku-cell="${index}"]`).boundingBox();
        await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
        assert.equal(await page.evaluate(() => window.__fuchsschrift.sudoku.selected), index, `${key}: touch selects the cell`);
      };
      const drawValue = async (value) => {
        const data = await page.evaluate(async ({ mode, value, version }) => {
          const { sudokuReferenceInk } = await import(`./js/sudoku-recognition.js?v=${version}`);
          const game = window.__fuchsschrift.sudoku;
          game.resize();
          const rect = game.canvas.getBoundingClientRect();
          return {
            ink: sudokuReferenceInk(mode, value),
            rect: { x: rect.x, y: rect.y }, transform: game.transform,
          };
        }, { mode, value, version });
        const client = (p) => ({ x: data.rect.x + data.transform.x + p.x * 300 * data.transform.scale, y: data.rect.y + data.transform.y + p.y * 200 * data.transform.scale });
        for (const stroke of data.ink) {
          const first = client(stroke[0]);
          await page.mouse.move(first.x, first.y);
          await page.mouse.down();
          for (const point of stroke.slice(1)) {
            const next = client(point);
            await page.mouse.move(next.x, next.y);
          }
          await page.mouse.up();
        }
      };

      const firstEmpty = initial.givens.indexOf(0);
      await select(firstEmpty);
      const wrong = [1, 2, 3, 4].find((value) => value !== task.game.solution[firstEmpty]);
      await drawValue(wrong);
      await page.locator('.sudoku-submit').click();
      assert.equal((await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot())).values[firstEmpty], 0);
      assert.equal(await page.locator('.sudoku-feedback').getAttribute('data-kind'), 'retry');
      await page.locator('#clear-button').click();
      assert.equal((await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot())).draftStrokes, 0);

      let undoChecked = false;
      for (const [index, given] of initial.givens.entries()) {
        if (given) continue;
        await select(index);
        await drawValue(task.game.solution[index]);
        const beforeSubmit = await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot());
        assert.equal(beforeSubmit.values[index], 0, `${key}: handwriting needs explicit confirmation`);
        assert.equal(beforeSubmit.status, 'ready');
        if (caseIndex === 1 && !undoChecked) {
          const draft = await page.evaluate(() => JSON.stringify(window.__fuchsschrift.sudoku.drafts));
          await page.setViewportSize({ width: viewport.height, height: viewport.width });
          await page.waitForTimeout(100);
          await checkBounds();
          assert.equal(await page.evaluate(() => JSON.stringify(window.__fuchsschrift.sudoku.drafts)), draft, 'rotation preserves handwriting');
        }
        await page.locator('.sudoku-submit').click();
        if (!undoChecked) {
          assert.equal((await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot())).values[index], task.game.solution[index], await page.locator('.sudoku-feedback').textContent());
          await page.locator('#undo-button').click();
          assert.equal((await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot())).values[index], 0, 'undo restores a blank');
          await drawValue(task.game.solution[index]);
          await page.locator('.sudoku-submit').click();
          undoChecked = true;
        }
      }
      await page.waitForFunction(() => window.__fuchsschrift.getState().index === 1);
      assert.equal((await page.evaluate(() => window.__fuchsschrift.getState())).completed, 1);
      assert.deepEqual(errors, []);
      report.push({ ...scenario, clueCount: initial.clueCount, wrongEntryRejected: true, penEntryConfirmed: true, undo: true, completed: true, errors });
    } catch (error) {
      await page.screenshot({ path: `${output}/${key}-failure.png` });
      writeFileSync(`${output}/${key}-failure.json`, JSON.stringify({ errors, state: await page.evaluate(() => window.render_game_to_text?.()) }, null, 2));
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.length} handwritten Sudoku playthroughs with fixed clues, hints, wrong answers, undo and confirmation`);
