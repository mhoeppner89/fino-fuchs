#!/usr/bin/env node
/**
 * Real functional check: WRITES the taught routes with genuine pointer input
 * (mouse through Playwright's input pipeline, WebDriver Actions in real
 * Safari) and verifies the app's answers — success overlay + task advance,
 * multi-stroke progression, out-of-order strokes, rejection of scribbles,
 * umlaut dots, the ß symbol, the Fino preview, and the evaluator API.
 *
 * Runs against the ?test review mode for a deterministic task order
 * (A … ß at index 29, digits at 59–68).
 *
 * Usage (needs the local server, default http://127.0.0.1:4173/?test):
 *
 *   PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers \
 *   node scripts/browser_functional_check.mjs --engine webkit   # Safari engine
 *   node scripts/browser_functional_check.mjs --engine firefox
 *   node scripts/browser_functional_check.mjs --engine chromium # control
 *   node scripts/browser_functional_check.mjs --engine safari   # real Safari.app
 *       (requires `safaridriver --enable`, an admin one-time setting)
 *
 * Writes a report to qa-functional/<engine>-report.md and exits non-zero on
 * any failed check.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);

const engineArg = (() => {
  const flag = process.argv.indexOf('--engine');
  return flag >= 0 ? process.argv[flag + 1] : 'webkit';
})();
const BASE_URL = process.env.FINO_QA_URL ?? 'http://127.0.0.1:4173/?test';
const OUTPUT_ROOT = resolve(process.env.FINO_FUNC_OUTPUT ?? 'qa-functional');
const VIEWPORT = { width: 1024, height: 768 };

// Review-session indices (buildReviewSession order).
const INDEX = { A: 0, K: 10, S: 18, ss: 29, oe: 57, five: 64, eight: 67, nine: 68 };

/* ------------------------------ page helpers ----------------------------- */

// Executed in the page: read app state + board data. Real functions —
// Playwright serializes them directly; Safari gets .toString() + an IIFE wrap.
function readPageState() {
  const api = window.__fuchsschrift;
  if (!api) return null;
  const state = api.getState();
  const task = api.getCurrentTask();
  const toast = document.getElementById('toast');
  const canvas = document.querySelector('#drawing-card canvas');
  const rect = canvas ? canvas.getBoundingClientRect() : null;
  return {
    ...state,
    taskId: state.task,
    strokes: task?.strokes ?? null,
    completionGroups: task?.completionGroups ?? null,
    toast: { hidden: toast?.hidden ?? true, text: toast?.textContent ?? '' },
    canvasRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
  };
}

// Executed in the page: fox (orange) pixel probe for the demo check.
function readFoxProbe() {
  const canvas = document.querySelector('#drawing-card canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  let count = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] < 8) continue;
      if (r > 185 && g < 185 && b < 145 && (r - b) > 55) { count += 1; sx += x; sy += y; }
    }
  }
  return count ? { count, cx: sx / count, cy: sy / count } : { count: 0 };
}

function densifyStroke(stroke, rect, jitterSeed = 0) {
  const points = [];
  const toClient = (p) => ({
    x: rect.left + p.x * rect.width,
    y: rect.top + p.y * rect.height,
  });
  const push = (p) => points.push(p);
  push(toClient(stroke[0]));
  for (let i = 1; i < stroke.length; i += 1) {
    const a = toClient(stroke[i - 1]);
    const b = toClient(stroke[i]);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let s = 1; s <= steps; s += 1) {
      push({ x: a.x + (b.x - a.x) * (s / steps), y: a.y + (b.y - a.y) * (s / steps) });
    }
  }
  // Child-like wobble everywhere except the exact start point (the taught
  // start matters to the evaluator).
  return points.map((p, i) => {
    if (i === 0) return p;
    const wobble = Math.sin((i + jitterSeed) * 1.7) * 0.7;
    return { x: p.x + wobble, y: p.y - wobble * 0.6 };
  });
}

function scribblePoints(rect) {
  // A loose zig-zag in the top-left corner, far from every glyph's ink.
  const pts = [];
  for (let i = 0; i < 14; i += 1) {
    pts.push({
      x: rect.left + rect.width * (0.06 + 0.1 * (i % 2)) + i * 2,
      y: rect.top + rect.height * (0.06 + 0.012 * i),
    });
  }
  return pts;
}

