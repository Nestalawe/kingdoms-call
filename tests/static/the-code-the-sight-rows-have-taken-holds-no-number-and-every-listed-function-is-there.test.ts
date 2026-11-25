// The code the sight rows have taken holds no number, and every function sight's count lists is there (B-06, T7, the
// rules pulled out: Run 3e, sight's part). Each function the family's rows have taken holds no number other than 0 (the
// sight rules' bands, chances and figures are read from content's rows instead); the two listed functions that hold
// none from the start are held at 0 from sight's first row. Each row adds what it takes to TAKEN. With them, the
// ratchet's count of the sight rules' numbers (tools/ratchet.ts's sightNumbersInEngine over the functions
// THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE lists, by the economy's helper economyNumbersByFunction), which only falls. A
// count of listed functions can be lowered by moving a number out of them, so each one listed must still be there: a
// function a row empties stays in its list at 0, and one a row deletes or renames leaves its list in that row's pull
// request.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  economyNumbersByFunction,
  readBaseline,
  sightNumbersInEngine,
  THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The sight file most of the listed functions are in. */
const THE_SIGHT_RULES = 'src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';

/** Each listed function the sight rows hold at 0, by its file, from the row that took it (or held it from the start):
 *  each of the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [THE_SIGHT_RULES, 'enemyCharVisibleTo', "sight's row 0: no number written there, held at 0 from the start"],
  [THE_SIGHT_RULES, 'nearSpiedProvIds', "sight's row 0: no number written there, held at 0 from the start"],
];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.for(TAKEN)('%s: %s holds no number (%s)', ([file, fn]) => {
  expect(
    THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE.some(([f, g]) => f === file && g === fn),
    `${file}'s ${fn} is one sight's count lists`,
  ).toBe(true);
  const counts = economyNumbersByFunction(file, read(file));
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s numbers (the ratchet's helper)`).toBe(0);
});

test.for(THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE)("%s declares %s, which sight's count lists", ([file, fn]) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(economyNumbersByFunction(file, read(file)).has(fn), `${file} declares ${fn}`).toBe(true);
});

test('no sight function is listed twice, and each is in src/engine/ outside its rules registry', () => {
  const keys = THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE.map(([file, fn]) => `${file} ${fn}`);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  expect(
    THE_SIGHTS_FUNCTIONS_IN_THE_ENGINE.filter(
      ([file]) => !file.startsWith('src/engine/') || file.startsWith('src/engine/rules/'),
    ),
  ).toEqual([]);
});

// The count on the tree is the ratchet's baseline; a number planted in a listed function raises it by one (a 1 too:
// the economy's rule leaves out only 0), and the ratchet fails on it; one in a function the list doesn't name, in the
// same file, doesn't (the checks above keep a listed function from being emptied that way).
test.for([
  [THE_SIGHT_RULES, 5, 'armySizeBand', 1],
  [THE_SIGHT_RULES, 1, 'nearSpiedProvIds', 1],
  ['src/engine/heroes/fame-and-consecration.ts', 5, 'spotEnemyInOwnedProvince', 1],
  ['src/engine/espionage/what-a-spy-learns.ts', 5, 'applySpySuccess', 1],
  [THE_SIGHT_RULES, 5, 'aPlantedSightRule', 0],
] as const)('%s: a %i planted in %s raises sightNumbersInEngine by %i', ([file, number, fn, rise]) => {
  const files = theCodeFiles();
  const onTheTree = sightNumbersInEngine(files);
  expect(onTheTree, 'sightNumbersInEngine on the tree as it is').toBe(readBaseline()['sightNumbersInEngine']);
  const asTheyAre = { ...readBaseline(), sightNumbersInEngine: onTheTree };
  const withThePlant = files.map(([f, text]): [string, string] => [
    f,
    f === file ? `${text}\nexport function ${fn}(): number { return ${String(number)}; }\n` : text,
  ]);
  const withANumber = sightNumbersInEngine(withThePlant);
  expect(withANumber, `sightNumbersInEngine with a ${String(number)} planted in ${fn}`).toBe(onTheTree + rise);
  const planted = { ...asTheyAre, sightNumbersInEngine: withANumber };
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => r.startsWith('sightNumbersInEngine rose from '))).toEqual(rose);
});
