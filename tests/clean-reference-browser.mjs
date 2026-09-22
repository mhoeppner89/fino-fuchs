import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';
const output = 'test-artifacts/clean-paths/browser';
mkdirSync(output, { recursive: true });
const report = [];
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:4173/testversion/calibration.html');
    for (const ch of ['M', 'O', 'n', '8', 'Ä']) {
      await page.locator('.target-row').filter({ has: page.locator('strong', { hasText: new RegExp(`^${ch}$`) }) }).click();
      const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      assert.equal(state.target.label, ch);
      assert.equal(state.target.total, 69);
      const darkestGuidePixel = await page.locator('#calibration-canvas').evaluate((canvas) => {
        const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        let minRed = 255;
        for (let i = 0; i < data.length; i += 4) minRed = Math.min(minRed, data[i]);
        return minRed;
      });
      assert.ok(darkestGuidePixel >= 151, `${engine} ${ch}: guide joins darkened to ${darkestGuidePixel}`);
      await page.locator('#calibration-canvas').screenshot({ path: `${output}/${engine}-calibration-${ch}.png` });
    }
    await page.goto('http://127.0.0.1:4173/testversion/?test');
    await page.locator('[data-category="review"]').click();
    await page.locator('#start-button').click();
    await page.waitForFunction(() => window.__fuchsschrift?.board.task);
    for (let i = 0; i < 12; i++) await page.locator('#next-task-button').click();
    assert.equal((await page.evaluate(() => window.__fuchsschrift.getState())).task, 'letter-M-gross');
    await page.evaluate(() => window.__fuchsschrift.board.stopDemo());
    await page.locator('#show-button').click();
    await page.waitForFunction(() => window.__fuchsschrift.board.demoProgress > 0.15);
    const demo = await page.evaluate(() => {
      const b = window.__fuchsschrift.board;
      return { progress: b.demoProgress, point: b.demoFoxPosition(), vertices: b.task.strokes[0].length };
    });
    assert.equal(demo.vertices, 5);
    assert.ok(demo.point && demo.progress < 1);
    await page.screenshot({ path: `${output}/${engine}-fino-M.png` });
    await page.evaluate(() => window.__fuchsschrift.board.stopDemo());
    const pen = await page.evaluate(() => {
      const b = window.__fuchsschrift.board;
      const rect = b.canvas.getBoundingClientRect();
      return b.task.strokes[0].map((p) => ({ x: rect.x+p.x*rect.width, y: rect.y+p.y*rect.height }));
    });
    await page.mouse.move(pen[0].x, pen[0].y);
    await page.mouse.down();
    for (let i = 1; i < pen.length; i++) {
      const a = pen[i-1], b = pen[i];
      const steps = Math.ceil(Math.hypot(b.x-a.x, b.y-a.y)/10);
      for (let j = 1; j <= steps; j++) await page.mouse.move(a.x+(b.x-a.x)*j/steps, a.y+(b.y-a.y)*j/steps);
    }
    await page.mouse.up();
    await page.waitForFunction(() => window.__fuchsschrift.getState().index === 13);
    assert.deepEqual(errors, []);
    report.push({ engine, calibration: ['M', 'O', 'n', '8', 'Ä'], FinoPreview: 'M', cleanMDrawingAdvances: true, errors });
  } finally { await browser.close(); }
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log('PASS: calibration reference previews, live Fino preview, and drawing completion in Chromium and WebKit');
