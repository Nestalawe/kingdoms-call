// The site's build (tools/build.ts, plan P1-09d): Vite builds each src/*.html on its own, and public/ is copied as it
// is. It replaced P1-05's stitch and its two tests (static/build.test.ts, static/engine-files.test.ts). Level 0
// (static): it builds the site into temporary folders (Vite, a few seconds) and reads what was made; nothing runs.
// - Every page builds, and the site is exactly: each page, its bundle and its stylesheet (a page with no script has no
//   bundle), and public/ as it is, but public/dev/ (the dev server's config), which is never published.
// - Each bundle stands alone: it parses as a classic script, with no import or export left, so jsdom can run it
//   (tests/lib/boot.js), and holds no stitch marker.
// - Every file under src/ is in a page: in a bundle (Rolldown's own list of the bundle's modules), or a page's
//   template or stylesheet. A file nothing reaches is found (planted), and a file a module imports that isn't there
//   stops the build (planted).
// - tools/pages.ts names each page's files as Rolldown does, but a module nothing on the page reads, which Rolldown
//   leaves out (kc-safe.ts on the Overlord page, which calls none of it).
// - The engine's files (tools/pages.ts's engineEntryFiles, which tests/lib/engine.ts bundles) are the data file and
//   every file under src/engine/ and src/views/, each in the GM page's bundle, in the order the page's entry lists them,
//   the dice and the clock first.
// - The build writes only what changed and removes what it no longer makes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import { afterAll, describe, expect, test } from 'vitest';
import { build, filesUnder, ROOT, type BuildResult } from '../../tools/build.ts';
import { DATA_FILE, engineEntryFiles, importsOf, pageEntries, pageFiles, pageNames } from '../../tools/pages.ts';

const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pages-build-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A copy of src/ in a new temporary folder, changed by `change`. */
function srcCopy(change: (dir: string) => void): string {
  const dir = fs.mkdtempSync(path.join(tmp, 'src-'));
  fs.cpSync(SRC, dir, { recursive: true });
  change(dir);
  return dir;
}

/** The files under `src` that no page's bundle, template or stylesheet holds. */
function unreached(src: string, r: BuildResult): string[] {
  const reached = new Set([
    ...Object.values(r.modules).flat(),
    ...pageNames(src).flatMap((page) => [page, ...pageEntries(page, src).styles]),
    // Types only, for TypeScript (tsconfig.json includes src/): no module imports it and no bundle holds it (P1-09e).
    'globals.d.ts',
  ]);
  return filesUnder(src).filter((f) => !reached.has(f));
}

const SITE = path.join(tmp, 'site');
const built = build(SITE);
const pages = pageNames();
const bundleOf = (page: string) => `assets/${page.replace(/\.html$/, '.js')}`;

