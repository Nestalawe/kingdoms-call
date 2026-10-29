// Each magic item states the numbers its effect has (plan P1-19's items family, Decision 3: the words tests read the
// registry's rows, so a number has one source). For every row of the content's item effects
// (src/content/magic-item-effects-their-names-numbers-and-words.ts, the numbers the items' registry reads), every item in
// play that carries it (found as the registry finds it: theEffectsAnItemCarries, by its effect's key, a field of its own
// or its base name) states each of the row's numbers as the item's texts write it (×1.25 as `+25%`, strength added as
// `+2`, a share as "half" or "halved", volleys as "two volleys", extra shots as "one extra shot", a share as a
// percentage as `10%`, gold for each province as `+1g`, `+1 gold` or "1 extra gold", skill levels added as `+1` or
// "one level", damage turned aside as "1 less", a chance in percentage points as `5%`), in its desc and in its lore, with no digit just before or after it (`+2` isn't in "+25%", nor `+20%` in "+120%"), and a word whole. So a number changed in content, and not in the items' texts, turns this red, and so does a text changed
// alone. Each row with numbers is carried by some item in play (else this would check nothing). The rows with no number
// (the Kraken Figurehead's step up a tier, which no item in play carries; the Tide-Caller's Horn's waiver at sea; the
// War-Horn's pursuit on any ground; the Shield-Wall Rune's refusal to retreat; the tax items' and the Traveller's
// Cloak's numbers, which each copy carries itself; the Crystal Orb's sure Spy, the Philosopher's Lens's lair and the
// Philosopher's Stone's power; the maximum-HP items' hit points and the temper items' temper, which each copy carries
// itself; the wards and riders a fighter wears, whose amounts, percentages and hits each copy carries itself, but the
// buckler's; the Mithril suit, in no table) are listed, so a number added to one is checked.
// The known gaps are listed by name, each with its Parked entry, and checked to be still gaps (so the exception leaves
// with the fix): the two relic standards say +4 and +6 and give +2 (NEXT.md question 20; Parked "The two relic
// standards give +2, not their +4 and +6"); five siege items say "Siege bonus +1" (question 21: Parked "Thirty items'
// texts name fewer units, or another rule, than the battle gives"); no home-defence item states its ×1.25 (question 22:
// Parked "The home-defence items say a quality tier in any province of one's own; the battle gives ×1.25 at the home
// alone"). The units an item reaches are words this test can't match to a set (question 21).
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
const SIEGE_WORDS =
  'Parked "Thirty items\' texts name fewer units, or another rule, than the battle gives" (NEXT.md question 21)';
const HOME_DEFENCE_WORDS =
  'Parked "The home-defence items say a quality tier in any province of one\'s own; the battle gives ×1.25 at the home alone" (NEXT.md question 22)';
