// ── The gold a lair's hoard holds, drawn from its guardian's band (B-06g, T7: the rules pulled out) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. One rule, where its two
// copies agreed: a lair's gold is a roll in its guardian's power's band, both ends counted, or 1 to 5 for a power the
// table doesn't list. encounterClearGold (a scout's figure and a clear's, rolled once and kept) and ensureLairHoard (the
// hoard stocked as the world is made, or a lair first read) read it. The die is the caller's, drawn where it was.
import {
  KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_BY_ITS_GUARDIANS_POWER,
  KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_WHOSE_GUARDIANS_POWER_THE_TABLE_DOES_NOT_LIST,
} from '../../content/kingdoms-call-data.ts';

/** The gold a lair's hoard holds on a die in [0, 1): a whole number from its guardian's power's band, the least on a
 *  die of 0 and the most on a die just below 1; content's 1 to 5 for a power its table doesn't list. The caller names
 *  the power (`'Weak'` for a lair with none). */
export function theGoldALairsHoardHoldsOnADie(theGuardiansPower: string, theDie: number): number {
  // the bands read by any power's name
  const bands: Readonly<Partial<Record<string, readonly [min: number, max: number]>>> =
    KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_BY_ITS_GUARDIANS_POWER;
  const band =
    bands[theGuardiansPower] ?? KC_THE_GOLD_A_LAIRS_HOARD_HOLDS_WHOSE_GUARDIANS_POWER_THE_TABLE_DOES_NOT_LIST;
  return Math.floor(theDie * (band[1] - band[0] + 1)) + band[0];
}
