// Only src/db/ talks to the database (plan P1-17, Decisions 3 and 8):
// - the name a test hands a page its Db under (THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER) is read only in
//   src/db/the-pages-database-client.ts: no other file of src/ names it, so no page code can pick up a Db of its own;
//   and tests/lib/boot.js sets it under that same name;
// - `supabase`, the client's global, is refused by ESLint in a file of src/ outside src/db/ and allowed in src/db/
//   (a planted read, linted in place).
// Level 0 (static): it reads files and lints planted text; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const NAME = THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER;

/** The files of `files` ([path under the repository, text]) outside src/db/ that name the way in. */
function filesOutsideSrcDbNamingIt(files: readonly (readonly [string, string])[]): string[] {
  return files.filter(([file, text]) => !file.startsWith('src/db/') && text.includes(NAME)).map(([file]) => file);
}

const srcFiles = filesUnder(path.join(ROOT, 'src')).map(
  (f) => ['src/' + f, fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')] as const,
);

describe('only src/db/ reads the Db a test hands the page', () => {
  test('no file of src/ outside src/db/ names it; the client function reads it', () => {
    expect(srcFiles.length).toBeGreaterThan(100);
    expect(filesOutsideSrcDbNamingIt(srcFiles)).toEqual([]);
    const theClient = srcFiles.find(([f]) => f === 'src/db/the-pages-database-client.ts')?.[1] ?? '';
    expect(theClient).toContain(`Reflect.get(globalThis, THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER)`);
    expect(theClient).toContain(`THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER = '${NAME}'`);
  });

  test.for([
    ['src/ui/gm/planted.ts', `export const handed = Reflect.get(globalThis, '${NAME}');\n`, ['src/ui/gm/planted.ts']],
    ['src/ui/player/planted.ts', `export const handed = window.${NAME};\n`, ['src/ui/player/planted.ts']],
    ['src/db/planted.ts', `export const handed = Reflect.get(globalThis, '${NAME}');\n`, []],
  ] as const)('planted in %s, a read of it is found there or not: %j', ([file, text, found]) => {
    expect(filesOutsideSrcDbNamingIt([...srcFiles, [file, text]])).toEqual(found);
  });

  test("tests/lib/boot.js hands a page its Db under the client function's name", () => {
    expect(fs.readFileSync(path.join(ROOT, 'tests/lib/boot.js'), 'utf8')).toContain(`w.${NAME}=opts.db`);
  });
});

describe('only src/db/ reads the supabase global', () => {
  const eslint = new ESLint({ cwd: ROOT });
  const PLANTED = 'export const client = supabase.createClient(KC_CONFIG.supabaseUrl, KC_CONFIG.supabaseKey);\n';
  test.for([
    ['src/ui/gm/planted.ts', ['1 no-restricted-globals']],
    ['src/ui/overlord/planted.ts', ['1 no-restricted-globals']],
    ['src/db/planted.ts', []],
  ] as const)(
    'a planted createClient on it in %s: %j',
    timeLimitForTheWork({ typeScriptPrograms: 1 }),
    async ([file, expected]) => {
      const [result] = await eslint.lintText(PLANTED, { filePath: path.join(ROOT, file) });
      const found = (result?.messages ?? [])
        .filter((m) => m.severity === 2 && m.ruleId === 'no-restricted-globals')
        .map((m) => `${String(m.line)} ${m.ruleId ?? ''}`);
      expect(found).toEqual(expected);
    },
  );
});
