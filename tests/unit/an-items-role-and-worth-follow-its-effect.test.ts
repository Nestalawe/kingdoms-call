// An item's role and worth follow its effect (plan P1-19t, the treasury: P1-19's items family, Decision 4 and the row's
// tests). The treasury reads what an item is for (itemRole: a combat item never sits in a Weak lair) and what it is
// worth (itemPowerScore: its tier, so which lairs hold it, and a bot's choice of what to carry) from the items' registry,
// by the effect a held copy carries. Checked here by properties, one item of each kind in play, not by a frozen table:
// - the role: every kind the registry says fights (a combat item, armour, an item of riders alone, the Mithril suit,
//   maximum HP, a temper, the Crown's aura) is a combat item, and so is any item that carries riders; a spell charm, a
//   tax item and a commander's item are utility; and no combat item in play sits in a Weak lair;
// - the worth by kind: a combat item's is its use's, armour's its ward's and its bonus's (the Mithril suit's an armour's),
//   an item of riders alone its riders' (and their ward's), maximum HP's, a tax item's and a skill's item's rises with
//   its bonus from nothing, a temper's is the same whatever it carries, a charm's rises with its spell's level; each
//   clamped at 12 and rounded to a tenth;
// - a combat use, a ward and a rider weigh more as their own number rises, and a copy that carries none of a combat
//   use's numbers weighs as one carrying its row's (the fight's fallback: one source);
// - a use, a ward or a stat the registry holds no effect for weighs as the treasury's generic worth (3, 2, or so much a
//   point of its bonus).
// The matrix sees a worth or a role planted wrong (the tiers move, and a game stops); these name which.
// Level 1 (unit): the items in play exist only after the engine's load-time pass, so the whole engine is imported first;
// each check calls the treasury's functions on an item in play or a staged copy (a staged spell put back as it was).
// Each holds on the row's base too (refactor-only); the fallbacks read the rows' theNumbersOfACopyThatCarriesNone.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P, SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import { _pcScore, _useScore, _wardScore, itemPowerScore, itemRole } from '../../src/engine/items/equipment.ts';
import { MITHRIL_ARMOUR } from '../../src/engine/heroes/fame-and-consecration.ts';

/** An item in play, as these checks read it. */
interface AnItemInPlay {
  readonly name: string;
  readonly tier: number;
  readonly effect: {
    readonly stat?: string;
    readonly use?: string;
    readonly ward?: string;
    readonly bonus?: number;
    readonly pc?: Readonly<Record<string, unknown>>;
  } & Readonly<Record<string, unknown>>;
}
const ITEMS: readonly AnItemInPlay[] = ALL_MAGIC_ITEMS_P;
/** The first item in play whose effect has the stat given (and the use or ward, if given). */
function theFirst(stat: string, more: { use?: string; ward?: string; withRiders?: boolean } = {}): AnItemInPlay {
  const found = ITEMS.find(
    (it) =>
      it.effect.stat === stat &&
      (more.use === undefined || it.effect.use === more.use) &&
      (more.ward === undefined || it.effect.ward === more.ward) &&
      (more.withRiders === undefined || Boolean(it.effect.pc) === more.withRiders),
  );
  if (!found) throw new Error(`No item in play of ${stat} ${JSON.stringify(more)}`);
  return found;
}
/** The treasury's clamp and rounding. */
const asTheTreasuryRoundsIt = (worth: number) => Math.min(12, Math.round(worth * 10) / 10);
const theBonus = (it: AnItemInPlay) => Number(it.effect.bonus) || 0;
const theRidersWorth = (it: AnItemInPlay) => (it.effect.pc ? _pcScore(it.effect.pc) : 0);

describe("an item's role follows its effect", () => {
  test.for([
    ['a combat item', 'combatUse'],
    ['armour', 'armour'],
    ['an item of riders alone', 'pc'],
    ['an item of maximum HP', 'maxHp'],
    ['a temper item', 'temper'],
    ['the Crown of Command', 'aura'],
  ] as const)('%s fights', ([, stat]) => {
    expect(itemRole(theFirst(stat))).toBe('combat');
  });

  test('the Mithril suit fights', () => {
    expect(itemRole(MITHRIL_ARMOUR)).toBe('combat');
  });

  test.for([
    ['a spell charm', 'castSpell'],
    ['a tax item', 'taxBonus'],
    ["a commander's item", 'cavBonus'],
    ['a field skill', 'tactical'],
  ] as const)('%s with no riders is utility', ([, stat]) => {
    expect(itemRole(theFirst(stat, { withRiders: false }))).toBe('utility');
  });

  test('a utility kind that carries riders fights: the riders outrank its stat', () => {
    const charm = theFirst('castSpell', { withRiders: false });
    expect(itemRole({ ...charm, effect: { ...charm.effect, pc: { dmgBonus: 1 } } })).toBe('combat');
  });

  test('no combat item in play sits in a Weak lair, and every kind that fights is in play', () => {
    expect(ITEMS.filter((it) => itemRole(it) === 'combat' && it.tier === 1).map((it) => it.name)).toEqual([]);
    for (const stat of ['combatUse', 'armour', 'pc', 'maxHp', 'temper', 'aura'])
      expect(
        ITEMS.some((it) => it.effect.stat === stat && itemRole(it) === 'combat'),
        stat,
      ).toBe(true);
  });
});

