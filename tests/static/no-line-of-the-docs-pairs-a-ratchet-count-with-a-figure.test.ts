// No line of the docs pairs a ratchet count with a figure: a doc names a count of tests/ratchet.json (its key), but
// never its value, which lives in tests/ratchet.json alone (the toolchain topic file, its paragraph "The ratchet").
// Without it a figure goes stale the day a count falls, and an agent plans from the stale one: before this test, the
// docs gave the old counts beside their keys in 14 lines (at 7f8795ea), some many steps out of date.
// Level 0 (static): it reads files and nothing runs.
// - The keys are read from tests/ratchet.json's counts, so the test holds none itself, and a new count is checked
//   at once.
// - No line of a Markdown file under docs/, nor of CLAUDE.md, holds a key (as a whole word) and a number.
// - A number is digits standing alone: the digits of an id (P1-19a, R-177, D-06, #540) or of a name (P1-24's 24) are
//   not numbers.
// Not checked: a count written in words ("nine files"), or a figure given on another line than its key's. The
// agent who writes the line keeps those out.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

const KEYS = Object.keys(
  z
    .object({ counts: z.record(z.string(), z.number()) })
    .parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/ratchet.json'), 'utf8'))).counts,
);

const markdownUnder = (folder: string): string[] =>
  fs
    .readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })
    .map((f) => `${folder}/${f.split(path.sep).join('/')}`)
    .filter((f) => f.endsWith('.md'))
    .sort();

const THE_FILES = ['CLAUDE.md', ...markdownUnder('docs')];

/** Digits standing alone: not after a letter, a digit, a hyphen, a full stop or "#", nor before a letter or a hyphen. */
const A_NUMBER = /(?<![\w.#-])\d+(?![\w-])/;

/** The keys a line pairs with a number, or none. */
function theKeysPairedWithANumber(line: string, keys: readonly string[]): string[] {
  if (!A_NUMBER.test(line)) return [];
  return keys.filter((key) => new RegExp(`\\b${key}\\b`).test(line));
}

describe('no line of the docs pairs a ratchet count with a figure', () => {
  test('the check finds a key beside a number, and lets ids and a key alone through (a check that finds nothing proves nothing)', () => {
    expect(KEYS.length).toBeGreaterThan(10);
    const keys = ['stubDbTests', 'tsNocheckUi'];
    expect(theKeysPairedWithANumber('the ratchet counts them (`stubDbTests` 19 → 18)', keys)).toEqual(['stubDbTests']);
    expect(theKeysPairedWithANumber('`tsNocheckUi` (9: the UI pages)', keys)).toEqual(['tsNocheckUi']);
    expect(theKeysPairedWithANumber('every page typed, `tsNocheckUi` 0', keys)).toEqual(['tsNocheckUi']);
    expect(theKeysPairedWithANumber('the ratchet counts them (`stubDbTests`), so it only falls', keys)).toEqual([]);
    expect(
      theKeysPairedWithANumber('`tsNocheckUi`, P1-16s: each row of P1-24 lowers it (#540, R-177, D-06)', keys),
    ).toEqual([]);
    expect(theKeysPairedWithANumber('the old stub, in 19 files', keys)).toEqual([]);
  });

  test('every Markdown file under docs/ is read, and CLAUDE.md', () => {
    expect(THE_FILES).toContain('CLAUDE.md');
    expect(THE_FILES).toContain('docs/architecture/the-toolchain-the-checks-and-the-harness.md');
    expect(THE_FILES).toContain('docs/backlog/README.md');
  });

  test('no line of docs/ or CLAUDE.md gives a ratchet count its figure', () => {
    const found = THE_FILES.flatMap((file) =>
      fs
        .readFileSync(path.join(ROOT, file), 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          theKeysPairedWithANumber(line, KEYS).map((key) => `${file}:${String(i + 1)}: \`${key}\` beside a number`),
        ),
    );
    expect(found).toEqual([]);
  });
});
