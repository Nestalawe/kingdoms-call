// Each magic item states the numbers its effect has (plan P1-19's items family, Decision 3: the words tests read the
// registry's rows, so a number has one source). For every row of the content's item effects
// (src/content/magic-item-effects-their-names-numbers-and-words.ts, the numbers the items' registry reads), every item in
// play that carries it (found as the registry finds it: theEffectsAnItemCarries, by its effect's key, a field of its own
// or its base name) states each of the row's numbers as the item's texts write it (×1.25 as `+25%`, strength added as
// `+2`), in its desc and in its lore, with no digit just before or after it (`+2` isn't in "+25%", nor `+20%` in
// "+120%"). So a number changed in content, and not in the items' texts, turns this red, and so does a text changed
// alone. Each row with numbers is carried by some item in play (else this would check nothing). The rows with no number
// (the Kraken Figurehead's step up a tier, which no item in play carries; the Tide-Caller's Horn's waiver at sea) are
// listed, so a number added to either is checked.
// The known gaps are listed by name, each with its Parked entry, and checked to be still gaps (so the exception leaves
// with the fix): the two relic standards say +4 and +6 and give +2 (NEXT.md question 20; Parked "The two relic
// standards give +2, not their +4 and +6"). The units an item reaches are words this test can't match to a set
// (question 21: Parked "Thirty items' texts name fewer units, or another rule, than the battle gives").
// Level 1 (unit), not static: the items in play exist only after the engine's load-time pass (src/engine/items/
// equipment.ts and tiers-and-hoards.ts rewrite the list: 711 items), so the whole engine is imported first.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS,
  type ANumberOfAnItemsEffect,
  type MagicItemEffectSlug,
} from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import { theEffectsAnItemCarries } from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';

/** The items whose texts don't state their effect's number yet, by the row's slug, each with its Parked entry. */
const KNOWN_GAPS: Partial<Record<MagicItemEffectSlug, Readonly<Record<string, string>>>> = {
  'army-bonus': {
    'Battle Standard': 'Parked "The two relic standards give +2, not their +4 and +6" (NEXT.md question 20)',
    'Standard of the Nine Legions':
      'Parked "The two relic standards give +2, not their +4 and +6" (NEXT.md question 20)',
  },
};
/** The rows with no number, each with why. */
const ROWS_WITH_NO_NUMBER: Partial<Record<MagicItemEffectSlug, string>> = {
  'naval-bonus': 'a step up a quality tier, from the tables (and no item in play carries it)',
  'land-units-at-full-strength-at-sea': "a waiver of the sea's penalty",
};

/** A number as an item's texts write it: a multiplier as the share it adds (×1.25 as +25%), strength added as +2. */
function asTheTextsWriteIt(n: ANumberOfAnItemsEffect): string {
  switch (n.theTextsWriteIt) {
    case 'a multiplier, as the share it adds':
      return `+${String(Number(((n.value - 1) * 100).toFixed(6)))}%`;
    case 'strength added':
      return `+${String(n.value)}`;
  }
}
/** A number as the texts write it, with no digit just before it, nor a digit, a `%` or a decimal part just after. */
const theNumber = (text: string) =>
  new RegExp(`(?<![0-9])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9%]|\\.[0-9])`);

const ROWS = Object.entries(MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS).map(([slug, row]) => ({
  slug,
  numbers: Object.values<ANumberOfAnItemsEffect>(row.numbers).map(asTheTextsWriteIt),
  items: ALL_MAGIC_ITEMS_P.filter((item) => theEffectsAnItemCarries(item).some((s) => s === slug)),
  gaps: KNOWN_GAPS[slug as MagicItemEffectSlug] ?? {},
}));

describe('each item in play states the numbers of the effects it carries, in its desc and its lore', () => {
  test.for(ROWS.filter((row) => row.numbers.length))('%s', (row) => {
    expect(row.items.length, `the items in play that carry ${row.slug}`).toBeGreaterThan(0);
    const stated = row.items
      .filter((item) => !(item.name in row.gaps))
      .map((item) => ({
        item: item.name,
        desc: row.numbers.filter((n) => !theNumber(n).test(item.desc)),
        lore: row.numbers.filter((n) => !theNumber(n).test(item.lore)),
      }))
      .filter((missing) => missing.desc.length || missing.lore.length);
    expect(stated, `the numbers ${row.numbers.join(', ')} each item leaves out`).toEqual([]);
  });
});

describe('the known gaps are still gaps (each leaves with its fix)', () => {
  test.for(ROWS.flatMap((row) => Object.keys(row.gaps).map((name) => [row.slug, name, row] as const)))(
    '%s: %s',
    ([, name, row]) => {
      const item = row.items.find((it) => it.name === name);
      expect(item, `${name} is in play and carries the effect`).toBeDefined();
      expect(
        row.numbers.filter((n) => theNumber(n).test(item?.desc ?? '') && theNumber(n).test(item?.lore ?? '')),
      ).toEqual([]);
    },
  );
});

test('the rows with no number are the ones listed', () => {
  expect(
    ROWS.filter((row) => !row.numbers.length)
      .map((row) => row.slug)
      .sort(),
  ).toEqual(Object.keys(ROWS_WITH_NO_NUMBER).sort());
});

test('a number is matched as the texts write it, and not inside another', () => {
  expect(asTheTextsWriteIt({ value: 1.15, theTextsWriteIt: 'a multiplier, as the share it adds' })).toBe('+15%');
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'strength added' })).toBe('+2');
  expect(theNumber('+2').test('Every army you lead fights +2.')).toBe(true);
  expect(theNumber('+2').test('strength +25%')).toBe(false);
  expect(theNumber('+2').test('strength +2.5')).toBe(false);
  expect(theNumber('+20%').test('strength +120%')).toBe(false);
});
