// A deploy keeps the files a cached page still names (tools/deploy/keep-the-previous-deploys-files.ts, plan P1-06b).
// Since P1-06b a page's bundle and stylesheet are named by their content, and GitHub Pages replaces the whole site on
// each deploy while its cache can hand out the old page for 10 minutes more; the deploy's build job runs this script
// between the build and the upload. Real builds of src/ and of planted copies, deployed in a row into temporary
// folders:
// - two and three deploys in a row: every file an older deploy's pages name is in the newer site, byte for byte; with
//   the keep left out, the changed files are missing (the check can fail);
// - the 24-hour window: a file that stopped being live is kept 24 hours, then dropped (the clock passed in);
// - the first deploy from today's unhashed names, read from a local server standing in for the live site;
// - a file the new build makes is never overwritten;
// - it stops, writing nothing, when the previous site is missing, lacks a file it must hand on, names a file outside
//   the site, or can't be read; run as the build job runs it, it exits 1 (so nothing is published).
// Level 1 (unit): it runs the script on folders, and a local server for a moment; no page runs (the browser spec
// tests/browser/a-page-opened-before-a-deploy-still-loads-its-files.spec.ts opens the pages). Static can't: it runs code.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import {
  keep,
  main,
  namedByPage,
  namedByStylesheet,
  previousSiteAt,
  previousSiteIn,
  PUBLISHED_FILES,
  type KeepResult,
  type PublishedFiles,
} from '../../tools/deploy/keep-the-previous-deploys-files.ts';

const SCRIPT = path.join(ROOT, 'tools', 'deploy', 'keep-the-previous-deploys-files.ts');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const BUILD = path.join(ROOT, 'tools', 'build.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-keep-'));
// Each build is Vite's, one per page: about a second here, up to 6 s on CI's runners with other tests beside it.
const BUILDS = { timeout: 60_000 };
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T1 = new Date('2026-10-21T00:00:00.000Z');
const T2 = new Date(T1.getTime() + 7 * MINUTE);
const T3 = new Date(T2.getTime() + 7 * MINUTE);
const later = (t: Date, ms: number) => new Date(t.getTime() + ms);

let n = 0;
const fresh = (name: string) => path.join(tmp, `${String(++n)}-${name}`);

/** A build of a copy of src/ changed by `change`, into a new folder. Built as `npm run build` builds: from the folder
 *  that holds `src/`, since Rolldown names each module in the bundle (`//#region src/…`) from the folder it runs in, so
 *  a copy built from anywhere else would differ in every bundle, and so in every name. */
function buildOf(name: string, change: (src: string) => void = () => undefined): string {
  const home = fresh(name);
  const src = path.join(home, 'src');
  fs.cpSync(SRC, src, { recursive: true });
  change(src);
  const out = path.join(home, 'site');
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', BUILD, out, '--src', src, '--public', PUBLIC],
    { cwd: home, encoding: 'utf8' },
  );
  if (run.status !== 0) throw new Error(`the build of ${src} failed:\n${run.stderr}`);
  return out;
}
const append = (file: string, text: string) => {
  fs.appendFileSync(file, text);
};
const aChangedLine = '\n(globalThis as { aPlantedChange?: number }).aPlantedChange = 1;\n';

/** A deploy of `built`, keeping the files of the previous deploy in `previous`, at `now`: a new folder. */
function deploy(built: string, previous: string, now: Date): { dir: string; result: KeepResult } {
  const dir = fresh('deploy');
  fs.cpSync(built, dir, { recursive: true });
  return { dir, result: keep(dir, previousSiteIn(previous), now) };
}

/** Each file `old`'s pages name (and their stylesheets) that `next` lacks or holds with other bytes. */
function missingOrDifferent(old: string, next: string): string[] {
  const named = new Set<string>();
  for (const page of fs.readdirSync(old).filter((f) => f.endsWith('.html'))) {
    for (const name of namedByPage(fs.readFileSync(path.join(old, page), 'utf8'), page)) named.add(name);
  }
  for (const css of [...named].filter((f) => f.endsWith('.css'))) {
    for (const name of namedByStylesheet(fs.readFileSync(path.join(old, css), 'utf8'), css)) named.add(name);
  }
  expect(named.size, `${old}: its pages name no file`).toBeGreaterThan(0);
  return [...named]
    .filter((f) => {
      const there = path.join(next, f);
      return !fs.existsSync(there) || !fs.readFileSync(there).equals(fs.readFileSync(path.join(old, f)));
    })
    .sort();
}
const copyOf = (dir: string) => {
  const out = fresh('copy');
  fs.cpSync(dir, out, { recursive: true });
  return out;
};
const publishedFiles = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, PUBLISHED_FILES), 'utf8')) as PublishedFiles;
/** A file's name with its hash replaced by `*`, so a test can name it before it is built. */
const unhash = (name: string) => name.replace(/-[A-Za-z0-9_-]{8}(\.(?:js|css))$/, '-*$1');

