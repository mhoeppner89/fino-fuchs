#!/usr/bin/env node
/**
 * Cross-browser matrix check: drives the ?test review mode ("Alle Symbole")
 * through all 69 symbols (A–Z, Ä Ö Ü ß, a–z, ä ö ü, 0–9) in every engine and
 * verifies that each task actually renders: grey sprite ink present, Fino
 * present, task id matching the expected sequence, no console/page errors.
 *
 * Screenshots land in `qa-browser-matrix/<engine>/NN-symbol.png` plus
 * `summary.json` and an `index.html` gallery per engine; a combined
 * `qa-browser-matrix/README.md` lists every engine run found.
 *
 * Usage (needs the local server, default http://127.0.0.1:4173/?test, and
 * playwright browsers — for the project-local cache set
 * PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers):
 *
 *   PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers \
 *   node scripts/browser_matrix_check.mjs --engine chromium   # or webkit|firefox|all
 *
 * `webkit` is the Safari engine — it is what "does it work in Safari"
 * means in a scripted check; for the Safari.app itself open the URL
 * manually (Playwright cannot drive the system Safari).
 *
 * macOS-14 note: playwright pins webkit to build 2251 on mac14/arm64, and
 * that artifact predates the `PushAPIEnabled` protocol setting that the
 * 1.62.x driver sends on every page (playwright PR #41660, July 2026) —
 * newPage fails with "Unknown setting: PushAPIEnabled". Until upstream
 * publishes a rebuilt mac14 artifact, keep the local one-line patch in
 * node_modules/playwright-core/lib/coreBundle.js (comment out the
 * PushAPIEnabled overrideSetting line). It only gates Push-API mocking,
 * which these smoke tests do not use. A fresh `npm install` removes the
 * patch — reapply it when webkit matrix runs start failing again.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Playwright ist nicht installiert. Bitte ausführen: npm install --save-dev playwright');
  process.exit(1);
}

const engineArg = (process.argv.find((arg) => arg.startsWith('--engine')) ?? '--engine chromium')
  .split('=')[1] ?? process.argv[process.argv.indexOf('--engine') + 1] ?? 'chromium';
const ENGINES = engineArg === 'all' ? ['chromium', 'webkit', 'firefox'] : [engineArg];

const BASE_URL = process.env.FINO_QA_URL ?? 'http://127.0.0.1:4173/?test';
const OUTPUT_ROOT = resolve(process.env.FINO_MATRIX_OUTPUT ?? 'qa-browser-matrix');
const VIEWPORT = { width: 1024, height: 768 };

const SEQUENCE = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß',
  ...'abcdefghijklmnopqrstuvwxyzäöü',
  ...'0123456789',
];

function symbolFromTaskId(id) {
  const match = /^(?:letter|number)-(.+)-gross$/.exec(id ?? '');
  return match ? match[1] : null;
}

/** Pixel smoke probe on the live board canvas. Must stay a real function:
 * Playwright only auto-invokes functions, not function-valued strings. */
function boardProbe() {
  const canvas = document.querySelector('#drawing-card canvas') ?? document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  if (!w || !h) return { error: 'empty canvas' };
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (error) {
    return { error: String(error) };
  }
  const ink = { count: 0, minX: w, minY: h, maxX: -1, maxY: -1 };
  const fox = { count: 0, minX: w, minY: h, maxX: -1, maxY: -1 };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] < 8) continue;
      if (r > 185 && g < 185 && b < 145 && (r - b) > 55) {
        fox.count += 1;
        if (x < fox.minX) fox.minX = x; if (x > fox.maxX) fox.maxX = x;
        if (y < fox.minY) fox.minY = y; if (y > fox.maxY) fox.maxY = y;
        continue;
      }
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Sprite grey renders around lum 190; the light guide rows sit at 230+.
      if (lum < 215) {
        ink.count += 1;
        if (x < ink.minX) ink.minX = x; if (x > ink.maxX) ink.maxX = x;
        if (y < ink.minY) ink.minY = y; if (y > ink.maxY) ink.maxY = y;
      }
    }
  }
  return { w, h, ink, fox };
}

