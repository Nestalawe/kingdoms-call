// Staged games run their turns by hand (P1-04a). A game staged in "auto" or "deadline" turn mode is also watched by
// the GM portal's auto-turn watcher, whose first check comes 3 s after sign-in: it reads the page's clock at a moment
// that depends on load, and runs a turn by itself once every realm's orders are in. Either makes a staged game's turns
// depend on the machine's speed. So every harness that runs turns (calls runTurn) stages its games in manual mode, as
// tools/balance/play.ts does. Level 0 (static): it reads the harnesses' source and runs nothing; a page test would
// see the watcher only when a run happened to outlast its first check.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Every harness that runs turns (`runTurn`, in `tests/` and `tools/`) stages its games in manual turn mode, so the
// auto-turn watcher never reads the clock or runs a turn in a test (P1-04a); the screenshot tour (`lib/screens.js`) is
// exempt, since it shows each mode on purpose. Level 0: a page test would see the watcher only when a run outlasted its
// first check. TypeScript, in `static/`
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SELF = path.relative(ROOT, import.meta.filename);
/** Kept, not run: the quarantined tests and the older export tools. */
const SKIPPED = new Set(['tests/quarantine', 'tools/legacy', 'node_modules']);
/** Harnesses that stage other modes on purpose, and why. */
const EXEMPT: Record<string, string> = {
  'tests/lib/screens.js':
    "the screenshot tour stages auto and deadline games so the game list and the watcher's own screens show each mode",
};

function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (SKIPPED.has(rel) || SKIPPED.has(e.name)) return [];
    if (e.isDirectory()) return sources(rel);
    return /\.(c|m)?(js|ts)$/.test(e.name) && rel !== SELF ? [rel] : [];
  });
}

/** Each turn mode staged in `text` (`turnMode={…}`, `turnMode:{…}`, or `"turnMode":{…}` in saved JSON): its mode,
 *  or what stands where a literal mode should be. */
function stagedModes(text: string): string[] {
  return [...text.matchAll(/turnMode['"]?\s*[:=]\s*\{([^{}]*)\}/g)].map((m) => {
    const mode = /mode['"]?\s*:\s*['"](\w+)['"]/.exec(m[1] ?? '');
    return mode?.[1] ?? `not a literal mode: {${m[1] ?? ''}}`;
  });
}

const runsTurns = sources('tests')
  .concat(sources('tools'))
  .filter((f) => /\brunTurn\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));

test('every harness that runs turns stages its games in manual turn mode', () => {
  const breaches = runsTurns
    .filter((f) => !(f in EXEMPT))
    .flatMap((f) =>
      stagedModes(fs.readFileSync(path.join(ROOT, f), 'utf8'))
        .filter((mode) => mode !== 'manual')
        .map((mode) => `${f}: ${mode}`),
    );
  expect(breaches, 'staged in another mode than manual: the watcher may read the clock or run a turn').toEqual([]);
});

test('the check sees the stagings: the matrix, the fuzz and the deterministic boot are among them', () => {
  const staging = runsTurns.filter((f) => stagedModes(fs.readFileSync(path.join(ROOT, f), 'utf8')).length > 0);
  expect(staging).toEqual(
    expect.arrayContaining([
      'tools/balance/play.ts',
      'tests/turn-fuzz.test.js',
      'tests/page/deterministic-boot.test.ts',
    ]),
  );
});

test('each exempt harness still runs turns and still stages another mode', () => {
  for (const [f, why] of Object.entries(EXEMPT)) {
    expect(runsTurns, `${f} (${why})`).toContain(f);
    const others = stagedModes(fs.readFileSync(path.join(ROOT, f), 'utf8')).filter((mode) => mode !== 'manual');
    expect(others.length, `${f} stages only manual games now: drop it from EXEMPT`).toBeGreaterThan(0);
  }
});
