// A pull request that changes a path listed in .github/dangerous-paths gets one warning comment asking to talk the
// change through before merging (.github/scripts/dangerous-paths.js, decision D-07). It never blocks. Moved from the old
// script tests/dangerous-paths.test.js (P1-14z), check for check.
// Level 1 (unit): the script's pure functions, on made-up file lists and on the real paths file; nothing reaches
// GitHub. Static can't: it runs code.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Which changed files count as dangerous: globs (`**` spans folders, `*` stays in one, a folder's name matches exactly),
// case ignored, each file once, a renamed file by its old name too; the paths file's comments and blank lines skipped;
// that the real list covers the database, `.github/`, the vendored code, the package files and the test harness, and
// not the rest of `src/` or the tests themselves; and what the warning says (the files, a long list cut at 20, the
// marker, and "no longer changes" once nothing dangerous is left).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import * as dangerousPaths from '../../.github/scripts/dangerous-paths.ts';

const { match, commentBody, parsePaths, isDangerous, MARKER } = dangerousPaths;

const GLOBS = ['supabase/**', '.github/**', 'site/vendor/**'];
interface AChangedFile {
  filename: string;
  previous_filename?: string;
  status?: string;
}
/** A changed file as GitHub's API lists it; a renamed one carries its old name. */
const file = (filename: string, previousFilename?: string): AChangedFile =>
  previousFilename === undefined ? { filename } : { filename, previous_filename: previousFilename, status: 'renamed' };

/** The globs of the real paths file, .github/dangerous-paths. */
function theRealPathsFilesGlobs(): string[] {
  const text = fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', '.github', 'dangerous-paths'), 'utf8');
  const parsed: unknown = parsePaths(text);
  const globs = theStringsIn(parsed);
  expect(globs.length, 'the paths file has globs').toBeGreaterThan(0);
  return globs;
}

/** The script is plain JavaScript, so its lists come untyped: each must be a list of strings. */
function theStringsIn(list: unknown): string[] {
  if (!Array.isArray(list) || !list.every((x) => typeof x === 'string'))
    throw new Error(`not a list of strings: ${JSON.stringify(list)}`);
  return list;
}

describe('which changed files count as dangerous', () => {
  test('a site-only change matches nothing', () => {
    expect(match([file('site/index.html'), file('tests/lib/boot.ts')], GLOBS)).toEqual([]);
  });

  test('supabase/, .github/ and site/vendor/ all match', () => {
    expect(match([file('supabase/migrations/0001_baseline.sql')], GLOBS)).toEqual([
      'supabase/migrations/0001_baseline.sql',
    ]);
    expect(match([file('.github/workflows/ci.yml')], GLOBS)).toEqual(['.github/workflows/ci.yml']);
    expect(match([file('site/vendor/supabase-js-2.0.0.min.js')], GLOBS)).toEqual([
      'site/vendor/supabase-js-2.0.0.min.js',
    ]);
  });

  test('only the dangerous files are reported, each once', () => {
    const files = [file('site/index.html'), file('supabase/a.sql'), file('supabase/a.sql'), file('.github/x.yml')];
    expect(match(files, GLOBS)).toEqual(['supabase/a.sql', '.github/x.yml']);
  });

  test('a file moved out of a dangerous folder still counts, by its old name', () => {
    expect(match([file('tools/x.sql', 'supabase/x.sql')], GLOBS)).toEqual(['supabase/x.sql']);
  });

  test('globs: ** spans folders, * stays within one, and the folder name must match exactly', () => {
    expect(isDangerous('.github/workflows/ci.yml', GLOBS)).toBe(true);
    expect(isDangerous('site/vendor/a/b/c.js', GLOBS)).toBe(true);
    expect(isDangerous('.githubx/ci.yml', GLOBS)).toBe(false);
    expect(isDangerous('site/vendorx.js', GLOBS)).toBe(false);
    expect(isDangerous('docs/supabase/notes.md', GLOBS)).toBe(false);
    expect(isDangerous('site/kc-safe.js', ['site/*.js'])).toBe(true);
    expect(isDangerous('site/x/kc-safe.js', ['site/*.js'])).toBe(false);
    expect(isDangerous('package.json', ['package.json'])).toBe(true);
    expect(isDangerous('site/package.json', ['package.json'])).toBe(false);
  });

  test('globs ignore case: a dangerous folder spelled with other capitals still counts', () => {
    expect(isDangerous('Supabase/migrations/x.sql', GLOBS)).toBe(true);
    expect(isDangerous('.GitHub/workflows/ci.yml', GLOBS)).toBe(true);
    expect(isDangerous('site/Vendor/x.js', GLOBS)).toBe(true);
    expect(isDangerous('Site/Vendorx.js', GLOBS)).toBe(false);
  });

  test('paths file: one glob per line; comments and blank lines are skipped', () => {
    expect(parsePaths('# heading\n\nsupabase/**\n  .github/**  \n# package.json\n')).toEqual([
      'supabase/**',
      '.github/**',
    ]);
  });
});

