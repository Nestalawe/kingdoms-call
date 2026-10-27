// Broadside, Armoured Hulls, Sea Archers, Punch Through and Bombardment act as the books say (plan P1-19's second
// slice, row P1-19g): five abilities of the volley that no race or beast test checks, and that the balance matrix sees
// only as hashes that changed (a planted fault in each turns 17 to 39 of its 60 games, and nothing names the
// ability). Each is checked here on plain values, through the functions that keep their names and signatures:
// - Broadside: at sea a Galleon Fleet shoots in the volley, after the ranged units; on land it doesn't
//   (abilityMissileUnits);
// - Armoured Hulls (with Shell Wall, the same stage): no shot is worth firing at Dwarf Ironclads or Great Turtles, and
//   every shot glances off them, leaving no mark (missileCapReached, missileTargetPool, applyMissileHit);
// - Sea Archers: with Elven Galleys in the force, its ranged units fight at sea with no land unit's penalty (×0.75); its
//   foot keep it, and so do ranged units with another hull (armStr's strength ladder);
// - Punch Through: Ironwood Crossbows soften a target to 55% of its strength, 90% of a winged rider's, where other
//   shooters stop at 40% and 80% (missileCap);
// - Bombardment: the Mountain Guns shoot first, and do +50% against each of the four garrisons and nothing more against
//   another unit (abilityMissileUnits' order, missileDamageMult).
// Each number is the books' (the blurb's and the roster row's), written here, so a fault in the content's row or in the
// effect turns this red.
// Level 1 (unit): pure functions of the engine's modules called directly (plan P1-14a), with no turn played and no die
// drawn; the whole engine is imported first (tests/lib/the-whole-engine.ts). A lower level can't run them; the race
// tests and the matrix don't name these five. The turn's context holds only its state (armStr reads no more of it with
// no hero), so its type is given by assertion, as the other unit tests of armStr do.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  abilityMissileUnits,
  missileCap,
  missileCapReached,
  missileDamageMult,
  missileTargetPool,
} from '../../src/engine/battle/strength.ts';
import { applyMissileHit, armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { ladderFm, theWordsOfAUnitsModifier } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import type { AModifierOfAUnitInTheLadder } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

/** A unit of no race (so no kinship), of quality `quality`. */
const unit = (type: string, quality = 'Average'): ArmyInABattle => ({
  type,
  quality,
  race: '',
  unitName: `the Test ${type}`,
});
const turn = { G: { players: [], characters: [] } } as unknown as TurnContext;
/** The labels armStr names on the strength ladder of `a`, at sea, in the force given, with no hero (the words the
 *  prose writes of each modifier armStr records). */
const atSea = (a: ArmyInABattle, force: readonly ArmyInABattle[]) => {
  const trace: AModifierOfAUnitInTheLadder[] = [];
  armStr(turn, a, null, 'Neutral', 'sea', { force, enemyForce: [], trace });
  return trace.map((t) => theWordsOfAUnitsModifier(t.reason)).filter((l) => l.startsWith('sea terrain'));
};
const THE_SEAS_PENALTY = `sea terrain ${ladderFm(0.75)}`;
const types = (units: readonly ArmyInABattle[]) => units.map((a) => a.type);

describe('Broadside: a galleon fires in the archery step at sea', () => {
  test('at sea, after the ranged units', () => {
    const force = [unit('Galleon Fleet'), unit('Men-at-Arms'), unit('Yeoman Longbows')];
    expect(types(abilityMissileUnits(force, 'sea'))).toEqual(['Yeoman Longbows', 'Galleon Fleet']);
  });
  test('not on land', () => {
    const force = [unit('Galleon Fleet'), unit('Yeoman Longbows')];
    expect(types(abilityMissileUnits(force, 'plain'))).toEqual(['Yeoman Longbows']);
  });
});

describe('Armoured Hulls and Shell Wall: immune to pre-battle volleys', () => {
  const longbows = unit('Yeoman Longbows');
  test.for([
    ['Dwarf Ironclads', 'armoured hull'],
    ['Great Turtles', 'shell'],
  ] as const)('%s: never worth a shot, and every shot glances off (%s)', ([type, why]) => {
    const hull = unit(type);
    expect(missileCapReached(hull, longbows)).toBe(true);
    expect(missileTargetPool([hull, unit('Men-at-Arms')], 0, longbows, [longbows]).map((a) => a.type)).toEqual([
      'Men-at-Arms',
    ]);
    expect(applyMissileHit(hull, 3, longbows)).toEqual({ dmg: 0, isFly: false, capped: false, immune: true, why });
    expect(hull).toEqual(unit(type));
  });
  test('another fleet is shot at, and marked', () => {
    const galleon = unit('Galleon Fleet');
    expect(missileCapReached(galleon, longbows)).toBe(false);
    expect(applyMissileHit(galleon, 3, longbows).dmg).toBeGreaterThan(0);
    expect(galleon._archeryRed).toBeGreaterThan(0);
  });
});

describe('Sea Archers: your ranged units ignore the land-unit penalty at sea', () => {
  test('with Elven Galleys in the force, its ranged units take no penalty at sea', () => {
    const longbows = unit('Yeoman Longbows');
    expect(atSea(longbows, [unit('Elven Galleys'), longbows])).toEqual([]);
    const crossbows = unit('Ironwood Crossbows');
    expect(atSea(crossbows, [crossbows, unit('Men-at-Arms'), unit('Elven Galleys')])).toEqual([]);
  });
  test('its foot keep the penalty, and ranged units with another hull keep it', () => {
    const foot = unit('Men-at-Arms');
    expect(atSea(foot, [unit('Elven Galleys'), foot])).toEqual([THE_SEAS_PENALTY]);
    const longbows = unit('Yeoman Longbows');
    expect(atSea(longbows, [unit('Galleon Fleet'), longbows])).toEqual([THE_SEAS_PENALTY]);
  });
});

describe('Punch Through: a target softened to 55%, a winged rider to 90%, where others stop at 40% and 80%', () => {
  // Strength 30 each (Elite): 55% is 16 and 50% would be 15; 90% is 27 and 80% is 24.
  const foot = unit('Men-at-Arms', 'Elite');
  const rider = unit('Eagle Riders', 'Elite');
  test('Ironwood Crossbows', () => {
    const crossbows = unit('Ironwood Crossbows');
    expect(missileCap(foot, crossbows)).toBe(16);
    expect(missileCap(rider, crossbows)).toBe(27);
  });
  test('another shooter, or none', () => {
    for (const firer of [unit('Yeoman Longbows'), unit('Mountain Guns'), null]) {
      expect(missileCap(foot, firer)).toBe(12);
      expect(missileCap(rider, firer)).toBe(24);
    }
  });
  test('a crossbow volley stops at the limit', () => {
    const crossbows = unit('Ironwood Crossbows');
    const target = { ...foot, _archeryRed: 15 };
    expect(missileCapReached(target, crossbows)).toBe(false);
    expect(missileCapReached({ ...foot, _archeryRed: 16 }, crossbows)).toBe(true);
    expect(missileCapReached(target, unit('Yeoman Longbows'))).toBe(true);
  });
});

describe('Bombardment: fire before all other ranged units, and +50% volley damage against garrisons', () => {
  const guns = unit('Mountain Guns');
  test('the guns shoot first, the others in their order', () => {
    const force = [unit('Yeoman Longbows'), unit('Black Arrows'), guns, unit('Elven Bowmen')];
    expect(types(abilityMissileUnits(force, 'plain'))).toEqual([
      'Mountain Guns',
      'Yeoman Longbows',
      'Black Arrows',
      'Elven Bowmen',
    ]);
  });
  test.for(['Human Garrison', 'Elven Garrison', 'Dwarf Garrison', 'Orc Garrison'])('×1.5 against a %s', (type) => {
    expect(missileDamageMult(guns, [guns], 'plain', unit(type), true)).toBe(1.5);
    expect(missileDamageMult(guns, [guns], 'mountain', unit(type), false)).toBe(1.5);
  });
  test('×1 against another unit, or with no target; and no other shooter gains it', () => {
    expect(missileDamageMult(guns, [guns], 'plain', unit('Men-at-Arms'), true)).toBe(1);
    expect(missileDamageMult(guns, [guns], 'plain', null, true)).toBe(1);
    expect(missileDamageMult(unit('Yeoman Longbows'), [], 'plain', unit('Human Garrison'), true)).toBe(1);
  });
});
