// The code the battle rows have taken holds no number, and every file and bots' function the battles' counts list is
// there (B-06, T7, the rules pulled out: Runs 3c and 3d, the battles). Each function or table the family's rows have
// taken holds no number other than 0 and 1 (the battles' factors, bands and tables are read from content's rows
// instead). Each row adds what it takes to TAKEN (the bots' race row B-06ah took the first). With them, the ratchet's
// three counts of the battles' numbers (tools/ratchet.ts's battleNumbersInEngine over src/engine/battle/ but its facts'
// files and two files of src/engine/units/, personalCombatNumbersInEngine over src/engine/personal-combat/ but its
// facts' file, and battleNumbersInTheBots over the bots' battle estimate's listed functions, by their helper
// battleNumbersByFunction), which only fall. A count of listed files or functions can be lowered by moving a number out
// of them, so each one listed must still be there: a function a row empties stays in its list at 0.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  battleNumbersByFunction,
  battleNumbersInEngine,
  battleNumbersInTheBots,
  compare,
  countsBattleNumbers,
  countsPersonalCombatNumbers,
  personalCombatNumbersInEngine,
  readBaseline,
  THE_BATTLES_FILES_IN_THE_UNITS_FOLDER,
  THE_BATTLES_FUNCTIONS_IN_THE_BOTS,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function or table holds. */
const TOP = '(top)';

/** Each function or table (or a file's top level) the battle rows have taken, by its file, from the row that took it:
 *  each of the family's rows adds what it takes (and a row of another family whose move empties one). */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/bots/intel.ts',
    'botRaceTerrainMult',
    "B-06ah, the kin's factors from the kin rule's content, the gifts' from their rows",
  ],
  [
    'src/engine/battle/terrain-and-unit-strength.ts',
    'TERRAIN_MODS',
    "B-06ax, the ground's table: content's (KC_EACH_UNIT_TYPES_FACTOR_ON_EACH_GROUND), the same object",
  ],
  [
    'src/engine/battle/fates.ts',
    'BATTLE_MARGIN_BANDS',
    "B-06ay1, the margin bands: content's (KC_A_BATTLES_MARGIN_BANDS_AND_EACH_SIDES_CHANCES_IN_THEM), the same list",
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'CARRYON_DEATH_STEP',
    "B-06ay1, the carry-on's step: content's row (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS)",
  ],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'CARRYON_DEATH_CAP',
    "B-06ay1, the carry-on's cap: content's row (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS)",
  ],
];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.for(TAKEN)('%s: %s holds no number (%s)', ([file, fn]) => {
  const isCounted =
    countsBattleNumbers(file) ||
    countsPersonalCombatNumbers(file) ||
    THE_BATTLES_FUNCTIONS_IN_THE_BOTS.some(([f, g]) => f === file && g === fn);
  expect(isCounted, `${file}'s ${fn} is one the battles' counts read`).toBe(true);
  const counts = battleNumbersByFunction(file, read(file));
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s numbers (the ratchet's helper)`).toBe(0);
});

test.for(THE_BATTLES_FILES_IN_THE_UNITS_FOLDER)('%s, which the battles count lists, is there', (file) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(countsBattleNumbers(file), `${file} is counted`).toBe(true);
});

test.for(THE_BATTLES_FUNCTIONS_IN_THE_BOTS)('%s declares %s, which the bots battle count lists', ([file, fn]) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(battleNumbersByFunction(file, read(file)).has(fn), `${file} declares ${fn}`).toBe(true);
});

test("no bots' function is listed twice, and each is in src/engine/bots/", () => {
  const keys = THE_BATTLES_FUNCTIONS_IN_THE_BOTS.map(([file, fn]) => `${file} ${fn}`);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  expect(THE_BATTLES_FUNCTIONS_IN_THE_BOTS.filter(([file]) => !file.startsWith('src/engine/bots/'))).toEqual([]);
});

