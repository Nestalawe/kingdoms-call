// The move pools on plain values (plan P1-11e5 moved them out of the turn's computeMovePoolMax and refreshMovePool, so
// the order form's march forecast can ask the same rules): a column marches at its slowest land company's pace (March
// adds to every land company that doesn't fly, the realm's discoveries to those of Speed 1–2) and sails at its slowest
// ship's (Naval adds to each); a lone hero has 5 of each and takes passage; an all-flying column, or one whose flyers
// lift every foot soldier, flies at its slowest flyer's pace over land and sea; the Swift and Seawolf titles add 1 to a
// pool there is. A pool whose maximum changes mid-turn keeps the points spent, and gains only the rise. A step spends
// the sea pool to enter the sea or land from it, else the land pool.
//
// Level 1 (unit): theMovePoolsOfAColumn, theMovePointsAPoolHasLeftOnceItsMaximumChanges and theMovePoolAStepSpends
// (src/engine/rules-on-plain-values/the-move-pools-a-column-marches-and-sails-by-and-the-pool-a-step-spends.ts) called
// on the values the turn hands them. A lower level can't run a function. The matrix reaches the pools, but a fault
// planted in a shared function moves every caller at once, and no game stages a negative pool, a flyer the table
// doesn't price or a Seawolf with no ships, so these cases pin its values. The speed table is the case's own (the
// roster's is tests/roster's): the units' kinds are the content's.
import { expect, test } from 'vitest';
import {
  theMovePointsAPoolHasLeftOnceItsMaximumChanges,
  theMovePoolAStepSpends,
  theMovePoolsOfAColumn,
} from '../../src/engine/rules-on-plain-values/the-move-pools-a-column-marches-and-sails-by-and-the-pool-a-step-spends.ts';
import type { WhatAColumnsMovePoolsAreWorkedOutFrom } from '../../src/engine/rules-on-plain-values/the-move-pools-a-column-marches-and-sails-by-and-the-pool-a-step-spends.ts';

interface ACompany {
  readonly type: string;
  readonly road?: number;
}
const SPEEDS = {
  'Shieldwall Levies': 2,
  'Free Lances': 4,
  'Noble Griffons': 5,
  Thunderbirds: 6,
  'Galleon Fleet': 3,
  'Corsair Fleet': 4,
  'Elven Bowmen': 0,
};
/** A column of these companies, March adding 1 on land, Naval adding the ship's base speed's tenth plus 1 (so a fault
 *  that hands the wrong base shows), each company's road its own `road`, no titles. */
function aColumnOf(
  companies: readonly ACompany[],
  more: Partial<WhatAColumnsMovePoolsAreWorkedOutFrom<ACompany>> = {},
): WhatAColumnsMovePoolsAreWorkedOutFrom<ACompany> {
  return {
    companies,
    theSpeedOfEachType: SPEEDS,
    whatHisMarchAddsOnLand: 1,
    whatHisNavalAddsToAShipOfTheSpeed: (base) => 1 + base / 10,
    whatHisRealmsDiscoveriesAddTo: (a) => a.road ?? 0,
    heHoldsSwift: false,
    heHoldsSeawolf: false,
    ...more,
  };
}

test('a lone hero has 5 of each pool and takes passage at sea; the Swift and Seawolf titles add 1 to each', () => {
  expect({
    alone: theMovePoolsOfAColumn(aColumnOf([])),
    aloneSwiftAndSeawolf: theMovePoolsOfAColumn(aColumnOf([], { heHoldsSwift: true, heHoldsSeawolf: true })),
  }).toEqual({
    alone: { land: 5, sea: 5, seaActive: true },
    aloneSwiftAndSeawolf: { land: 6, sea: 6, seaActive: true },
  });
});