describe('the real paths file', () => {
  test('covers supabase/, .github/, the vendored code, the database config and the package files, and not the rest of src/', () => {
    const globs = theRealPathsFilesGlobs();
    // Since P1-05 the site's source is src/ (site/ is built, and not in git); since P1-09d what is copied as it is,
    // public/.
    for (const g of ['supabase/**', '.github/**', 'public/vendor/**', 'public/kc-config.js'])
      expect(globs.includes(g), g).toBe(true);
    expect(isDangerous('public/vendor/supabase-js-2.117.3.min.js', globs)).toBe(true);
    expect(isDangerous('package.json', globs)).toBe(true);
    expect(isDangerous('package-lock.json', globs)).toBe(true);
    for (const f of ['src/index.html', 'src/engine/run-turn.ts', 'public/kc-staging-footer.js', 'tests/lib/boot.ts'])
      expect(isDangerous(f, globs), f).toBe(false);
  });

  test('covers the test harness (P1-01b), and not the tests themselves', () => {
    const globs = theRealPathsFilesGlobs();
    for (const f of [
      '.claude/settings.json',
      'tsconfig.json',
      'tsconfig.build.json',
      'vitest.config.mts',
      'eslint.config.js',
      'playwright.config.ts',
      '.nvmrc',
      '.npmrc',
      'tests/setup/each.ts',
      'tests/setup/the-test-levels.mts',
      'tests/ratchet.json',
      'tests/static/harness.test.ts',
      'tests/balance/matrix.test.ts',
      'tools/hooks/after-edit.ts',
      'tools/check.ts',
      'tools/ratchet.ts',
      'tools/build.ts',
      'tools/pages.ts',
      'tools/dev.ts',
      'tests/lib/engine.ts',
    ])
      expect(isDangerous(f, globs), f).toBe(true);
    for (const f of [
      'tests/static/other.test.ts',
      'tests/lib/boot.ts',
      'tests/boot-pages.test.js',
      'tools/legacy/README.md',
    ])
      expect(isDangerous(f, globs), f).toBe(false);
  });
});

describe('the warning comment', () => {
  test('names the files, says to talk it through before merging, and carries the marker', () => {
    const body: string = commentBody(['supabase/a.sql', '.github/x.yml']);
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toMatch(/talk it through with Theo before merging/);
    expect(body).toMatch(/`supabase\/a\.sql`/);
    expect(body).toMatch(/`\.github\/x\.yml`/);
  });

  test('a long list is shortened, so the comment stays readable', () => {
    const many = Array.from({ length: 30 }, (_, i) => `supabase/m${String(i)}.sql`);
    const body: string = commentBody(many);
    expect(body).toMatch(/`supabase\/m19\.sql`/);
    expect(body).not.toMatch(/`supabase\/m20\.sql`/);
    expect(body).toMatch(/and 10 more/);
  });

  test('once nothing dangerous is left, the comment says so (and keeps the marker)', () => {
    const body: string = commentBody([]);
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toMatch(/no longer changes/);
    expect(body).not.toMatch(/talk it through/);
  });
});
