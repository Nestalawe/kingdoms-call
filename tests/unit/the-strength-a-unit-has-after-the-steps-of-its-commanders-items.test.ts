// The steps a commander's items make on the strength of a unit he leads, and the strength after them, on plain values
// (plan P1-11e37 moved the items' stage "strength: the commander's items" out of the items' registry, so the army card
// can later ask the turn's own): each of the ten effects gives its step to a unit it reaches (strength added, a
// multiplier, or the Kraken Figurehead's step up a quality tier) and nothing to one it doesn't, and the steps are taken
// in the order handed, each multiplier rounded as it goes, strength added not rounded.
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-strength-a-unit-has-after-the-steps-of-its-
// commanders-items.ts on made-up units, the registry's entries and stage that hand them on, and the registry's runner
// on made-up items. A lower level can't run a function. A fault planted in a shared function moves every caller at once
// (the turn and, later, the card alike), so these cases pin its answers; armStr's own cases on the content's items are
// in tests/unit/the-commanders-items-no-matrix-game-carries-keep-their-values.test.ts.
import { describe, expect, test } from 'vitest';
import {
  THE_COMMANDERS_ITEMS,
  theStrengthAUnitHasAfterTheStepsOfItsCommandersItems,
  type AUnitLedByACommander,
} from '../../src/engine/rules-on-plain-values/the-strength-a-unit-has-after-the-steps-of-its-commanders-items.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS,
  THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS,
  theStrengthAfterTheCommandersItems,
} from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';

/** A company of Free Lances (cavalry), Average, not skeletal, led for a Neutral realm, with `changes` made. */
const aUnit = (changes: Partial<AUnitLedByACommander> = {}): AUnitLedByACommander => ({
  unitType: 'Free Lances',
  quality: 'Average',
  isSkeletal: false,
  theRealmsAlignment: 'Neutral',
  ...changes,
});
const after = theStrengthAUnitHasAfterTheStepsOfItsCommandersItems;
const STEP = THE_COMMANDERS_ITEMS;

describe("each effect's step", () => {
  test('the Battle Standard: +2 on every unit', () => {
    expect(STEP['army-bonus']()).toEqual({ adds: 2 });
  });
  test('the Golden Spur, the Mark and the Pendant: their multiplier on the units they reach, else nothing', () => {
    expect(STEP['cavalry-bonus'](aUnit())).toEqual({ multipliesBy: 1.25 });
    expect(STEP['cavalry-bonus'](aUnit({ unitType: 'Men-at-Arms' }))).toBeNull();
    expect(STEP['infantry-bonus'](aUnit({ unitType: 'Men-at-Arms' }))).toEqual({ multipliesBy: 1.2 });
    expect(STEP['infantry-bonus'](aUnit())).toBeNull();
    expect(STEP['archer-bonus'](aUnit({ unitType: 'Elven Bowmen' }))).toEqual({ multipliesBy: 1.3 });
    expect(STEP['archer-bonus'](aUnit())).toBeNull();
  });
  test('the Blueprint, the Sea Chart and the Spyglass: strength added on the units they reach, else nothing', () => {
    expect(STEP['heavy-bonus'](aUnit({ unitType: 'Mountain Guns' }))).toEqual({ adds: 4 });
    expect(STEP['heavy-bonus'](aUnit())).toBeNull();
    expect(STEP['fleet-strength'](aUnit({ unitType: 'Galleon Fleet' }))).toEqual({ adds: 1 });
    expect(STEP['fleet-strength'](aUnit())).toBeNull();
    expect(STEP['admirals-spyglass'](aUnit({ unitType: 'Galleon Fleet' }))).toEqual({ adds: 2 });
    expect(STEP['admirals-spyglass'](aUnit())).toBeNull();
  });
  test("the Kraken Figurehead: a fleet one tier up, the next tier's multiplier over its own; none past Elite", () => {
    const fleet = (quality: string | undefined) => aUnit({ unitType: 'Galleon Fleet', quality });
    expect(STEP['naval-bonus'](fleet('Average'))).toEqual({ multipliesBy: 3, dividedBy: 2 });
    expect(STEP['naval-bonus'](fleet('Green'))).toEqual({ multipliesBy: 2, dividedBy: 1 });
    expect(STEP['naval-bonus'](fleet('Elite'))).toBeNull();
    expect(STEP['naval-bonus'](fleet(undefined))).toBeNull();
    expect(STEP['naval-bonus'](fleet('Legendary'))).toBeNull();
    expect(STEP['naval-bonus'](aUnit())).toBeNull();
  });
  test("the Chalice of Dawn: ×1.15 on a Divine realm's units, of any type; nothing for another realm or none", () => {
    expect(STEP['chalice-of-dawn'](aUnit({ theRealmsAlignment: 'Divine', unitType: 'Mountain Guns' }))).toEqual({
      multipliesBy: 1.15,
    });
    expect(STEP['chalice-of-dawn'](aUnit())).toBeNull();
    expect(STEP['chalice-of-dawn'](aUnit({ theRealmsAlignment: null }))).toBeNull();
  });
  test('the Black Sceptre: +4 on a skeletal unit of any type, else nothing', () => {
    expect(STEP['undead-bonus'](aUnit({ isSkeletal: true }))).toEqual({ adds: 4 });
    expect(STEP['undead-bonus'](aUnit())).toBeNull();
  });
});

