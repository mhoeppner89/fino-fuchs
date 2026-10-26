import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const output = 'test-artifacts/picture-completion/browser';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FINO_CHROME_PATH ? { executablePath: process.env.FINO_CHROME_PATH } : {}),
});
const report = [];
const origin = process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173';
try {
  for (const directory of ['', '/testversion']) {
    const viewports = directory ? [{ width: 844, height: 390 }] : [
      { width: 390, height: 844 }, { width: 844, height: 390 },
    ];
    for (const viewport of viewports) {
      for (const id of ['shape-sailboat', 'shape-rocket']) {
        const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
        try {
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
          await page.goto(`${origin}${directory}/?test`);
          await page.locator('[data-category="shapes"]').click();
          await page.locator('label:has(input[name="difficulty"][value="easy"])').click();
          await page.evaluate(async ({ id, version }) => {
            const { buildSession, seededRandom } = await import(`./js/curriculum.js?v=${version}`);
            for (let seed = 1; seed < 10000; seed += 1) {
              if (buildSession({ category: 'shapes', difficulty: 'easy', rng: seededRandom(seed) })[0].id === id) {
                Math.random = seededRandom(seed);
                return;
              }
            }
            throw new Error(`No session seed for ${id}`);
          }, { id, version });
          await page.locator('#start-button').click();
          await page.waitForFunction((id) => window.__fuchsschrift?.getState().task === id, id);
          const ink = await page.evaluate((id) => {
            const board = window.__fuchsschrift.board;
            board.stopDemo();
            const rect = board.canvas.getBoundingClientRect();
            const unit = Math.min(rect.width, rect.height);
            return board.task.strokes.map((stroke, index) => stroke.map((point) => {
              const x = id === 'shape-sailboat'
                ? point.x - (index === 1 ? 0.02 * unit / rect.width : 0)
                : point.x + (index === 2 || index === 3 ? (0.5 - point.x) * 0.2 : 0);
              const y = point.y + (id === 'shape-rocket' && (index === 2 || index === 3) ? 0.07 * unit / rect.height : 0);
              return { x: rect.x + x * rect.width, y: rect.y + y * rect.height };
            }));
          }, id);
          const draw = async (stroke) => {
            await page.mouse.move(stroke[0].x, stroke[0].y);
            await page.mouse.down();
            for (let index = 1; index < stroke.length; index += 1) {
              const a = stroke[index - 1], b = stroke[index];
              await page.mouse.move(b.x, b.y, { steps: Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)) });
            }
            await page.mouse.up();
          };
          for (const stroke of ink.slice(0, -1)) {
            await draw(stroke);
            // Exercise the real 90 ms stroke-end check and preview callback.
            await page.waitForTimeout(180);
            const state = await page.evaluate(() => window.__fuchsschrift.evaluationSnapshot());
            assert.equal(state.index, 0, `${id}: advanced before final part`);
            assert.equal(state.transitioning, false, `${id}: celebrated before final part`);
            assert.equal(state.allRequired, false, `${id}: marked incomplete ink as complete`);
          }
          const key = `${directory ? 'testversion' : 'main'}-${id}-${viewport.width}x${viewport.height}`;
          await page.evaluate(() => window.__fuchsschrift.board.stopDemo());
          const beforeFinal = await page.evaluate(() => {
            const b = window.__fuchsschrift.board;
            return {
              ...window.__fuchsschrift.evaluationSnapshot(),
              shapePathPresence: b.currentEvaluation().shapePathPresence,
              nextGuideStrokeIndex: b.nextGuideStrokeIndex(),
              visibleGuideStrokeIndexes: b.visibleGuideStrokeIndexes(),
            };
          });
          assert.equal(beforeFinal.shapePathPresence.at(-1), false);
          assert.equal(beforeFinal.nextGuideStrokeIndex, ink.length - 1);
          assert.ok(beforeFinal.visibleGuideStrokeIndexes.includes(ink.length - 1));
          await page.screenshot({ path: `${output}/${key}-waiting.png` });
          await draw(ink.at(-1));
          await page.waitForFunction(() => window.__fuchsschrift.evaluationSnapshot().transitioning);
          await page.screenshot({ path: `${output}/${key}-complete.png` });
          await page.waitForFunction(() => window.__fuchsschrift.getState().index === 1);
          assert.deepEqual(errors, []);
          report.push({ directory: directory || '/', id, viewport, waitedForFinalPart: true, completedAfterFinalPart: true, errors });
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.length} real-pointer picture completion scenarios, no browser errors`);