/** The site as it is published today, before P1-06b: the same build with assets/<page>.js and assets/<page>.css. */
function withoutHashes(built: string): string {
  const out = fresh('unhashed');
  fs.cpSync(built, out, { recursive: true });
  const renamed = new Map<string, string>();
  for (const f of filesUnder(path.join(out, 'assets'))) {
    const plain = f.replace(/-[A-Za-z0-9_-]{8}(\.(?:js|css))$/, '$1');
    fs.renameSync(path.join(out, 'assets', f), path.join(out, 'assets', plain));
    renamed.set(`assets/${f}`, `assets/${plain}`);
  }
  for (const page of fs.readdirSync(out).filter((f) => f.endsWith('.html'))) {
    let html = fs.readFileSync(path.join(out, page), 'utf8');
    for (const [from, to] of renamed) html = html.split(from).join(to);
    fs.writeFileSync(path.join(out, page), html);
  }
  return out;
}

/** A local server standing in for the live site: `dir`'s files, or one status for everything. */
async function serving(dir: string, status?: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/').replace(/^\/+/, '');
    const file = path.join(dir, name);
    if (status !== undefined) {
      res.writeHead(status);
      res.end();
    } else if (!name || name.includes('..') || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end('no');
    } else {
      res.writeHead(200);
      res.end(fs.readFileSync(file));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

// Three builds: src/ as it is; then the GM page's code and the player portal's stylesheet changed; then the Hall of
// Fame's code changed too.
let b1 = '';
let b2 = '';
let b3 = '';
beforeAll(() => {
  b1 = buildOf('b1');
  const second = (src: string) => {
    append(path.join(src, 'ui', 'gm', 'start.ts'), aChangedLine);
    append(path.join(src, 'ui', 'player', 'style.css'), '\n.a-planted-change { color: red; }\n');
  };
  b2 = buildOf('b2', second);
  b3 = buildOf('b3', (src) => {
    second(src);
    append(path.join(src, 'ui', 'leaderboard', 'main.ts'), aChangedLine);
  });
}, 3 * BUILDS.timeout);

describe('deploys in a row', () => {
  test("a changed file gets a new name: the GM bundle, and the player portal's stylesheet and bundle", () => {
    expect(missingOrDifferent(b1, b2).map(unhash)).toEqual([
      'assets/kingdoms-call-gm-portal-*.js',
      'assets/kingdoms-call-player-portal-*.css',
      'assets/kingdoms-call-player-portal-*.js',
    ]);
  });

  test("two deploys: every file the first one's pages name is in the second, byte for byte; with the keep left out, 3 are missing", () => {
    const d1 = deploy(b1, b1, T1);
    expect(d1.result.kept).toEqual([]);
    expect(d1.result.named).toHaveLength(16);
    const d2 = deploy(b2, d1.dir, T2);
    expect(d2.result.kept).toEqual(missingOrDifferent(b1, b2));
    expect(missingOrDifferent(d1.dir, d2.dir)).toEqual([]);
    // The keep left out (the build alone): the check finds the three.
    expect(missingOrDifferent(d1.dir, b2)).toHaveLength(3);
    // published-files.json: every file of the new site live (null), each kept one with when it stopped being live.
    const list = publishedFiles(d2.dir).files;
    expect(Object.keys(list).sort()).toEqual(filesUnder(d2.dir).filter((f) => f !== PUBLISHED_FILES));
    for (const f of filesUnder(b2)) expect(list[f], f).toBeNull();
    for (const f of d2.result.kept) expect(list[f], f).toBe(T2.toISOString());
  });

  test("three deploys: both older deploys' pages find all their files in the third", () => {
    const d1 = deploy(b1, b1, T1);
    const d2 = deploy(b2, d1.dir, T2);
    const d3 = deploy(b3, d2.dir, T3);
    // The first deploy's three (stopped being live 7 minutes ago) and the second's Hall of Fame bundle.
    expect(d3.result.kept.map(unhash)).toEqual([
      'assets/kingdoms-call-gm-portal-*.js',
      'assets/kingdoms-call-leaderboard-*.js',
      'assets/kingdoms-call-player-portal-*.css',
      'assets/kingdoms-call-player-portal-*.js',
    ]);
    expect(missingOrDifferent(d1.dir, d3.dir)).toEqual([]);
    expect(missingOrDifferent(d2.dir, d3.dir)).toEqual([]);
    expect(missingOrDifferent(d1.dir, b3)).toHaveLength(4);
    expect(missingOrDifferent(d2.dir, b3)).toHaveLength(1);
  });

  test('a file that stopped being live is kept for 24 hours, then dropped', () => {
    const d1 = deploy(b1, b1, T1);
    const d2 = deploy(b2, d1.dir, T2);
    const d3 = deploy(b3, d2.dir, T3);
    // b3 again: its pages name only its own files, so only the list keeps the older ones.
    const justInside = deploy(b3, d3.dir, later(T2, 24 * HOUR - 1));
    expect(justInside.result.kept).toEqual(d3.result.kept);
    expect(justInside.result.dropped).toEqual([]);
    const firstGone = deploy(b3, d3.dir, later(T2, 24 * HOUR));
    expect(firstGone.result.kept.map(unhash)).toEqual(['assets/kingdoms-call-leaderboard-*.js']);
    expect(firstGone.result.dropped).toHaveLength(3);
    // A kept file keeps the time it stopped being live: a day after that, it goes, however many deploys came between.
    expect(publishedFiles(firstGone.dir).files[firstGone.result.kept[0] ?? '']).toBe(T3.toISOString());
    const allGone = deploy(b3, firstGone.dir, later(T3, 24 * HOUR));
    expect(allGone.result.kept).toEqual([]);
    expect(allGone.result.dropped).toHaveLength(1);
    expect(filesUnder(allGone.dir)).toEqual([...filesUnder(b3), PUBLISHED_FILES].sort());
  });
});

describe('what a page names', () => {
  test("a page's scripts, stylesheets and other files beside it; not another site, an anchor or another page", () => {
    const html = [
      '<link rel="stylesheet" crossorigin href="./assets/a-12345678.css">',
      '<script type="module" crossorigin src="./assets/a-12345678.js"></script>',
      '<script src="vendor/lib-1.2.3.min.js"></script><script src="kc-config.js?v=2"></script>',
      '<link rel="icon" href="icons/crown.png#x">',
      '<a href="#overview">…</a><a href="other.html?gm=1">…</a><a href="rules.html#world">…</a>',
      '<link href="https://fonts.googleapis.com/css2?family=Cinzel"><a href="mailto:gm@example.com">…</a>',
      '<script src="//cdn.example.com/x.js"></script><a href="">…</a>',
    ].join('\n');
    expect(namedByPage(html, 'index.html')).toEqual([
      'assets/a-12345678.css',
      'assets/a-12345678.js',
      'icons/crown.png',
      'kc-config.js',
      'vendor/lib-1.2.3.min.js',
    ]);
  });

  test("a stylesheet's url()s of files beside it, relative to the stylesheet; not data or another site", () => {
    const css =
      "@import url('https://fonts.googleapis.com/css2?family=Cinzel');\n" +
      '.a { background: url(../images/map.png); } .b { src: url("fonts/rune.woff2?v=1"); }\n' +
      ".c { background: url('data:image/png;base64,AAAA'); } .d { background: url( icon.svg ); }\n";
    expect(namedByStylesheet(css, 'assets/a-12345678.css')).toEqual([
      'assets/fonts/rune.woff2',
      'assets/icon.svg',
      'images/map.png',
    ]);
  });

  test('a file a previous stylesheet names is kept too (planted: a font beside the stylesheet)', () => {
    const d1 = deploy(b1, b1, T1);
    const css = filesUnder(d1.dir).find((f) => /^assets\/kingdoms-call-player-portal-.*\.css$/.test(f)) ?? '';
    fs.appendFileSync(path.join(d1.dir, css), '\n@font-face { src: url(fonts/a-planted-font.woff2); }\n');
    fs.mkdirSync(path.join(d1.dir, 'assets', 'fonts'));
    fs.writeFileSync(path.join(d1.dir, 'assets', 'fonts', 'a-planted-font.woff2'), 'a font');
    const d2 = deploy(b2, d1.dir, T2);
    expect(d2.result.kept).toContain('assets/fonts/a-planted-font.woff2');
    expect(missingOrDifferent(d1.dir, d2.dir)).toEqual([]);
  });
});

describe('the first deploy, from the unhashed names of today', () => {
  test('read from the live site (a local server): 13 files kept, none of the 16 its pages name missing', async () => {
    const live = withoutHashes(b1);
    const server = await serving(live);
    try {
      const d1 = fresh('first');
      fs.cpSync(b1, d1, { recursive: true });
      const r = await main([d1, '--live', server.url, '--now', T1.toISOString()]);
      expect(r.kept).toHaveLength(13);
      expect(r.named).toHaveLength(16);
      expect(missingOrDifferent(live, d1)).toEqual([]);
      expect(missingOrDifferent(live, b1)).toHaveLength(13);
      // The same from a folder (an artifact of the last unhashed deploy).
      const fromFolder = deploy(b1, live, T1);
      expect(fromFolder.result.kept).toEqual(r.kept);
      expect(publishedFiles(fromFolder.dir)).toEqual(publishedFiles(d1));
    } finally {
      await server.close();
    }
  });
});

describe('what it never does', () => {
  test('a file the new build makes is never overwritten', () => {
    const d1 = deploy(b1, b1, T1);
    fs.writeFileSync(path.join(d1.dir, 'kc-config.js'), 'const KC_CONFIG = { theOldOne: true };\n');
    const d2 = deploy(b2, d1.dir, T2);
    expect(
      fs.readFileSync(path.join(d2.dir, 'kc-config.js')).equals(fs.readFileSync(path.join(b2, 'kc-config.js'))),
    ).toBe(true);
    expect(publishedFiles(d2.dir).files['kc-config.js']).toBeNull();
    expect(d2.result.kept).not.toContain('kc-config.js');
  });

  test('a file the previous pages name that the previous site lacks stops it, and the new site is left as it was', () => {
    const d1 = deploy(b1, b1, T1);
    const gm = missingOrDifferent(b1, b2).find((f) => f.includes('gm-portal')) ?? '';
    fs.rmSync(path.join(d1.dir, gm));
    const site = copyOf(b2);
    expect(() => keep(site, previousSiteIn(d1.dir), T2)).toThrow(
      `the previous site lacks files it must hand on: ${gm}`,
    );
    expect(filesUnder(site)).toEqual(filesUnder(b2));
  });

  test('a file its list keeps that the previous site lacks stops it', () => {
    const d1 = deploy(b1, b1, T1);
    const d2 = deploy(b2, d1.dir, T2);
    const kept = d2.result.kept[0] ?? '';
    fs.rmSync(path.join(d2.dir, kept));
    expect(() => keep(copyOf(b3), previousSiteIn(d2.dir), T3)).toThrow(kept);
  });

  test('no previous site stops it: a missing folder, a folder with no page', () => {
    expect(() => previousSiteIn(path.join(tmp, 'nothing-here'))).toThrow(/^no previous site/);
    const empty = fresh('empty');
    fs.mkdirSync(empty);
    expect(() => previousSiteIn(empty)).toThrow(/^no previous site: .* has no page$/);
  });

  test('a page naming a file outside the site stops it', () => {
    const d1 = copyOf(b1);
    fs.appendFileSync(path.join(d1, 'index.html'), '<script src="../outside.js"></script>\n');
    expect(() => keep(copyOf(b2), previousSiteIn(d1), T2)).toThrow('index.html names ../outside.js');
  });

  test('a live site that fails to answer stops it: an error, nothing listening, no page at all', async () => {
    const pages = fs.readdirSync(b1).filter((f) => f.endsWith('.html'));
    const failing = await serving(b1, 500);
    try {
      await expect(previousSiteAt(failing.url, pages, T1)).rejects.toThrow(/answered 500$/);
    } finally {
      await failing.close();
    }
    const gone = await serving(b1);
    await gone.close();
    await expect(previousSiteAt(gone.url, pages, T1)).rejects.toThrow(/^couldn't read /);
    const empty = await serving(b1, 404);
    try {
      await expect(previousSiteAt(empty.url, pages, T1)).rejects.toThrow(/^no previous site: .* served none of /);
    } finally {
      await empty.close();
    }
  });

  test('run as the build job runs it, with no previous site: exit 1, an error for the job, and nothing written', () => {
    const site = copyOf(b2);
    const run = spawnSync(process.execPath, [SCRIPT, site, '--previous', path.join(tmp, 'no-artifact')], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^::error title=keep the previous deploy's files::no previous site: /m);
    expect(filesUnder(site)).toEqual(filesUnder(b2));
  });
});

test('the build jobs run it: a real previous deploy in a folder, by the command line', BUILDS, () => {
  const d1 = deploy(b1, b1, T1);
  const site = copyOf(b2);
  const run = spawnSync(process.execPath, [SCRIPT, site, '--previous', d1.dir, '--now', T2.toISOString()], {
    encoding: 'utf8',
  });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout).toMatch(/^Kept 3 files of the previous deploy \(.*\); its pages name 16, all in the new site\.$/m);
  expect(missingOrDifferent(d1.dir, site)).toEqual([]);
});
