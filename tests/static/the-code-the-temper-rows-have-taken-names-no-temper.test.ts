// The code the temper rows have taken names no temper (B-06, T7, the rules pulled out: Run 3a's tempers, B-06ai and
// B-06aj): each function (or file's top level) the family's rows have taken holds no string naming a temper
// (`'Berserk'`, `'Brave'`, `'Cautious'`, `'Cowardly'`), whatever the code does with it (compared, a `case`, a list, a
// map's value, a literal type, or in a function nested inside). It reads the temper's row instead. Each row adds what it
// takes to TAKEN, which is empty until the first of them (B-06ai). With them, the ratchet's count of the tempers the
// engine names outside src/engine/rules/ (tools/ratchet.ts's temperChecksInEngine, by its helper
// temperChecksByFunction), so that count only falls: the helper counts each temper planted, and none in
// src/engine/rules/ or a page's code.
// Not seen: a temper as a property's key (`TEMPER_TRAITS.Brave`), and `'None'`, the guardians' row of no temper.
//
// Level 0 (static): the files' syntax trees and content's list of tempers as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { KC_TEMPERS } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  TEMPER_VOCABULARY,
  temperChecksByFunction,
  temperChecksInEngine,
  theCodeFiles,
} from '../../tools/ratchet.ts';
import { everyStringIn, TOP } from '../lib/the-strings-a-function-of-the-code-holds.ts';

/** Each function (or a file's top level) the temper rows have taken, by its file, from the row that took it. Empty
 *  until B-06ai: each of the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [];

test.for(TAKEN)('%s: %s names no temper (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = temperChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of a temper (the ratchet's helper)`).toBe(0);
  expect(
    everyStringIn(file, text, fn, (word) => TEMPER_VOCABULARY.has(word)),
    `every string in ${fn} naming a temper`,
  ).toEqual([]);
});

test("the vocabulary holds content's four tempers, and no other word", () => {
  expect([...TEMPER_VOCABULARY]).toEqual(KC_TEMPERS);
  expect([...TEMPER_VOCABULARY]).toEqual(['Berserk', 'Brave', 'Cautious', 'Cowardly']);
});

// The helper finds what it counts: each form of a temper planted in one function of the engine (an arrow given to a
// name counts for that name, as a named function does; one outside every function for the top level), and none of
// what isn't a temper or is a literal type or a property's key.
test("the ratchet's helper counts each temper's name, a literal type's and a key's aside", () => {
  const planted = `
    type Temper = 'Brave' | 'Berserk';
    const STANCE = { Brave: 'challenge', x: 'Cautious' };
    export function planted(h: { temper?: string }) {
      const a = (h.temper === 'Cowardly') + ['Berserk', 'Brave'].length;
      const inner = () => \`Cautious\`;
      return a + inner() + (h.temper || 'Brave') + 'None' + 'brave';
    }`;
  expect(Object.fromEntries(temperChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 1,
    planted: 4,
    inner: 1,
  });
});

// The count on the tree is the ratchet's baseline; a temper planted in an engine function raises it by one, in the
// bots too, and the ratchet fails on it; one planted in src/engine/rules/ or a page's code isn't counted.
test.for([
  ['src/engine/items/equipment.ts', "return 'Brave';", 1],
  ['src/engine/bots/spellcraft.ts', "return ['Cautious', 'Cowardly'];", 2],
  ['src/engine/rules/the-registry-of-alignment-abilities.ts', "return 'Berserk';", 0],
  ['src/ui/player/map-symbols.ts', "return 'Brave';", 0],
] as const)('%s: %s raises temperChecksInEngine by %i', ([file, body, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), temperChecksInEngine: temperChecksInEngine(files) };
  expect(asTheyAre.temperChecksInEngine, 'temperChecksInEngine on the tree as it is').toBe(
    readBaseline()['temperChecksInEngine'],
  );
  const withThePlant = files.map(([f, text]): [string, string] =>
    f === file ? [f, `${text}\nexport function aPlantedTemper() { ${body} }\n`] : [f, text],
  );
  const planted = { ...asTheyAre, temperChecksInEngine: temperChecksInEngine(withThePlant) };
  expect(planted.temperChecksInEngine, `temperChecksInEngine with ${body} planted in ${file}`).toBe(
    asTheyAre.temperChecksInEngine + rise,
  );
  expect(compare(asTheyAre, planted).rose, 'the ratchet fails on a rise').toHaveLength(rise > 0 ? 1 : 0);
});
