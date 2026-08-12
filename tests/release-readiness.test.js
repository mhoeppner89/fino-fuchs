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
