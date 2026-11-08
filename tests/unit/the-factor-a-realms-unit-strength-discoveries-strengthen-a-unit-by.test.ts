// The factor a realm's unit-strength discoveries (`unitStr`) strengthen a unit by, on plain values (plan P1-11e36 moved
// the kind's effect and its runner's product out of the discoveries' registry, so the army card can later ask the
// turn's own): each effect gives `1 + pct` to a unit it reaches (its type, class, race and quality; led by the king; the
// ground; the side; a garrison standing alone), nothing to one it doesn't, and the product is capped at ×1.30.
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-factor-a-realms-unit-strength-discoveries-
// strengthen-a-unit-by.ts on made-up effects and units, the registry's entry and stage that hand them on, and the
// registry's runner on a realm holding the content's own discoveries. A lower level can't run a function. A fault
// planted in a shared function moves every caller at once (the turn and, later, the card alike), so these cases pin
// its answers; an effect with no share (`pct`) is on no content row and in no matrix game (proof:unreached).
import { describe, expect, test } from 'vitest';
import type { TheEffectOfADiscovery } from '../../src/content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  theFactorAUnitStrengthDiscoveryGivesAUnit,
  theFactorTheUnitStrengthDiscoveriesARealmHoldsStrengthenAUnitBy,
  type AUnitARealmsDiscoveriesMayStrengthen,
} from '../../src/engine/rules-on-plain-values/the-factor-a-realms-unit-strength-discoveries-strengthen-a-unit-by.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES,
  THE_REGISTRY_OF_DISCOVERY_EFFECTS,
  theFactorARealmsDiscoveriesStrengthenAUnitBy,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';

/** A company of Free Lances (Human cavalry, Average) on the plain, attacking under a commander who isn't the king,
 *  with `changes` made. */
const aUnit = (changes: Partial<AUnitARealmsDiscoveriesMayStrengthen> = {}): AUnitARealmsDiscoveriesMayStrengthen => ({
  theUnit: { type: 'Free Lances', race: 'Human', quality: 'Average' },
  theGround: 'plain',
  isItsSideTheAttacker: true,
  isItLedByTheKing: false,
  hasItACommander: true,
  ...changes,
});
const strength = (pct: number, filters: Partial<TheEffectOfADiscovery> = {}): TheEffectOfADiscovery => ({
  kind: 'unitStr',
  pct,
  ...filters,
});
const gives = theFactorAUnitStrengthDiscoveryGivesAUnit;

describe("one unit-strength effect's factor", () => {
  test('1 + its share to a unit it reaches; 1 with no share', () => {
    expect(gives(strength(0.2), aUnit())).toBe(1.2);
    expect(gives({ kind: 'unitStr' }, aUnit())).toBe(1);
  });
  test("the unit's type, class, race and quality, or nothing", () => {
    expect(gives(strength(0.13, { types: ['Free Lances', 'Gilded Lances'] }), aUnit())).toBe(1.13);
    expect(gives(strength(0.13, { types: ['Gilded Lances'] }), aUnit())).toBeNull();
    expect(gives(strength(0.2, { cls: 'cavalry' }), aUnit())).toBe(1.2);
    expect(gives(strength(0.2, { cls: 'infantry' }), aUnit())).toBeNull();
    expect(gives(strength(0.3, { race: 'Human' }), aUnit())).toBe(1.3);
    expect(gives(strength(0.3, { race: 'Elven' }), aUnit())).toBeNull();
    expect(gives(strength(0.1, { quality: ['Average'] }), aUnit())).toBe(1.1);
    expect(gives(strength(0.1, { quality: ['Veteran'] }), aUnit())).toBeNull();
  });
  test('an effect for the king in person: only when he leads it', () => {
    expect(gives(strength(0.1, { king: true }), aUnit({ isItLedByTheKing: true }))).toBe(1.1);
    expect(gives(strength(0.1, { king: true }), aUnit())).toBeNull();
    expect(gives(strength(0.1), aUnit({ isItLedByTheKing: true }))).toBe(1.1);
  });
  test('an effect on its ground: none on other ground or none given', () => {
    const onThePlains = strength(0.3, { terrain: ['plain', 'desert'] });
    expect(gives(onThePlains, aUnit({ theGround: 'desert' }))).toBe(1.3);
    expect(gives(onThePlains, aUnit({ theGround: 'forest' }))).toBeNull();
    expect(gives(onThePlains, aUnit({ theGround: null }))).toBeNull();
    expect(gives(onThePlains, aUnit({ theGround: undefined }))).toBeNull();
    expect(gives(strength(0.3), aUnit({ theGround: null }))).toBe(1.3);
  });
  test("an attacker's effect and a defender's: each only on its side, neither with no side given", () => {
    const attacking = strength(0.2, { side: 'atk' });
    const defending = strength(0.3, { side: 'def' });
    expect(gives(attacking, aUnit())).toBe(1.2);
    expect(gives(attacking, aUnit({ isItsSideTheAttacker: false }))).toBeNull();
    expect(gives(attacking, aUnit({ isItsSideTheAttacker: null }))).toBeNull();
    expect(gives(defending, aUnit({ isItsSideTheAttacker: false }))).toBe(1.3);
    expect(gives(defending, aUnit())).toBeNull();
    expect(gives(defending, aUnit({ isItsSideTheAttacker: undefined }))).toBeNull();
    expect(gives(strength(0.2), aUnit({ isItsSideTheAttacker: false }))).toBe(1.2);
  });
  test("a garrison's effect: only on a garrison standing without a commander", () => {
    const drill = strength(0.3, { led: 'garrison' });
    expect(gives(drill, aUnit({ hasItACommander: false }))).toBe(1.3);
    expect(gives(drill, aUnit())).toBeNull();
    expect(gives(strength(0.3), aUnit({ hasItACommander: false }))).toBe(1.3);
  });
});