describe('every page builds', () => {
  test('the pages are the seven published ones', () => {
    expect(pages).toEqual([
      'index.html',
      'kingdoms-call-gm-portal.html',
      'kingdoms-call-leaderboard.html',
      'kingdoms-call-overlord.html',
      'kingdoms-call-player-portal.html',
      'kingdoms-call-rules-intro.html',
      'kingdoms-call-rules.html',
    ]);
  });

  test('the site is each page, its bundle and its stylesheet, and public/ as it is', () => {
    const want = [
      ...pages,
      ...pages.filter((p) => pageEntries(p).modules.length).map(bundleOf),
      ...pages.map((p) => `assets/${p.replace(/\.html$/, '.css')}`),
      ...filesUnder(PUBLIC).filter((f) => !f.startsWith('dev/')),
    ].sort();
    expect(filesUnder(SITE)).toEqual(want);
    expect(built.files).toBe(want.length);
  });

  test('a page with no script of its own has no bundle: the landing page', () => {
    expect(pages.filter((p) => !pageEntries(p).modules.length)).toEqual(['index.html']);
  });

  test.for(pages.filter((p) => pageEntries(p).modules.length))(
    '%s: its bundle stands alone, a classic script with no import or export, and the page loads it',
    (page) => {
      const code = fs.readFileSync(path.join(SITE, bundleOf(page)), 'utf8');
      const program = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      expect(program.body.filter((s) => /^(Import|Export)/.test(s.type)).map((s) => s.type)).toEqual([]);
      expect(() => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' })).not.toThrow();
      expect(code.includes('{{kc-build:')).toBe(false);
      const html = fs.readFileSync(path.join(SITE, page), 'utf8');
      expect(html).toContain(`<script type="module" crossorigin src="./${bundleOf(page)}"></script>`);
    },
  );
});

describe('every file under src/ is in a page', () => {
  test('none is left out', () => {
    expect(unreached(SRC, built)).toEqual([]);
  });

  test('a file nothing imports is found (planted)', () => {
    const copy = srcCopy((d) => {
      fs.writeFileSync(path.join(d, 'engine', 'forgotten.ts'), 'export const forgotten = 1;\n');
    });
    expect(unreached(copy, build(path.join(tmp, 'site-forgotten'), copy))).toEqual(['engine/forgotten.ts']);
  });

  test('a file a module imports that is missing stops the build (planted)', () => {
    const copy = srcCopy((d) => {
      fs.rmSync(path.join(d, 'engine', 'graves.ts'));
    });
    expect(() => build(path.join(tmp, 'site-missing'), copy)).toThrow(/graves\.ts/);
  });

  test.for(pages)("%s: tools/pages.ts names the files Rolldown's bundle holds", (page) => {
    const theirs = built.modules[page] ?? [];
    const ours = pageFiles(page);
    expect(theirs.filter((f) => !ours.includes(f))).toEqual([]);
    const leftOut = ours.filter((f) => !theirs.includes(f) && !pageEntries(page).styles.includes(f) && f !== page);
    const scriptless = !pageEntries(page).modules.length;
    expect(leftOut).toEqual(page === 'kingdoms-call-overlord.html' ? ['ui/shared/kc-safe.ts'] : []);
    expect(scriptless ? theirs : []).toEqual([]);
  });
});

describe("the engine's files", () => {
  const GM = 'kingdoms-call-gm-portal.html';
  const files = engineEntryFiles();
  const inFolders = filesUnder(SRC).filter((f) => /^(engine|views)\//.test(f));

  test('the data file, then every file under src/engine/ and src/views/, the dice and the clock first', () => {
    expect(files[0]).toBe(DATA_FILE);
    expect([...files.slice(1)].sort()).toEqual(inFolders);
    expect(files.slice(1, 3)).toEqual(['engine/rng.ts', 'engine/clock.ts']);
  });

  test("each is in the GM page's bundle, in the order the page's entry lists them", () => {
    const inBundle = built.modules[GM] ?? [];
    expect(files.filter((f) => !inBundle.includes(f))).toEqual([]);
    const listed = importsOf('ui/gm/page.ts');
    expect(files.filter((f) => listed.includes(f))).toEqual(listed.filter((f) => files.includes(f)));
  });
});

test("public/dev/ (the dev server's config) is never published", () => {
  const pub = path.join(tmp, 'public');
  fs.cpSync(PUBLIC, pub, { recursive: true });
  fs.mkdirSync(path.join(pub, 'dev'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'dev', 'kc-config.js'), 'const KC_CONFIG = {};\n');
  const out = path.join(tmp, 'site-dev');
  build(out, SRC, pub);
  expect(filesUnder(out).filter((f) => f.startsWith('dev/'))).toEqual([]);
  expect(filesUnder(out)).toContain('kc-config.js');
});

test('the build writes only what changed, and removes what it no longer makes', () => {
  const out = path.join(tmp, 'site-again');
  const first = build(out);
  expect(first.written).toHaveLength(first.files);
  for (const f of filesUnder(SITE))
    expect(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(SITE, f))), f).toBe(true);
  fs.writeFileSync(path.join(out, 'stale.html'), 'old');
  fs.writeFileSync(path.join(out, 'kc-staging-footer.js'), 'changed by hand');
  const second = build(out);
  expect(second.written).toEqual(['kc-staging-footer.js']);
  expect(second.removed).toEqual(['stale.html']);
  expect(build(out)).toMatchObject({ written: [], removed: [] });
});
