import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/kidoku-freehand.json', import.meta.url)));
const output = 'test-artifacts/sudoku/freehand-browser';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.FINO_CHROME_PATH ? { executablePath: process.env.FINO_CHROME_PATH } : {}) });
const report = [];
const scenarios = [
  { id: 'one-flag-and-foot', target: 1 },
  { id: 'four-open', target: 4 },
  { id: 'd-round', target: 4 },
  { id: 'square-rounded', target: 3 },
  { id: 'triangle-down', target: 2 },
  { id: 'star-pentagram', target: 4 },
  { id: 'unknown-five', target: 3 },
  { id: 'unknown-p', target: 2 },
  { id: 'square-rounded', target: 3, directory: '/testversion' },
];

try {
  for (const [caseIndex, scenario] of scenarios.entries()) {
    const example = cases.find((item) => item.id === scenario.id);
    const key = `${scenario.directory ? 'testversion-' : ''}${example.id}`;
    const context = await browser.newContext({ viewport: caseIndex % 2 ? { width: 390, height: 844 } : { width: 1024, height: 768 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      let index = -1;
      for (let attempt = 0; attempt < 10 && index < 0; attempt += 1) {
        await page.goto(`${process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173'}${scenario.directory ?? ''}/?test`);
        await page.locator('[data-category="sudoku"]').click();
        await page.locator(`label:has(input[name="sudoku-symbols"][value="${example.mode}"])`).click();
        await page.locator('label:has(input[name="difficulty"][value="hard"])').click();
        await page.locator('#start-button').click();
        await page.waitForFunction(() => window.__fuchsschrift?.getState().task?.startsWith('sudoku-'));
        index = await page.evaluate((target) => {
          const task = window.__fuchsschrift.getCurrentTask();
          return task.game.solution.findIndex((value, cell) => value === target && !task.game.givens[cell]);
        }, scenario.target);
      }
      assert.ok(index >= 0, 'a blank cell for the tested value exists');
      await page.locator(`[data-sudoku-cell="${index}"]`).click();
      const data = await page.evaluate(() => {
        const game = window.__fuchsschrift.sudoku;
        game.resize();
        const rect = game.canvas.getBoundingClientRect();
        return { x: rect.x, y: rect.y, transform: game.transform };
      });
      // Independent sketches in the blank pad, with no hint/reference shown.
      const client = ([x, y]) => ({
        x: data.x + data.transform.x + (90 + x * 1.2) * data.transform.scale,
        y: data.y + data.transform.y + (40 + y * 1.2) * data.transform.scale,
      });
      for (const stroke of example.strokes) {
        const first = client(stroke[0]);
        await page.mouse.move(first.x, first.y);
        await page.mouse.down();
        for (const point of stroke.slice(1)) {
          const next = client(point);
          await page.mouse.move(next.x, next.y, { steps: 3 });
        }
        await page.mouse.up();
      }
      assert.equal((await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot())).values[index], 0, 'pen lifts do not submit unfinished writing');
      await page.screenshot({ path: `${output}/${key}-drawn.png` });
      await page.locator('.sudoku-submit').click();
      const state = await page.evaluate(() => window.__fuchsschrift.sudoku.snapshot());
      const feedback = await page.locator('.sudoku-feedback').textContent();
      assert.equal(state.values[index], example.value ?? 0, `${key}: ${feedback}`);
      assert.equal(await page.locator('.sudoku-feedback').getAttribute('data-kind'), example.value ? 'success' : 'retry');
      if (!example.value) assert.match(feedback, /Noch nicht erkannt/, 'unknown ink is rejected before Sudoku answer validation');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/${key}-result.png` });
      report.push({ key, expected: example.value, feedback, state, errors });
    } catch (error) {
      await page.screenshot({ path: `${output}/${key}-failure.png` });
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.length} freehand browser entries, including rejected out-of-set writing and testversion`);
