import { KC_A_HEROS_WAGE_IN_SERVICE } from '../../content/kingdoms-call-data.ts';
import { THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER } from '../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { THE_NEUTRAL_HEROES } from '../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../rng.ts';
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from '../saves/the-saved-games-version-this-build-writes.ts';
import { RACES_P, TEMPERS_P } from './tables.ts';
import { theWageOfAHeroInService } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import {
  theSkillAWandererOfTheAlignmentIsSureOf,
  theWanderingHeroesDeckOfAlignments,
} from '../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { ABILITIES_P, shuffleP } from '../battle/fortune.ts';
import { nextHeroName, renameLairsThematicP } from '../names.ts';
import { ITEMS_BY_TIER } from '../items/tiers-and-hoards.ts';
import { ensureAllLairHoards } from '../items/lair-items.ts';
import { GUARDIAN_TABLE_VER, computeMaxHp, maxHpPlayers } from '../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../personal-combat/helpers.ts';
import { rP } from '../units/drill-and-spoils.ts';
import { assignLairGrades } from '../chances-and-lair-grades.ts';
import {
  type AHeroAsTheWorldMakesHim,
  type ARealmAsTheSetUpHandsIt,
  theCardDealt,
  theOneMadeSure,
} from './the-worlds-making/what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';
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

  // Neutral heroes — one per non-home land province, and per sea province that has defenders,
  // leading the province's neutral armies (so sea provinces actually fight when entered) neutral
  // heroes now start with a spread of skills (INCLUDING magic schools) so they are more useful —
  // one skill at level 2 and one at level 1, dealt round-robin from NEUTRAL_SKILL_POOL so the
  // skills are spread evenly across the whole neutral-hero population rather than clustered.
  // the order is the tie-break (content's row says why)
  const NEUTRAL_SKILL_POOL = THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER;
  // neutral-hero traits are DEALT FROM RESHUFFLED DECKS rather than rolled. The old round-robin
  // cursor spread skills evenly but in province-id order, so the same skill recurred in a fixed
  // stride down the map; alignment/race/temper were independent rolls, which on a normal map easily
  // produced runs of identical results. A deck guarantees the intended proportions over every pass
  // and a fresh random ORDER each pass.
  const _mkDeck = <Card>(cards: readonly Card[]) => {
    let d: Card[] = [];
    return () => {
      if (!d.length) d = shuffleP(cards);
      return theCardDealt(d.pop());
    };
  };
  const _dealPrimary = _mkDeck(NEUTRAL_SKILL_POOL);
  const _dealSecondary = _mkDeck(NEUTRAL_SKILL_POOL);
  // Alignment mix: Divine/Undead 5%, Good/Evil 10%, Druidic/Pagan 20%, Neutral 30% — encoded as a
  // 20-card deck (1/2/4/6/4/2/1) so every 20 neutral heroes hit the mix exactly (the ladder's column: P1-19ay1).
  const _dealAlign = _mkDeck(theWanderingHeroesDeckOfAlignments());
  const _dealRace = _mkDeck(RACES_P);
  const _dealTemper = _mkDeck(TEMPERS_P.slice(0, THE_NEUTRAL_HEROES.theTempersOneIsDealtFrom));
  // ── SECRET Easter egg: reserve Garreth the Independent and pick which neutral LAND province he
  // guards. Reserving his name parts BEFORE the loop keeps "Garreth"/"the Independent" out of every
  // other hero's draw (item: unique names). He is otherwise an ordinary neutral guard.
  const _garrethLandProvs = provinces.filter(
    (p) => p.owner === null && p.terrain !== 'sea' && p.neutralDefenders.length > 0,
  );
  const _garrethPool = _garrethLandProvs.length
    ? _garrethLandProvs
    : provinces.filter((p) => p.owner === null && p.neutralDefenders.length > 0);
  const _garrethProvId = _garrethPool.length
    ? theOneMadeSure(_garrethPool[Math.floor(kcRng() * _garrethPool.length)]).id
    : null; // name reserved at top of generateNewGame
  provinces
    .filter((p) => p.owner === null && (p.terrain !== 'sea' || p.neutralDefenders.length > 0))
    .forEach((lp) => {
      const hid = allChars.length;
      // a neutral hero is a PERSON — their race is always humanoid, even when they guard a sea or
      // primal (Creature/Monster) province. The monster class belongs to the ARMIES they lead, never
      // to the hero.
      const hrace = _dealRace();
      const hSkills: Partial<Record<string, number>> = {};
      // Item 7 / deal one level-2 skill and one level-1 skill from two independent reshuffled decks,
      // so across all neutral heroes every skill appears equally often as the L2 pick and as the L1
      // pick, with no positional pattern. Magic schools are in the pool, so some neutral heroes can
      // cast.
      const _primary = _dealPrimary();
      let _secondary = _dealSecondary();
      if (_secondary === _primary) {
        const _alt = _dealSecondary();
        if (_alt !== _primary) _secondary = _alt;
        else
          _secondary = theOneMadeSure(
            NEUTRAL_SKILL_POOL[(NEUTRAL_SKILL_POOL.indexOf(_primary) + 1) % NEUTRAL_SKILL_POOL.length],
          );
      }
      hSkills[_primary] = THE_NEUTRAL_HEROES.theLevelOfTheFirstSkill;
      hSkills[_secondary] = (hSkills[_secondary] ?? 0) + 1;
      // Druidic neutral heroes are guaranteed the Druid skill (needed to lead primal armies without
      // penalty); if the deal didn't already give it, fold it into the level-1 slot.
      let wAlign = _dealAlign();
      const _wanderersSkill = theSkillAWandererOfTheAlignmentIsSureOf(wAlign);
      if (_wanderersSkill !== undefined && !hSkills[_wanderersSkill]) hSkills[_wanderersSkill] = 1;
      const _isGarreth = lp.id === _garrethProvId;
      if (_isGarreth) wAlign = 'Neutral'; // Garreth/the Independent are Neutral-pool names — keep it consistent
      const baseName = _isGarreth ? 'Garreth the Independent' : nextHeroName(wAlign);
      const h: AHeroAsTheWorldMakesHim = {
        id: hid,
        name: baseName,
        isKing: false,
        player: null,
        _unkillable: _isGarreth, // SECRET: never dies (see _escapesTheEnd / handleHeroDeath)
        race: hrace,
        alignment: wAlign,
        temper: _dealTemper(),
        hp: THE_NEUTRAL_HEROES.theHpOneIsMadeWith,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        // Neutral heroes carry the province's neutral armies
        armies: [...lp.neutralDefenders],
        items: [],
        location: lp.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: lp.name,
        _isNeutralGuard: true, // flag: currently defending their home province
        // NOTE: no encounterPlan here on purpose. autoEncounterPlan/ensureEncounterPlan live inside
        // runTurn's scope and are NOT reachable from generateNewGame — calling them here throws a
        // ReferenceError and world generation dies. NPC plans are built lazily at combat time.
      };
      h.maxHp = h.hp;
      ABILITIES_P.forEach((ab) => {
        h.aptitude[ab] = rP(THE_NEUTRAL_HEROES.eachAptitude.theLeast, THE_NEUTRAL_HEROES.eachAptitude.theMost);
      });
      h.pay = theWageOfAHeroInService(KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired, h); // wandering default; the hire desk quotes alignment + skill premium
      allChars.push(h);
      lp.characters.push(hid);
      // Province still keeps neutralDefenders for backward-compat intel display, but armies actually
      // live on the hero now
    });

  // ── THEMATIC NAMING PASS ── Every province now has its final terrain, race and army pool
  // (including king home provinces), so name them all thematically here, then point each
  // character's stored location name at the freshly-named province they occupy.
  nameAllProvinces();
  allChars.forEach((c) => {
    const pv = provinces[c.location];
    if (pv) c.locationName = pv.name;
  });

  // Build turnOrders
  const turnOrders: Partial<Record<number, null[]>> = {};
  allChars
    .filter((c) => c.player !== null && c.alive)
    .forEach((c) => {
      turnOrders[c.id] = [null, null, null, null, null];
    });

  const _newGameState = {
    world: { provinces, cols, rows, seaPct },
    players,
    characters: allChars,
    mercenaries: [],
    // ── Diplomacy (KC alliance system) ── relations between players, keyed "minIdx-maxIdx" →
    // 'enemy' | 'allied'. Any pair absent from the map is NEUTRAL (the default). All players begin
    // Neutral to one another; relations only change at end of turn via mutual Treat / a war
    // declaration.
    relations: {},
    heroGraveyard: [],
    turn: 1,
    phase: 0,
    maxTurns,
    log: [],
    turnOrders,
    nextItemId: 0,
    _awardedItems: [],
  };
  grantMithrilToDwarves(_newGameState); // dwarf characters of a dwarf realm start suited in mithril
  // re-grade every lair before the hoards are stocked - always 22 legendary lairs, spread across
  // the world, with the weak country gathered around the homes.
  assignLairGrades(
    provinces,
    players.map((pl) => pl.homeProvinceId),
    sz.cols,
    sz.rows,
    ITEMS_BY_TIER[4].length,
  );
  // name every lair AFTER its guardian is settled, from that guardian's own pools, and uniquely
  // across the world. Must run after assignLairGrades, which re-draws the guardians.
  renameLairsThematicP(_newGameState);
  ensureAllLairHoards(_newGameState); // every lair's gold and magic decided now
  // 2026-09-10 revert: earned HP — every starting character opens with an empty pool (15 HP; 18 for
  // an Orc of an Orcish realm), at full health.
  maxHpPlayers.players = players;
  allChars.forEach((c) => {
    c.hpEarned = 0;
    c.maxHp = computeMaxHp(c, players);
    c.hp = c.maxHp;
  });
  // the save's marks, then the save's shape as this build writes it (P1-15c), on the same object in the same order
  return Object.assign(_newGameState, {
    _maxHpV2: true,
    _maxHpV3: true,
    _guardiansV2: true,
    _guardiansVer: GUARDIAN_TABLE_VER,
    schemaVersion: THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES,
  });
}