const KNOWN_GAPS: Partial<Record<MagicItemEffectSlug, Readonly<Record<string, string>>>> = {
  'army-bonus': {
    'Battle Standard': 'Parked "The two relic standards give +2, not their +4 and +6" (NEXT.md question 20)',
    'Standard of the Nine Legions':
      'Parked "The two relic standards give +2, not their +4 and +6" (NEXT.md question 20)',
  },
  'siege-bonus': {
    'Cloak of the Siege Engineer': SIEGE_WORDS,
    'Ring of the Sapper': SIEGE_WORDS,
    "Siege-Wright's Scale Model": SIEGE_WORDS,
    'Travelworn Veil': SIEGE_WORDS,
    'Plain Bezel': SIEGE_WORDS,
  },
  'home-defence-bonus': {
    'Banner of the Realm': HOME_DEFENCE_WORDS,
    'Shield of the Innocent': HOME_DEFENCE_WORDS,
    'Mantle of the Marches': HOME_DEFENCE_WORDS,
    'Band of the Home Guard': HOME_DEFENCE_WORDS,
    'Standard of the Home Levy': HOME_DEFENCE_WORDS,
    'Ensign of the Hearth': HOME_DEFENCE_WORDS,
    'Aegis of the Hearth': HOME_DEFENCE_WORDS,
    'Banded Shield': HOME_DEFENCE_WORDS,
    'Banded Targe': HOME_DEFENCE_WORDS,
    'Travelworn Robe': HOME_DEFENCE_WORDS,
    'Plain Round': HOME_DEFENCE_WORDS,
  },
};
/** The rows with no number, each with why. */
const ROWS_WITH_NO_NUMBER: Partial<Record<MagicItemEffectSlug, string>> = {
  'naval-bonus': 'a step up a quality tier, from the tables (and no item in play carries it)',
  'land-units-at-full-strength-at-sea': "a waiver of the sea's penalty",
  'war-horn-of-the-plains': "a pursuit on any ground (Ride Them Down's share is the unit ability's)",
  'shield-wall-rune': 'a refusal to retreat',
  'tax-bonus': "the gold each copy carries itself (its effect's bonus)",
  'crystal-orb': 'a Spy order without a roll (and no item in play carries it)',
  'philosophers-lens': 'one more lair revealed (the order draws which)',
  'travellers-cloak': 'the share of a province each copy carries itself (its exploreMove)',
  'philosophers-stone': 'a step up a quality tier, from the tables (and no item in play carries it)',
  'maximum-hp': "the hit points each copy carries itself (its effect's bonus)",
  temper: "the temper each copy carries itself (its effect's temper)",
  ...Object.fromEntries(
    (
      [
        'melee-damage-turned-aside',
        'arrow-damage-turned-aside',
        'nature-damage-turned-aside',
        'dark-damage-turned-aside',
        'thorns',
        'regeneration',
        'round-ward',
      ] as const
    ).map((slug) => [slug, "the amount each copy's ward carries itself"]),
  ),
  ...Object.fromEntries(
    (
      [
        'spell-damage-cut',
        'dodge',
        'block',
        'a-hits-damage-capped',
        'second-wind',
        'damage-cut-at-low-hp',
        'arrow-block',
        'spell-block',
      ] as const
    ).map((slug) => [slug, "the percentage each copy's ward carries itself"]),
  ),
  'the-first-hit-drunk': 'a flag',
  'lingering-harm-turned-aside': 'a flag',
  resist: 'a flag (and no item in play carries it)',
  'stun-immunity': 'a flag',
  'open-guard': "the hits and percentage each copy carries itself (content's are for a copy that carries none)",
  ...Object.fromEntries(
    (['aura-rider', 'burn-rider', 'drain-rider', 'hit-bonus-rider', 'damage-bonus-rider'] as const).map((slug) => [
      slug,
      "the amount each copy's rider carries itself",
    ]),
  ),
  'mithril-armour': "a dwarven birthright in no table (what it turns aside is the fight's)",
};

/** A count or a share in words, as the texts write it (a value with no word here writes as itself: no text matches). */
const IN_WORDS: Readonly<Record<number, string>> = { 0.5: 'half', 1: 'one', 2: 'two', 3: 'three' };
const inWords = (value: number) => IN_WORDS[value] ?? String(value);

/** A number as an item's texts write it (any of the forms given): a multiplier as the share it adds (×1.25 as +25%),
 *  strength added as +2, a share in words (0.5 as "half" or "halved"), volleys in words (2 as "two volleys"), extra
 *  shots in words (1 as "one extra shot"), a share as a percentage (0.1 as 10%), gold for each province (1 as +1g,
 *  +1 gold or "1 extra gold"), skill levels added (1 as +1 or "one level"), damage turned aside (1 as "1 less"), a
 *  chance in percentage points (5 as 5%). */
function asTheTextsWriteIt(n: ANumberOfAnItemsEffect): string[] {
  switch (n.theTextsWriteIt) {
    case 'a multiplier, as the share it adds':
      return [`+${String(Number(((n.value - 1) * 100).toFixed(6)))}%`];
    case 'strength added':
      return [`+${String(n.value)}`];
    case 'a share, in words':
      return n.value === 0.5 ? ['half', 'halved'] : [inWords(n.value)];
    case 'volleys, in words':
      return [`${inWords(n.value)} volleys`];
    case 'extra shots, in words':
      return [`${inWords(n.value)} extra shot${n.value === 1 ? '' : 's'}`];
    case 'a share, as a percentage':
      return [`${String(Number((n.value * 100).toFixed(6)))}%`];
    case 'gold, for each province':
      return [`+${String(n.value)}g`, `+${String(n.value)} gold`, `${String(n.value)} extra gold`];
    case 'skill levels added':
      return [`+${String(n.value)}`, `${inWords(n.value)} level${n.value === 1 ? '' : 's'}`];
    case 'damage turned aside':
      return [`${String(n.value)} less`];
    case 'a chance, in percentage points':
      return [`${String(n.value)}%`];
  }
}
/** A number as the texts write it, with no digit or letter just before it, nor a digit, a letter, a `%` or a decimal
 *  part just after. */
