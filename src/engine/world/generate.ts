import { type ARealmAsTheSetUpHandsIt } from './the-worlds-making/what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';
import { theSetUpTheMapsGridAndTheProvincesNames } from './the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts';
import { theCapitalsPlacedAsFarApartAsTheMapAllows } from './the-worlds-making/s01-the-capitals-placed-as-far-apart-as-the-map-allows.ts';
import { eachHomesRingTailoredAndTheSeasFillRates } from './the-worlds-making/s02-each-homes-ring-tailored-and-the-seas-fill-rates.ts';
import { everyProvinceMadeItsTerrainTaxArmiesAndLairs } from './the-worlds-making/s03-every-province-made-its-terrain-tax-armies-and-lairs.ts';
import { theRacesDealtToTheirHeartlandsInEqualShares } from './the-worlds-making/s04-the-races-dealt-to-their-heartlands-in-equal-shares.ts';
import { theCoastalFleetsAHumanoidShoreOffers } from './the-worlds-making/s05-the-coastal-fleets-a-humanoid-shore-offers.ts';
import { theSeasByKindPrimalPoorWatersAndOpenWater } from './the-worlds-making/s06-the-seas-by-kind-primal-poor-waters-and-open-water.ts';
import { theSeaFeaturesAndTheirGuardiansInEverySea } from './the-worlds-making/s07-the-sea-features-and-their-guardians-in-every-sea.ts';
import { aCoastalHomeBordersAnOpenWaterSea } from './the-worlds-making/s08-a-coastal-home-borders-an-open-water-sea.ts';
import { eachHomeTailoredAndItsKingAndHeroesMade } from './the-worlds-making/s09-each-home-tailored-and-its-king-and-heroes-made.ts';
import { theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome } from './the-worlds-making/s10-the-two-crowns-given-wild-country-within-two-provinces-of-home.ts';
import { theNeutralRacesRebalancedToWithinOneProvince } from './the-worlds-making/s11-the-neutral-races-rebalanced-to-within-one-province.ts';
import { everyLandProvinceLiftedToTheTaxFloor } from './the-worlds-making/s12-every-land-province-lifted-to-the-tax-floor.ts';
import { everyCoastalHumanoidProvinceOffersItsRacesFleet } from './the-worlds-making/s13-every-coastal-humanoid-province-offers-its-races-fleet.ts';
import { everyNeutralProvincesDefendersBroughtInsideItsTaxsBand } from './the-worlds-making/s14-every-neutral-provinces-defenders-brought-inside-its-taxs-band.ts';
import { everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits } from './the-worlds-making/s15-every-neutral-province-fields-the-strongest-mix-of-its-own-units.ts';
import { everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince } from './the-worlds-making/s16-every-neutral-province-gets-its-guard-hero-and-garreth-his-province.ts';
import { theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn } from './the-worlds-making/s17-the-world-named-its-realms-states-lairs-and-hit-points-set-and-handed-on.ts';

export {
  SEA_PCT_DEFAULT,
  SEA_PCT_MAX,
  SEA_PCT_MIN,
  normSeaPct,
} from './the-worlds-making/the-sea-share-the-gm-picks-from-the-least-to-the-most.ts';
export function generateNewGame(
  setupPlayers: readonly ARealmAsTheSetUpHandsIt[],
  sz: { readonly cols: number; readonly rows: number },
  maxTurns: number,
  genOpts: { readonly seaPct?: unknown } | null | undefined,
) {
  // S0 to S2 (B-06v), each in its own file (src/engine/world/the-worlds-making/): the set-up, the capitals, each home's ring
  const {
    cols,
    rows,
    provinces,
    seaPct,
    seaTarget,
    hasPaganPlayer,
    humanoidRaces,
    primalDefs,
    armiesByTerrainAndRace,
    featurePools,
    unitNamesByType,
    offEven,
    offOdd,
    cellIdRC,
    neighbourCells,
    cellDistRC,
    navalLevelOf,
    pickLand,
    nameAllProvinces,
  } = theSetUpTheMapsGridAndTheProvincesNames({ setupPlayers, sz, genOpts });
  const { homeCells, homeIdSet } = theCapitalsPlacedAsFarApartAsTheMapAllows({
    setupPlayers,
    cols,
    rows,
    cellIdRC,
    cellDistRC,
  });
  const { constraint, SEA_BASE_RATE, SEA_CLUSTER_RATE } = eachHomesRingTailoredAndTheSeasFillRates({
    setupPlayers,
    seaPct,
    seaTarget,
    homeCells,
    homeIdSet,
    neighbourCells,
    navalLevelOf,
    pickLand,
  });

  // S3 (B-06w), in its own file: every province made, its terrain, tax, armies and lairs
  everyProvinceMadeItsTerrainTaxArmiesAndLairs({
    cols,
    rows,
    provinces,
    seaPct,
    seaTarget,
    hasPaganPlayer,
    humanoidRaces,
    primalDefs,
    armiesByTerrainAndRace,
    featurePools,
    neighbourCells,
    pickLand,
    constraint,
    SEA_BASE_RATE,
    SEA_CLUSTER_RATE,
  });

  // S4 to S8 (B-06x), each in its own file: the races dealt to their heartlands, the coastal fleets, the seas by kind,
  // the sea features and their guardians, and the home's open-water sea
  theRacesDealtToTheirHeartlandsInEqualShares({ provinces, humanoidRaces });
  const { fleetsByRace, fleetTypes } = theCoastalFleetsAHumanoidShoreOffers({
    cols,
    rows,
    provinces,
    humanoidRaces,
    offEven,
    offOdd,
  });
  theSeasByKindPrimalPoorWatersAndOpenWater({ provinces, unitNamesByType });
  theSeaFeaturesAndTheirGuardiansInEverySea({ provinces });
  aCoastalHomeBordersAnOpenWaterSea({ homeCells, neighbourCells, provinces });

  // S9 (B-06y), in its own file: the colours dealt, then each home tailored and its king and two heroes made, one home
  // after the other
  const { playerStarts, allChars, creaturesByTerrain, monstersByTerrain, players } =
    eachHomeTailoredAndItsKingAndHeroesMade({
      setupPlayers,
      cols,
      rows,
      provinces,
      offEven,
      offOdd,
      primalDefs,
      armiesByTerrainAndRace,
      featurePools,
      homeCells,
    });

  // S10 to S15 (B-06z), each in its own file: wild country near the two crowns, the neutral races rebalanced, the tax
  // floor, the coastal shipyards, the defender band audit and the strongest neutral mix
  theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome({
    cols,
    rows,
    provinces,
    primalDefs,
    playerStarts,
    players,
    creaturesByTerrain,
    monstersByTerrain,
  });
  theNeutralRacesRebalancedToWithinOneProvince({ cols, rows, provinces, humanoidRaces, offEven, offOdd, playerStarts });
  everyLandProvinceLiftedToTheTaxFloor({ provinces });
  everyCoastalHumanoidProvinceOffersItsRacesFleet({
    provinces,
    humanoidRaces,
    neighbourCells,
    fleetsByRace,
    fleetTypes,
  });
  everyNeutralProvincesDefendersBroughtInsideItsTaxsBand({ provinces });
  everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits({ provinces });

  // S16 and S17 (B-06aa), each in its own file: the neutral heroes and Garreth's province, then the world named and
  // handed on (the naming pass, the turn orders, the state, the mithril, the lairs' grades, names and hoards, the HP)
  everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince({ provinces, allChars });
  return theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn({
    sz,
    maxTurns,
    cols,
    rows,
    provinces,
    seaPct,
    nameAllProvinces,
    players,
    allChars,
  });
}
