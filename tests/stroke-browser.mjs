import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sampleStroke } from '../js/stroke-validation.js';
import { chromium, webkit } from 'playwright';

const output = new URL('../test-artifacts/stroke-acceptance/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [];
const url = process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173/?test';
const engines = process.argv.includes('--chromium-only') ? [['chromium', chromium]]
  : process.argv.includes('--webkit-only') ? [['webkit', webkit]] : [['chromium', chromium], ['webkit', webkit]];

for (const [engineName, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const cdp = engineName === 'chromium' ? await context.newCDPSession(page) : null;
  const read = () => page.evaluate(() => ({ ...window.__fuchsschrift.board.currentEvaluation(),
    ink: window.__fuchsschrift.board.getUserStrokes().length,
    guide: window.__fuchsschrift.board.nextGuideStrokeIndex(),
  }));
  const task = () => page.evaluate(() => window.__fuchsschrift.board.task);
  const check = (name) => { results.push({ engine: engineName, name, passed: true }); console.log(`${engineName}: ${name}`); };

  async function pointer(type, point, buttons) {
    if (cdp) {
      await cdp.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: buttons ? 'left' : 'none',
        buttons, pointerType: 'pen', force: buttons ? 0.55 : 0,
        ...(type === 'mouseReleased' ? { button: 'left', clickCount: 1 } : type === 'mousePressed' ? { clickCount: 1 } : {}),
      });
    } else if (type === 'mousePressed') {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
    } else if (type === 'mouseReleased') await page.mouse.up();
    else await page.mouse.move(point.x, point.y);
  }

  async function draw(stroke, { inspectWhileDown = false, screenshotWhileDown } = {}) {
    const rect = await page.locator('#drawing-canvas').boundingBox();
    const points = stroke.map((p) => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height }));
    const before = await read();
    await pointer('mousePressed', points[0], 1);
    for (const point of points.slice(1)) await pointer('mouseMoved', point, 1);
    if (inspectWhileDown) assert.equal((await read()).acceptedCount, before.acceptedCount, 'cannot advance before pen-up');
    if (screenshotWhileDown) await page.screenshot({ path: new URL(screenshotWhileDown, output).pathname });
    await pointer('mouseReleased', points.at(-1), 0);
    return read();
  }

  async function start(value = 'A', level = 'easy', strict = true) {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__fuchsschrift));
    assert.equal(await page.locator('#strict-schulschrift').isChecked(), true);
    await page.locator('[data-category="letters"]').click();
    await page.locator('label:has(input[name="letter-selection"][value="custom"])').click();
    await page.locator('#letter-set').fill(value);
    await page.locator(`label:has(input[name="difficulty"][value="${level}"])`).click();
    await page.locator('#strict-schulschrift').setChecked(strict);
    await page.locator('#start-button').click();
    await page.waitForFunction(() => window.__fuchsschrift.getState().screen === 'practice' && window.__fuchsschrift.board.task);
    await page.evaluate(() => window.__fuchsschrift.board.stopDemo({ render: true }));
    return task();
  }

  try {
    for (const level of ['easy', 'medium', 'hard']) {
      const current = await start('A', level);
      assert.equal(current.assist, level);
      const first = current.completionGroups[0];
      let state = await draw(current.strokes[first[1]]);
      assert.equal(state.acceptedCount, 0);
      assert.equal(state.guide, 0);
      const route = current.strokes[0];
      state = await draw(route.slice(0, Math.max(2, Math.floor(route.length / 2))));
      assert.equal(state.acceptedCount, 0);
      assert.equal(state.ink, 2);
      await page.locator('#undo-button').click();
      assert.equal((await read()).ink, 1);
      state = await draw(route, { inspectWhileDown: true });
      assert.equal(state.acceptedCount, 1);
      assert.equal(await page.locator('#toast').isVisible(), false, 'successful retry must clear rejection feedback');
      assert.equal(state.ink, 2, 'failed attempt must remain visible after a correct retry');
      assert.equal(state.guide, 1);
      await page.locator('#undo-button').click();
      assert.equal((await read()).acceptedCount, 0, 'undo accepted stroke must reopen its step');
      await draw(route);
      if (level === 'easy') {
        await page.screenshot({ path: new URL(`${engineName}-retry.png`, output).pathname });
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(400);
        assert.equal((await read()).acceptedCount, 1, 'resize must preserve acceptance');
        assert.equal((await read()).rejectedCount, 1);
        const reflowed = await task();
        await draw(reflowed.strokes[1]);
      } else {
        for (const stroke of current.strokes.slice(1)) await draw(stroke);
      }
      assert.equal(await page.locator('#success-overlay').isVisible(), true, 'completion must celebrate');
      await page.waitForTimeout(750);
      assert.equal((await task()).assist, level, 'next exercise must keep the selected difficulty');
      await page.setViewportSize({ width: 1024, height: 768 });
      check(`${level}: strict order, partial retry, rejected ink, undo, completion, fixed difficulty`);
    }

    const relaxed = await start('A', 'easy', false);
    assert.equal((await draw([...relaxed.strokes[1]].reverse())).acceptedCount, 1);
    await draw([...relaxed.strokes[0]].reverse());
    assert.equal(await page.locator('#success-overlay').isVisible(), true);
    check('relaxed menu option accepts another order and direction');

    const displaced = await start('A');
    const shifted = displaced.strokes[0].map((p) => ({ x: p.x + 0.01, y: p.y }));
    assert.equal((await draw(shifted)).acceptedCount, 1);
    const movedGuide = await page.evaluate(() => window.__fuchsschrift.board.guideStroke(1));
    assert.deepEqual(movedGuide, displaced.strokes[1]);
    await page.screenshot({ path: new URL(`${engineName}-shifted-guide.png`, output).pathname });
    await draw(movedGuide);
    assert.equal(await page.locator('#success-overlay').isVisible(), true);
    check('slightly displaced ink leaves the template and next guide fixed');

    for (const name of ['handwritten-a', 'handwritten-a-rough', 'handwritten-r']) for (const wobble of [0, 0.05]) {
      await start('A', 'easy', true);
      const fixture = JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url)));
      const pixelPoints = fixture.task.strokes.flat().map((p) => ({ x: p.x * fixture.width, y: p.y * fixture.height }));
      const size = Math.max(Math.max(...pixelPoints.map((p) => p.x)) - Math.min(...pixelPoints.map((p) => p.x)),
        Math.max(...pixelPoints.map((p) => p.y)) - Math.min(...pixelPoints.map((p) => p.y)));
      const rough = fixture.strokes.map((stroke) => sampleStroke(stroke.map((p) => ({ x: p.x * fixture.width, y: p.y * fixture.height })), 129)
        .map((p) => ({ x: (p.x + size * wobble * Math.sin(p.y / size * Math.PI * 3)) / fixture.width,
          y: (p.y + size * wobble * Math.sin(p.x / size * Math.PI * 3)) / fixture.height })));
      const placed = await page.evaluate(({ fixture, rough }) => {
        const board = window.__fuchsschrift.board;
        const { width, height } = board.getViewport();
        const scale = Math.min(width * 0.8 / fixture.width, height * 0.85 / fixture.height);
        const dx = (width - fixture.width * scale) / 2, dy = (height - fixture.height * scale) / 2;
        const place = (stroke) => stroke.map((p) => ({ x: (dx + p.x * fixture.width * scale) / width,
          y: (dy + p.y * fixture.height * scale) / height }));
        board.setTask({ ...board.task, ...fixture.task, strokes: fixture.task.strokes.map(place) }, 'easy');
        return rough.map(place);
      }, { fixture, rough });
      assert.equal((await draw(placed[0], { inspectWhileDown: true })).acceptedCount, 1, `${name} outline must pass first`);
      assert.equal(await page.locator('#success-overlay').isVisible(), false);
      const result = await draw(placed[1], { inspectWhileDown: true,
        screenshotWhileDown: `${engineName}-${name}-${wobble}.png` });
      assert.equal(result.acceptedCount, fixture.task.strokes.length, `${name} remaining parts must pass`);
      assert.equal(await page.locator('#success-overlay').isVisible(), true);
      check(`${name}: easy accepts screenshot reconstruction with ${wobble} additional wobble`);
    }

    const joinedR = await start('R', 'easy', true);
    await page.evaluate(() => {
      const board = window.__fuchsschrift.board;
      const task = board.task;
      board.setTask({ ...task, strokes: [...task.strokes, [{ x: 0.9, y: 0.1 }]],
        completionGroups: [[0, 1, 2], [3]] }, 'easy');
    });
    await draw(joinedR.strokes[0]);
    assert.equal((await draw([...joinedR.strokes[1], ...joinedR.strokes[2]])).acceptedCount, 3);
    await page.locator('#undo-button').click();
    assert.equal((await read()).acceptedCount, 1, 'Undo must reopen every part of a combined stroke');
    assert.equal((await read()).ink, 1);
    assert.equal((await read()).guide, 1);
    await draw([...joinedR.strokes[1], ...joinedR.strokes[2]]);
    await page.setViewportSize({ width: 900, height: 700 });
    assert.equal((await read()).acceptedCount, 3, 'resize must preserve combined-stroke credit');
    await page.setViewportSize({ width: 1024, height: 768 });
    check('joined R parts survive resize and Undo removes both together');

    const dotted = await start('ä');
    await draw(dotted.strokes[0]);
    await draw([{ x: dotted.strokes[1][0].x, y: dotted.strokes[1][0].y - 0.015 }]);
    assert.equal((await read()).acceptedCount, 2);
    await draw(dotted.strokes[1]);
    assert.equal((await read()).acceptedCount, 2, 'same dot cannot satisfy the next dot');
    await page.screenshot({ path: new URL(`${engineName}-dots.png`, output).pathname });
    await draw(dotted.strokes[2]);
    assert.equal(await page.locator('#success-overlay').isVisible(), true);
    check('stationary pen taps, dot tolerance, and separate umlaut dots');

    await start('A');
    await page.evaluate(async () => {
      const { EXERCISE_BANKS, adaptTaskToViewport } = await import('../js/curriculum.js?v=1.3.40');
      const board = window.__fuchsschrift.board;
      board.setTask(adaptTaskToViewport(EXERCISE_BANKS.shapes.find((t) => t.id === 'shape-square'), board.getViewport()), 'hard');
    });
    const square = (await task()).strokes[0];
    const ring = square.slice(0, -1).reverse();
    const outline = [...ring.slice(2), ...ring.slice(0, 2)];
    outline.push(outline[0]);
    await draw(outline);
    assert.equal(await page.locator('#success-overlay').isVisible(), true);
    check('shape outline accepts a different corner and direction with strict setting on');

    await start('A');
    const polygon = await page.evaluate(async () => {
      const { EXERCISE_BANKS, adaptTaskToViewport } = await import('../js/curriculum.js?v=1.3.40');
      const board = window.__fuchsschrift.board;
      board.setTask(adaptTaskToViewport(EXERCISE_BANKS.shapes.find((t) => t.id === 'shape-circle'), board.getViewport()), 'easy');
      return adaptTaskToViewport(EXERCISE_BANKS.shapes.find((t) => t.id === 'shape-pentagon'), board.getViewport()).strokes[0];
    });
    assert.equal((await draw(polygon)).acceptedCount, 0);
    await draw((await task()).strokes[0]);
    assert.equal(await page.locator('#success-overlay').isVisible(), true);
    check('a polygon cannot substitute for a circle, and the circle retry succeeds');

    await start('A');
    const active = await task();
    const box = await page.locator('#drawing-canvas').boundingBox();
    const first = active.strokes[0][0];
    await pointer('mousePressed', { x: box.x + first.x * box.width, y: box.y + first.y * box.height }, 1);
    await page.evaluate(() => {
      const board = window.__fuchsschrift.board;
      board.onPointerCancel({ pointerId: board.activePointerId, preventDefault() {} });
    });
    await pointer('mouseReleased', { x: box.x + first.x * box.width, y: box.y + first.y * box.height }, 0);
    assert.equal((await read()).acceptedCount, 0);
    await draw(active.strokes[0]);
    assert.equal((await read()).acceptedCount, 1);
    check('cancelled input cannot advance and a later retry works');

    await page.goto(url);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.screenshot({ path: new URL(`${engineName}-menu-phone.png`, output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: new URL(`${engineName}-menu-landscape.png`, output).pathname, fullPage: true });
    assert.equal(await page.locator('#strict-schulschrift').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await page.evaluate(async () => Boolean(await caches.match('./js/stroke-validation.js?v=1.3.40'))), true);
    // WebKit's automation runtime aborts offline navigations with an internal
    // error, even with a controlling worker. Check its cache explicitly;
    // Chromium also exercises a complete offline reload and module startup.
    if (engineName === 'chromium') {
      await context.setOffline(true);
      await page.reload();
      await page.waitForFunction(() => Boolean(window.__fuchsschrift));
      assert.equal(await page.locator('#strict-schulschrift').isChecked(), true);
      await context.setOffline(false);
    }
    assert.deepEqual(errors, []);
    check(`menu layouts, offline ${engineName === 'chromium' ? 'reload' : 'cache'}, and browser console`);
  } finally {
    writeFileSync(new URL('results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
  }
}