/* --------------------------- playwright backend -------------------------- */

class PlaywrightEngine {
  constructor(playwright, engine) { this.playwright = playwright; this.engine = engine; }
  async start() {
    const launchOptions = { headless: true };
    if (this.engine === 'chromium') launchOptions.args = ['--use-gl=angle', '--use-angle=swiftshader'];
    this.browser = await this.playwright[this.engine].launch(launchOptions);
    this.context = await this.browser.newContext({ viewport: VIEWPORT });
    this.page = await this.context.newPage();
    this.errors = [];
    this.page.on('console', (m) => { if (m.type() === 'error') this.errors.push(m.text()); });
    this.page.on('pageerror', (e) => this.errors.push(`pageerror: ${e.message}`));
    await this.page.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
    await this.page.locator('[data-category="review"]').waitFor({ timeout: 15_000 });
    await this.page.locator('[data-category="review"]').click();
    await this.page.locator('#start-button').click();
    await this.page.locator('#practice-screen:not([hidden])').waitFor();
  }
  async state() { return this.page.evaluate(readPageState); }
  async fox() { return this.page.evaluate(readFoxProbe); }
  async navigateTo(targetIndex) {
    for (let guard = 0; guard < 120; guard += 1) {
      const state = await this.state();
      if (state.index === targetIndex && !state.transitioning) return state;
      if (!state.transitioning) {
        const button = targetIndex > state.index ? '#next-task-button' : '#previous-task-button';
        await this.page.evaluate((sel) => document.querySelector(sel)?.click(), button);
      }
      await this.page.waitForTimeout(120);
    }
    throw new Error(`navigation to index ${targetIndex} failed`);
  }
  async drawPoints(points) {
    const [first, ...rest] = points;
    await this.page.mouse.move(first.x, first.y);
    await this.page.mouse.down();
    for (const p of rest) await this.page.mouse.move(p.x, p.y);
    await this.page.mouse.up();
  }
  async clickClear() { await this.page.evaluate(() => document.getElementById('clear-button')?.click()); }
  async callApi(name, ...args) {
    return this.page.evaluate(([name, args]) => window.__fuchsschrift[name]?.(...args), [name, args]);
  }
  async waitSuccess(indexBefore, timeout = 4000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const state = await this.state();
      if (state.index > indexBefore) return { advanced: true, ms: Date.now() - started, state };
      await this.page.waitForTimeout(120);
    }
    return { advanced: false, ms: timeout, state: await this.state() };
  }
  async waitNoSuccess(index, ms = 1500) {
    await this.page.waitForTimeout(ms);
    const state = await this.state();
    return { advanced: state.index > index, state };
  }
  async close() { await this.browser?.close(); }
}

/* ---------------------------- safari WebDriver --------------------------- */

