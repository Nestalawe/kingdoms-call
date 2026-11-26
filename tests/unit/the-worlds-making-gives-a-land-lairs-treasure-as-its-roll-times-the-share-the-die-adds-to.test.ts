// The world's making, S3 (src/engine/world/the-worlds-making/
// s03-every-province-made-its-terrain-tax-armies-and-lairs.ts): a land lair's treasure is its roll, between the row's
// least and most, times a share: the row's least share and what the die adds to it (EACH_PROVINCE.aLairsTreasure),
// rounded, and never under 1. On a high die a lair holds close to the most of the roll; on a middling die, the middling
// roll times a middling share.
//
// Level 1 (unit): the stage is called directly on the set-up's (S0's) tables, on a one-province map of plain land, with
// every die fixed (kcRng.use), so the treasure each lair gets is known; nothing is left to the test's seed. Not lower:
// the treasure is worked out inside the stage, from its dice.
import { expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { theSetUpTheMapsGridAndTheProvincesNames } from '../../src/engine/world/the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts';
import { everyProvinceMadeItsTerrainTaxArmiesAndLairs } from '../../src/engine/world/the-worlds-making/s03-every-province-made-its-terrain-tax-armies-and-lairs.ts';
import { EACH_PROVINCE } from '../../src/content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';

/** The treasure of each lair of a one-province world of plain land made with every die `die`. */
function theLairsTreasuresOnTheDie(die: number) {
  const setUp = theSetUpTheMapsGridAndTheProvincesNames({ setupPlayers: [], sz: { cols: 1, rows: 1 }, genOpts: null });
  const theDiceBefore = kcRng.use(() => die);
  try {
    everyProvinceMadeItsTerrainTaxArmiesAndLairs({
      ...setUp,
      seaTarget: 0,
      hasPaganPlayer: false,
      pickLand: () => 'plain',
      constraint: {},
      SEA_BASE_RATE: 0,
      SEA_CLUSTER_RATE: 0,
    });
  } finally {
    kcRng.use(theDiceBefore);
  }
  return setUp.provinces.flatMap((p) => p.features.filter((f) => f.monster != null).map((f) => f.treasure));
}

/** The treasure on the die `die`: the roll the die gives between the row's least and most, times the least share and
 *  the die's share of what it adds, rounded and never under 1. */
function theTreasureOnTheDie(die: number) {
  const { theLeastOfTheRoll, theMostOfTheRoll, theLeastShare, theShareTheDieAdds } = EACH_PROVINCE.aLairsTreasure;
  const theRoll = Math.floor(die * (theMostOfTheRoll - theLeastOfTheRoll + 1)) + theLeastOfTheRoll;
  return Math.max(1, Math.round(theRoll * (theLeastShare + die * theShareTheDieAdds)));
}

test("on a high die each land lair holds its roll's most times nearly the whole share", () => {
  const die = 0.999;
  const treasures = theLairsTreasuresOnTheDie(die);
  expect(treasures.length, 'the province has lairs').toBeGreaterThan(0);
  expect(theTreasureOnTheDie(die), "the roll's most, the share nearly whole").toBe(
    EACH_PROVINCE.aLairsTreasure.theMostOfTheRoll,
  );
  expect(treasures).toEqual(treasures.map(() => theTreasureOnTheDie(die)));
});

test('on a middling die each land lair holds the middling roll times the middling share', () => {
  const die = 0.5;
  const treasures = theLairsTreasuresOnTheDie(die);
  expect(treasures.length, 'the province has lairs').toBeGreaterThan(0);
  expect(treasures).toEqual(treasures.map(() => theTreasureOnTheDie(die)));
});