const theNumber = (text: string) =>
  new RegExp(`(?<![0-9A-Za-z])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z%]|\\.[0-9])`);
/** Whether a text states a number in one of the forms it is written. */
const states = (text: string, forms: readonly string[]) => forms.some((form) => theNumber(form).test(text));

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
        desc: row.numbers.filter((forms) => !states(item.desc, forms)),
        lore: row.numbers.filter((forms) => !states(item.lore, forms)),
      }))
      .filter((missing) => missing.desc.length || missing.lore.length);
    expect(
      stated,
      `the numbers ${row.numbers.map((forms) => forms.join(' or ')).join(', ')} each item leaves out`,
    ).toEqual([]);
  });
});

describe('the known gaps are still gaps (each leaves with its fix)', () => {
  test.for(ROWS.flatMap((row) => Object.keys(row.gaps).map((name) => [row.slug, name, row] as const)))(
    '%s: %s',
    ([, name, row]) => {
      const item = row.items.find((it) => it.name === name);
      expect(item, `${name} is in play and carries the effect`).toBeDefined();
      expect(row.numbers.filter((forms) => states(item?.desc ?? '', forms) && states(item?.lore ?? '', forms))).toEqual(
        [],
      );
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
  expect(asTheTextsWriteIt({ value: 1.15, theTextsWriteIt: 'a multiplier, as the share it adds' })).toEqual(['+15%']);
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'strength added' })).toEqual(['+2']);
  expect(asTheTextsWriteIt({ value: 0.5, theTextsWriteIt: 'a share, in words' })).toEqual(['half', 'halved']);
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'volleys, in words' })).toEqual(['two volleys']);
  expect(asTheTextsWriteIt({ value: 1, theTextsWriteIt: 'extra shots, in words' })).toEqual(['one extra shot']);
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'extra shots, in words' })).toEqual(['two extra shots']);
  expect(asTheTextsWriteIt({ value: 0.1, theTextsWriteIt: 'a share, as a percentage' })).toEqual(['10%']);
  expect(asTheTextsWriteIt({ value: 1, theTextsWriteIt: 'gold, for each province' })).toEqual([
    '+1g',
    '+1 gold',
    '1 extra gold',
  ]);
  expect(asTheTextsWriteIt({ value: 1, theTextsWriteIt: 'skill levels added' })).toEqual(['+1', 'one level']);
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'skill levels added' })).toEqual(['+2', 'two levels']);
  expect(asTheTextsWriteIt({ value: 1, theTextsWriteIt: 'damage turned aside' })).toEqual(['1 less']);
  expect(asTheTextsWriteIt({ value: 5, theTextsWriteIt: 'a chance, in percentage points' })).toEqual(['5%']);
  expect(theNumber('+2').test('Every army you lead fights +2.')).toBe(true);
  expect(theNumber('+2').test('strength +25%')).toBe(false);
  expect(theNumber('+2').test('strength +2.5')).toBe(false);
  expect(theNumber('+20%').test('strength +120%')).toBe(false);
  expect(states('the bonuses are halved.', ['half', 'halved'])).toBe(true);
  expect(states('a halfling', ['half', 'halved'])).toBe(false);
  expect(states('fire two volleys instead of one', ['two volleys'])).toBe(true);
  expect(states('on behalf of the realm', ['half', 'halved'])).toBe(false);
  expect(states('+10% HP recovered', ['10%'])).toBe(true);
  expect(states('+110% HP recovered', ['10%'])).toBe(false);
  expect(states('+1g collected per province', ['+1g', '+1 gold'])).toBe(true);
  expect(states('+1gold', ['+1g'])).toBe(false);
  expect(states('fights and works one level better', ['+1', 'one level'])).toBe(true);
  expect(states('one levels', ['+1', 'one level'])).toBe(false);
  expect(states('melee blows deal 1 less damage', ['1 less'])).toBe(true);
  expect(states('melee blows deal 11 less damage', ['1 less'])).toBe(false);
  expect(states('foes have −5% to hit you', ['5%'])).toBe(true);
  expect(states('foes have −15% to hit you', ['5%'])).toBe(false);
});
