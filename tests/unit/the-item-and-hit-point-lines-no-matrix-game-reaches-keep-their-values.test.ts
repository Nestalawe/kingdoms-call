// The lines of the two files plan P1-10b10 freed of the ts-nocheck line (src/engine/items/equipment.ts and
// heroes/skills-and-hp.ts), changed by statements that keep every value (P1-10's Decisions of 2026-10-29, Decision 2),
// that no game of the balance matrix reaches. The matrix proves the others (both sets, every realm's report identical);
// these are proved here, each on the value it had before (worked out by the files as they were, with their ts-nocheck
// line):
// - a value the code guards, missing: no item, effect, stat, hero, list (of items, heroes, realms, provinces, features,
//   discoveries or perks), a gap in a list, no name, no skills, no realms to fall back on, no rise, no maximum, no hp;
// - a number a `||` gave its fallback for, which `??` alone would keep: a 0 in each of a combat item's fallbacks (the
//   content holds none: the saved item's schema allows one), a 0 maximum HP, no bonus;
// - a key no table holds: a tier or a kind with no stock target, a slot with no cap or no words, a spell of no name or
//   of a name no spell has, a held discovery the table doesn't know, a guardian the table doesn't know;
// - the functions no game calls: rollMagicItem (an unstocked hoard's roll) and itemFallbackOk (a spent tier's
//   fallback), and the passes of an older save (its items' words, a guardian table behind, a discovery since retired).
// Level 1 (unit): each is a plain function on staged values, called directly on the engine's modules (plan P1-14a); a
// static check can't run them, and no game reaches these lines. The dice are fixed with kcRng.use where a line draws
// them. A case that stages a content table (a spell with a level, an empty tier) puts it back as it was.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { SKILL_LABELS } from '../../src/engine/army-tables.ts';
import { ALL_MAGIC_ITEMS_P, MONSTERS_P, SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { _ITEM_ALT_BASE } from '../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { ITEMS_BY_TIER } from '../../src/engine/items/tiers-and-hoards.ts';
import { discMaxHpFor } from '../../src/engine/discoveries.ts';
import {
  _pcScore,
  _skillItem,
  _useScore,
  _wardScore,
  activeItems,
  effTemper,
  hasItemBase,
  itemFallbackOk,
  itemPowerScore,
  itemRole,
  itemTierTarget,
  migrateItemTiers,
  normaliseEquipment,
  rollMagicItem,
  settleTheItemsAHeroGained,
} from '../../src/engine/items/equipment.ts';
import { theWordsOfTheItemsAHeroGained } from '../../src/views/prose/the-words-of-the-items-a-hero-gained.ts';
import {
  GUARDIAN_TABLE_VER,
  computeMaxHp,
  dedupeItemsByName,
  effSkillOf,
  guardianPassives,
  hpEarnedBase,
  hpGainLine,
  itemMaxHpBonus,
  maxHpIsOrc,
  maxHpPlayers,
  migrateLairGuardiansV2,
  migrateMaxHpV2,
  retireDiscoveries,
  rollHpGain,
  skillBonusBreakdown,
  syncMaxHp,
} from '../../src/engine/heroes/skills-and-hp.ts';

type Obj = Record<string, unknown>;
/** A guardian's perk as staged: its name, and its effect if it has one. */
interface APerk {
  readonly name: string;
  readonly fx?: unknown;
}

/** Runs `fn` with the dice fixed at `value`. */
function withDice<T>(value: number, fn: () => T): T {
  const was = kcRng.use(() => value);
  try {
    return fn();
  } finally {
    kcRng.use(was);
  }
}
/** Runs `fn` with maxHpPlayers' realms set to `players`, then puts them back. */
function withTheRealmsSet<T>(players: Obj[] | null, fn: () => T): T {
  const was = maxHpPlayers.players;
  maxHpPlayers.players = players;
  try {
    return fn();
  } finally {
    maxHpPlayers.players = was;
  }
}
/** An item no table slots (a trinket: always worn), with the effect given. */
const aTrinket = (name: string, effect: Obj = { stat: 'tactical', bonus: 1 }) => ({ name, effect, tier: 1 });
/** A ring (two to a hero), worn or not. */
const aRing = (name: string, equipped?: boolean) => ({
  name,
  slot: 'ring',
  effect: { stat: 'spy', bonus: 1 },
  tier: 1,
  ...(equipped === undefined ? {} : { equipped }),
});
/** An item in a slot no table names (no cap, no words): an older save's. */
const anOddSlotItem = (name: string, equipped?: boolean) => ({
  name,
  slot: 'boots',
  effect: { stat: 'march', bonus: 1 },
  tier: 1,
  ...(equipped === undefined ? {} : { equipped }),
});
/** The Crown of Command: its wearer gives every ally beside him +1 to every skill. */
const theCrown = () => ({ name: 'Crown of Command', effect: { stat: 'aura', bonus: 1 }, tier: 4 });

describe('the item and hit-point lines no matrix game reaches keep their values', () => {
  test("an item's role: no item, no effect, no stat, a field school of no bonus", () => {
    expect(itemRole(null)).toBe('utility');
    expect(itemRole(undefined)).toBe('utility');
    expect(itemRole({ name: 'A Bare Token' })).toBe('utility');
    expect(itemRole({ name: 'A Bare Token', effect: null })).toBe('utility');
    expect(itemRole({ name: 'A Token of No Stat', effect: {} })).toBe('utility');
    expect(itemRole({ name: 'A Token of No Stat', effect: { pc: { ward: 'meleeDR', amt: 1 } } })).toBe('combat');
    expect(itemRole({ name: 'A Psychic Charm', effect: { stat: 'psychic' } })).toBe('utility');
    expect(itemRole({ name: 'A Psychic Charm', effect: { stat: 'psychic', bonus: 0 } })).toBe('utility');
    expect(itemRole({ name: 'A Psychic Charm', effect: { stat: 'psychic', bonus: 2 } })).toBe('combat');
  });

  test("a band's stock target: a tier or a kind with none, both roles together", () => {
    expect(itemTierTarget(4, 'ring', null)).toBe(0);
    expect(itemTierTarget(9, 'ring', 'utility')).toBe(0);
    expect(itemTierTarget(1, 'boots', 'combat')).toBe(0);
    expect(itemTierTarget(2, 'ring', null)).toBe(24);
    expect(itemTierTarget(2, 'ring', undefined)).toBe(24);
    expect(itemTierTarget(2, 'ring', 'utility')).toBe(8);
    expect(itemTierTarget(2, 'ring', 'combat')).toBe(16);
  });

  test('a ward and a rider scored: none given', () => {
    expect(_wardScore(null)).toBe(0);
    expect(_wardScore(undefined)).toBe(0);
    expect(_pcScore(null)).toBe(0);
    expect(_pcScore(undefined)).toBe(0);
  });

  test("a combat item's worth: a 0 in each fallback is the fallback, as a missing one is; a short list adds NaN", () => {
    const zero = (use: string, more: Obj = {}) => _useScore({ use, ...more });
    expect(zero('heal', { amt: 0 })).toBe(2);
    expect(zero('hot', { amt: 0, rounds: 0 })).toBe(3);
    expect(zero('hot', { amt: 6, rounds: 0 })).toBe(6);
    expect(zero('secondwind', { amt: 0 })).toBe(5);
    expect(zero('dmg', { dmg: [3, 3], times: 0 })).toBe(1);
    expect(zero('stun', { stun: 0 })).toBe(2.5);
    expect(zero('pen', { hitPen: 0 })).toBe(2.5);
    expect(zero('focus', { hitBonus: 0 })).toBe(2.5);
    expect(zero('absorb', { absorb: 0 })).toBeCloseTo(10 / 3, 12);
    expect(zero('mirror', { images: 0 })).toBe(3);
    expect(zero('flee', { fleeBonus: 0 })).toBeCloseTo(25 / 12, 12);
    expect(zero('invis', { toHitReduce: 0 })).toBeCloseTo(25 / 6, 12);
    expect(zero('terror', { hitPen: 0 })).toBe(4.5);
    expect(zero('silence', { rounds: 0 })).toBeCloseTo(3.6, 12);
    // a damage of one number, or none, and a lingering harm of one number: as JavaScript adds a missing element
    expect(zero('drain', { dmg: [4] })).toBeNaN();
    expect(zero('drain', { dmg: [] })).toBeNaN();
    expect(zero('dmg', { dmg: [3, 3], dot: [3] })).toBeNaN();
  });

  test("an item's worth: no item, no effect, no bonus, a charm of no spell, of an unknown spell, of a levelled one", () => {
    expect(itemPowerScore(null)).toBe(0);
    expect(itemPowerScore({ name: 'A Bare Token' })).toBe(3);
    expect(itemPowerScore({ name: 'A Bare Token', effect: null })).toBe(3);
    expect(itemPowerScore({ name: 'A Hollow Amulet', effect: { stat: 'maxHp' } })).toBe(0);
    expect(itemPowerScore({ name: 'A Hollow Purse', effect: { stat: 'taxBonus' } })).toBe(0);
    expect(itemPowerScore({ name: 'A Charm of Nothing', effect: { stat: 'castSpell', spell: 'No Such Spell' } })).toBe(
      5.4,
    );
    // staged: spells with a level (no spell row sets one today), and one under the name a missing spell reads
    const spells: Record<string, unknown> = SPELL_DEFS_P;
    spells['A Test Spell of Level 3'] = { school: 'white', level: 3, lvl: 4 };
    spells['A Test Spell of Lvl 4'] = { school: 'white', level: 0, lvl: 4 };
    spells['A Test Spell of Minimum Level 1'] = { school: 'white', minLevel: 1 };
    spells['undefined'] = { school: 'white', level: 3 };
    try {
      const charm = (spell?: string) =>
        itemPowerScore({ name: 'A Test Charm', effect: { stat: 'castSpell', ...(spell ? { spell } : {}) } });
      expect(charm('A Test Spell of Level 3')).toBe(6.6);
      expect(charm('A Test Spell of Lvl 4')).toBe(7.8);
      expect(charm('A Test Spell of Minimum Level 1')).toBe(4.2);
      expect(charm()).toBe(6.6); // no spell reads the key "undefined", as JavaScript reads it
      expect(charm('No Such Spell')).toBe(5.4);
    } finally {
      delete spells['A Test Spell of Level 3'];
      delete spells['A Test Spell of Lvl 4'];
      delete spells['A Test Spell of Minimum Level 1'];
      delete spells['undefined'];
    }
  });

  test("an older save's items re-stamped: no state or lists, gaps, no name, a second name, no tier, old words", () => {
    expect(() => {
      migrateItemTiers(null);
    }).not.toThrow();
    expect(() => {
      migrateItemTiers({});
    }).not.toThrow();
    expect(() => {
      migrateItemTiers({ world: {} });
    }).not.toThrow();
    // a second name the treasury no longer carries, whose base it does: the base's tier
    const [secondName, baseName] =
      Object.entries(_ITEM_ALT_BASE).find(
        ([a, b]) => !ALL_MAGIC_ITEMS_P.some((i) => i.name === a) && ALL_MAGIC_ITEMS_P.some((i) => i.name === b),
      ) ?? [];
    const baseTier = ALL_MAGIC_ITEMS_P.find((i) => i.name === baseName)?.tier;
    expect(secondName, 'a second name the treasury lost').toBeDefined();
    const bySecondName = { name: String(secondName), tier: Number(baseTier) + 1, effect: { stat: 'combatUse' } };
    const ofNoName = { name: '', tier: 1, effect: { stat: 'melee', bonus: 1 } };
    const ofNoTier = { name: 'A Blade No Table Knows', effect: { stat: 'melee', bonus: 1 } };
    const withOldWords = {
      name: 'A Charm No Table Knows',
      tier: 1,
      effect: { stat: 'castSpell' },
      desc: 'casts Charm (psychic) and Mist (illusory)',
    };
    const inAHoard = { name: 'A Hoarded Blade No Table Knows', tier: 1, effect: { stat: 'melee', bonus: 1 } };
    const inAVault = { name: 'A Vaulted Blade No Table Knows', tier: 1, effect: { stat: 'melee', bonus: 1 } };
    migrateItemTiers({
      characters: [{}, { items: [null, bySecondName, ofNoName, ofNoTier, withOldWords] }],
      world: { provinces: [{}, { features: [null, {}, { hoardItems: [inAHoard] }] }] },
      players: [null, { vault: [inAVault] }],
    });
    expect(bySecondName.tier).toBe(baseTier);
    expect(ofNoName.tier).toBe(1);
    expect(ofNoTier).toHaveProperty('tier', 2);
    expect(withOldWords.desc).toBe(`casts Charm (${SKILL_LABELS.psychic}) and Mist (${SKILL_LABELS.illusory})`);
    expect(inAHoard.tier).toBe(2);
    expect(inAVault.tier).toBe(2);
  });

  test("a hero's slots: no hero or list, a gap, an unslotted item's flag, a slot with no cap, a slot over its cap", () => {
    expect(() => {
      normaliseEquipment(null);
    }).not.toThrow();
    expect(() => {
      normaliseEquipment({});
    }).not.toThrow();
    expect(() => {
      normaliseEquipment({ items: {} as never });
    }).not.toThrow();
    const trinket = { ...aTrinket('Quiver of the Hawk'), equipped: true };
    const wornOdd = anOddSlotItem('Boots Worn Before', true);
    const unwornOdd = anOddSlotItem('Boots Carried Before');
    const rings = [aRing('Ring One', true), aRing('Ring Two', true), aRing('Ring Three', true)];
    const hero = { items: [null, trinket, wornOdd, unwornOdd, ...rings] };
    normaliseEquipment(hero);
    expect(trinket).not.toHaveProperty('equipped');
    expect(wornOdd.equipped).toBe(true); // a slot of no cap: a count is never at or past it
    expect(unwornOdd.equipped).toBe(false); // nor under it
    expect(rings.map((r) => r.equipped)).toEqual([true, true, false]);
  });

  test("a gained item's note: no hero, list or items, a gap, nothing gained, no room in a slot of no words", () => {
    // the engine settles the slots and records how the hero carries each item; the prose writes the note (P1-12d21)
    const theNote = (...a: Parameters<typeof settleTheItemsAHeroGained>) =>
      theWordsOfTheItemsAHeroGained(settleTheItemsAHeroGained(...a));
    const ring = aRing('A Gained Ring');
    expect(theNote(null, [ring])).toBe('');
    expect(theNote({ name: 'Ana' }, [ring])).toBe('');
    expect(theNote({ name: 'Ana', items: {} as never }, [ring])).toBe('');
    expect(theNote({ name: 'Ana', items: [ring] }, null)).toBe('');
    expect(theNote({ name: 'Ana', items: [ring] }, [aRing('A Ring Not Carried')])).toBe('');
    const odd = anOddSlotItem('Old Boots');
    expect(theNote({ name: 'Ana', items: [null, odd] }, [null, odd])).toBe(
      '🎒 Ana has no room to equip the Old Boots: the boots slot is full, so it goes in the pack (an Equip Items order can swap it in).',
    );
    const worn = [aRing('Ring One', true), aRing('Ring Two', true)];
    const third = aRing('Ring Three');
    expect(theNote({ name: 'Ana', items: [null, ...worn, third] }, [third])).toBe(
      '🎒 Ana has no room to equip the Ring Three: the both ring slots already hold the Ring One and the Ring Two, so it goes in the pack (an Equip Items order can swap it in).',
    );
  });

  test("a hero's active items, an item's base name, a hero's temper: no hero, a gap, no name, no temper", () => {
    const trinket = aTrinket('Quiver of the Hawk');
    expect(activeItems(null)).toEqual([]);
    expect(activeItems({ items: [null, trinket, undefined] })).toEqual([trinket]);
    expect(hasItemBase({ items: [{ name: '', effect: { stat: 'tactical' }, tier: 1 }] }, '')).toBe(false);
    expect(effTemper(null)).toBe('Brave');
    expect(effTemper({ items: [] })).toBe('Brave');
    expect(effTemper({ items: [], temper: null })).toBe('Brave');
    expect(effTemper({ items: [], temper: '' })).toBe('Brave');
    expect(effTemper({ items: [aTrinket('A Cold Stone', { stat: 'temper', temper: '' })], temper: 'Bold' })).toBe(
      'Bold',
    );
  });

  test("an unstocked hoard's roll: from its tier, the tier spent, a Weak tier spent, an empty tier, nothing left", () => {
    const tier2 = ITEMS_BY_TIER[2];
    const first = tier2[0];
    expect(withDice(0, () => rollMagicItem('Moderate', new Set(), new Set()))).toBe(first);
    expect(withDice(0, () => rollMagicItem('Moderate', null, null))).toBe(first);
    // the tier spent: any item left (a Moderate lair takes any role)
    const spent = new Set(tier2.map((i) => i.name));
    expect(withDice(0, () => rollMagicItem('Moderate', spent, null))).toBe(
      ALL_MAGIC_ITEMS_P.find((i) => !spent.has(i.name)),
    );
    // a Weak tier spent: a utility item if any is left, else any item
    const weak = new Set(ITEMS_BY_TIER[1].map((i) => i.name));
    expect(withDice(0, () => rollMagicItem('Weak', weak, null))).toBe(
      ALL_MAGIC_ITEMS_P.find((i) => !weak.has(i.name) && itemRole(i) === 'utility'),
    );
    const weakAndUtility = new Set([
      ...weak,
      ...ALL_MAGIC_ITEMS_P.filter((i) => itemRole(i) === 'utility').map((i) => i.name),
    ]);
    expect(withDice(0, () => rollMagicItem('Weak', weakAndUtility, null))).toBe(
      ALL_MAGIC_ITEMS_P.find((i) => !weakAndUtility.has(i.name)),
    );
    expect(withDice(0, () => rollMagicItem('Weak', new Set(ALL_MAGIC_ITEMS_P.map((i) => i.name)), null))).toBeNull();
    // staged: the Weak tier empty, so the roll is from the whole treasury, a combat item among it
    const firstCombat = ALL_MAGIC_ITEMS_P.findIndex((i) => itemRole(i) === 'combat');
    const held = ITEMS_BY_TIER[1].splice(0);
    try {
      const at = (firstCombat + 0.5) / ALL_MAGIC_ITEMS_P.length;
      expect(withDice(at, () => rollMagicItem('Weak', new Set(), null))).toBe(ALL_MAGIC_ITEMS_P[firstCombat]);
    } finally {
      ITEMS_BY_TIER[1].push(...held);
    }
  });

  test("a spent tier's fallback: a Weak lair takes a utility item only; any other lair, or none, takes any", () => {
    const combat = ALL_MAGIC_ITEMS_P.find((i) => itemRole(i) === 'combat');
    const utility = ALL_MAGIC_ITEMS_P.find((i) => itemRole(i) === 'utility');
    expect(itemFallbackOk(combat, null)).toBe(true);
    expect(itemFallbackOk(combat, undefined)).toBe(true);
    expect(itemFallbackOk(combat, 2)).toBe(true);
    expect(itemFallbackOk(combat, 1)).toBe(false);
    expect(itemFallbackOk(utility, 1)).toBe(true);
  });

  test('a skill with its items: no hero, no skills, an item of no bonus', () => {
    expect(_skillItem(null, 'spy')).toBe(0);
    expect(_skillItem({ items: [] }, 'spy')).toBe(0);
    expect(_skillItem({ skills: { spy: 2 }, items: [aTrinket('A Blank Lens', { stat: 'spy' })] }, 'spy')).toBe(2);
  });

  test("a skill's breakdown: no hero, no skills, an item of no effect or name, nowhere, no list, the Crown's bearer", () => {
    const none = skillBonusBreakdown(null, 'spy', []);
    expect(none).toEqual({ base: 0, items: 0, aura: 0, curse: 0, sources: [] });
    expect(none).not.toHaveProperty('total');
    expect(effSkillOf(null, 'spy', [])).toBeUndefined();
    expect(skillBonusBreakdown({ items: [] }, 'spy', null)).toEqual({
      base: 0,
      items: 0,
      aura: 0,
      curse: 0,
      sources: [],
      total: 0,
      bonus: 0,
    });
    const ofNoName = { name: '', effect: { stat: 'spy', bonus: 1 }, tier: 1 };
    expect(
      skillBonusBreakdown({ skills: { spy: 2 }, items: [{ name: 'A Pebble', tier: 1 }, ofNoName] }, 'spy', null)
        .sources,
    ).toEqual([{ label: 'an item', delta: 1, kind: 'item' }]);
    // the Crown: its bearer alive, of the same realm, on the same ground
    const bearer = (more: Obj = {}) => ({ id: 2, name: 'Bea', alive: true, player: 0, items: [theCrown()], ...more });
    const hero = (more: Obj = {}) => ({ id: 1, name: 'Ana', player: 0, skills: { spy: 2 }, items: [], ...more });
    expect(skillBonusBreakdown(hero(), 'spy', [bearer({ location: undefined })]).aura).toBe(0); // he stands nowhere
    expect(skillBonusBreakdown(hero({ location: 5 }), 'spy', {} as never).aura).toBe(0);
    const beside = skillBonusBreakdown(hero({ location: 5 }), 'spy', [null, bearer({ location: 5 })]);
    expect(beside.aura).toBe(1);
    expect(beside.total).toBe(3);
    expect(beside.sources).toEqual([{ label: 'Crown of Command (Bea)', delta: 1, kind: 'aura' }]);
    const self = hero({ location: 5, alive: true, items: [theCrown()] });
    expect(skillBonusBreakdown(self, 'spy', [self]).sources).toEqual([
      { label: 'Crown of Command', delta: 1, kind: 'aura' },
    ]);
    expect(
      skillBonusBreakdown(hero({ location: 5 }), 'spy', [bearer({ location: 5, name: undefined })]).sources,
    ).toEqual([{ label: 'Crown of Command (undefined)', delta: 1, kind: 'aura' }]);
  });

  test('items told apart by name: no list, a gap, no name, no name and no effect, a twin', () => {
    expect(dedupeItemsByName(null)).toEqual([]);
    const a = { name: 'A' };
    expect(dedupeItemsByName([null, a, undefined])).toEqual([a]);
    expect(dedupeItemsByName([a, { name: 'A' }])).toEqual([a]);
    const spyA = { name: '', effect: { stat: 'spy' } };
    expect(dedupeItemsByName([spyA, { name: '', effect: { stat: 'spy' } }])).toEqual([spyA]);
    expect(dedupeItemsByName([spyA, { name: '', effect: { stat: 'march' } }])).toHaveLength(2);
    const bare = { name: '' };
    expect(dedupeItemsByName([bare, { name: '', effect: {} }])).toEqual([bare]);
  });

  test("a hero's hit points: an Orc with no realms or his realm gone, no hero, no bonus, a twin, no realms to read", () => {
    const orc = { race: 'Orcish', player: 3, items: [] };
    expect(withTheRealmsSet(null, () => maxHpIsOrc(orc, null))).toBe(false);
    expect(maxHpIsOrc(orc, [{ race: 'Orcish' }])).toBe(false);
    expect(hpEarnedBase(null, [])).toBe(15);
    expect(itemMaxHpBonus({ items: [aTrinket('A Hollow Amulet', { stat: 'maxHp' })] })).toBe(0);
    const twin = () => aTrinket('Amulet of Twins', { stat: 'maxHp', bonus: 2 });
    expect(itemMaxHpBonus({ items: [twin(), twin()] })).toBe(2);
    expect(computeMaxHp(null, [])).toBe(15);
    // a realm with Thick Hides (+2 to every hero's maximum) read only for its own heroes
    const hides = { race: 'Orcish', discoveries: [{ id: 'ro08' }] };
    const hero = { player: 3, items: [], skills: {} };
    expect(discMaxHpFor(hides, hero)).toBe(2);
    expect(withTheRealmsSet(null, () => computeMaxHp(hero, null))).toBe(15);
    expect(computeMaxHp(hero, [hides])).toBe(15);
    expect(computeMaxHp({ ...hero, player: 0 }, [hides])).toBe(17);
  });

  test('a hit-point roll and its line: no hero, dead, no reason; no rise, no gain, no name, no maximum', () => {
    expect(rollHpGain(null, [], 'a fight')).toEqual({ gain: 0, maxHp: 0 });
    expect(rollHpGain({ alive: false, maxHp: 20 }, [], 'a fight')).toEqual({ gain: 0, maxHp: 20 });
    const hero = () => ({ alive: true, maxHp: 15, hp: 15, hpEarned: 0, items: [] });
    expect(withDice(0, () => rollHpGain(hero(), [], undefined))).toEqual({ gain: 1, maxHp: 16, why: '' });
    expect(withDice(0, () => rollHpGain(hero(), [], null))).toEqual({ gain: 1, maxHp: 16, why: '' });
    expect(hpGainLine({ name: 'Ana' }, null)).toBe('');
    expect(hpGainLine({ name: 'Ana' }, { gain: 0, maxHp: 20 })).toBe('');
    expect(hpGainLine({}, { gain: 2, maxHp: 20 })).toBe(
      '💪 undefined is hardened by the victory — maximum HP +2 → 20.',
    );
    expect(hpGainLine({}, { gain: 2, maxHp: 20, wound: true })).toBe(
      '💪 undefined is hardened by the wounds of the fight — maximum HP +2 → 20.',
    );
    expect(hpGainLine({ name: 'Ana' }, { gain: 2 })).toBe(
      '💪 Ana is hardened by the victory — maximum HP +2 → undefined.',
    );
    expect(hpGainLine({ name: 'Ana' }, { gain: 2, wound: true })).toBe(
      '💪 Ana is hardened by the wounds of the fight — maximum HP +2 → undefined.',
    );
  });

  test("a hero's maximum brought in line: no hero, no maximum, a null maximum, no hp", () => {
    expect(syncMaxHp(null, [])).toBe(0);
    const noMaximum: Obj = { hpEarned: 0, items: [], hp: 10 };
    expect(syncMaxHp(noMaximum, [])).toBe(0);
    expect(noMaximum).toMatchObject({ maxHp: 15, hp: 10 });
    const aNullMaximum: Obj = { hpEarned: 0, items: [], hp: 10, maxHp: null };
    expect(syncMaxHp(aNullMaximum, [])).toBe(0);
    expect(aNullMaximum).toMatchObject({ maxHp: 15, hp: 10 });
    const noHp: Obj = { hpEarned: 0, items: [], maxHp: 20 };
    expect(syncMaxHp(noHp, [])).toBe(-5);
    expect(noHp).toEqual({ hpEarned: 0, items: [], maxHp: 15 });
  });

  test("an older save's retired discoveries: no state or realms, a gap, an id alone, a retired one, an unknown one", () => {
    expect(retireDiscoveries(null)).toBe(0);
    const bare: Obj = {};
    expect(retireDiscoveries(bare)).toBe(0);
    expect(bare).toEqual({ _retiredDiscoveries: 0 });
    const unknown = { id: 'zz99', name: 'An Old Name', category: 'Old', desc: 'old words' };
    const realm = { discoveries: ['sd34', 'ro08', null, { id: 'sd34', name: 'Mounted Couriers' }, unknown] };
    const state = { players: [null, {}, { discoveries: {} as never }, realm], _retiredDiscoveries: 2 };
    expect(retireDiscoveries(state)).toBe(2);
    expect(realm.discoveries).toEqual(['ro08', null, unknown]);
    expect(unknown).toEqual({ id: 'zz99', name: 'An Old Name', category: 'Old', desc: 'old words' });
    expect(state._retiredDiscoveries).toBe(4);
  });

  test("an older save's earned hit points: no state, realms or heroes, a gap, a 0 maximum noted, a realm not there", () => {
    withTheRealmsSet(null, () => {
      migrateMaxHpV2(null);
      expect(maxHpPlayers.players).toBeNull();
      migrateMaxHpV2({ characters: [] });
      expect(maxHpPlayers.players).toEqual([]);
      const noHeroes: Obj = { players: [{ race: 'Human' }] };
      migrateMaxHpV2(noHeroes);
      expect(noHeroes).toMatchObject({ _maxHpV2: true, _maxHpV3: true });
    });
    withTheRealmsSet(null, () => {
      const state: Obj = { players: [], characters: [null, { alive: false, maxHp: 30 }] };
      migrateMaxHpV2(state);
      expect(state).toMatchObject({ _maxHpV2: true, _maxHpV3: true });
      expect(state).not.toHaveProperty('_maxHpMigration');
    });
    withTheRealmsSet(null, () => {
      const hides = { race: 'Orcish', discoveries: [{ id: 'ro08' }] };
      // a 0 maximum is read as 15; a hero of a realm not in the list has no realm's bonus
      const atZero = { id: 7, alive: true, player: 0, maxHp: 0, hp: 0, items: [], skills: {} };
      const elsewhere = { id: 8, alive: true, player: 4, maxHp: 30, hp: 30, items: [], skills: {} };
      // a maximum past the clamp: the earned base stops at 60, and the hero is noted too
      const pastTheClamp = { id: 9, alive: true, player: 0, maxHp: 80, hp: 80, items: [], skills: {} };
      const state: Obj = { players: [hides], characters: [atZero, elsewhere, pastTheClamp] };
      migrateMaxHpV2(state);
      expect(atZero).toMatchObject({ hpEarned: 0, maxHp: 17 });
      expect(elsewhere).toMatchObject({ hpEarned: 15, maxHp: 30 });
      expect(pastTheClamp).toMatchObject({ hpEarned: 45, maxHp: 62, hp: 62 });
      expect(state['_maxHpMigration']).toEqual([
        { charId: 7, player: 0, old: 15, nu: 17 },
        { charId: 9, player: 0, old: 80, nu: 62 },
      ]);
    });
  });

  test("a guardian's perks: none, a gap or a perk of no effect, the one perk an older save holds", () => {
    expect(guardianPassives(null)).toEqual([]);
    const ward: APerk = { name: 'Hard Hide', fx: { ward: 'meleeDR', amt: 1 } };
    const nothing: APerk = { name: 'Nothing' };
    expect(guardianPassives({ passives: [null, nothing, ward] })).toEqual([ward]);
    expect(guardianPassives({ passive: ward })).toEqual([ward]);
    expect(guardianPassives({ passive: nothing })).toEqual([]);
    expect(guardianPassives({})).toEqual([]);
  });

  test("an older save's guardians: no state, world, version, provinces or features, a gap, cleared, none, unknown", () => {
    expect(() => {
      migrateLairGuardiansV2(null);
    }).not.toThrow();
    const noWorld: Obj = {};
    migrateLairGuardiansV2(noWorld);
    expect(noWorld).toEqual({});
    const noProvinces: Obj = { world: {} };
    migrateLairGuardiansV2(noProvinces);
    expect(noProvinces).toMatchObject({ _guardiansV2: true, _guardiansVer: GUARDIAN_TABLE_VER });
    const [row] = MONSTERS_P;
    if (!row) throw new Error('no guardian in the table');
    const cleared = { name: row.name, hp: 1, melee: 0, archery: 0 };
    const unknown = { name: 'A Guardian No Table Knows', hp: 1 };
    const behind = {
      name: row.name,
      hp: 1,
      melee: 0,
      archery: 0,
      _hpFull: 9,
      passive: { name: 'An Old Perk' },
      spells: [],
      passives: [],
      weak: null,
    };
    const state: Obj = {
      world: {
        provinces: [
          {},
          {
            features: [
              null,
              { cleared: true, monster: cleared },
              { monster: null },
              { monster: unknown },
              { monster: behind },
            ],
          },
        ],
      },
    };
    migrateLairGuardiansV2(state);
    expect(cleared).toEqual({ name: row.name, hp: 1, melee: 0, archery: 0 });
    expect(unknown).toEqual({ name: 'A Guardian No Table Knows', hp: 1 });
    expect(behind).toEqual({
      name: row.name,
      hp: row.hp,
      melee: row.melee,
      archery: row.archery,
      spells: row.spells,
      passives: row.passives,
      weak: row.weak,
    });
    expect(behind.spells).not.toBe(row.spells);
    expect(state).toMatchObject({ _guardiansV2: true, _guardiansVer: GUARDIAN_TABLE_VER });
  });
});