test("a column marches at its slowest land company's pace: March adds to each, the realm's discoveries to Speed 1–2 alone", () => {
  const asked: string[] = [];
  const levies = { type: 'Shieldwall Levies', road: 1 };
  const lances = { type: 'Free Lances', road: 7 };
  expect({
    leviesWithARoad: theMovePoolsOfAColumn(aColumnOf([levies])),
    leviesOfNoRealm: theMovePoolsOfAColumn(aColumnOf([levies], { whatHisRealmsDiscoveriesAddTo: null })),
    lancesWhoseRoadIsNotAsked: theMovePoolsOfAColumn(
      aColumnOf([lances], {
        whatHisRealmsDiscoveriesAddTo: (a) => {
          asked.push(a.type);
          return a.road ?? 0;
        },
      }),
    ),
    // The slowest sets the pace: Levies 2 + 1 + 1 against Lances 4 + 1.
    leviesAndLances: theMovePoolsOfAColumn(aColumnOf([lances, levies])),
    leviesAndLancesSwift: theMovePoolsOfAColumn(aColumnOf([lances, levies], { heHoldsSwift: true })),
    // A Seawolf adds nothing to a sea pool there isn't.
    leviesSeawolf: theMovePoolsOfAColumn(aColumnOf([levies], { heHoldsSeawolf: true })),
    // A type the table prices at nothing, or doesn't price, marches at 3 (and is past the roads' band).
    bowmenPricedAtNothing: theMovePoolsOfAColumn(aColumnOf([{ type: 'Elven Bowmen', road: 5 }])),
    aTypeTheTableLacks: theMovePoolsOfAColumn(aColumnOf([{ type: 'Men-at-Arms', road: 5 }])),
    asked,
  }).toEqual({
    leviesWithARoad: { land: 4, sea: 0, seaActive: false },
    leviesOfNoRealm: { land: 3, sea: 0, seaActive: false },
    lancesWhoseRoadIsNotAsked: { land: 5, sea: 0, seaActive: false },
    leviesAndLances: { land: 4, sea: 0, seaActive: false },
    leviesAndLancesSwift: { land: 5, sea: 0, seaActive: false },
    leviesSeawolf: { land: 4, sea: 0, seaActive: false },
    bowmenPricedAtNothing: { land: 4, sea: 0, seaActive: false },
    aTypeTheTableLacks: { land: 4, sea: 0, seaActive: false },
    asked: [],
  });
});

test("a column sails at its slowest ship's pace, Naval added to each by its base speed; ships alone have no land pool", () => {
  expect({
    twoFleets: theMovePoolsOfAColumn(aColumnOf([{ type: 'Corsair Fleet' }, { type: 'Galleon Fleet' }])),
    twoFleetsSwiftAndSeawolf: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Corsair Fleet' }, { type: 'Galleon Fleet' }], { heHoldsSwift: true, heHoldsSeawolf: true }),
    ),
    leviesAboardAGalleon: theMovePoolsOfAColumn(aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Galleon Fleet' }])),
    // Naval is handed each ship's own base speed.
    aCorsair: theMovePoolsOfAColumn(aColumnOf([{ type: 'Corsair Fleet' }])),
    // A ship the table doesn't price sails at 3, Naval added.
    anUnpricedShip: theMovePoolsOfAColumn(aColumnOf([{ type: 'Elven Galleys' }])),
  }).toEqual({
    twoFleets: { land: 0, sea: 4.3, seaActive: true },
    twoFleetsSwiftAndSeawolf: { land: 0, sea: 5.3, seaActive: true },
    leviesAboardAGalleon: { land: 3, sea: 4.3, seaActive: true },
    aCorsair: { land: 0, sea: 5.4, seaActive: true },
    anUnpricedShip: { land: 0, sea: 4.3, seaActive: true },
  });
});