describe("an item's worth follows its effect, by its kind", () => {
  test("a combat item's is its use's", () => {
    for (const it of ITEMS.filter((i) => i.effect.stat === 'combatUse'))
      expect(itemPowerScore(it), it.name).toBe(asTheTreasuryRoundsIt(_useScore(it.effect) + theRidersWorth(it)));
  });

  test("armour's is its ward's and its bonus's (a bare armour of that bonus), and the Mithril suit's an armour's", () => {
    const bare = (bonus: number) => itemPowerScore({ name: 'A Staged Armour', effect: { stat: 'armour', bonus } });
    for (const it of ITEMS.filter((i) => i.effect.stat === 'armour'))
      expect(itemPowerScore(it), it.name).toBe(
        asTheTreasuryRoundsIt(_wardScore(it.effect) + bare(theBonus(it)) + theRidersWorth(it)),
      );
    expect(bare(0)).toBe(0);
    expect(bare(2)).toBeGreaterThan(bare(1));
    expect(itemPowerScore(MITHRIL_ARMOUR)).toBe(bare(MITHRIL_ARMOUR.effect.bonus));
  });

  test("an item of riders alone is worth its riders' and their ward's", () => {
    for (const it of ITEMS.filter((i) => i.effect.stat === 'pc'))
      expect(itemPowerScore(it), it.name).toBe(asTheTreasuryRoundsIt(theRidersWorth(it)));
  });

  test.for([
    ['maximum HP', 'maxHp'],
    ['a tax item', 'taxBonus'],
    ["a skill's item (generic)", 'tactical'],
    ["a commander's item (generic)", 'cavBonus'],
  ] as const)("%s's rises with its bonus, from nothing", ([, stat]) => {
    const it = theFirst(stat, { withRiders: false });
    const withBonus = (bonus: number) => itemPowerScore({ ...it, effect: { ...it.effect, bonus } });
    expect(withBonus(0)).toBe(0);
    expect(withBonus(1)).toBeGreaterThan(0);
    expect(withBonus(2)).toBeGreaterThan(withBonus(1));
  });

  test("a temper item's is the same whatever its temper and bonus", () => {
    const temper = theFirst('temper', { withRiders: false });
    expect(itemPowerScore(temper)).toBeGreaterThan(0);
    expect(itemPowerScore({ ...temper, effect: { ...temper.effect, temper: 'another', bonus: 5 } })).toBe(
      itemPowerScore(temper),
    );
  });

  test("a spell charm's rises with its spell's level (one of no level counts as level 2)", () => {
    const spells: Record<string, unknown> = SPELL_DEFS_P;
    spells['A Staged Spell of Level 1'] = { school: 'white', level: 1 };
    spells['A Staged Spell of Level 3'] = { school: 'white', level: 3 };
    try {
      const charm = (spell: string) => itemPowerScore({ name: 'A Staged Charm', effect: { stat: 'castSpell', spell } });
      expect(charm('A Staged Spell of Level 1')).toBeLessThan(charm('No Such Spell'));
      expect(charm('No Such Spell')).toBeLessThan(charm('A Staged Spell of Level 3'));
    } finally {
      delete spells['A Staged Spell of Level 1'];
      delete spells['A Staged Spell of Level 3'];
    }
  });
});