describe('the strength after the steps', () => {
  test('no step: the strength so far', () => {
    expect(after([], aUnit(), 9)).toBe(9);
    expect(after(['chalice-of-dawn', 'heavy-bonus'], aUnit(), 9)).toBe(9);
  });
  test('in the order handed, each multiplier rounded as it goes', () => {
    expect(after(['army-bonus', 'cavalry-bonus'], aUnit(), 9)).toBe(14); // (9 + 2) × 1.25 = 13.75
    expect(after(['cavalry-bonus', 'army-bonus'], aUnit(), 9)).toBe(13); // 11.25 rounded, + 2
    expect(after(['cavalry-bonus', 'cavalry-bonus'], aUnit(), 9)).toBe(14); // 11.25 → 11, × 1.25 = 13.75
  });
  test('strength added is not rounded', () => {
    expect(after(['army-bonus'], aUnit(), 7.5)).toBe(9.5);
  });
  test("the Kraken's step: the strength times the next tier's multiplier, over its own, then rounded", () => {
    const fleet = aUnit({ unitType: 'Galleon Fleet' });
    expect(after(['naval-bonus'], fleet, 9)).toBe(14); // 27 / 2 = 13.5
    expect(after(['naval-bonus'], aUnit({ unitType: 'Galleon Fleet', quality: 'Green' }), 9)).toBe(18);
    expect(after(['naval-bonus', 'fleet-strength', 'admirals-spyglass'], fleet, 7)).toBe(14); // 10.5 → 11, + 1 + 2
  });
  test("a Divine realm's skeletal cavalry under every item: each step that reaches it", () => {
    const unit = aUnit({ isSkeletal: true, theRealmsAlignment: 'Divine' });
    // 10 + 2 = 12; × 1.25 = 15; × 1.15 = 17.25 → 17; + 4 = 21
    expect(after(THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"], unit, 10)).toBe(21);
  });
});

describe("the items' registry hands its stage on", () => {
  const ORDER = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"];
  test("the stage's order holds each moved effect once, and each entry of the stage is that effect's step", () => {
    expect([...ORDER].sort()).toEqual(Object.keys(THE_COMMANDERS_ITEMS).sort());
    for (const slug of ORDER)
      expect(THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS[slug].strength["the commander's items"]).toBe(STEP[slug]);
  });
  test("the runner: the effects the items carry, in the stage's order whatever the items' order", () => {
    const spur = { effect: { stat: 'cavBonus' } };
    const standard = { effect: { stat: 'armyBonus' } };
    expect(theStrengthAfterTheCommandersItems(aUnit(), [spur, standard], 9)).toBe(14);
    expect(theStrengthAfterTheCommandersItems(aUnit(), [standard, spur, spur], 9)).toBe(14);
    expect(theStrengthAfterTheCommandersItems(aUnit(), [{ effect: { stat: 'navalBonus' } }], 9)).toBe(9);
    expect(theStrengthAfterTheCommandersItems(aUnit(), [], 9)).toBe(9);
  });
});
