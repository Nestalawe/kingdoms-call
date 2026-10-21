// The engine's rules of a hero, an army, an item, a level or a number live in src/engine/rules-on-plain-values/ (plan
// P1-11a, Decision 2), and its files import only src/content and each other: no other engine file, no load-time set-up
// from elsewhere, no package. So the player portal can load them (through src/shared/, P1-11a4) without loading the
// rest of the engine or running its tables' set-up. Every import counts: `import … from`, `export … from`, a bare
// `import '…'`, `import(…)` and `require(…)` (TypeScript's preProcessFile reads them all, and only code: comments and
// strings don't count). Until P1-13's dependency-cruiser rule does the same. Level 0 (static): it reads the sources and
// runs nothing.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';

const SRC = path.join(ROOT, 'src');
const FOLDER = 'engine/rules-on-plain-values/';
/** What a file of the folder may import: the content, and the folder itself. */
const ALLOWED = ['content/', FOLDER];

/** Each import of `file` (relative to src/): what it names, and where that is relative to src/ (null: not a file
 *  of src/, e.g. a package or one of Node's modules). */
function importsOf(file: string): { names: string; resolved: string | null }[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => {
    if (!fileName.startsWith('.')) return { names: fileName, resolved: null };
    const resolved = path.relative(SRC, path.resolve(path.dirname(path.join(SRC, file)), fileName));
    return { names: fileName, resolved: resolved.startsWith('..') ? null : resolved.split(path.sep).join('/') };
  });
}

/** One finding per import of a file in the folder that reaches outside the content and the folder. */
function importsOutsideTheContentAndTheFolder(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    importsOf(file)
      .filter(({ resolved }) => resolved === null || !ALLOWED.some((a) => resolved.startsWith(a)))
      .map(({ names }) => `${file} imports ${names}`),
  );
}

describe('the rules on plain values import only the content and each other', () => {
  const files = filesUnder(SRC).filter((f) => f.startsWith(FOLDER));

  test('the folder is there to check', () => {
    // Its first file, the two casting limits (P1-11a1). Which functions live here is the parity test's to say: it
    // imports each from its file (tests/lib/player-portal-copies.ts).
    expect(files).toContain(`${FOLDER}spells-each-school-allows-a-turn-and-a-fight.ts`);
    expect(files.every((f) => f.endsWith('.ts'))).toBe(true);
  });

  test('every import a file of the folder makes is of the content or of the folder', () => {
    expect(importsOutsideTheContentAndTheFolder(files)).toEqual([]);
  });

  test('every import in the folder names a file that is there', () => {
    const missing = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved !== null && !fs.existsSync(path.join(SRC, resolved)))
        .map(({ names }) => `${file} imports ${names}, which isn't there`),
    );
    expect(missing).toEqual([]);
  });
});
