// The world's making's stages, S0 to S17, in the order generateNewGame (src/engine/world/generate.ts) runs them: the
// one home of their order, their ids and their names in game terms (the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md). generate.ts takes each stage's
// function from this list, under the function's own name, and generateNewGame calls them in its order, threading what
// one stage makes to the next (the stages read and make different things, so each call names what its stage reads);
// tests/unit/the-world-is-made-by-the-stages-its-list-holds-each-once-in-the-lists-order.test.ts fails when the two
// part (a stage dropped, added or moved). The world proof's stage table (tools/proof/the-worlds-makings-stages.ts) and
// the world-making counts' list (tools/ratchet.ts) read their stages from this list's text
// (tools/the-worlds-makings-stages-read-from-their-list-in-src.ts).
import { theSetUpTheMapsGridAndTheProvincesNames } from './s00-the-set-up-the-maps-grid-and-the-provinces-names.ts';
import { theCapitalsPlacedAsFarApartAsTheMapAllows } from './s01-the-capitals-placed-as-far-apart-as-the-map-allows.ts';
import { eachHomesRingTailoredAndTheSeasFillRates } from './s02-each-homes-ring-tailored-and-the-seas-fill-rates.ts';
import { everyProvinceMadeItsTerrainTaxArmiesAndLairs } from './s03-every-province-made-its-terrain-tax-armies-and-lairs.ts';
import { theRacesDealtToTheirHeartlandsInEqualShares } from './s04-the-races-dealt-to-their-heartlands-in-equal-shares.ts';
import { theCoastalFleetsAHumanoidShoreOffers } from './s05-the-coastal-fleets-a-humanoid-shore-offers.ts';
import { theSeasByKindPrimalPoorWatersAndOpenWater } from './s06-the-seas-by-kind-primal-poor-waters-and-open-water.ts';
import { theSeaFeaturesAndTheirGuardiansInEverySea } from './s07-the-sea-features-and-their-guardians-in-every-sea.ts';
import { aCoastalHomeBordersAnOpenWaterSea } from './s08-a-coastal-home-borders-an-open-water-sea.ts';
import { eachHomeTailoredAndItsKingAndHeroesMade } from './s09-each-home-tailored-and-its-king-and-heroes-made.ts';
import { theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome } from './s10-the-two-crowns-given-wild-country-within-two-provinces-of-home.ts';
import { theNeutralRacesRebalancedToWithinOneProvince } from './s11-the-neutral-races-rebalanced-to-within-one-province.ts';
import { everyLandProvinceLiftedToTheTaxFloor } from './s12-every-land-province-lifted-to-the-tax-floor.ts';
import { everyCoastalHumanoidProvinceOffersItsRacesFleet } from './s13-every-coastal-humanoid-province-offers-its-races-fleet.ts';
import { everyNeutralProvincesDefendersBroughtInsideItsTaxsBand } from './s14-every-neutral-provinces-defenders-brought-inside-its-taxs-band.ts';
import { everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits } from './s15-every-neutral-province-fields-the-strongest-mix-of-its-own-units.ts';
import { everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince } from './s16-every-neutral-province-gets-its-guard-hero-and-garreth-his-province.ts';
import { theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn } from './s17-the-world-named-its-realms-states-lairs-and-hit-points-set-and-handed-on.ts';

/** A stage of the world's making as the list holds it: its id (S0 to S17), what it makes in game terms, and its
 *  function, which takes the typed object of what the stage reads (its own `What…Reads`). */
export interface AStageOfTheWorldsMakingInItsList {
  readonly stage: `S${number}`;
  readonly inGameTerms: string;
  readonly run: (whatTheStageReads: never) => unknown;
}

/** The stages, in the order generateNewGame runs them. Each entry keeps its function's own type. */
export const THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN = [
  {
    stage: 'S0',
    inGameTerms: "the set-up: the map's grid, the content the making reads, and the provinces' names",
    run: theSetUpTheMapsGridAndTheProvincesNames,
  },
  {
    stage: 'S1',
    inGameTerms: 'the capitals, placed as far apart as the map allows',
    run: theCapitalsPlacedAsFarApartAsTheMapAllows,
  },
  {
    stage: 'S2',
    inGameTerms: "each home's ring tailored, and how fast the seas fill",
    run: eachHomesRingTailoredAndTheSeasFillRates,
  },
  {
    stage: 'S3',
    inGameTerms: 'every province made: its terrain, tax, armies, features, lairs and ritual sites',
    run: everyProvinceMadeItsTerrainTaxArmiesAndLairs,
  },
  {
    stage: 'S4',
    inGameTerms: 'the races dealt to their heartlands, in equal shares',
    run: theRacesDealtToTheirHeartlandsInEqualShares,
  },
  { stage: 'S5', inGameTerms: 'the coastal fleets a humanoid shore offers', run: theCoastalFleetsAHumanoidShoreOffers },
  {
    stage: 'S6',
    inGameTerms: 'the seas by kind: primal seas, poor waters and open water',
    run: theSeasByKindPrimalPoorWatersAndOpenWater,
  },
  {
    stage: 'S7',
    inGameTerms: 'the sea features and their guardians, in every sea',
    run: theSeaFeaturesAndTheirGuardiansInEverySea,
  },
  { stage: 'S8', inGameTerms: 'a coastal home borders an open-water sea', run: aCoastalHomeBordersAnOpenWaterSea },
  {
    stage: 'S9',
    inGameTerms:
      "the realms' colours, then each home tailored and its king and two heroes made, one home after another",
    run: eachHomeTailoredAndItsKingAndHeroesMade,
  },
  {
    stage: 'S10',
    inGameTerms: 'the two crowns given wild country within two provinces of home',
    run: theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome,
  },
  {
    stage: 'S11',
    inGameTerms: 'the neutral races rebalanced, to within one province',
    run: theNeutralRacesRebalancedToWithinOneProvince,
  },
  {
    stage: 'S12',
    inGameTerms: 'every land province lifted to the tax floor',
    run: everyLandProvinceLiftedToTheTaxFloor,
  },
  {
    stage: 'S13',
    inGameTerms: "the coastal shipyards: every coastal humanoid province offers its race's fleet",
    run: everyCoastalHumanoidProvinceOffersItsRacesFleet,
  },
  {
    stage: 'S14',
    inGameTerms: "every neutral province's defenders brought inside its tax's band",
    run: everyNeutralProvincesDefendersBroughtInsideItsTaxsBand,
  },
  {
    stage: 'S15',
    inGameTerms: 'every neutral province fields the strongest mix of its own units',
    run: everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits,
  },
  {
    stage: 'S16',
    inGameTerms: 'every neutral province gets its guard hero, and Garreth his province',
    run: everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince,
  },
  {
    stage: 'S17',
    inGameTerms:
      "the world named, its turn orders, the game's state, the dwarves' mithril, the lairs graded, named and stocked, and every hero's hit points",
    run: theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn,
  },
] as const satisfies readonly AStageOfTheWorldsMakingInItsList[];
