import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const output = 'test-artifacts/pictures-v146/browser';
mkdirSync(output, { recursive: true });
const report = [];
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:4173/testversion/calibration.html');
    await page.locator('#scope-select').selectOption('shapes');
    await page.locator('#mode-select').selectOption('whole');
    assert.equal(await page.locator('#scope-select option[value="shapes"]').textContent(), 'Nur Formen (66)');
    assert.equal(await page.locator('#scope-select option[value="all"]').textContent(), 'Buchstaben, Zahlen + Formen (135)');
    for (const ch of ['Planet', 'Zug', 'Pinguin']) {
      await page.locator('.target-row').filter({ has: page.locator('strong', { hasText: new RegExp(`^${ch}$`) }) }).click();
      const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      assert.equal(state.target.label, ch);
      assert.equal(state.target.total, 66);
      await page.locator('#calibration-canvas').screenshot({ path: `${output}/${engine}-${ch}.png` });
    }
    await page.goto('http://127.0.0.1:4173/testversion/?test');
    await page.locator('[data-category="shapes"]').click();
    await page.locator('label:has(input[name="difficulty"][value="hard"])').click();
    // Select a real session beginning with a new picture that includes taps.
    await page.evaluate(async () => {
      const { buildSession, seededRandom } = await import('./js/curriculum.js?v=1.3.48');
      for (let seed = 1; seed < 1000; seed++) {
        if (buildSession({ category: 'shapes', difficulty: 'hard', rng: seededRandom(seed) })[0].id === 'shape-penguin') {
          Math.random = seededRandom(seed);
          return;
        }
      }
      throw new Error('No penguin session seed found');
    });
    await page.locator('#start-button').click();
    await page.waitForFunction(() => window.__fuchsschrift?.board.task);
    // Use the live board renderer for every finished picture, then restore the
    // real session task before testing demonstration and pointer completion.
    const original = await page.evaluate(() => window.__fuchsschrift.board.task);
    assert.equal(original.id, 'shape-penguin');
    const tasks = await page.evaluate(async () => (await import('./js/curriculum.js?v=1.3.48')).EXERCISE_BANKS.shapes.map(t => ({ id: t.id, title: t.title })));
    for (const task of tasks) {
      const pass = await page.evaluate(async (id) => {
        const { EXERCISE_BANKS, adaptTaskToViewport } = await import('./js/curriculum.js?v=1.3.48');
        const { passesDrawingCriteria } = await import('./js/drawing.js?v=1.3.48');
        const board = window.__fuchsschrift.board;
        const target = adaptTaskToViewport(EXERCISE_BANKS.shapes.find(t => t.id === id), { width: board.width, height: board.height });
        board.setTask(target, 'easy');
        board.setUserStrokes(target.strokes);
        return passesDrawingCriteria(board.currentEvaluation(), 'easy', { qualityAdjustment: 0.045 });
      }, task.id);
      assert.equal(pass, true, `${engine}: ${task.id} exact trace`);
      await page.locator('#drawing-canvas').screenshot({ path: `${output}/${engine}-${task.id}.png` });
    }
    await page.evaluate((task) => window.__fuchsschrift.board.setTask(task, 'hard'), original);
    await page.locator('#show-button').click();
    await page.waitForFunction(() => window.__fuchsschrift.board.demoProgress > 0.1);
    assert.ok(await page.evaluate(() => window.__fuchsschrift.board.demoFoxPosition()));
    await page.screenshot({ path: `${output}/${engine}-fino.png` });
    await page.evaluate(() => window.__fuchsschrift.board.stopDemo());
    const initial = await page.evaluate(() => window.__fuchsschrift.getState().index);
    const strokes = await page.evaluate(() => {
      const board = window.__fuchsschrift.board;
      const rect = board.canvas.getBoundingClientRect();
      return board.task.strokes.map(s => s.map(p => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height })));
    });
    for (const stroke of strokes) {
      await page.mouse.move(stroke[0].x, stroke[0].y);
      await page.mouse.down();
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i-1], b = stroke[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x, b.y-a.y) / 8));
        for (let j = 1; j <= steps; j++) await page.mouse.move(a.x+(b.x-a.x)*j/steps, a.y+(b.y-a.y)*j/steps);
      }
      await page.mouse.up();
    }
    await page.waitForFunction((index) => window.__fuchsschrift.getState().index > index, initial);
    assert.deepEqual(errors, []);
    report.push({ engine, rendered: tasks.length, calibration: ['Planet', 'Zug', 'Pinguin'], demonstratedAndDrawn: original.id, advanced: true, errors });
  } finally { await browser.close(); }
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
