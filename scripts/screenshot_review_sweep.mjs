#!/usr/bin/env node
/**
 * Drives the ?test review mode ("Alle Symbole") through all 69 symbols —
 * A–Z, Ä Ö Ü ß, a–z, ä ö ü, 0–9 — and screenshots every task for a final
 * sprite review.
 *
 * Each capture shows the grey template sprite with Fino waiting at the
 * first stroke's start point. The auto-demo is neutralised before the
 * session starts so Fino never runs off mid-capture — deterministic start
 * positions instead of timing luck. Screenshots land in
 * `qa-sprite-sweep/` (configurable) as `NN-symbol.png`, plus
 * `summary.json` and an `index.html` gallery.
 *
 * Usage:
 *   node scripts/screenshot_review_sweep.mjs
 *   FINO_QA_URL=http://127.0.0.1:4173/?test \
 *   FINO_SWEEP_OUTPUT=qa-sprite-sweep \
 *   node scripts/screenshot_review_sweep.mjs
 *
 * Requires the app to be served locally with `?test` in the URL (the review
 * card only appears then) and playwright installed:
 *   npm install --save-dev playwright
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Playwright ist nicht installiert. Bitte ausführen: npm install --save-dev playwright');
  process.exit(1);
}
const { chromium } = playwright;

const BASE_URL = process.env.FINO_QA_URL ?? 'http://127.0.0.1:4173/?test';
const OUTPUT = resolve(process.env.FINO_SWEEP_OUTPUT ?? 'qa-sprite-sweep');
// Landscape and large enough that the rotate-suggestion overlay never
// appears on top of the drawing card.
const VIEWPORT = { width: 1024, height: 768 };

// Fixed order from buildReviewSession in js/curriculum.js — used as a
// fallback name if the live task id cannot be read.
const SEQUENCE = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß',
  ...'abcdefghijklmnopqrstuvwxyzäöü',
  ...'0123456789',
];

function symbolFromTaskId(id) {
  const match = /^(?:letter|number)-(.+)-gross$/.exec(id ?? '');
  return match ? match[1] : null;
}

mkdirSync(OUTPUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const reviewCard = page.locator('[data-category="review"]');
  await reviewCard.waitFor({ timeout: 10_000 });
  // Keep Fino parked on the first stroke's start point: without this the
  // auto-demo (assist 'easy') runs the stroke and he ends up mid-route or
  // at the stroke's end when the screenshot fires.
  await page.evaluate(() => {
    const board = window.__fuchsschrift?.board;
    if (board) board.startDemo = async () => {};
  });
  await reviewCard.click();
  await page.locator('#start-button').click();
  await page.locator('#practice-screen:not([hidden])').waitFor();

  const captured = [];
  for (let index = 0; index < SEQUENCE.length; index += 1) {
    const expectedText = `${index + 1} von ${SEQUENCE.length}`;
    // renderTask updates the counter and draws the sprite synchronously in
    // the same block, so once the counter reads this task, the canvas is
    // already painted with Fino parked at the first stroke's start.
    await page.waitForFunction(
      (text) => document.getElementById('progress-text')?.textContent === text,
      expectedText,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(60);

    const taskId = await page.evaluate(() => window.__fuchsschrift?.getCurrentTask()?.id ?? null);
    const symbol = symbolFromTaskId(taskId) ?? SEQUENCE[index];
    const fileName = `${String(index + 1).padStart(2, '0')}-${symbol}.png`;
    await page.locator('#drawing-card').screenshot({ path: resolve(OUTPUT, fileName) });
    captured.push({ index: index + 1, symbol, taskId, file: fileName });
    console.log(`captured ${expectedText}  ${fileName}`);

    if (index < SEQUENCE.length - 1) {
      await page.locator('#next-task-button:not([disabled])').click();
    }
  }

  writeFileSync(resolve(OUTPUT, 'summary.json'), JSON.stringify({ url: BASE_URL, captured }, null, 2));

  const rows = captured.map((entry) => `
      <figure>
        <img src="${encodeURIComponent(entry.file)}" alt="${entry.symbol}" loading="lazy">
        <figcaption><strong>${entry.symbol}</strong> — ${entry.taskId ?? ''}</figcaption>
      </figure>`).join('');
  writeFileSync(resolve(OUTPUT, 'index.html'), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sprite-Review (${captured.length} Symbole)</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf6ed; color: #2a2a33; margin: 0; padding: 24px; }
  h1 { font-size: 1.2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  figure { margin: 0; background: #fff; border: 1px solid #e4ddd0; border-radius: 12px; padding: 8px; }
  img { width: 100%; display: block; border-radius: 8px; background: #fff; }
  figcaption { margin-top: 6px; font-size: .85rem; text-align: center; }
</style></head><body>
<h1>Sprite-Review — ${captured.length} Symbole (${BASE_URL})</h1>
<div class="grid">${rows}
</div></body></html>
`);

  console.log(`\nFertig: ${captured.length} Screenshots in ${OUTPUT}`);
  if (errors.length) {
    console.warn(`\n${errors.length} console/page errors gesehen:`);
    errors.forEach((message) => console.warn(`  - ${message}`));
  } else {
    console.log('Keine console/page errors.');
  }
} finally {
  await browser.close();
}
