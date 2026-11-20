// 2026-10-11 (the maintainer: the winged riders are soldiers of their race): Eagle Riders, Noble Griffons and Wyvern
// Riders are no longer Creatures or Monsters. They need Druid 1 to lead, like every racial troop (waived for their own
// race), have no place among the flyers Dragon Taming leads, and their own strikes land one time in two whatever the
// commander's Druid.
//
// Level 1 (unit): the data file's tables, imported (tests/lib/the-whole-engine.ts first, as every test on the engine's
// modules). Not lower: the agreement between the class lists and the Druid ladder is a property of the data, not of
// one line of text.
//
// Until plan P1-14z this was tests/flyers-soldiers.test.js, which read the data file in a vm and called getDruidLevel
// and primalStrikeChance on the booted GM and player pages. Its table checks are here, as they were; its checks on the
// booted pages (getDruidLevel and the strike's chance, and each page booting) stay page checks, in
// tests/page/the-gm-and-player-pages-type-druid-strike-and-home-roster-rules-answer-as-the-rosters-decide.test.ts,
// which says why.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { KC_DRUID_LEVELS, KC_UNIT_CLASS } from '../../src/content/kingdoms-call-data.ts';

const THE_WINGED_RIDERS = ['Eagle Riders', 'Noble Griffons', 'Wyvern Riders'];
const THE_DRUID_LADDER: Readonly<Record<string, readonly string[] | undefined>> = KC_DRUID_LEVELS;
const theUnitsAtDruid = (level: number): readonly string[] => THE_DRUID_LADDER[level] ?? [];

describe.each(THE_WINGED_RIDERS)('%s, in the data file', (rider) => {
  test('are neither Creature nor Monster', () => {
    expect(KC_UNIT_CLASS.creature).not.toContain(rider);
    expect(KC_UNIT_CLASS.monster).not.toContain(rider);
  });

  test('are not a flyer to be tamed', () => {
    expect(KC_UNIT_CLASS.tamedFlyer).not.toContain(rider);
  });

  test('still fly', () => {
    expect(KC_UNIT_CLASS.flying).toContain(rider);
    expect(KC_UNIT_CLASS.aerial).toContain(rider);
  });

  test('sit at Druid 1 with the other racial troops, and at no higher level', () => {
    expect(theUnitsAtDruid(1)).toContain(rider);
    for (const level of [2, 3, 4, 5]) expect(theUnitsAtDruid(level)).not.toContain(rider);
  });
});

test('Druid 3 is left to the sea-beasts, the Whale Cohort first', () => {
  // (2026-10-13, Creatures and Monsters III: the Shark Shoals share Druid 3 with the Whale Cohort; no winged rider does.)
  expect(theUnitsAtDruid(3)[0]).toBe('Whale Cohort');
  for (const rider of THE_WINGED_RIDERS) expect(theUnitsAtDruid(3)).not.toContain(rider);
});

test('Gnomish Gyrocopters still need nobody', () => {
  for (const units of Object.values(THE_DRUID_LADDER)) expect(units).not.toContain('Gnomish Gyrocopters');
});
