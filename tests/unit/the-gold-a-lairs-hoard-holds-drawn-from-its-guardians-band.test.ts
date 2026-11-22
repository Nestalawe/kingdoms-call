// The gold a lair's hoard holds, drawn from its guardian's band, on plain values (B-06g, T7: the rules pulled out): a
// whole number from the guardian's power's band in content's table (Weak 5-8, Moderate 12-18, Powerful 20-30,
// Legendary 40-60), its least on a die of 0 and its most on a die just below 1, or 1 to 5 for a power the table
// doesn't list; the engine's name for the table (ENCOUNTER_CLEAR_GOLD_BANDS) is content's same object; and the Sage 6's
// gold for a new discovery, content's 5.
//
// Level 1 (unit): the function of src/engine/rules-on-plain-values/the-gold-a-lairs-hoard-holds-drawn-from-its-guardians-
// band.ts on dice handed in, against the expression its two copies (encounterClearGold, ensureLairHoard) wrote. A lower
// level can't run a function. No matrix game reaches a band's ends on purpose, nor a power the table doesn't list (every
// guardian a world makes has one of the four), so these cases pin them; the Research order's cases hold the Sage's 5g at
// its three finds, the explore and search orders' cases the two call sites, and the matrix the worlds' hoards.
import { describe, expect, test } from 'vitest';
import {
  KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_BY_ITS_GUARDIANS_POWER,
  KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_WHOSE_GUARDIANS_POWER_THE_TABLE_DOES_NOT_LIST,
  KC_THE_GOLD_A_SAGE_MASTERS_NEW_DISCOVERY_BRINGS,
} from '../../src/content/kingdoms-call-data.ts';
import { ENCOUNTER_CLEAR_GOLD_BANDS } from '../../src/engine/world/tables.ts';
import { theGoldALairsHoardHoldsOnADie } from '../../src/engine/rules-on-plain-values/the-gold-a-lairs-hoard-holds-drawn-from-its-guardians-band.ts';

/** The highest die kcRng() can give: just below 1. */
const THE_HIGHEST_DIE = 1 - 2 ** -32;

describe("the gold a lair's hoard holds, drawn from its guardian's band", () => {
  test("each band's least on a die of 0 and its most on the highest die; 1 to 5 for a power the table doesn't list", () => {
    const ends = (power: string) => [
      theGoldALairsHoardHoldsOnADie(power, 0),
      theGoldALairsHoardHoldsOnADie(power, THE_HIGHEST_DIE),
    ];
    expect({
      Weak: ends('Weak'),
      Moderate: ends('Moderate'),
      Powerful: ends('Powerful'),
      Legendary: ends('Legendary'),
      Mythic: ends('Mythic'),
      none: ends(''),
    }).toEqual({
      Weak: [5, 8],
      Moderate: [12, 18],
      Powerful: [20, 30],
      Legendary: [40, 60],
      Mythic: [1, 5],
      none: [1, 5],
    });
  });

  test('every whole number of a band is drawn, and none outside it', () => {
    const drawn = (power: string) => {
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) seen.add(theGoldALairsHoardHoldsOnADie(power, i / 1000));
      return [...seen].sort((a, b) => a - b);
    };
    expect(drawn('Moderate')).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(drawn('Mythic')).toEqual([1, 2, 3, 4, 5]);
  });

  test('the same gold as the expression the scout, the clear and the stocking wrote, on every power and die', () => {
    const theOldBands: Readonly<Partial<Record<string, readonly [number, number]>>> = {
      Weak: [5, 8],
      Moderate: [12, 18],
      Powerful: [20, 30],
      Legendary: [40, 60],
    };
    const theOldGold = (power: string, die: number) => {
      const band = theOldBands[power] ?? [1, 5];
      return Math.floor(die * (band[1] - band[0] + 1)) + band[0];
    };
    const parted: string[] = [];
    for (const power of ['Weak', 'Moderate', 'Powerful', 'Legendary', 'Mythic', ''])
      for (let i = 0; i <= 1000; i++) {
        const die = i === 1000 ? THE_HIGHEST_DIE : i / 1000;
        if (theGoldALairsHoardHoldsOnADie(power, die) !== theOldGold(power, die))
          parted.push(`${power} ${String(die)}`);
      }
    expect(parted).toEqual([]);
  });

  test("the engine's table is content's, the same object, and the fallback and the Sage's gold are content's values", () => {
    expect(ENCOUNTER_CLEAR_GOLD_BANDS).toBe(KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_BY_ITS_GUARDIANS_POWER);
    expect(KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_WHOSE_GUARDIANS_POWER_THE_TABLE_DOES_NOT_LIST).toEqual([1, 5]);
    expect(KC_THE_GOLD_A_SAGE_MASTERS_NEW_DISCOVERY_BRINGS).toBe(5);
  });
});
