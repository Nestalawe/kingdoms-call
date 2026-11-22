import { type ARealmAsTheSetUpHandsIt } from './the-worlds-making/what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';
import { THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN } from './the-worlds-making/the-stages-in-the-order-they-run.ts';

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
  // The stages' functions, S0 to S17, from their list (the one home of their order and their names), read as the world
  // is made, not as the module loads (the list's file imports every stage's): each name must be its entry's function's,
  // in the list's order, and each is called once in that order
  // (tests/unit/the-world-is-made-by-the-stages-its-list-holds-each-once-in-the-lists-order.test.ts).
  const [
    { run: theSetUpTheMapsGridAndTheProvincesNames },
    { run: theCapitalsPlacedAsFarApartAsTheMapAllows },
    { run: eachHomesRingTailoredAndTheSeasFillRates },
    { run: everyProvinceMadeItsTerrainTaxArmiesAndLairs },
    { run: theRacesDealtToTheirHeartlandsInEqualShares },
    { run: theCoastalFleetsAHumanoidShoreOffers },
    { run: theSeasByKindPrimalPoorWatersAndOpenWater },
    { run: theSeaFeaturesAndTheirGuardiansInEverySea },
    { run: aCoastalHomeBordersAnOpenWaterSea },
    { run: eachHomeTailoredAndItsKingAndHeroesMade },
    { run: theTwoCrownsGivenWildCountryWithinTwoProvincesOfHome },
    { run: theNeutralRacesRebalancedToWithinOneProvince },
    { run: everyLandProvinceLiftedToTheTaxFloor },
    { run: everyCoastalHumanoidProvinceOffersItsRacesFleet },
    { run: everyNeutralProvincesDefendersBroughtInsideItsTaxsBand },
    { run: everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits },
    { run: everyNeutralProvinceGetsItsGuardHeroAndGarrethHisProvince },
    { run: theWorldNamedItsRealmsStatesLairsAndHitPointsSetAndHandedOn },
  ] = THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN;
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
