// The units the Druid mastery lifts (plan P1-11d12: src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-
// druid-each-unit-needs.ts, theDruidMasteryLiftsAUnitOfThisType), called directly: a Creature or a Monster, and not a
// skeleton. The battle's druidMasteryGain and the army card on the player's report both ask it; the parity test
// (the-player-portals-copies-agree-with-the-engine, "the army card's Druid mastery bonus is the turn's …") shows the
// card's line and the battle agree on it. The file imports only the content and its folder, so the test imports it as it
// is, with no engine loaded.
// Level 1 (unit): a function of a unit's type and whether it is a skeleton.
import { expect, test } from 'vitest';
import { theDruidMasteryLiftsAUnitOfThisType as lifts } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';

test('a living Creature or Monster: lifted', () => {
  for (const type of ['Thunderbirds', 'Forest Ents', 'Cave Trolls', 'Shark Shoals']) {
    expect(lifts(type, false)).toBe(true);
    expect(lifts(type, undefined)).toBe(true);
    expect(lifts(type, null)).toBe(true);
  }
});

test('a skeleton: never lifted, a Creature or a Monster too', () => {
  for (const type of ['Thunderbirds', 'Cave Trolls', 'Shieldwall Levies']) expect(lifts(type, true)).toBe(false);
});

test('a unit of a humanoid race, a winged rider among them: never lifted', () => {
  for (const type of ['Shieldwall Levies', 'Human Garrison', 'Eagle Riders', 'Wyvern Riders', 'No Such Unit'])
    expect(lifts(type, false)).toBe(false);
});