describe('a combat use, a ward and a rider weigh more as their own number rises', () => {
  test.for([
    ['heal', 'amt'],
    ['hot', 'amt'],
    ['secondwind', 'amt'],
    ['dmg', 'times'],
    ['drain', 'dmg'],
    ['stun', 'stun'],
    ['pen', 'hitPen'],
    ['weak', 'melee'],
    ['buff', 'melee'],
    ['focus', 'hitBonus'],
    ['absorb', 'absorb'],
    ['mirror', 'images'],
    ['flee', 'fleeBonus'],
    ['invis', 'toHitReduce'],
    ['terror', 'hitPen'],
    ['silence', 'rounds'],
  ] as const)('a %s by its %s', ([use, field]) => {
    const it = theFirst('combatUse', { use });
    const own = it.effect[field];
    const more = Array.isArray(own) ? own.map((n) => Number(n) + 4) : (Number(own) || 1) + 4;
    expect(_useScore({ ...it.effect, [field]: more }), JSON.stringify(it.effect)).toBeGreaterThan(_useScore(it.effect));
  });

  test.for([
    'meleeDR',
    'arrowDR',
    'natureDR',
    'darkDR',
    'thorns',
    'regen',
    'roundWard',
    'dodge',
    'block',
    'arrowBlock',
    'spellBlock',
    'spellPct',
    'cap',
    'lowHp',
    'openGuard',
    'stunImmune',
    'dotImmune',
    'firstHit',
    'secondWind',
    'buckler',
  ])('a ward of %s', (ward) => {
    const it = ITEMS.find((i) => i.effect.ward === ward) ?? ITEMS.find((i) => i.effect.pc?.['ward'] === ward);
    expect(it, ward).toBeDefined();
    const theWard = { ward, amt: 2, pct: 10 };
    expect(_wardScore({ ward, amt: 4, pct: 20 })).toBeGreaterThan(_wardScore(theWard));
    expect(_wardScore(theWard)).toBeGreaterThan(0);
  });

  test.for(['hitBonus', 'dmgBonus', 'burn', 'drain', 'aura'])('a rider of %s', (rider) => {
    expect(_pcScore({ [rider]: 2 })).toBeGreaterThan(_pcScore({ [rider]: 1 }));
    expect(_pcScore({ [rider]: 1 })).toBeGreaterThan(_pcScore({}));
  });

  test("a copy that carries none of a combat use's numbers weighs as one carrying its row's (the fight's fallback)", () => {
    const fallbacks = [
      ['heal', ROWS['combat-item-heals'].theNumbersOfACopyThatCarriesNone],
      ['hot', ROWS['combat-item-heals-over-time'].theNumbersOfACopyThatCarriesNone],
      ['secondwind', ROWS['combat-item-second-wind'].theNumbersOfACopyThatCarriesNone],
      ['stun', ROWS['combat-item-stuns'].theNumbersOfACopyThatCarriesNone],
      ['pen', ROWS['combat-item-blinds'].theNumbersOfACopyThatCarriesNone],
      ['focus', ROWS['combat-item-focuses'].theNumbersOfACopyThatCarriesNone],
      ['absorb', ROWS['combat-item-wards'].theNumbersOfACopyThatCarriesNone],
      ['mirror', ROWS['combat-item-mirror-images'].theNumbersOfACopyThatCarriesNone],
      ['flee', ROWS['combat-item-flight'].theNumbersOfACopyThatCarriesNone],
      ['invis', ROWS['combat-item-hides'].theNumbersOfACopyThatCarriesNone],
      ['terror', ROWS['combat-item-terrifies'].theNumbersOfACopyThatCarriesNone],
      ['silence', ROWS['combat-item-silences'].theNumbersOfACopyThatCarriesNone],
      ['dmg', ROWS['combat-item-damages'].theNumbersOfACopyThatCarriesNone],
      ['bane', ROWS['combat-item-bane'].theNumbersOfACopyThatCarriesNone],
    ] as const;
    for (const [use, none] of fallbacks) {
      const blows = use === 'dmg' || use === 'bane' ? { dmg: [5, 7] } : {};
      expect(_useScore({ use, ...blows }), use).toBe(_useScore({ use, ...blows, ...none }));
      expect(_useScore({ use, ...blows }), use).toBeGreaterThan(0);
    }
  });
});

test('a use, a ward or a stat the registry holds no effect for weighs as the generic worth', () => {
  expect(_useScore({ use: 'a use of no row' })).toBe(3);
  expect(_wardScore({ ward: 'a ward of no row', amt: 5, pct: 50 })).toBe(2);
  expect(itemPowerScore({ name: 'A Staged Token', effect: { stat: 'a stat of no row', bonus: 2 } })).toBe(6);
  expect(itemPowerScore({ name: 'A Staged Token', effect: { stat: 'a stat of no row' } })).toBe(3);
  expect(itemRole({ name: 'A Staged Token', effect: { stat: 'a stat of no row', bonus: 2 } })).toBe('utility');
});
