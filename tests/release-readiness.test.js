import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const html = read('index.html');
const styles = read('styles.css');
const serviceWorker = read('sw.js');
const scripts = ['app.js', 'curriculum.js', 'drawing.js', 'mini-games.js', 'handwriting-template-data.js', 'handwriting-stroke-data.js']
  .map((file) => [`js/${file}`, read(`js/${file}`)]);

function shellPaths() {
  const list = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? '';
  return new Set([...list.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1].replace(/^\.\//, '')));
}

test('release version, theme, and offline cache stay in sync', () => {
  const version = packageJson.version;
  assert.match(html, new RegExp(`App-Version ${version.replaceAll('.', '\\.')}`));
  assert.ok(serviceWorker.includes('const CACHE_NAME = `${CACHE_PREFIX}v' + version + '`;'));
  const htmlTheme = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1]?.toLowerCase();
  assert.equal(htmlTheme, manifest.theme_color.toLowerCase());
  assert.equal(manifest.background_color.toLowerCase(), manifest.theme_color.toLowerCase());
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
});

test('the drawing board stays light in mobile Safari and fullscreen', () => {
  const drawing = read('js/drawing.js');
  assert.match(html, /<meta name="color-scheme" content="light">/);
  assert.match(styles, /#drawing-canvas\s*{[\s\S]*?background-color:\s*#fffcf7;/);
  assert.match(drawing, /getContext\('2d',\s*{\s*alpha:\s*false/);
  assert.match(drawing, /context\.fillStyle = CANVAS_PAPER;\s*context\.fillRect\(0, 0, this\.width, this\.height\);/);
});

test('landscape phones keep their compact menu and maze renderer cheap', () => {
  const drawing = read('js/drawing.js');
  assert.match(styles, /\.activity-icon strong\s*{[\s\S]*?font-size:\s*\.78rem;/);
  assert.match(styles, /#exit-button\s*{\s*display:\s*grid;\s*place-items:\s*center;/);
  assert.match(drawing, /buildMazeLayers\(\)/);
  assert.match(drawing, /this\.mazeLayers\?\.key === cacheKey/);
  assert.match(drawing, /context\.drawImage\(layers\.base/);
  assert.match(drawing, /context\.drawImage\(layers\.walls/);
});

test('Funkelpunkte reuses a cached backdrop while drawing', () => {
  const drawing = read('js/drawing.js');
  assert.match(drawing, /buildConnectBackdrop\(\)/);
  assert.match(drawing, /this\.connectBackdrop\?\.key === cacheKey/);
  assert.match(drawing, /context\.drawImage\(this\.buildConnectBackdrop\(\)/);
  assert.match(drawing, /sharedEndpointRadius:\s*game\.hitRadius \+ clearance \+ 6/);
});

test('Safari drawing avoids spiky joins and expensive unstable samples', () => {
  const drawing = read('js/drawing.js');
  assert.match(drawing, /const WEBKIT_ENGINE = [^;]+AppleWebKit/);
  assert.match(drawing, /if \(webkit\) return \[event\];/);
  assert.match(drawing, /desynchronized:\s*!this\.isWebKit/);
  assert.match(drawing, /const dprLimit = this\.isWebKit \? 2 : 3/);
  assert.match(drawing, /context\.miterLimit = 2/);
  assert.match(drawing, /angular:\s*true,\s*lineJoin:\s*'round'/);
});

test('letter and number Fino follows the child and can be toggled', () => {
  const app = read('js/app.js');
  const drawing = read('js/drawing.js');
  assert.match(app, /const shouldDemo = !task\.gameMode && !usesPenFollowingFino\(task\)/);
  assert.match(app, /state\.finoEnabled = !state\.finoEnabled/);
  assert.match(app, /aria-label', state\.finoEnabled \? 'Fino ausschalten' : 'Fino einschalten'/);
  assert.match(drawing, /if \(this\.usesPenFollowingFino\(\)\) return Promise\.resolve\(\);/);
  assert.match(drawing, /x: target\.x < this\.width \/ 2 \? -foxSize : this\.width \+ foxSize/);
  assert.match(drawing, /this\.reactiveFoxPoint = finishedStroke\.at\(-1\)/);
});

test('tracing exercises do not show a prescribed green starting dot', () => {
  const drawing = read('js/drawing.js');
  assert.doesNotMatch(drawing, /drawStartPoint/);
  assert.doesNotMatch(drawing, /#62C892/);
  assert.doesNotMatch(styles, /\.progress-dots span\.is-complete\s*{[^}]*var\(--green\)/s);
  assert.match(styles, /\.progress-dots span\.is-complete\s*{[^}]*var\(--blue\)/s);
});

test('practice drawing blocks Safari page gestures and text selection', () => {
  const app = read('js/app.js');
  const drawing = read('js/drawing.js');
  assert.match(styles, /body\[data-screen="practice"\]\s*{[\s\S]*?position:\s*fixed;[\s\S]*?overscroll-behavior:\s*none;/);
  assert.match(styles, /\.practice-screen\s*{[\s\S]*?-webkit-touch-callout:\s*none;/);
  assert.match(styles, /#drawing-canvas\s*{[\s\S]*?touch-action:\s*none;[\s\S]*?-webkit-user-select:\s*none;/);
  assert.match(app, /addEventListener\('touchmove', preventPracticeGesture, \{ passive: false \}\)/);
  assert.match(app, /selection\.removeAllRanges\(\)/);
  assert.match(drawing, /'gesturestart'[\s\S]*?this\.preventNativeGesture, \{ passive: false \}/);
  assert.match(drawing, /finishInterruptedStroke\(pointerId\)/);
});

test('practice mode provides a phone-friendly fullscreen control', () => {
  const app = read('js/app.js');
  assert.match(html, /id="fullscreen-button"[^>]*aria-label="Vollbild einschalten"/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /webkitRequestFullscreen/);
  assert.match(app, /screen\.orientation\?\.lock/);
  assert.match(app, /immersive-fallback/);
  assert.match(html, /id="rotate-suggestion"[^>]*aria-label="Vollbild öffnen und ins Querformat wechseln"/);
  assert.match(app, /elements\.rotateSuggestion\.addEventListener\('click', toggleFullscreen\)/);
  assert.match(styles, /@keyframes rotate-invite/);
});

test('the completed-round screen fits a short landscape phone', () => {
  assert.match(styles, /@media \(orientation: landscape\) and \(max-height: 620px\)[\s\S]*?\.finish-screen\s*{[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(styles, /\.finish-card\s*{[\s\S]*?grid-template-areas:[\s\S]*?"fox actions";/);
  assert.match(styles, /\.finish-fox\s*{[\s\S]*?width:\s*min\(190px, 42dvh, 100%\);/);
});

test('an installed older release cannot mix its scripts with the current menu', () => {
  assert.match(html, /navigator\.serviceWorker\.addEventListener\('controllerchange'/);
  assert.match(html, /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.match(html, /location\.reload\(\)/);
  assert.doesNotMatch(read('js/app.js'), /serviceWorker\.register/);
  assert.match(serviceWorker, /const versionSensitive = \['script', 'style', 'worker'\]/);
});

test('every offline shell entry and local runtime dependency exists', () => {
  const shell = shellPaths();
  assert.ok(shell.has('index.html'));
  assert.ok(shell.has('styles.css'));
  assert.ok(shell.has('js/mini-games.js'));
  shell.forEach((path) => {
    if (path === '') return;
    assert.equal(existsSync(join(root, path)), true, `offline file is missing: ${path}`);
  });

  const dependencies = new Set();
  for (const [sourcePath, source] of scripts) {
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
      dependencies.add(normalize(relative(root, resolve(root, dirname(sourcePath), match[1]))));
    }
    for (const match of source.matchAll(/new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g)) {
      dependencies.add(normalize(relative(root, resolve(root, dirname(sourcePath), match[1]))));
    }
  }
  dependencies.forEach((path) => {
    assert.equal(existsSync(join(root, path)), true, `runtime dependency is missing: ${path}`);
    assert.ok(shell.has(path), `runtime dependency is not available offline: ${path}`);
  });
});

test('install icons have the declared PNG dimensions', () => {
  manifest.icons.forEach((icon) => {
    const path = icon.src.replace(/^\.\//, '');
    const file = readFileSync(join(root, path));
    assert.equal(file.toString('ascii', 1, 4), 'PNG', `${path} is not a PNG`);
    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
    assert.deepEqual([width, height], [expectedWidth, expectedHeight], `${path} has the wrong dimensions`);
  });
});

test('the child-facing app is local-only and synthetic voice remains disabled', () => {
  const runtime = [html, styles, serviceWorker, ...scripts.map(([, source]) => source)].join('\n');
  assert.doesNotMatch(runtime, /https?:\/\//i);
  assert.doesNotMatch(runtime, /\blocalStorage\b|\bindexedDB\b/);
  assert.match(read('js/app.js'), /const SYNTHETIC_VOICE_ENABLED = false;/);
  assert.match(html, /id="home-sound-button"[^>]*hidden/);
});
