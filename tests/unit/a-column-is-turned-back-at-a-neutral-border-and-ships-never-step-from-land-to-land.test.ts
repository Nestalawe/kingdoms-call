// The march's two refusals, on plain values (plan P1-11e4 moved them out of the Move order so the order form's
// forecast can ask the same rules): a hero who leads companies is turned back at the border of a realm his own is merely
// neutral with (a lone hero, an ally's land, an enemy's, unowned ground and his own realm's are open), and a column that
// leads ships never steps from one land province to another (it may put to sea, and land from it).
//
// Level 1 (unit): aColumnIsTurnedBackAtANeutralRealmsBorder and aColumnLeadingShipsMayNotStepFromLandToLand
// (src/engine/rules-on-plain-values/where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts)
// called on the values the turn hands them. A lower level can't run a function. The matrix's games reach the border's
// refusal, but no game stages a lone hero at a neutral border, and a fault planted in the shared function moves the
// Move order and any caller at once, so these cases pin its values.
import { expect, test } from 'vitest';
import {
  aColumnIsTurnedBackAtANeutralRealmsBorder,
  aColumnLeadingShipsMayNotStepFromLandToLand,
} from '../../src/engine/rules-on-plain-values/where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';

// The hero is of realm 0; realm 1 holds the province he marches into, unless the case says otherwise.
test("a column of companies is turned back at a neutral realm's border; a lone hero, an ally, a war, unowned ground and his own land are open", () => {
  expect(
    {
      twoCompaniesIntoANeutralRealm: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 1, 2, 'neutral'),
      aLoneHeroIntoANeutralRealm: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 1, 0, 'neutral'),
      twoCompaniesIntoAnAlly: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 1, 2, 'allied'),
      twoCompaniesIntoAnEnemyAtWar: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 1, 2, 'enemy'),
      // The turn hands 'neutral' for a province nobody holds (relationBetween with no owner).
      twoCompaniesIntoUnownedGround: aColumnIsTurnedBackAtANeutralRealmsBorder(0, null, 2, 'neutral'),
      twoCompaniesIntoUnownedGroundUndefined: aColumnIsTurnedBackAtANeutralRealmsBorder(0, undefined, 2, 'neutral'),
      // The turn hands 'self' for his own realm; his own land stays open whatever relation a caller reads for it.
      twoCompaniesIntoHisOwnLand: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 0, 2, 'self'),
      twoCompaniesIntoHisOwnLandReadAsNeutral: aColumnIsTurnedBackAtANeutralRealmsBorder(0, 0, 2, 'neutral'),
    },
    'only companies into a neutral realm are turned back',
  ).toEqual({
    twoCompaniesIntoANeutralRealm: true,
    aLoneHeroIntoANeutralRealm: false,
    twoCompaniesIntoAnAlly: false,
    twoCompaniesIntoAnEnemyAtWar: false,
    twoCompaniesIntoUnownedGround: false,
    twoCompaniesIntoUnownedGroundUndefined: false,
    twoCompaniesIntoHisOwnLand: false,
    twoCompaniesIntoHisOwnLandReadAsNeutral: false,
  });
});

test('a column that leads ships may not step from land to land; it may put to sea and land from it, and foot alone may march', () => {
  expect(
    {
      shipsFromPlainToForest: aColumnLeadingShipsMayNotStepFromLandToLand(true, 'plain', 'forest'),
      shipsFromPlainOutToSea: aColumnLeadingShipsMayNotStepFromLandToLand(true, 'plain', 'sea'),
      shipsFromTheSeaOntoAPlain: aColumnLeadingShipsMayNotStepFromLandToLand(true, 'sea', 'plain'),
      shipsFromSeaToSea: aColumnLeadingShipsMayNotStepFromLandToLand(true, 'sea', 'sea'),
      footFromPlainToForest: aColumnLeadingShipsMayNotStepFromLandToLand(false, 'plain', 'forest'),
    },
    'ships never cross land',
  ).toEqual({
    shipsFromPlainToForest: true,
    shipsFromPlainOutToSea: false,
    shipsFromTheSeaOntoAPlain: false,
    shipsFromSeaToSea: false,
    footFromPlainToForest: false,
  });
});
