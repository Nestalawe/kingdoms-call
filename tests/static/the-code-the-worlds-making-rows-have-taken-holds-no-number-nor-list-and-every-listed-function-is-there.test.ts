// The code the world's making's rows have taken holds no number and no list, and every function the world's making's
// counts list is there (B-06, T7, the rules pulled out: its world generation family, B-06s to B-06ab). Each function or
// table the family's rows have taken holds no number other than 0 and 1 and no string in an array literal (the name
// pools, the beasts, the fleets, the chances and the bands are read from content's rows instead). Each row adds what
// it takes to TAKEN, which is empty until the first of them (B-06t). With them, the ratchet's two counts of the world's
// making (tools/ratchet.ts's worldMakingNumbersInEngine and worldMakingListsInEngine, by their helper
// worldMakingCountsByFunction), which only fall. A count of listed functions can be lowered by moving a number or a
// list out of the list, so every function the list names must still be declared: one a row moves keeps its entry at its
// new home (the row's pull request moves it), and a function a row empties stays in it at 0.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES,
  theCodeFiles,
  worldMakingCountsByFunction,
  worldMakingListsInEngine,
  worldMakingNumbersInEngine,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function or table holds. */
const TOP = '(top)';

/** Each function or table (or a file's top level) the world's making's rows have taken, by its file, from the row that
 *  took it: each of the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.for(TAKEN)('%s: %s holds no number and no list (%s)', ([file, fn]) => {
  const counts = worldMakingCountsByFunction(file, read(file));
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn)?.numbers ?? 0, `${fn}'s numbers (the ratchet's helper)`).toBe(0);
  expect(counts.get(fn)?.lists ?? 0, `${fn}'s lists' strings (the ratchet's helper)`).toBe(0);
});

test.for(THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES)(
  '%s declares %s, which the world-making counts list',
  ([file, fn]) => {
    expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
    expect(worldMakingCountsByFunction(file, read(file)).has(fn), `${file} declares ${fn}`).toBe(true);
  },
);

test('no function is listed twice, and each is in src/engine/ outside src/engine/rules/', () => {
  const keys = THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES.map(([file, fn]) => `${file} ${fn}`);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  expect(
    THE_WORLDS_MAKINGS_FUNCTIONS_AND_TABLES.filter(
      ([file]) => !file.startsWith('src/engine/') || file.startsWith('src/engine/rules/'),
    ),
  ).toEqual([]);
});

// The helper finds what it counts: each number other than 0 and 1, and each string an array literal holds (inside a
// `new Set([...])` too), in a top-level function or table; a nested function, named or not, counts for the top-level
// one around it, and what is outside every one for the top level. None of a literal type's, an element's index, a 0 or
// a 1, nor a string that isn't an array's element.
test("the ratchet's helper counts each number other than 0 and 1, and each string in an array", () => {
  const planted = `
    type Terrain = 'plain' | 'sea';
    type Band = 2 | 3;
    export const TABLE = { a: 2, b: 0, c: 1, d: [1.5, -4], e: ['plain', 'sea'] };
    for (const k of ['x']) TABLE[k] = 3;
    export function planted(list: string[], band: Band, t: Terrain) {
      const inner = () => ['forest', \`desert\`, 'jungle'.length];
      function named() { return new Set(['mountain', 7]); }
      return list[2] + list[0] + 'not a list' + inner() + named() + band + t + 1e-9 + 0x10 + 1 + 0;
    }
    export const arrow = () => 6;`;
  expect(Object.fromEntries(worldMakingCountsByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: { numbers: 1, lists: 1 },
    TABLE: { numbers: 3, lists: 2 },
    planted: { numbers: 3, lists: 3 },
    arrow: { numbers: 1, lists: 0 },
  });
});

// The counts on the tree are the ratchet's baselines; a number or a list's string planted in a listed function raises
// its count by one, and the ratchet fails on it; one in a function the list doesn't name isn't counted (the check
// above is what keeps a listed function from being emptied that way).
test.for([
  ['src/engine/world/generate.ts', 'normSeaPct', 'return 5;', 'worldMakingNumbersInEngine', 1],
  ['src/engine/bots/setup.ts', 'generateBotSetups', "return ['Elven'];", 'worldMakingListsInEngine', 1],
  ['src/engine/world/generate.ts', 'aFunctionNoListNames', 'return 5;', 'worldMakingNumbersInEngine', 0],
] as const)('%s, in %s: %s raises %s by %i', ([file, fn, body, count, rise]) => {
  const files = theCodeFiles();
  const theCount = count === 'worldMakingNumbersInEngine' ? worldMakingNumbersInEngine : worldMakingListsInEngine;
  const asTheyAre = { ...readBaseline(), [count]: theCount(files) };
  expect(asTheyAre[count], `${count} on the tree as it is`).toBe(readBaseline()[count]);
  const withThePlant = files.map(([f, text]): [string, string] => [
    f,
    f === file ? `${text}\nexport function ${fn}() { ${body} }\n` : text,
  ]);
  const planted = { ...asTheyAre, [count]: theCount(withThePlant) };
  expect(planted[count], `${count} with ${body} planted in ${fn}`).toBe(Number(asTheyAre[count]) + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => r.startsWith(`${count} rose from `))).toEqual(rose);
});