class SafariEngine {
  constructor(port = 4466) { this.port = port; this.base = `http://127.0.0.1:${port}`; }
  async #request(method, path, body) {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    const value = payload.value ?? payload;
    if (value?.error) throw new Error(`WebDriver ${method} ${path}: ${value.error} ${value.message ?? ''}`.slice(0, 300));
    return value;
  }
  async start() {
    this.proc = spawn('/usr/bin/safaridriver', ['-p', String(this.port)], { stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 30 && !ready; i += 1) {
      try { await this.#request('GET', '/status'); ready = true; } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    if (!ready) throw new Error('safaridriver did not become ready');
    this.session = await this.#request('POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    this.id = this.session.sessionId;
    this.errors = [];
    await this.#request('POST', `/session/${this.id}/url`, { url: BASE_URL });
    // Wait for the review card and start the session.
    for (let i = 0; i < 50; i += 1) {
      const present = await this.evalJs(`return !!document.querySelector('[data-category=\"review\"]')`);
      if (present) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await this.evalJs(`return document.querySelector('[data-category=\"review\"]').click()`);
    for (let i = 0; i < 50; i += 1) {
      if (await this.evalJs(`return !document.getElementById('start-button').disabled`)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await this.evalJs(`return document.getElementById('start-button').click()`);
    for (let i = 0; i < 50; i += 1) {
      const visible = await this.evalJs(`return !document.getElementById('practice-screen').hidden`);
      if (visible) break;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  async evalJs(script) {
    const value = await this.#request('POST', `/session/${this.id}/execute/sync`, { script, args: [] });
    return value;
  }
  async state() { return this.evalJs(`return (${readPageState.toString()})();`); }
  async fox() { return this.evalJs(`return (${readFoxProbe.toString()})();`); }
  async navigateTo(targetIndex) {
    for (let guard = 0; guard < 120; guard += 1) {
      const state = await this.state();
      if (state.index === targetIndex && !state.transitioning) return state;
      if (!state.transitioning) {
        const button = targetIndex > state.index ? '#next-task-button' : '#previous-task-button';
        await this.evalJs(`return document.querySelector('${button}')?.click()`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`navigation to index ${targetIndex} failed`);
  }
  async drawPoints(points) {
    const actions = [];
    actions.push({ type: 'pointerMove', origin: 'viewport', x: Math.round(points[0].x), y: Math.round(points[0].y), duration: 30 });
    actions.push({ type: 'pointerDown', button: 0 });
    for (const p of points.slice(1)) {
      actions.push({ type: 'pointerMove', origin: 'viewport', x: Math.round(p.x), y: Math.round(p.y), duration: 1 });
    }
    actions.push({ type: 'pointerUp', button: 0 });
    await this.#request('POST', `/session/${this.id}/actions`, {
      actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'mouse' }, actions }],
    });
    await this.#request('DELETE', `/session/${this.id}/actions`);
  }
  async clickClear() { await this.evalJs(`return document.getElementById('clear-button')?.click()`); }
  async callApi(name, ...args) {
    return this.evalJs(`return window.__fuchsschrift[${JSON.stringify(name)}]?.(${args.map((a) => JSON.stringify(a)).join(',')})`);
  }
  async waitSuccess(indexBefore, timeout = 4000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const state = await this.state();
      if (state.index > indexBefore) return { advanced: true, ms: Date.now() - started, state };
      await new Promise((r) => setTimeout(r, 150));
    }
    return { advanced: false, ms: timeout, state: await this.state() };
  }
  async waitNoSuccess(index, ms = 1500) {
    await new Promise((r) => setTimeout(r, ms));
    const state = await this.state();
    return { advanced: state.index > index, state };
  }
  async close() {
    try { await this.#request('DELETE', `/session/${this.id}`); } catch { /* already gone */ }
    this.proc?.kill();
  }
}

/* ------------------------------- the checks ------------------------------ */

async function runChecks(engine) {
  const checks = [];
  const record = (name, passed, detail) => {
    checks.push({ name, passed, detail });
    console.log(`${passed ? '✔' : '✖'} ${name} — ${detail}`);
  };

  // 1. Fino preview runs on a fresh task (A).
  await engine.navigateTo(INDEX.A);
  await new Promise((r) => setTimeout(r, 250));
  const foxA = await engine.fox();
  await new Promise((r) => setTimeout(r, 550));
  const foxB = await engine.fox();
  const moved = foxA?.count > 30 && foxB?.count > 30
    && Math.hypot(foxB.cx - foxA.cx, foxB.cy - foxA.cy) > 4;
  record('fino-preview runs', Boolean(moved),
    `fox px ${foxA?.count}→${foxB?.count}, moved ${foxA?.count && foxB?.count ? Math.hypot(foxB.cx - foxA.cx, foxB.cy - foxA.cy).toFixed(1) : '?'}px`);

  // 2. Write A correctly with real pointer input.
  {
    const state = await engine.state();
    const rect = state.canvasRect;
    const before = state.index;
    for (const stroke of state.strokes) {
      await engine.drawPoints(densifyStroke(stroke, rect, 1));
      await new Promise((r) => setTimeout(r, 320));
    }
    const outcome = await engine.waitSuccess(before);
    const after = outcome.state;
    record('write A (2 strokes) is accepted', outcome.advanced && after.completed >= 1,
      `advanced=${outcome.advanced} in ${outcome.ms}ms, index ${before}→${after.index}, completed=${after.completed}, userStrokes=${(await engine.callApi('evaluationSnapshot')) ? 'ok' : '?'}`);
  }

  // 3. Multi-stroke K: two strokes are not enough, three are.
  {
    const state = await engine.navigateTo(INDEX.K);
    const rect = state.canvasRect;
    const before = state.index;
    await engine.drawPoints(densifyStroke(state.strokes[0], rect, 2));
    await new Promise((r) => setTimeout(r, 350));
    await engine.drawPoints(densifyStroke(state.strokes[1], rect, 3));
    const partial = await engine.waitNoSuccess(before);
    const snapshot = await engine.callApi('evaluationSnapshot');
    record('K accepts first two strokes without finishing', !partial.advanced,
      `advanced=${partial.advanced}, completion after 2 strokes=${snapshot?.completion?.toFixed?.(2)}`);
    await engine.drawPoints(densifyStroke(state.strokes[2], rect, 4));
    const outcome = await engine.waitSuccess(before);
    record('K finishes on the third stroke', outcome.advanced, `index ${before}→${outcome.state.index}, completed=${outcome.state.completed}`);
  }

  // 4. ß — the new symbol, written end to end.
  {
    const state = await engine.navigateTo(INDEX.ss);
    const rect = state.canvasRect;
    const before = state.index;
    for (const stroke of state.strokes) {
      await engine.drawPoints(densifyStroke(stroke, rect, 5));
      await new Promise((r) => setTimeout(r, 320));
    }
    const outcome = await engine.waitSuccess(before);
    record('write ß (1 long stroke) is accepted', outcome.advanced, `index ${before}→${outcome.state.index}, completed=${outcome.state.completed}`);
  }

  // 5. Digit 5 out of order: crossbar alone is not enough.
  {
    const state = await engine.navigateTo(INDEX.five);
    const rect = state.canvasRect;
    const before = state.index;
    const crossbar = state.strokes.length === 2
      ? (state.strokes[0].length < state.strokes[1].length ? state.strokes[0] : state.strokes[1])
      : state.strokes.at(-1);
    const body = state.strokes.find((s) => s !== crossbar);
    await engine.drawPoints(densifyStroke(crossbar, rect, 6));
    const partial = await engine.waitNoSuccess(before);
    const snapshot = await engine.callApi('evaluationSnapshot');
    record('5 crossbar alone does not finish', !partial.advanced,
      `advanced=${partial.advanced}, completion=${snapshot?.completion?.toFixed?.(2)}`);
    await engine.drawPoints(densifyStroke(body, rect, 7));
    const outcome = await engine.waitSuccess(before);
    record('5 finishes once body stroke is added', outcome.advanced, `index ${before}→${outcome.state.index}`);
  }

  // 6. Rejection: scribble far from the glyph, then clear and write S.
  {
    const state = await engine.navigateTo(INDEX.S);
    const rect = state.canvasRect;
    const before = state.index;
    await engine.drawPoints(scribblePoints(rect));
    const rejected = await engine.waitNoSuccess(before);
    const toast = rejected.state.toast;
    const snapshot = await engine.callApi('evaluationSnapshot');
    record('scribble is not accepted as S', !rejected.advanced,
      `advanced=${rejected.advanced}, completion=${snapshot?.completion?.toFixed?.(2)}, toast="${toast.hidden ? '' : toast.text}"`);
    await engine.clickClear();
    await new Promise((r) => setTimeout(r, 300));
    const fresh = await engine.state();
    for (const stroke of fresh.strokes) {
      await engine.drawPoints(densifyStroke(stroke, rect, 8));
      await new Promise((r) => setTimeout(r, 320));
    }
    const outcome = await engine.waitSuccess(before);
    record('S is accepted after clear + correct writing', outcome.advanced, `index ${before}→${outcome.state.index}`);
  }

  // 7. Umlaut ö: base loop plus two real dot taps.
  {
    const state = await engine.navigateTo(INDEX.oe);
    const rect = state.canvasRect;
    const before = state.index;
    const taps = state.strokes.filter((s) => s.length <= 2);
    const bodies = state.strokes.filter((s) => s.length > 2);
    for (const stroke of bodies) {
      await engine.drawPoints(densifyStroke(stroke, rect, 9));
      await new Promise((r) => setTimeout(r, 320));
    }
    for (const dot of taps) {
      const center = dot[0];
      const points = [{
        x: rect.left + center.x * rect.width,
        y: rect.top + center.y * rect.height,
      }];
      points.push({ x: points[0].x + 1.5, y: points[0].y + 1 });
      await engine.drawPoints(points);
      await new Promise((r) => setTimeout(r, 320));
    }
    const outcome = await engine.waitSuccess(before);
    record('ö base + two dots accepted', outcome.advanced, `index ${before}→${outcome.state.index}, dots=${taps.length}`);
  }

  // 8. The 8 loop, written in one continuous motion.
  {
    const state = await engine.navigateTo(INDEX.eight);
    const rect = state.canvasRect;
    const before = state.index;
    for (const stroke of state.strokes) {
      await engine.drawPoints(densifyStroke(stroke, rect, 10));
      await new Promise((r) => setTimeout(r, 320));
    }
    const outcome = await engine.waitSuccess(before);
    record('write 8 (one loop) is accepted', outcome.advanced, `index ${before}→${outcome.state.index}`);
  }

  // 9. Evaluator API: failCurrent is rejected, solveCurrent finishes the round.
  {
    const state = await engine.navigateTo(INDEX.nine);
    const before = state.index;
    const failed = await engine.callApi('failCurrent');
    await new Promise((r) => setTimeout(r, 300));
    const stillThere = (await engine.state()).index === before;
    record('failCurrent is rejected', !failed?.passed && stillThere, `passed=${failed?.passed}, index stayed=${stillThere}`);
    const solved = await engine.callApi('solveCurrent');
    const finish = await engine.waitSuccess(before, 5000);
    record('solveCurrent completes the round', Boolean(solved) && (finish.advanced || finish.state.screen === 'finish'),
      `screen=${finish.state.screen}, advanced=${finish.advanced}`);
  }

  return checks;
}

/* --------------------------------- main ---------------------------------- */

mkdirSync(OUTPUT_ROOT, { recursive: true });

let engine;
let engineName = engineArg;
if (engineArg === 'safari') {
  engine = new SafariEngine();
} else {
  let playwright;
  try { playwright = require('playwright'); } catch {
    console.error('Playwright ist nicht installiert: npm install --save-dev playwright');
    process.exit(1);
  }
  if (!['webkit', 'firefox', 'chromium'].includes(engineArg)) {
    console.error(`unknown engine: ${engineArg}`);
    process.exit(1);
  }
  engine = new PlaywrightEngine(playwright, engineArg);
}

const errors = [];
let checks = [];
try {
  await engine.start();
  checks = await runChecks(engine);
  errors.push(...(engine.errors ?? []));
} catch (error) {
  const detail = String(error?.stack ?? error).slice(0, 400);
  console.error(`✖ engine run — ${detail}`);
  checks.push({ name: 'engine run', passed: false, detail });
} finally {
  await engine.close().catch(() => {});
}

const passedCount = checks.filter((c) => c.passed).length;
const report = [
  `# Functional check — ${engineName}`,
  '',
  `| Check | Result | Detail |`,
  `| --- | --- | --- |`,
  ...checks.map((c) => `| ${c.name} | ${c.passed ? '✅' : '❌'} | ${c.detail.replaceAll('|', '\\|')} |`),
  '',
  `**${passedCount}/${checks.length} checks passed.** Console/page errors: ${errors.length}`,
  ...errors.slice(0, 10).map((e) => `- ${e.slice(0, 200)}`),
  '',
].join('\n');
writeFileSync(resolve(OUTPUT_ROOT, `${engineName}-report.md`), report);
console.log(`\n[${engineName}] ${passedCount}/${checks.length} checks passed, ${errors.length} console/page errors. Report: qa-functional/${engineName}-report.md`);
process.exit(passedCount === checks.length && errors.length === 0 ? 0 : 1);
