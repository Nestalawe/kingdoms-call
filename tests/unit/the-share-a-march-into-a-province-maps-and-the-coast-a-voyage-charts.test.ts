// The share a march maps on plain values (plan P1-11e6 moved it out of the turn's Move order, so the order form's
// Explore note can ask the same rules): every march into a province maps 10% of it, and 5% a level of the marcher's
// Explorer as the turn counts it, and the share his worn items add, and at March 6 or more 2% a company he leads; a
// realm's share of a province stops at 100%. A hero who sails into a sea at Naval 6 or more, leading ships, charts 5%
// of each land province beside it.
//
// Level 1 (unit): theShareOfAProvinceAMarchIntoItMaps, theShareOfAProvinceMappedOnceAShareIsAdded,
// theShareAVoyageChartsOfEachCoastBesideTheSea and aProvinceBesideTheSeaIsACoastAVoyageCharts
// (src/engine/rules-on-plain-values/the-share-a-march-into-a-province-maps-and-the-coast-a-voyage-charts.ts) called
// on the values the Move order hands them. A lower level can't run a function. The matrix reaches the march in, but a
// fault planted in a shared function moves every caller at once, so these cases pin each factor's value: each figure
// below differs from what a fault in one factor would give.
import { expect, test } from 'vitest';
import {
  aProvinceBesideTheSeaIsACoastAVoyageCharts,
  theShareAVoyageChartsOfEachCoastBesideTheSea,
  theShareOfAProvinceAMarchIntoItMaps,
  theShareOfAProvinceMappedOnceAShareIsAdded,
} from '../../src/engine/rules-on-plain-values/the-share-a-march-into-a-province-maps-and-the-coast-a-voyage-charts.ts';

test("a march in maps 10%, 5% an Explorer level, his worn items' share, and 2% a company he leads at March 6", () => {
  expect({
    explorer0Alone: theShareOfAProvinceAMarchIntoItMaps(0, 0, false, 0),
    explorer3: theShareOfAProvinceAMarchIntoItMaps(3, 0, false, 0),
    // The level is counted as the turn hands it (effStat), with no cap of its own.
    explorer7: theShareOfAProvinceAMarchIntoItMaps(7, 0, false, 0),
    aTravellersCloakWorn: theShareOfAProvinceAMarchIntoItMaps(0, 20, false, 0),
    march6LeadingThree: theShareOfAProvinceAMarchIntoItMaps(0, 0, true, 3),
    march6Alone: theShareOfAProvinceAMarchIntoItMaps(0, 0, true, 0),
    belowMarch6LeadingThree: theShareOfAProvinceAMarchIntoItMaps(0, 0, false, 3),
    everyFactor: theShareOfAProvinceAMarchIntoItMaps(2, 20, true, 4),
  }).toEqual({
    explorer0Alone: 10,
    explorer3: 25,
    explorer7: 45,
    aTravellersCloakWorn: 30,
    march6LeadingThree: 16,
    march6Alone: 10,
    belowMarch6LeadingThree: 10,
    everyFactor: 48,
  });
});

test("a realm's share of a province grows by the share added, and stops at 100%", () => {
  expect({
    fromNothing: theShareOfAProvinceMappedOnceAShareIsAdded(0, 25),
    fromForty: theShareOfAProvinceMappedOnceAShareIsAdded(40, 25),
    toExactly100: theShareOfAProvinceMappedOnceAShareIsAdded(95, 5),
    past100: theShareOfAProvinceMappedOnceAShareIsAdded(90, 25),
    whollyMappedAlready: theShareOfAProvinceMappedOnceAShareIsAdded(100, 5),
  }).toEqual({ fromNothing: 25, fromForty: 65, toExactly100: 100, past100: 100, whollyMappedAlready: 100 });
});

test('Naval 6 charts 5% of each land province beside a sea he sails into leading ships, and none else', () => {
  expect({
    aSeaAtNaval6LeadingShips: theShareAVoyageChartsOfEachCoastBesideTheSea('sea', true, true),
    aSeaBelowNaval6: theShareAVoyageChartsOfEachCoastBesideTheSea('sea', false, true),
    aSeaLeadingNoShips: theShareAVoyageChartsOfEachCoastBesideTheSea('sea', true, false),
    aPlainAtNaval6LeadingShips: theShareAVoyageChartsOfEachCoastBesideTheSea('plain', true, true),
  }).toEqual({ aSeaAtNaval6LeadingShips: 5, aSeaBelowNaval6: 0, aSeaLeadingNoShips: 0, aPlainAtNaval6LeadingShips: 0 });
  expect({
    aPlain: aProvinceBesideTheSeaIsACoastAVoyageCharts('plain'),
    aMountain: aProvinceBesideTheSeaIsACoastAVoyageCharts('mountain'),
    anotherSea: aProvinceBesideTheSeaIsACoastAVoyageCharts('sea'),
  }).toEqual({ aPlain: true, aMountain: true, anotherSea: false });
});
