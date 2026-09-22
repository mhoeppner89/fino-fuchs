import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173/testversion/?test');
  await page.locator('[data-category="review"]').click();
  await page.locator('label:has(input[name="difficulty"][value="hard"])').click();
  await page.locator('#start-button').click();
  await page.waitForFunction(() => window.__fuchsschrift?.getState().screen === 'practice' && window.__fuchsschrift.board.task);
  const expected = await page.evaluate(async () => {
    const { buildReviewSession } = await import('./js/curriculum.js?v=1.3.42');
    return buildReviewSession().map((task) => task.id);
  });
  assert.equal(expected.length, 69);
  for (let i = 0; i < expected.length; i++) {
    const state = await page.evaluate(() => window.__fuchsschrift.getState());
    assert.equal(state.task, expected[i]);
    assert.equal(state.assist, 'hard');
    assert.equal(await page.locator('#progress-text').textContent(), `${i + 1} von 69`);
    if (i < expected.length - 1) await page.locator('#next-task-button').click();
  }
  assert.equal(await page.locator('#next-task-button').isDisabled(), true);
  await page.locator('#previous-task-button').click();
  assert.equal((await page.evaluate(() => window.__fuchsschrift.getState())).index, 67);
  mkdirSync('test-artifacts/review', { recursive: true });
  await page.screenshot({ path: 'test-artifacts/review/sequence.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: all 69 symbols in order, selected hard difficulty, next/previous navigation, no page errors');
} finally {
  await browser.close();
}