async function runEngine(engine) {
  const browserType = playwright[engine];
  if (!browserType) throw new Error(`unknown engine: ${engine}`);
  const output = resolve(OUTPUT_ROOT, engine);
  mkdirSync(output, { recursive: true });

  const launchOptions = { headless: true };
  if (engine === 'chromium') launchOptions.args = ['--use-gl=angle', '--use-angle=swiftshader'];
  const browser = await browserType.launch(launchOptions);
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

  const captured = [];
  const failures = [];
  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
    const reviewCard = page.locator('[data-category="review"]');
    await reviewCard.waitFor({ timeout: 15_000 });
    // Park Fino on each task's start point: neutralise the auto-demo.
    const parked = await page.evaluate(() => {
      const board = window.__fuchsschrift?.board;
      if (!board) return false;
      board.startDemo = async () => {};
      return true;
    });
    if (!parked) throw new Error('window.__fuchsschrift.board not reachable');

    await reviewCard.click();
    await page.locator('#start-button').click();
    await page.locator('#practice-screen:not([hidden])').waitFor();

    for (let index = 0; index < SEQUENCE.length; index += 1) {
      const expectedSymbol = SEQUENCE[index];
      const expectedText = `${index + 1} von ${SEQUENCE.length}`;
      await page.waitForFunction(
        (text) => document.getElementById('progress-text')?.textContent === text,
        expectedText,
        { timeout: 15_000 },
      );
      await page.evaluate(() => {
        const board = window.__fuchsschrift?.board;
        if (board) board.startDemo = async () => {};
      });
      await page.waitForTimeout(50);

      const taskId = await page.evaluate(() => window.__fuchsschrift?.getCurrentTask()?.id ?? null);
      const symbol = symbolFromTaskId(taskId);
      const probe = await page.evaluate(boardProbe);
      const entry = {
        index: index + 1,
        expected: expectedSymbol,
        symbol: symbol ?? expectedSymbol,
        taskId,
        inkPixels: probe?.ink?.count ?? 0,
        inkBox: probe?.ink ? [probe.ink.minX, probe.ink.minY, probe.ink.maxX, probe.ink.maxY] : null,
        foxPixels: probe?.fox?.count ?? 0,
        probeError: probe?.error ?? null,
      };
      const problems = [];
      if (symbol !== expectedSymbol) problems.push(`task id ${taskId} != expected ${expectedSymbol}`);
      if (probe?.error) problems.push(`probe: ${probe.error}`);
      else {
        if ((probe?.ink?.count ?? 0) < 250) problems.push(`sprite ink too small (${probe?.ink?.count}px)`);
        if ((probe?.fox?.count ?? 0) === 0) problems.push('fox not found on board');
      }
      entry.ok = problems.length === 0;
      if (problems.length) failures.push({ ...entry, problems });

      const fileName = `${String(index + 1).padStart(2, '0')}-${expectedSymbol}.png`;
      await page.locator('#drawing-card').screenshot({ path: resolve(output, fileName) });
      entry.file = fileName;
      captured.push(entry);
      console.log(`${engine} ${expectedText}  ${expectedSymbol}${entry.ok ? '' : `  !! ${problems.join('; ')}`}`);

      if (index < SEQUENCE.length - 1) {
        await page.locator('#next-task-button:not([disabled])').click();
      }
    }
  } catch (error) {
    failures.push({ fatal: String(error?.stack ?? error) });
  } finally {
    await browser.close();
  }

  writeFileSync(resolve(output, 'summary.json'), JSON.stringify({
    engine, url: BASE_URL, captured: captured.length, failures, errors, capturedList: captured,
  }, null, 2));

  const rows = captured.map((entry) => `
      <figure${entry.ok ? '' : ' style="outline:3px solid #d33"'}>
        <img src="${encodeURIComponent(entry.file)}" alt="${entry.expected}" loading="lazy">
        <figcaption><strong>${entry.expected}</strong> — ${entry.ok ? 'ok' : 'PROBLEM'}</figcaption>
      </figure>`).join('');
  writeFileSync(resolve(output, 'index.html'), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browser-Matrix ${engine} (${captured.length} Symbole)</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf6ed; color: #2a2a33; margin: 0; padding: 24px; }
  h1 { font-size: 1.2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
  figure { margin: 0; background: #fff; border: 1px solid #e4ddd0; border-radius: 12px; padding: 8px; }
  img { width: 100%; display: block; border-radius: 8px; background: #fff; }
  figcaption { margin-top: 6px; font-size: .85rem; text-align: center; }
</style></head><body>
<h1>${engine} — ${captured.length} Symbole (${BASE_URL})</h1>
<div class="grid">${rows}
</div></body></html>
`);

  console.log(`\n[${engine}] captured ${captured.length}/${SEQUENCE.length}, failures: ${failures.length}, console/page errors: ${errors.length}`);
  errors.slice(0, 10).forEach((message) => console.warn(`  error: ${message.slice(0, 200)}`));
  return { engine, captured: captured.length, failures, errors };
}

const results = [];
for (const engine of ENGINES) {
  results.push(await runEngine(engine));
}

// Combined README over every engine directory found.
const engineDirs = existsSync(OUTPUT_ROOT)
  ? readdirSync(OUTPUT_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  : [];
const combined = engineDirs.map((engine) => {
  const summaryPath = resolve(OUTPUT_ROOT, engine, 'summary.json');
  if (!existsSync(summaryPath)) return `- ${engine}: (kein summary.json)`;
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  return `- ${engine}: ${summary.captured}/69 Symbole, ${summary.failures.length} Fehler, ${summary.errors.length} Console-Errors — Gallery: \`${engine}/index.html\``;
}).join('\n');
writeFileSync(resolve(OUTPUT_ROOT, 'README.md'), `# Browser-Matrix — 69 Symbole\n\n${combined}\n`);

const broken = results.filter((result) => result.failures.length || result.errors.length || result.captured !== SEQUENCE.length);
console.log(`\nMatrix: ${results.map((r) => `${r.engine}=${r.captured}/${SEQUENCE.length}${r.failures.length ? ` (${r.failures.length} failures)` : ''}`).join(', ')}`);
process.exit(broken.length ? 1 : 0);
