// The items' index, on plain values (plan P1-11e37b moved it out of the items' registry, so the army card can later
// find the effects the report's items carry): which effects a held copy of an item carries, by its effect's key, a
// field of its own that is set, its base name (a second name counting as its base's), its armour's ward, its riders'
// ward and each rider above 0, its combat use and a field of its effect that is set, in that order; whether it is worn
// as armour; and the effects a hero's items carry, each once.
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-effects-a-held-item-carries.ts on made-up
// copies of items. A lower level can't run a function. A fault planted in a shared function moves every caller at once
// (each of the registry's runners, and later the card), so these cases pin its answers; each item's own effects, found
// this way, are pinned in tests/unit/each-magic-item-states-the-numbers-its-effect-has.test.ts.
import { describe, expect, test } from 'vitest';
import {
  BY_EFFECT_FIELD,
  BY_RIDER,
  anItemIsWornAsArmour,
  theEffectAUseCarries,
  theEffectAWardCarries,
  theEffectsAnItemCarries,
  theEffectsTheseItemsCarry,
} from '../../src/engine/rules-on-plain-values/the-effects-a-held-item-carries.ts';

const carries = theEffectsAnItemCarries;

describe('the effects a held item carries', () => {
  test("by its effect's key: the effects of that key, and none for a key no effect has or no key", () => {
    expect(carries({ effect: { stat: 'cavBonus' } })).toEqual(['cavalry-bonus']);
    expect(carries({ effect: { stat: 'oracle' } })).toEqual(['crystal-orb']);
    expect(carries({ effect: { stat: 'primalStrike' } })).toEqual(['strike-chance-bonus']);
    expect(carries({ effect: { stat: 'no such key' } })).toEqual([]);
    expect(carries({ effect: { stat: null } })).toEqual([]);
    expect(carries({})).toEqual([]);
    expect(carries({ effect: null })).toEqual([]);
  });
  test('by a field of its own that is set, and not by one that is 0 or unset', () => {
    expect(carries({ fleetStr: 2 })).toEqual(['fleet-strength']);
    expect(carries({ primalStrike: true })).toEqual(['strike-chance-field']);
    expect(carries({ exploreMove: 1 })).toEqual(['travellers-cloak']);
    expect(carries({ fleetStr: 0 })).toEqual([]);
    expect(carries({ landFullAtSea: false })).toEqual([]);
  });
  test('by its base name, a second name counting as its base, and not by a name no effect has', () => {
    expect(carries({ name: 'Chalice of Dawn' })).toEqual(['chalice-of-dawn']);
    expect(carries({ name: 'Cup of the Morning' })).toEqual(['chalice-of-dawn']);
    expect(carries({ name: "Tide-Lord's Glass" })).toEqual(['admirals-spyglass']);
    expect(carries({ name: 'Dreamstone' })).toEqual(['dreamstone']);
    expect(carries({ name: 'A Plain Stick' })).toEqual([]);
    expect(carries({ name: '' })).toEqual([]);
  });
  test("by its armour's ward only when it is worn as armour", () => {
    expect(carries({ effect: { stat: 'armour', ward: 'meleeDR' } })).toEqual([
      'an-item-worn-as-armour',
      'melee-damage-turned-aside',
    ]);
    expect(carries({ effect: { stat: 'armour' } })).toEqual(['an-item-worn-as-armour']);
    expect(carries({ effect: { stat: 'armour', ward: 'no such ward' } })).toEqual(['an-item-worn-as-armour']);
    expect(carries({ effect: { ward: 'meleeDR' } })).toEqual([]);
  });
  test("by its riders' ward and each rider above 0, in the riders' order", () => {
    expect(
      carries({ effect: { pc: { ward: 'thorns', aura: 1, burn: 0, drain: 2, hitBonus: 3, dmgBonus: 4 } } }),
    ).toEqual(['thorns', 'aura-rider', 'drain-rider', 'hit-bonus-rider', 'damage-bonus-rider']);
    expect(carries({ effect: { pc: { burn: 1 } } })).toEqual(['burn-rider']);
    expect(carries({ effect: { pc: { burn: -1, aura: 0 } } })).toEqual([]);
    expect(carries({ effect: { pc: null } })).toEqual([]);
  });
  test('by its combat use, and by a field of its effect that is set', () => {
    expect(carries({ effect: { stat: 'combatUse', use: 'heal' } })).toEqual(['a-combat-item', 'combat-item-heals']);
    expect(carries({ effect: { use: 'drain' } })).toEqual(['combat-item-drains']);
    expect(carries({ effect: { use: 'no such use' } })).toEqual([]);
    expect(carries({ effect: { doubleVs: ['Undead'] } })).toEqual(['combat-item-doubled-against-its-kinds']);
    expect(carries({ effect: { doubleVs: null } })).toEqual([]);
  });
  test('in the order: key, own field, name, armour, riders, use, field of its effect', () => {
    expect(
      carries({
        name: 'Chalice of Dawn',
        fleetStr: 1,
        effect: { stat: 'armour', ward: 'regen', use: 'heal', pc: { ward: 'thorns', burn: 1 }, doubleVs: ['Undead'] },
      }),
    ).toEqual([
      'an-item-worn-as-armour',
      'fleet-strength',
      'chalice-of-dawn',
      'regeneration',
      'thorns',
      'burn-rider',
      'combat-item-heals',
      'combat-item-doubled-against-its-kinds',
    ]);
  });
});

describe("the index's maps and its other answers", () => {
  test('the effect a ward or a use carries, or none', () => {
    expect(theEffectAWardCarries('regen')).toBe('regeneration');
    expect(theEffectAWardCarries('no such ward')).toBeUndefined();
    expect(theEffectAWardCarries(null)).toBeUndefined();
    expect(theEffectAUseCarries('heal')).toBe('combat-item-heals');
    expect(theEffectAUseCarries('no such use')).toBeUndefined();
    expect(theEffectAUseCarries(undefined)).toBeUndefined();
  });
  test("the riders and the effect's fields, in the content's order", () => {
    expect(BY_RIDER).toEqual([
      ['aura', 'aura-rider'],
      ['burn', 'burn-rider'],
      ['drain', 'drain-rider'],
      ['hitBonus', 'hit-bonus-rider'],
      ['dmgBonus', 'damage-bonus-rider'],
    ]);
    expect(BY_EFFECT_FIELD).toEqual([['doubleVs', 'combat-item-doubled-against-its-kinds']]);
  });
  test('an item is worn as armour when its key is the armour key', () => {
    expect(anItemIsWornAsArmour({ effect: { stat: 'armour' } })).toBe(true);
    expect(anItemIsWornAsArmour({ effect: { stat: 'meleeDR' } })).toBe(false);
    expect(anItemIsWornAsArmour({ effect: { ward: 'meleeDR' } })).toBe(false);
    expect(anItemIsWornAsArmour({})).toBe(false);
  });
  test("the effects a hero's items carry: each once, in the order first carried", () => {
    expect([
      ...theEffectsTheseItemsCarry([
        { effect: { stat: 'cavBonus' } },
        { name: 'Dreamstone' },
        { effect: { stat: 'cavBonus' } },
      ]),
    ]).toEqual(['cavalry-bonus', 'dreamstone']);
    expect([...theEffectsTheseItemsCarry([])]).toEqual([]);
  });
});
