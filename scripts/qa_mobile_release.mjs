import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE_URL = process.env.FINO_QA_URL ?? 'http://127.0.0.1:4192/?test';
const OUTPUT = resolve('qa-mobile-release');
mkdirSync(OUTPUT, { recursive: true });

const viewports = [
  [280, 653], [320, 568], [360, 800], [390, 844], [412, 915],
  [653, 280], [667, 375], [844, 390], [768, 1024], [1024, 768],
];

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator)) : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

async function startCategory(page, category, difficulty = 'easy') {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator(`[data-category="${category}"]`).click();
  await page.locator(`input[name="difficulty"][value="${difficulty}"]`).check({ force: true });
  await page.locator('#start-button').click();
  await page.locator('#practice-screen:not([hidden])').waitFor();
  await page.waitForTimeout(180);
}

async function dragNormalized(page, points) {
  const box = await page.locator('#drawing-canvas').boundingBox();
  if (!box || points.length < 2) throw new Error('Canvas or path missing.');
  const pixel = (point) => ({ x: box.x + point.x * box.width, y: box.y + point.y * box.height });
  const first = pixel(points[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = 10;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const next = pixel({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
      await page.mouse.move(next.x, next.y);
    }
  }
  await page.mouse.up();
}

function physicalAspect(strokes, viewport) {
  const points = strokes.flat();
  const width = (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * viewport.width;
  const height = (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * viewport.height;
  return width / Math.max(1, height);
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));
const report = { homes: [], touchTargets: [], maze: {}, connect: {}, rotation: {} };

for (const [width, height] of viewports) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    cards: document.querySelectorAll('.activity-card').length,
    start: document.querySelector('#start-button')?.getBoundingClientRect().toJSON(),
  }));
  if (metrics.scrollWidth > metrics.clientWidth + 1) throw new Error(`Horizontal overflow at ${width}x${height}`);
  if (metrics.cards !== 8) throw new Error(`Missing activity at ${width}x${height}`);
  report.homes.push({ width, height, ...metrics });
  if ([280, 320, 390, 653, 844, 1024].includes(width)) {
    await page.screenshot({ path: resolve(OUTPUT, `home-${width}x${height}.png`), fullPage: true });
  }
}

for (const [width, height] of [[280, 653], [320, 568], [390, 844], [653, 280], [844, 390], [768, 1024], [1024, 768]]) {
  await page.setViewportSize({ width, height });
  await startCategory(page, 'lines');
  const sizes = await page.locator('.practice-header button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { id: button.id, width: rect.width, height: rect.height };
  }));
  sizes.forEach((size) => {
    if (size.width < 43.5 || size.height < 43.5) throw new Error(`${size.id} is too small at ${width}x${height}: ${size.width}x${size.height}`);
  });
  report.touchTargets.push({ width, height, sizes });
}

await page.setViewportSize({ width: 390, height: 844 });
await startCategory(page, 'maze', 'easy');
let task = await page.evaluate(() => window.__fuchsschrift.getCurrentTask());
await page.screenshot({ path: resolve(OUTPUT, 'maze-portrait-start.png') });
const wall = task.game.walls.reduce((best, candidate) => {
  const value = pointToSegmentDistance(task.game.start, candidate.a, candidate.b);
  return !best || value < best.value ? { wall: candidate, value } : best;
}, null).wall;
const dx = wall.b.x - wall.a.x;
const dy = wall.b.y - wall.a.y;
const denominator = dx * dx + dy * dy;
const position = denominator ? Math.max(0, Math.min(1, ((task.game.start.x - wall.a.x) * dx + (task.game.start.y - wall.a.y) * dy) / denominator)) : 0.5;
const closest = { x: wall.a.x + dx * position, y: wall.a.y + dy * position };
const beyond = { x: closest.x + (closest.x - task.game.start.x) * 0.35, y: closest.y + (closest.y - task.game.start.y) * 0.35 };
await dragNormalized(page, [task.game.start, beyond]);
await page.waitForTimeout(100);
report.maze.collision = await page.evaluate(() => window.__fuchsschrift.board.gameSnapshot());
if (report.maze.collision.collisions < 1 || report.maze.collision.status === 'complete') throw new Error('Maze wall collision was not rejected.');
await dragNormalized(page, task.game.solution);
await page.waitForTimeout(500);
report.maze.success = await page.evaluate(() => window.__fuchsschrift.getState());
if (report.maze.success.completed !== 1) throw new Error('Maze solution did not complete exactly once.');
await page.screenshot({ path: resolve(OUTPUT, 'maze-portrait-success.png') });

await page.setViewportSize({ width: 844, height: 390 });
await startCategory(page, 'connect', 'medium');
task = await page.evaluate(() => window.__fuchsschrift.getCurrentTask());
await page.screenshot({ path: resolve(OUTPUT, 'connect-landscape-start.png') });
await dragNormalized(page, task.game.points.slice(0, 2));
await page.waitForTimeout(80);
report.connect.afterFirst = await page.evaluate(() => window.__fuchsschrift.board.gameSnapshot());
if (report.connect.afterFirst.progress !== 1) throw new Error('First point connection was not locked.');
await page.locator('#undo-button').click();
report.connect.afterUndo = await page.evaluate(() => window.__fuchsschrift.board.gameSnapshot());
if (report.connect.afterUndo.progress !== 0) throw new Error('Point undo did not restore the prior target.');
for (let index = 1; index < task.game.points.length; index += 1) {
  await dragNormalized(page, [task.game.points[index - 1], task.game.points[index]]);
}
await page.waitForTimeout(500);
report.connect.success = await page.evaluate(() => window.__fuchsschrift.getState());
if (report.connect.success.completed !== 1) throw new Error('Point path did not complete exactly once.');
await page.screenshot({ path: resolve(OUTPUT, 'connect-landscape-success.png') });

await page.setViewportSize({ width: 390, height: 844 });
await startCategory(page, 'letters', 'easy');
await page.evaluate(() => {
  const current = window.__fuchsschrift.getCurrentTask();
  window.__fuchsschrift.board.setUserStrokes(current.strokes);
});
const before = await page.evaluate(() => ({
  task: window.__fuchsschrift.getCurrentTask(),
  ink: window.__fuchsschrift.board.getUserStrokes(),
}));
report.rotation.beforeAspect = physicalAspect(before.task.strokes, before.task.viewport);
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  task: window.__fuchsschrift.getCurrentTask(),
  ink: window.__fuchsschrift.board.getUserStrokes(),
}));
report.rotation.afterAspect = physicalAspect(after.task.strokes, after.task.viewport);
report.rotation.aspectChange = Math.abs(report.rotation.afterAspect - report.rotation.beforeAspect) / report.rotation.beforeAspect;
report.rotation.maximumInkError = after.task.strokes.reduce((maximum, stroke, strokeIndex) => Math.max(
  maximum,
  ...stroke.map((point, pointIndex) => Math.hypot(
    (point.x - after.ink[strokeIndex][pointIndex].x) * after.task.viewport.width,
    (point.y - after.ink[strokeIndex][pointIndex].y) * after.task.viewport.height,
  )),
), 0);
if (report.rotation.aspectChange > 0.02 || report.rotation.maximumInkError > 0.5) throw new Error(`Rotation reflow drifted: ${JSON.stringify(report.rotation)}`);
await page.screenshot({ path: resolve(OUTPUT, 'rotation-with-ink.png') });

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
writeFileSync(resolve(OUTPUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(`Mobile release QA passed (${viewports.length} home viewports, maze, points, rotation).`);
