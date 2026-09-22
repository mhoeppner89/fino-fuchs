import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const output = 'test-artifacts/mse-browser';
mkdirSync(output, { recursive: true });
const fixtures = ['handwritten-a', 'handwritten-a-rough', 'handwritten-r'].map((name) => ({
  name, ...JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url))),
}));
const reports = [];
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const start = async () => {
      await page.goto(process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173/?test');
      await page.locator('[data-category="review"]').click();
      await page.locator('#start-button').click();
      await page.waitForFunction(() => window.__fuchsschrift?.board.task);
      await page.evaluate(() => window.__fuchsschrift.board.stopDemo());
    };
    for (const fixture of fixtures) {
      await start();
      const data = await page.evaluate((fixture) => {
        const board = window.__fuchsschrift.board;
        const rect = board.canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / fixture.width, rect.height / fixture.height) * 0.94;
        const transform = (strokes) => strokes.map((stroke) => stroke.map((p) => ({
          x: 0.5 + (p.x - 0.5) * fixture.width * scale / rect.width,
          y: 0.5 + (p.y - 0.5) * fixture.height * scale / rect.height,
        })));
        // Replay the documented screenshot reconstructions with their registered
        // templates, uniformly fitted to the actual canvas. Input uses the real
        // browser pointer pipeline and the app's normal completion callback.
        board.setTask({ ...fixture.task, strokes: transform(fixture.task.strokes) }, 'easy');
        return { strokes: transform(fixture.strokes), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
      }, fixture);
      const initialGuide = await page.evaluate(() => JSON.stringify(window.__fuchsschrift.board.task.strokes));
      for (const [index, stroke] of data.strokes.entries()) {
        const toClient = (point) => ({ x: data.rect.x + point.x * data.rect.width, y: data.rect.y + point.y * data.rect.height });
        const first = toClient(stroke[0]);
        await page.mouse.move(first.x, first.y);
        await page.mouse.down();
        for (const point of stroke.slice(1)) {
          const client = toClient(point);
          await page.mouse.move(client.x, client.y);
        }
        await page.mouse.up();
        const result = await page.evaluate(() => window.__fuchsschrift.evaluationSnapshot());
        assert.equal(result.allRequired, index === data.strokes.length - 1, `${engine} ${fixture.name} stroke ${index}`);
        assert.equal(await page.evaluate(() => JSON.stringify(window.__fuchsschrift.board.task.strokes)), initialGuide);
      }
      await page.screenshot({ path: `${output}/${engine}-${fixture.name}.png` });
      await page.waitForFunction(() => window.__fuchsschrift.getState().index === 1);
      reports.push({ engine, case: fixture.name, passed: true });
    }
    await start();
    // Sparse pen input: a crossbar may arrive as down/up without any move.
    const endpoint = await page.evaluate(() => {
      const board = window.__fuchsschrift.board;
      board.clear();
      board.hooks.onStrokeEnd = () => {};
      // Synthetic pen events have no OS pointer for browser capture. The real
      // mouse replays above exercise capture; this case targets sparse events.
      const capture = board.canvas.setPointerCapture;
      board.canvas.setPointerCapture = () => {};
      const rect = board.canvas.getBoundingClientRect();
      const fire = (type, x, y) => board.canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 17, pointerType: 'pen', isPrimary: true, bubbles: true,
        clientX: rect.x + x * rect.width, clientY: rect.y + y * rect.height,
        buttons: type === 'pointerup' ? 0 : 1, pressure: type === 'pointerup' ? 0 : 0.5,
      }));
      fire('pointerdown', 0.3, 0.5);
      fire('pointerup', 0.7, 0.5);
      const line = board.getUserStrokes()[0];
      fire('pointerdown', 0.5, 0.2);
      fire('pointerup', 0.5, 0.2);
      const dot = board.getUserStrokes()[1];
      board.canvas.setPointerCapture = capture;
      return { line, dot };
    });
    assert.equal(endpoint.line.length, 2);
    assert.ok(Math.abs(endpoint.line.at(-1).x - 0.7) < 1e-6);
    assert.equal(endpoint.dot.length, 1);
    reports.push({ engine, case: 'sparse pen endpoint and stationary tap', passed: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
writeFileSync(`${output}/report.json`, JSON.stringify(reports, null, 2));
console.log(`PASS: ${reports.length} browser scenarios, Chromium and WebKit, no page or console errors`);
