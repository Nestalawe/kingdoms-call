// The code the economy's rows have taken holds no number, and every function the economy's counts list is there (B-06,
// T7, the rules pulled out: its economy family, B-06b to B-06h). Each function or table of the engine or the bots the
// family's rows have taken holds no number other than 0 (the gold, the wages, the prices and the shares are read from
// content's rows instead), whatever the code does with it. Each row adds what it takes to TAKEN (from B-06b). With them, the ratchet's two counts of the economy's numbers (tools/ratchet.ts's
// economyNumbersInEngine and economyNumbersInTheBots, by their helper economyNumbersByFunction), which only fall. A
// count of listed functions can be lowered by moving a number out of the list, so every function the lists name must
// still be declared: one a row deletes or renames leaves its list in that row's pull request, and a function a row
// empties stays in it at 0.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  economyNumbersByFunction,
  economyNumbersInEngine,
  economyNumbersInTheBots,
  readBaseline,
  THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE,
  THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function or table holds. */
const TOP = '(top)';

/** Each function or table (or a file's top level) the economy's rows have taken, by its file, from the row that took
 *  it: each of the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/army-tables.ts', 'ARMY_COST_MASTER', "B-06b, the price table: content's, the same object"],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'thePriceOfACompanyOfAType',
    "B-06b, the price rule: content's table and its 2g for a type priced at nothing",
  ],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'theWageOfACompany',
    "B-06b, the wage rule: content's 1g for a skeletal company",
  ],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'thePriceADruidPaysForABeast',
    "B-06d, the Druid's half price: his row's share in the economy's rules",
  ],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'theWageABeastPaysUnderADruid',
    "B-06d, the Druid's half wage: his row's share and least wage in the economy's rules",
  ],
  [
    'src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts',
    'heroSkillWage',
    "B-06d, the hero's skill premium: content's skill points for each gold and the gold it takes off",
  ],
  [
    'src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts',
    'theWageOfAHeroInService',
    "B-06d, the hero's wage in service, the one formula: content's least wage",
  ],
  [
    'src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts',
    'theHostLeadersCut',
    "B-06d, the Host-Leader's cut: his row's gold on each company",
  ],
  [
    'src/engine/heroes/effective-skills-and-hidden-heroes.ts',
    'recalcHeroPay',
    "B-06d, the hero's wage: the one formula (theWageOfAHeroInService) and content's allegiance of a hero never hired",
  ],
  [
    'src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts',
    'thePriceOfAMercenaryBand',
    "B-06f, a mercenary band's price, the order's and the report's: content's least price of a band",
  ],
  [
    'src/engine/items/tiers-and-hoards.ts',
    'WILD_HUNT_COST',
    "B-06f, the Wild Hunt's fallback price: content's, the same value",
  ],
  [
    'src/engine/items/tiers-and-hoards.ts',
    'wildHuntPrice',
    "B-06f, the Wild Hunt's price, the rite's, the report's and the bots': the table's, or content's fallback",
  ],
  [
    'src/engine/items/tiers-and-hoards.ts',
    'GRAND_HEIST_RICH_TAX',
    "B-06f, the Grand Heist's rich province, the order's and the bots': content's tax, the same value",
  ],
  [
    'src/engine/world/tables.ts',
    'ENCOUNTER_CLEAR_GOLD_BANDS',
    "B-06g, the lairs' gold bands: content's, the same object",
  ],
  [
    'src/engine/world/tables.ts',
    'encounterClearGold',
    "B-06g, a scout's and a clear's gold: the one roll (theGoldALairsHoardHoldsOnADie), content's bands and fallback",
  ],
];

const LISTED = [...THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE, ...THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS];
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.for(TAKEN)('%s: %s holds no number (%s)', ([file, fn]) => {
  const counts = economyNumbersByFunction(file, read(file));
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s numbers (the ratchet's helper)`).toBe(0);
});

test.for(LISTED)('%s declares %s, which the economy counts list', ([file, fn]) => {
  expect(fs.existsSync(path.join(ROOT, file)), `${file} is there`).toBe(true);
  expect(economyNumbersByFunction(file, read(file)).has(fn), `${file} declares ${fn}`).toBe(true);
});

test('no function is listed twice, nor in both lists, and the bots are counted apart', () => {
  const keys = LISTED.map(([file, fn]) => `${file} ${fn}`);
  expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  expect(THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE.filter(([file]) => !file.startsWith('src/engine/'))).toEqual(
    [],
  );
  expect(
    THE_ECONOMYS_FUNCTIONS_AND_TABLES_IN_THE_ENGINE.filter(
      ([file]) => file.startsWith('src/engine/bots/') || file.startsWith('src/engine/rules/'),
    ),
  ).toEqual([]);
  expect(THE_ECONOMYS_FUNCTIONS_IN_THE_BOTS.filter(([file]) => !file.startsWith('src/engine/bots/'))).toEqual([]);
});

// The helper finds what it counts: each number other than 0 in a function or a top-level table (a nested function,
// named or not, counts for the one around it; one outside every function for the top level), and none of a literal
// type's, an element's index or a 0.
test("the ratchet's helper counts each number other than 0, a literal type's and an index aside", () => {
  const planted = `
    type Price = 2 | 3;
    export const TABLE = { a: 2, b: 0, c: [1.5, -4] };
    for (const k of Object.keys(TABLE)) TABLE[k] = 1;
    export function planted(list: number[], cost: Price) {
      const inner = (x: number) => x * 0.5;
      function named() { return 7; }
      return list[0] + list[1] + inner(cost) + 1e-9 + 0x10 + 0;
    }
    export const arrow = () => 6;`;
  expect(Object.fromEntries(economyNumbersByFunction('src/engine/planted.ts', planted))).toEqual({
    TABLE: 3,
    [TOP]: 1,
    planted: 3,
    named: 1,
    arrow: 1,
  });
});

// A number planted in a listed function raises its count by one, and the ratchet fails on it; one in a function the
// lists don't name isn't counted (the check above is what keeps a listed function from being emptied that way).
test.for([
  ['src/engine/discoveries.ts', 'taxBonusCap', 'economyNumbersInEngine', 1],
  ['src/engine/bots/strategy.ts', 'botUpkeep', 'economyNumbersInTheBots', 1],
  ['src/engine/discoveries.ts', 'aFunctionNoListNames', 'economyNumbersInEngine', 0],
] as const)('a number planted in %s, in %s, raises %s by %i', ([file, fn, count, rise]) => {
  const files = theCodeFiles();
  const theCount = count === 'economyNumbersInEngine' ? economyNumbersInEngine : economyNumbersInTheBots;
  const asTheyAre = { ...readBaseline(), [count]: theCount(files) };
  expect(asTheyAre[count], `${count} on the tree as it is`).toBe(readBaseline()[count]);
  const withThePlant = files.map(([f, text]): [string, string] => [
    f,
    f === file ? `${text}\nexport function ${fn}(): number { return 5; }\n` : text,
  ]);
  const planted = { ...asTheyAre, [count]: theCount(withThePlant) };
  expect(planted[count], `${count} with a 5 planted in ${fn}`).toBe(Number(asTheyAre[count]) + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => r.startsWith(`${count} rose from `))).toEqual(rose);
});