test("an all-flying column, or one whose flyers lift every foot soldier, flies at its slowest flyer's pace over land and sea", () => {
  expect({
    // March doesn't speed a flyer.
    griffons: theMovePoolsOfAColumn(aColumnOf([{ type: 'Noble Griffons' }])),
    // An all-flying column's sea pace is its land pace.
    thunderbirds: theMovePoolsOfAColumn(aColumnOf([{ type: 'Thunderbirds' }])),
    griffonsAndThunderbirds: theMovePoolsOfAColumn(aColumnOf([{ type: 'Thunderbirds' }, { type: 'Noble Griffons' }])),
    // Griffons lift the Levies: the column flies at 5, not the Levies' 3.
    griffonsLiftingLevies: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Noble Griffons' }]),
    ),
    // The slowest flyer sets a lifted column's pace.
    griffonsAndThunderbirdsLiftingLevies: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Thunderbirds' }, { type: 'Shieldwall Levies' }, { type: 'Noble Griffons' }]),
    ),
    // Two Levies for one Griffon: the column walks, and can't take to the sea.
    griffonsShortOfLift: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Shieldwall Levies' }, { type: 'Noble Griffons' }]),
    ),
    // Thunderbirds fly but lift no one: the Levies stay on the ground.
    thunderbirdsAndLevies: theMovePoolsOfAColumn(aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Thunderbirds' }])),
    // A flyer the table doesn't price lifts the Levies at 3.
    anUnpricedFlyerLiftingLevies: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Eagle Riders' }]),
    ),
    griffonsLiftingLeviesSeawolf: theMovePoolsOfAColumn(
      aColumnOf([{ type: 'Shieldwall Levies' }, { type: 'Noble Griffons' }], { heHoldsSeawolf: true }),
    ),
  }).toEqual({
    griffons: { land: 5, sea: 5, seaActive: true },
    thunderbirds: { land: 6, sea: 6, seaActive: true },
    griffonsAndThunderbirds: { land: 5, sea: 5, seaActive: true },
    griffonsLiftingLevies: { land: 5, sea: 5, seaActive: true },
    griffonsAndThunderbirdsLiftingLevies: { land: 5, sea: 5, seaActive: true },
    griffonsShortOfLift: { land: 3, sea: 0, seaActive: false },
    thunderbirdsAndLevies: { land: 3, sea: 0, seaActive: false },
    anUnpricedFlyerLiftingLevies: { land: 3, sea: 3, seaActive: true },
    griffonsLiftingLeviesSeawolf: { land: 5, sea: 6, seaActive: true },
  });
});

test('a pool whose maximum changes keeps the points spent and gains only the rise, never above the new maximum nor below none', () => {
  expect({
    // A slower company joins after a march of 2 of 5: 3 left, cut to the new maximum of 2.
    aSlowerCompanyJoins: theMovePointsAPoolHasLeftOnceItsMaximumChanges(5, 3, 2),
    // A slower company joins before any march: 3 of 3, cut to 2.
    aSlowerCompanyJoinsFresh: theMovePointsAPoolHasLeftOnceItsMaximumChanges(3, 3, 2),
    // The slow company leaves after a march of 1 of 2: 1 left, raised by the rise of 2.
    theSlowCompanyLeaves: theMovePointsAPoolHasLeftOnceItsMaximumChanges(2, 1, 4),
    // A pool spent out stays at none when its maximum falls; it gains the rise when it climbs.
    spentOutAndFalling: theMovePointsAPoolHasLeftOnceItsMaximumChanges(4, 0, 2),
    spentOutAndRising: theMovePointsAPoolHasLeftOnceItsMaximumChanges(2, 0, 3),
    // No change: what was left stays.
    noChange: theMovePointsAPoolHasLeftOnceItsMaximumChanges(3, 2, 3),
    // A pool handed below none comes back at none.
    handedBelowNone: theMovePointsAPoolHasLeftOnceItsMaximumChanges(3, -2, 3),
  }).toEqual({
    aSlowerCompanyJoins: 2,
    aSlowerCompanyJoinsFresh: 2,
    theSlowCompanyLeaves: 3,
    spentOutAndFalling: 0,
    spentOutAndRising: 1,
    noChange: 2,
    handedBelowNone: 0,
  });
});

test('a step spends the sea pool to enter the sea or to land from it, and the land pool from land to land', () => {
  expect({
    putsToSea: theMovePoolAStepSpends('plains', 'sea'),
    sailsOn: theMovePoolAStepSpends('sea', 'sea'),
    landsOnACoast: theMovePoolAStepSpends('sea', 'forest'),
    marches: theMovePoolAStepSpends('plains', 'hills'),
  }).toEqual({ putsToSea: 'sea', sailsOn: 'sea', landsOnACoast: 'sea', marches: 'land' });
});