describe('the product of the effects a realm holds, capped', () => {
  const product = theFactorTheUnitStrengthDiscoveriesARealmHoldsStrengthenAUnitBy;
  test('none: ×1; one: its factor', () => {
    expect(product([], aUnit())).toBe(1);
    expect(product([strength(0.04)], aUnit())).toBe(1.04);
  });
  test("each that reaches the unit multiplies; one that doesn't is passed over", () => {
    expect(product([strength(0.1), strength(0.05)], aUnit())).toBeCloseTo(1.155, 12);
    expect(product([strength(0.1), strength(0.2, { cls: 'infantry' }), strength(0.05)], aUnit())).toBeCloseTo(
      1.155,
      12,
    );
    expect(product([strength(0.2, { cls: 'infantry' })], aUnit())).toBe(1);
  });
  test('the product capped at the kind’s ceiling, ×1.30, and not below it once reached', () => {
    expect(product([strength(0.2), strength(0.2)], aUnit())).toBe(1.3);
    expect(product([strength(0.3)], aUnit())).toBe(1.3);
    expect(product([strength(0.29)], aUnit())).toBe(1.29);
  });
});

describe("the registry's runner hands the realm's effects to the product", () => {
  const stage = "a realm's discoveries strengthen a unit";
  test('the stage holds the one kind, whose entry is the shared effect', () => {
    expect(THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES.strength[stage]).toEqual(['unit-strength']);
    expect(THE_REGISTRY_OF_DISCOVERY_EFFECTS['unit-strength'].strength[stage]).toBe(
      theFactorAUnitStrengthDiscoveryGivesAUnit,
    );
  });
  test("War Drums, Fire Arrows and Garrison Drill, on the units each reaches, in the realm's order", () => {
    const realm = { discoveries: [{ id: 'sd02' }, null, { id: 'nonesuch' }, { id: 'sd07' }, { id: 'sd44' }] };
    const longbows = { type: 'Yeoman Longbows', race: 'Human', quality: 'Average' };
    expect(theFactorARealmsDiscoveriesStrengthenAUnitBy(realm, aUnit())).toBe(1.04);
    expect(theFactorARealmsDiscoveriesStrengthenAUnitBy(realm, aUnit({ theUnit: longbows }))).toBeCloseTo(
      1.04 * 1.14,
      12,
    );
    expect(theFactorARealmsDiscoveriesStrengthenAUnitBy(realm, aUnit({ hasItACommander: false }))).toBe(1.3);
    expect(theFactorARealmsDiscoveriesStrengthenAUnitBy(null, aUnit())).toBe(1);
    expect(theFactorARealmsDiscoveriesStrengthenAUnitBy({ discoveries: null }, aUnit())).toBe(1);
  });
});
