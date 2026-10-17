// The build (tools/build.ts, P1-05): src/ becomes the site in site/, as src/manifest.ts lists it. Level 1 (static): it
// parses the sources and puts the site together in memory or in a temporary folder; nothing runs in a page.
// - Every .js file under src/ (but the supabase-js copy) parses on its own, as a classic script: lint, CodeQL and the
//   syntax test can each read it (plan P1-05, Decision 2).
// - Where two files of a block meet, the cut falls between two of the block's top-level statements, never inside one
//   (so never inside a function). Checked on the whole block: the two halves of a cut statement can each parse alone.
// - The build refuses a file in src/ that no list names (it would never be published), a block placed twice or not at
//   all, and a marker that isn't a line of its own. A one-character edit changes exactly the one page built from it.
// - It writes only what changed and removes from its output what it no longer makes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import { afterAll, describe, expect, test } from 'vitest';
import { PAGES } from '../../src/manifest.ts';
import { assemble, build, filesUnder, ROOT } from '../../tools/build.ts';

const SRC = path.join(ROOT, 'src');
const read = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8');
const parse = (text: string) => acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });

/** Where `pieces`, joined, meet inside one of the joined text's top-level statements: the start of each such
 *  statement. Empty when every cut falls between statements. */
function cutsInside(pieces: readonly string[]): string[] {
  const text = pieces.join('');
  const statements = parse(text).body;
  const cuts: number[] = [];
  let at = 0;
  for (const p of pieces.slice(0, -1)) cuts.push((at += p.length));
  return cuts.flatMap((c) =>
    statements.filter((s) => s.start < c && c < s.end).map((s) => text.slice(s.start, Math.min(s.end, s.start + 60))),
  );
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-build-'));
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

describe('the sources', () => {
  const scripts = filesUnder(SRC).filter((f) => f.endsWith('.js') && !f.startsWith('vendor/'));

  test('there are scripts to check', () => {
    expect(scripts).toContain('engine/run-turn.js');
    expect(scripts).toContain('content/kingdoms-call-data.js');
  });

  test.for(scripts)('%s parses on its own', (f) => {
    expect(() => parse(read(f))).not.toThrow();
  });

  const cutBlocks = Object.entries(PAGES).flatMap(([page, p]) =>
    Object.entries(p.blocks)
      .filter(([, files]) => files.length > 1)
      .map(([block, files]) => [`${page} ${block}`, files] as const),
  );

  test('the GM portal and the player portal are cut into files', () => {
    expect(cutBlocks.map(([name]) => name)).toEqual([
      'kingdoms-call-gm-portal.html main',
      'kingdoms-call-player-portal.html main',
    ]);
  });

  test.for(cutBlocks)('%s: every cut falls between top-level statements', ([, files]) => {
    expect(cutsInside(files.map(read))).toEqual([]);
  });

  test('a cut inside a statement is found, even when both halves parse on their own (planted)', () => {
    const halves = ['const total = 1\n', '+ 2;\n'];
    for (const h of halves) expect(() => parse(h)).not.toThrow();
    expect(cutsInside(halves)).toEqual(['const total = 1\n+ 2;']);
    expect(cutsInside(['function f() {\n  return 1;\n', '}\n'])).toHaveLength(1);
    expect(cutsInside(['const a = 1;\n// about b\n', 'function b() {}\n'])).toEqual([]);
  });
});

describe('the build', () => {
  const site = assemble();

  test('it makes every published file, and the pages hold no marker', () => {
    expect([...site.keys()].sort()).toEqual([
      'index.html',
      'kc-config.js',
      'kc-db-guard.js',
      'kc-safe.js',
      'kc-staging-footer.js',
      'kingdoms-call-data.js',
      'kingdoms-call-gm-portal.html',
      'kingdoms-call-leaderboard.html',
      'kingdoms-call-overlord.html',
      'kingdoms-call-player-portal.html',
      'kingdoms-call-rules-intro.html',
      'kingdoms-call-rules.html',
      'vendor/supabase-js-2.117.3.min.js',
      'vendor/supabase-js-LICENSE.txt',
    ]);
    for (const [name, bytes] of site) expect(bytes.includes('{{kc-build:'), name).toBe(false);
  });

  test('a one-character edit in a file changes exactly the page built from it', () => {
    const dir = srcCopy((d) => {
      const f = path.join(d, 'engine', 'battle', 'ladder.js');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('ladder', 'ladddr'));
    });
    const changed = [...assemble(dir)].filter(([name, bytes]) => !bytes.equals(site.get(name) ?? Buffer.alloc(0)));
    expect(changed.map(([name]) => name)).toEqual(['kingdoms-call-gm-portal.html']);
  });

  test.for([
    [
      'a file in src/ that no list names',
      (d: string) => {
        fs.writeFileSync(path.join(d, 'engine', 'forgotten.js'), 'const forgotten = 1;\n');
      },
      /in no list in src\/manifest\.ts, so never published: engine\/forgotten\.js/,
    ],
    [
      'a listed file that is missing',
      (d: string) => {
        fs.rmSync(path.join(d, 'engine', 'graves.js'));
      },
      /ENOENT.*engine\/graves\.js/,
    ],
    [
      'a block placed twice',
      (d: string) => {
        const f = path.join(d, 'ui', 'landing', 'index.html');
        fs.writeFileSync(
          f,
          fs.readFileSync(f, 'utf8').replace('{{kc-build:style}}\n', '{{kc-build:style}}\n'.repeat(2)),
        );
      },
      /block "style" is placed twice/,
    ],
    [
      'a block not placed',
      (d: string) => {
        const f = path.join(d, 'ui', 'landing', 'index.html');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('{{kc-build:style}}\n', ''));
      },
      /no \{\{kc-build:…\}\} line for style/,
    ],
    [
      'a marker that is not a line of its own',
      (d: string) => {
        const f = path.join(d, 'ui', 'landing', 'index.html');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('{{kc-build:style}}', '  {{kc-build:style}}'));
      },
      /must be a line on its own/,
    ],
  ] as const)('it refuses %s (planted)', ([, change, message]) => {
    const dir = srcCopy(change);
    expect(() => assemble(dir)).toThrow(message);
  });

  test('it writes only what changed, and removes what it no longer makes', () => {
    const out = path.join(tmp, 'site');
    const first = build(out);
    expect(first.written).toHaveLength(site.size);
    for (const [name, bytes] of site) expect(fs.readFileSync(path.join(out, name)).equals(bytes), name).toBe(true);
    fs.writeFileSync(path.join(out, 'stale.html'), 'old');
    fs.writeFileSync(path.join(out, 'kc-safe.js'), 'changed by hand');
    const second = build(out);
    expect(second.written).toEqual(['kc-safe.js']);
    expect(second.removed).toEqual(['stale.html']);
    expect(build(out)).toMatchObject({ written: [], removed: [] });
  });
});
