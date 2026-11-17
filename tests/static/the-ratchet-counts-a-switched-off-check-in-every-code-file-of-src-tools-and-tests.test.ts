// The ratchet counts a switched-off check in every code file, wherever it is (tools/ratchet.ts's countsFromTheCodeFiles;
// plan P1-21, the mutation session of 2026-11-17 over P1-17s2, which retired the count of tests on the old stand-in
// beside these two). A line that switches lint off (counted as `eslintDisable`) or the compiler off (either of the two
// comments counted as `tsIgnore`) raises its count by one, in the site's code (`src/`), a tool (`tools/`) and a test
// (`tests/`) alike; a file that isn't code (Markdown) counts nothing.
// Level 0 (static): the files are handed to the function as made-up [path, text] pairs, so nothing is planted in the
// tree and no game code runs. The switch-off words are built from parts, so this file doesn't count itself.
import { describe, expect, test } from 'vitest';
import { countsFromTheCodeFiles } from '../../tools/ratchet.ts';

const LINT_OFF = '// eslint-' + 'disable-next-line no-console';
const COMPILER_OFF = '// @ts-' + 'ignore';
const COMPILER_OFF_EXPECTING_AN_ERROR = '// @ts-' + 'expect-error';
/** A code file with no switch-off. */
const CLEAN: readonly [string, string] = ['src/a-made-up-clean-file.ts', 'export const madeUp = 1;\n'];

describe('the counts from the code files', () => {
  test('a clean code file counts nothing', () => {
    expect(countsFromTheCodeFiles([CLEAN])).toEqual({ tsIgnore: 0, eslintDisable: 0 });
  });

  for (const folder of ['src', 'tools', 'tests'])
    test(`a lint switch-off in a file of ${folder}/ raises eslintDisable by one`, () => {
      const planted: [string, string] = [`${folder}/a-made-up-file.ts`, `${LINT_OFF}\nconsole.log(1);\n`];
      expect(countsFromTheCodeFiles([CLEAN, planted])).toEqual({ tsIgnore: 0, eslintDisable: 1 });
    });

  for (const folder of ['src', 'tools', 'tests'])
    test(`a compiler switch-off in a file of ${folder}/ raises tsIgnore by one, each kind`, () => {
      const ignore: [string, string] = [`${folder}/a-made-up-file.ts`, `${COMPILER_OFF}\nexport const a = 1;\n`];
      const expecting: [string, string] = [
        `${folder}/another-made-up-file.js`,
        `${COMPILER_OFF_EXPECTING_AN_ERROR}\nexport const b = 1;\n`,
      ];
      expect(countsFromTheCodeFiles([CLEAN, ignore])).toEqual({ tsIgnore: 1, eslintDisable: 0 });
      expect(countsFromTheCodeFiles([CLEAN, ignore, expecting])).toEqual({ tsIgnore: 2, eslintDisable: 0 });
    });

  test('a switch-off in a file that is not code counts nothing', () => {
    expect(countsFromTheCodeFiles([['docs/a-made-up-note.md', `${LINT_OFF}\n${COMPILER_OFF}\n`]])).toEqual({
      tsIgnore: 0,
      eslintDisable: 0,
    });
  });
});