// The files each count reads: every file of src/engine/battle/ (a folder of its own inside it too) but a facts' file,
// the units' two listed files, and every file of src/engine/personal-combat/ but its facts' file; the folders and the
// facts' files the rule names are there, so it reads what it says.
test('the battles count reads src/engine/battle/ and two units files, personal combat its own folder, no facts file', () => {
  for (const folder of ['src/engine/battle', 'src/engine/personal-combat'])
    expect(fs.existsSync(path.join(ROOT, folder)), `${folder} is there`).toBe(true);
  for (const facts of [
    'src/engine/battle/the-facts-a-battles-lines-record.ts',
    'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
  ])
    expect(fs.existsSync(path.join(ROOT, facts)), `${facts} is there`).toBe(true);
  expect(
    [
      'src/engine/battle/battles-against-province-defenders.ts',
      'src/engine/battle/the-battle-against-defenders/s01-the-set-up.ts',
      'src/engine/battle/the-facts-a-battles-lines-record.ts',
      'src/engine/units/sea-lift-stranding-and-retreats.ts',
      'src/engine/units/movement-pools.ts',
      'src/engine/personal-combat/melee-flight-and-archery.ts',
      'src/content/kingdoms-call-data.ts',
    ].map(countsBattleNumbers),
  ).toEqual([true, true, false, true, false, false, false]);
  expect(
    [
      'src/engine/personal-combat/melee-flight-and-archery.ts',
      'src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts',
      'src/engine/battle/fates.ts',
    ].map(countsPersonalCombatNumbers),
  ).toEqual([true, false, false]);
});

// The helper is the world's making's rule: each number other than 0 and 1 in a top-level function or table (a nested
// function, named or not, counts for the top-level one around it), none of a literal type's or an element's index.
test("the ratchet's helper counts each number other than 0 and 1, by top-level function and table", () => {
  const planted = `
    type Band = 2 | 3;
    export const BANDS = [{ at: 0.25, mult: 1.5 }, { at: 1, mult: 0 }];
    export function planted(list: number[], band: Band) {
      const inner = () => 1.25 * list[2];
      return inner() + band * 2 + 1 + 0 + -5;
    }`;
  expect(Object.fromEntries(battleNumbersByFunction('src/engine/battle/planted.ts', planted))).toEqual({
    [TOP]: 0,
    BANDS: 2,
    planted: 3,
  });
});

// The counts on the tree are the ratchet's baselines; a number planted where a count reads raises it by one, and the
// ratchet fails on it; one where none reads (a facts' file, another units file, a bots' function not listed) doesn't.
type TheBattlesCounts = 'battleNumbersInEngine' | 'personalCombatNumbersInEngine' | 'battleNumbersInTheBots';
const THE_COUNTS: Readonly<
  Record<TheBattlesCounts, (codeFiles: readonly (readonly [file: string, text: string])[]) => number>
> = { battleNumbersInEngine, personalCombatNumbersInEngine, battleNumbersInTheBots };
test.for([
  ['src/engine/battle/fates.ts', 'aPlantedBand', 'battleNumbersInEngine', 1],
  [
    'src/engine/battle/the-battle-against-defenders/s01-a-planted-stage.ts',
    'aPlantedStage',
    'battleNumbersInEngine',
    1,
  ],
  ['src/engine/units/defend-ride-outs-ambushes-and-reinforcements.ts', 'aPlantedRideOut', 'battleNumbersInEngine', 1],
  ['src/engine/battle/the-facts-a-battles-lines-record.ts', 'aPlantedFact', 'battleNumbersInEngine', 0],
  ['src/engine/units/movement-pools.ts', 'aPlantedPool', 'battleNumbersInEngine', 0],
  [
    'src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts',
    'aPlantedToHit',
    'personalCombatNumbersInEngine',
    1,
  ],
  ['src/engine/bots/intel.ts', 'botMarginFor', 'battleNumbersInTheBots', 1],
  ['src/engine/bots/intel.ts', 'aPlantedBotGuess', 'battleNumbersInTheBots', 0],
] as const)('%s, in %s: a number raises %s by %i', ([file, fn, count, rise]) => {
  const files = theCodeFiles();
  const theCount = THE_COUNTS[count];
  const asTheyAre = { ...readBaseline(), [count]: theCount(files) };
  expect(asTheyAre[count], `${count} on the tree as it is`).toBe(readBaseline()[count]);
  const plant = `\nexport function ${fn}() { return 5; }\n`;
  const withThePlant = files.some(([f]) => f === file)
    ? files.map(([f, text]): [string, string] => (f === file ? [f, `${text}${plant}`] : [f, text]))
    : [...files, [file, plant] as const];
  const planted = { ...asTheyAre, [count]: theCount(withThePlant) };
  expect(planted[count], `${count} with a 5 planted in ${fn} of ${file}`).toBe(Number(asTheyAre[count]) + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => r.startsWith(`${count} rose from `))).toEqual(rose);
});
