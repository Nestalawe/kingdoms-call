import {
  KC_A_HEROS_WAGE_IN_SERVICE,
  KC_HUMANOID_RACES,
  KC_RIVAL_RACE,
  KC_THE_POOR_SEAS_BEASTS_DEALT_TURN_ABOUT_WITH_THEIR_RACE_TAGS,
  KC_UNIT_CLASS,
  MONSTERS_P,
} from '../../content/kingdoms-call-data.ts';
import {
  THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST,
  THE_NEUTRAL_HEROES_SKILLS_IN_THEIR_TIE_BREAK_ORDER,
  THE_SEA_BEASTS_A_HOMES_WEAK_LAIR_LEAVES_OUT,
  THE_SEA_FEATURES_NAMES,
  THE_WILD_CREATURES_BY_TERRAIN,
  THE_WILD_MONSTERS_BY_TERRAIN,
} from '../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import {
  A_KING_AND_HIS_HEROES,
  EACH_PROVINCE,
  THE_HOMES,
  THE_NEUTRAL_HEROES,
  THE_SEAS_BY_KIND,
  THE_SEA_FEATURES_AND_THEIR_GUARDIANS,
  THE_STRONGEST_NEUTRAL_MIX,
  THE_TAX_BANDS,
  THE_TAX_FLOOR,
  THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS,
} from '../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../rng.ts';
import { UNIT_Q_MULT } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { HOME_FLEET_BY_RACE } from '../grand-design.ts';
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from '../saves/the-saved-games-version-this-build-writes.ts';
import {
  COASTAL_NAVAL_CHANCE,
  HUMANOID_FLEET_TYPES,
  PRIMAL_LAND_CHANCE,
  RACES_P,
  SEA_TYPES_GEN,
  SIGNATURE_TERRAIN_P,
  SIGNATURE_WEIGHT_P,
  TEMPERS_P,
  buildHumanoidPool,
  fullRaceLandRoster,
  provincePoolSize,
} from './tables.ts';
import { getDruidLevel } from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  ALIGNMENTS_P,
  theWageOfAHeroInService,
} from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { THE_LADDER_OF_THE_ALIGNMENTS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  doesACapitalOfTheAlignmentOpenBesideCreatures,
  doesACapitalOfTheAlignmentOpenBesideMonsters,
  doesACapitalOfTheAlignmentOpenBesideTheRitualStones,
  doesAKingOfTheAlignmentStartWithASkeletalCompany,
  theSkillAKingOfTheAlignmentStartsWith,
  theSkillAWandererOfTheAlignmentIsSureOf,
  theWanderingHeroesDeckOfAlignments,
} from '../rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';
import { ABILITIES_P, shuffleP } from '../battle/fortune.ts';
import { SEA_GUARDIAN_NAMES, nextHeroName, renameLairsThematicP } from '../names.ts';
import {
  FEATURE_POOLS_P,
  ITEMS_BY_TIER,
  RITUAL_SITE_CHANCE_HUMANOID,
  RITUAL_SITE_NAMES,
} from '../items/tiers-and-hoards.ts';
import { ensureAllLairHoards } from '../items/lair-items.ts';
import { discoverFeat } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { GUARDIAN_TABLE_VER, computeMaxHp, maxHpPlayers } from '../heroes/skills-and-hp.ts';
import { grantMithrilToDwarves } from '../personal-combat/helpers.ts';
import { bestNeutralMix, neutralDefCount, rP, resyncNeutralDefenders } from '../units/drill-and-spoils.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { REALM_COLOURS, REALM_COLOUR_FALLBACK } from '../bots/intel.ts';
import { getNeighborsP } from './map-helpers.ts';
import { LAIR_TIER_ROLL, assignLairGrades } from '../chances-and-lair-grades.ts';
import type { Army, Item, ProvinceFeature } from '../../schemas/saved-game-state.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  type ARealmAsTheSetUpHandsIt,
  type ATerrainOfTheMaking,
  theCardDealt,
  theOneMadeSure,
} from './the-worlds-making/what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';
import { theSetUpTheMapsGridAndTheProvincesNames } from './the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts';
import { theCapitalsPlacedAsFarApartAsTheMapAllows } from './the-worlds-making/s01-the-capitals-placed-as-far-apart-as-the-map-allows.ts';
import { eachHomesRingTailoredAndTheSeasFillRates } from './the-worlds-making/s02-each-homes-ring-tailored-and-the-seas-fill-rates.ts';

/** A hero as the world's making builds him: a king's name and temper as the setup gave them (either may be
 *  missing), his wage set after his birth for the heroes but the king, his province's name `null` until the naming
 *  pass, his skills and aptitudes by any skill's name. */
interface AHeroAsTheWorldMakesHim {
  id: number;
  name: string | undefined;
  isKing: boolean;
  player: number | null;
  _unkillable?: boolean | undefined;
  race: string | undefined;
  alignment: string | undefined;
  temper: string | undefined;
  hp: number;
  maxHp: number;
  skills: Partial<Record<string, number>>;
  aptitude: Partial<Record<string, number>>;
  armies: Army[];
  items: Item[];
  location: number;
  alive: boolean;
  merits: number;
  taxBonus: number;
  pay?: number | undefined;
  spellsUsedThisTurn: unknown[];
  locationName: string | null;
  _isNeutralGuard?: boolean | undefined;
  startingHero?: boolean | undefined;
  hpEarned?: number | undefined;
}
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

  // ── PHASE 3: generate every province ── Primal land provinces split evenly Creature / Monster.
  // We alternate deterministically (rather than a per-province coin-flip) so the count comes out
  // exactly half-and-half; parity is seeded randomly so it isn't always Creature-first. "Primal"
  // stays the internal umbrella — players only ever see the Creature / Monster label (see
  // formatRace / primalClass in the player portal).
  let _primalCreatureNext = kcRng() < EACH_PROVINCE.theChanceTheFirstWildLandIsTheCreatures;
  // Non-primal land provinces are split EXACTLY equally between the four humanoid races. A plain
  // per-province random draw drifted several provinces off even on a normal map, which visibly
  // favoured one race's units. Instead we deal from a repeatedly-reshuffled four-card deck: within
  // every block of four humanoid provinces each race appears once, so the totals can never differ
  // by more than the length of the final partial block.
  let _raceDeck: string[] = [];
  // Provisional race, replaced wholesale by the terrain-weighted allocation pass below. The pass
  // needs every province's terrain decided first, so the loop cannot make the final call itself.
  const nextHumanoidRace = () => {
    if (_raceDeck.length === 0) _raceDeck = shuffleP(RACES_P);
    return theCardDealt(_raceDeck.pop());
  };
  // ── TERRAIN PRE-PASS: every cell's terrain is decided here, BEFORE the province loop, so the sea
  // share can be corrected to the exact target while nothing (tax, race, features) yet depends on it.
  // 1. Tailored cells take their Phase-2 terrain. 2. Free cells: the clustered fill — sea at the base
  // rate, or the cluster rate when the cell to the left or above is already water, so seas form
  // coherent lakes and coastlines rather than scattered hexes. 3. Grow or shrink the coasts among
  // FREE cells only until the sea count equals round(share × cells): too little water → a random
  // land cell touching sea becomes sea (a fresh lake is seeded only if no coast exists); too much →
  // a random sea cell touching land becomes land. Coherence survives because every change is made
  // at an existing shoreline.
  const terrainGrid = new Array<ATerrainOfTheMaking>(rows * cols);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;
      const con = constraint[id];
      if (con) {
        terrainGrid[id] = con.terrain;
        continue;
      }
      const leftSea = col > 0 && terrainGrid[row * cols + (col - 1)] === 'sea';
      const upSea = row > 0 && terrainGrid[(row - 1) * cols + col] === 'sea';
      terrainGrid[id] = kcRng() < (leftSea || upSea ? SEA_CLUSTER_RATE : SEA_BASE_RATE) ? 'sea' : pickLand();
    }
  }
  {
    const freeIds: number[] = [];
    for (let id = 0; id < rows * cols; id++) if (!constraint[id]) freeIds.push(id);
    const nbrIds = (id: number) => neighbourCells(Math.floor(id / cols), id % cols).map((n) => n.id);
    const seaCount = () => terrainGrid.filter((t) => t === 'sea').length;
    const want = Math.round(seaTarget * rows * cols);
    let guard = 0;
    while (seaCount() < want && guard++ < rows * cols * 4) {
      let pool = freeIds.filter((id) => terrainGrid[id] !== 'sea' && nbrIds(id).some((n) => terrainGrid[n] === 'sea'));
      if (!pool.length) pool = freeIds.filter((id) => terrainGrid[id] !== 'sea'); // no shoreline at all: seed a lake
      if (!pool.length) break; // every free cell is already water
      terrainGrid[theOneMadeSure(pool[Math.floor(kcRng() * pool.length)])] = 'sea';
    }
    guard = 0;
    while (seaCount() > want && guard++ < rows * cols * 4) {
      let pool = freeIds.filter((id) => terrainGrid[id] === 'sea' && nbrIds(id).some((n) => terrainGrid[n] !== 'sea'));
      if (!pool.length) pool = freeIds.filter((id) => terrainGrid[id] === 'sea');
      if (!pool.length) break; // only tailored sea is left (a naval king's harbour)
      terrainGrid[theOneMadeSure(pool[Math.floor(kcRng() * pool.length)])] = pickLand();
    }
    const got = seaCount();
    if (got !== want)
      console.warn(
        `World gen: sea share ${String(seaPct)}% asked for ${String(want)} sea provinces on ${String(cols)}x${String(rows)}; the home neighbourhoods fix ${String(rows * cols - freeIds.length)} cells, so ${String(got)} was the nearest reachable.`,
      );
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;
      let taxOverride = null;
      const terrain = theOneMadeSure(terrainGrid[id]);
      const con = constraint[id];
      if (con) {
        // Home / tailored-neighbour cell: terrain (and sometimes tax band) was decided in Phase 2.
        if (con.taxBand === 'poor')
          taxOverride = rP(THE_TAX_BANDS.thePoor.theLeast, THE_TAX_BANDS.thePoor.theMost); // Poor = 2-3 (2026-09-21: no province is ever tax 1)
        else if (con.taxBand === 'prosperous')
          taxOverride = rP(THE_TAX_BANDS.theProsperous.theLeast, THE_TAX_BANDS.theProsperous.theMost); // Prosperous = 3-6; capped at 6 so this band never leaks into the Rich tier (tax>=7)
      }
      // all six terrains rolled, in this order, for a province no band decides (the dice read each roll)
      const _taxOf = EACH_PROVINCE.theTaxOfEachTerrain;
      const baseTax =
        taxOverride ??
        {
          plain: rP(_taxOf.plain.theLeast, _taxOf.plain.theMost),
          desert: rP(_taxOf.desert.theLeast, _taxOf.desert.theMost),
          forest: rP(_taxOf.forest.theLeast, _taxOf.forest.theMost),
          jungle: rP(_taxOf.jungle.theLeast, _taxOf.jungle.theMost),
          mountain: rP(_taxOf.mountain.theLeast, _taxOf.mountain.theMost),
          sea: rP(_taxOf.sea.theLeast, _taxOf.sea.theMost),
        }[terrain];
      // PRIMAL_LAND_CHANCE of LAND provinces are Primal (non-humanoid), split evenly Creature /
      // Monster. Each such province recruits exactly ONE unit type — a single wild unit makes these
      // provinces special. Sea is never Primal at this stage (the sea post-pass below assigns sea
      // beasts separately).
      const isPrimal = terrain !== 'sea' && kcRng() < PRIMAL_LAND_CHANCE;
      let race: string | null,
        primalUnit: string | null = null;
      if (terrain === 'sea') {
        race = null;
      } else if (isPrimal) {
        // Alternate Creature / Monster for an exact half-and-half count across the map.
        const wantCreature = _primalCreatureNext;
        _primalCreatureNext = !_primalCreatureNext;
        // One terrain-appropriate unit per class. Every unit here is classified by the engine's
        // CREATURE_ARMIES / MONSTER_ARMIES sets (Druidic favours Creatures, Evil favours Monsters).
        // 2026-10-13 (Creatures and Monsters IV): Great Bears in forest and mountain, Unicorn Herd on the plain
        // and in the forest, Mammoth Host on the plain and in the desert.
        // the bank by any terrain's name
        const bankByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = wantCreature
          ? THE_WILD_CREATURES_BY_TERRAIN
          : THE_WILD_MONSTERS_BY_TERRAIN;
        const pool = bankByTerrain[terrain] ?? (wantCreature ? ['Stone Giants'] : ['Cave Trolls']);
        primalUnit = theOneMadeSure(pool[Math.floor(kcRng() * pool.length)]);
        // Province race carries the singular sub-race noun (e.g. 'Primal:Stone Giant'); the player
        // portal maps that to "Creature (Stone Giant)" / "Monster (Cave Troll)" and never shows
        // "Primal".
        race = 'Primal:' + ((primalDefs[primalUnit]?.race ?? '') || primalUnit);
      } else {
        race = nextHumanoidRace();
      }
      const population =
        terrain === 'sea'
          ? 0
          : rP(EACH_PROVINCE.thePeopleOfALandProvince.theLeast, EACH_PROVINCE.thePeopleOfALandProvince.theMost);
      // Build army pool — primal provinces recruit their single wild unit; all others use the pool.
      let fullPool: readonly string[];
      if (primalUnit) {
        fullPool = [primalUnit];
      } else if (terrain === 'sea') {
        // Sea army pools are decided later by the province's sea TYPE (Primal / Whale / open
        // water), so leave it empty here — the sea post-processing pass sets armyTypes
        // definitively.
        fullPool = [];
      } else {
        // Regular land province: pull army types for this terrain + race
        const cell = armiesByTerrainAndRace[terrain] ?? {};
        fullPool = cell[String(race)] ?? ['Shieldwall Levies'];
      }
      // Randomise the available army pool: every humanoid province offers 2-3 recruitable unit
      // types IN ADDITION to its race's garrison unit (which is always available). Primal provinces
      // have a single wild unit and are capped by the size of their own pool.
      // (The king's home province gets its full racial pool restored separately.)
      let armyPool: string[];
      if (race !== null && humanoidRaces.has(race)) {
        const hp = buildHumanoidPool(terrain, race, provincePoolSize(kcRng), kcRng); // provisional: the race-allocation pass below rebuilds it the same way (item 15: 2 or 3 types; home restores its full roster separately)
        armyPool = [...hp.types, ...hp.garrison];
      } else {
        // Primal (single wild unit) and sea provinces keep whatever their pool already holds.
        const nonGarrison = fullPool.filter((t) => !t.toLowerCase().includes('garrison'));
        const garrison = fullPool.filter((t) => t.toLowerCase().includes('garrison'));
        const poolCount = Math.min(
          nonGarrison.length,
          rP(
            EACH_PROVINCE.theUnitTypesAWildOrSeaProvinceOffers.theLeast,
            EACH_PROVINCE.theUnitTypesAWildOrSeaProvinceOffers.theMost,
          ),
        );
        const shuffled = shuffleP(nonGarrison).slice(0, poolCount);
        armyPool = [...shuffled, ...garrison];
      }
      // Features (land provinces only): 2-4 explorable features each. Difficulty weighting for a
      // new lair — see LAIR DIFFICULTY below.
      const features: ProvinceFeature[] = [];
      if (terrain !== 'sea') {
        const pool = featurePools[terrain] ?? FEATURE_POOLS_P.plain;
        const fcount = rP(
          EACH_PROVINCE.theFeaturesOfALandProvince.theLeast,
          EACH_PROVINCE.theFeaturesOfALandProvince.theMost,
        );
        const used = new Set<string>();
        for (let fi = 0; fi < fcount; fi++) {
          let fname: string,
            tries = 0;
          do {
            fname = theOneMadeSure(pool[Math.floor(kcRng() * pool.length)]);
            tries++;
          } while (used.has(fname) && tries < EACH_PROVINCE.theTriesForAFeaturesNameNotYetTaken);
          used.add(fname);
          // Land features: exclude EVERY sea guardian so land lairs never get sea beasts.
          const landMonsters = MONSTERS_P.filter((m) => !SEA_GUARDIAN_NAMES.has(m.name));
          // ── LAIR DIFFICULTY ────
          // A lair now HAS a difficulty of its own, rolled first, and its guardian is drawn from
          // the beasts of that same standing. The tier is stored on the feature as `tier`, so the
          // difficulty shown never depends on whether the guardian has been identified yet.
          // Weighted toward the easier end: most country holds modest dangers.
          const _tier = LAIR_TIER_ROLL();
          const _pool = landMonsters.filter((mm) => mm.power === _tier);
          const _from = _pool.length ? _pool : landMonsters.length ? landMonsters : MONSTERS_P;
          const m = { ...theOneMadeSure(_from[Math.floor(kcRng() * _from.length)]) };
          features.push({
            name: fname,
            tier: m.power || _tier,
            monster: { ...m },
            discovered: false,
            cleared: false,
            treasure: Math.max(
              1,
              Math.round(
                rP(EACH_PROVINCE.aLairsTreasure.theLeastOfTheRoll, EACH_PROVINCE.aLairsTreasure.theMostOfTheRoll) *
                  (EACH_PROVINCE.aLairsTreasure.theLeastShare +
                    kcRng() * EACH_PROVINCE.aLairsTreasure.theShareTheDieAdds),
              ),
            ),
          });
        }
        // ── PAGAN: ritual sites ── Standing stones of the old gods, where Pagan characters may
        // Perform Rites. Weighted heavily toward Primal country — the old faith lingers where the
        // wild things rule — which gives Pagans a reason to want the one terrain nobody else does.
        // ritualSite features carry NO guardian monster and are never "cleared"; discovery works
        // like any other feature
        // (Explore thresholds). Non-Pagans can find them; only Pagans can use them. Skipped entirely
        // when no player is Pagan, so a Pagan-less game is never littered with unusable sites.
        // 2026-09-07 batch 3: EVERY primal (creature or monster) land province holds a ritual site
        // — both rites can be performed there. 25% of humanoid land provinces also hold one, but
        // with no wild creatures to bind only the Blood Offering is possible there (the Wild Hunt
        // option is gated on the province's primal armyTypes in both the order form and the
        // engine).
        if (hasPaganPlayer && (isPrimal || kcRng() < RITUAL_SITE_CHANCE_HUMANOID)) {
          features.push({
            name: theOneMadeSure(RITUAL_SITE_NAMES[Math.floor(kcRng() * RITUAL_SITE_NAMES.length)]),
            ritualSite: true,
            monster: null,
            discovered: false,
            cleared: false,
            treasure: 0,
          });
        }
      }
      // Neutral defenders
      const neutralDefenders: Army[] = [];
      if (terrain !== 'sea') {
        const isPrimalProv = race?.startsWith('Primal:');
        // Neutral army count by wealth tier — Rich 3-4 / Prosperous 2-3 / Poor 1-2. Applies to
        // humanoid AND primal land alike; primal quality still leans Veteran below.
        const dc = neutralDefCount(baseTax);
        const defQuality = isPrimalProv
          ? kcRng() < EACH_PROVINCE.theChanceAWildProvincesDefendersAreVeterans
            ? 'Veteran'
            : 'Average'
          : 'Average';
        // Starting neutral defenders draw only from NON-Garrison army types (garrisons stay in
        // armyTypes so they remain recruitable once the province is owned, but no neutral army
        // begins the game as a Garrison unit). Fall back to the full pool only if a province
        // somehow has garrison-only types.
        const defenderPool = armyPool.filter((t) => !t.toLowerCase().includes('garrison'));
        const drawPool = defenderPool.length > 0 ? defenderPool : armyPool;
        for (let d = 0; d < dc; d++) {
          const dt = theOneMadeSure(drawPool[Math.floor(kcRng() * drawPool.length)]);
          neutralDefenders.push({
            type: dt,
            quality: defQuality,
            race: (race ?? '') || 'Human',
            unitName: theOneMadeSure(armyUnitName(dt)),
          });
        }
      }
      provinces.push({
        id,
        row,
        col,
        name: null,
        terrain,
        tax: baseTax,
        race,
        population,
        owner: null,
        features,
        npcArmies: neutralDefenders.length,
        neutralDefenders,
        explored: 0,
        characters: [],
        armyTypes: armyPool,
        garrisonArmies: [],
        visitedBy: [],
      });
    }
  }

  // Post-generation: add fleet types to coastal provinces (land adjacent to sea) Whale Cohorts are
  // NOT an Elven unit — they are wild primal sea-beasts, raised only in the whale waters that
  // generate them, by any realm with the Druid skill to command them. ── Race allocation: weighted
  // towards each race's heartland, balanced to equal totals ── Two requirements pull against each
  // other. Races should cluster in their signature terrain
  // (Humans on plains, Elves in forest, Dwarves in mountains, Orcs in desert), but the four races
  // must also hold equal numbers of provinces — and terrain is NOT evenly distributed, so a plain
  // weighted draw would hand whichever race owns the commonest terrain a permanent advantage.
  //
  // Resolved by giving each race a hard quota of floor(n/4) provinces (the remainder spread at
  // random) and then, for each province in random order, drawing among the races that still have
  // quota left, weighted by SIGNATURE_WEIGHT_P for a terrain match and by each race's REMAINING
  // quota. The quota term is what keeps it balanced: a race that has been getting its way falls
  // back automatically as its allowance runs down. Totals are exact to within one province.
  {
    const humanoidProvs = provinces.filter((p) => p.terrain !== 'sea' && humanoidRaces.has(p.race));
    const n = humanoidProvs.length;
    const quota: Partial<Record<string, number>> = {};
    RACES_P.forEach((r) => {
      quota[r] = Math.floor(n / 4);
    });
    shuffleP(RACES_P)
      .slice(0, n - Math.floor(n / 4) * 4)
      .forEach((r) => {
        quota[r] = Number(quota[r]) + 1;
      });
    for (const p of shuffleP(humanoidProvs)) {
      const pool = RACES_P.filter((r) => Number(quota[r]) > 0);
      const cands = pool.length ? pool : [...RACES_P];
      const weights = cands.map(
        (r) => (SIGNATURE_TERRAIN_P[r] === p.terrain ? SIGNATURE_WEIGHT_P : 1) * Math.max(1, Number(quota[r])),
      );
      let roll = kcRng() * weights.reduce((a, b) => a + b, 0),
        pick = theOneMadeSure(cands[cands.length - 1]);
      for (let i = 0; i < cands.length; i++) {
        roll -= Number(weights[i]);
        if (roll <= 0) {
          pick = theOneMadeSure(cands[i]);
          break;
        }
      }
      quota[pick] = Number(quota[pick]) - 1;
      p.race = pick;
      // Rebuild everything downstream of race: the recruitable pool and the neutral garrison that
      // was rolled from it. Province count, wealth, terrain and features are untouched.
      const hp = buildHumanoidPool(p.terrain, pick, provincePoolSize(kcRng), kcRng); // item 15: 2 (75%) or 3 (25%)
      p.armyTypes = [...hp.types, ...hp.garrison];
      const drawPool = hp.types.length ? hp.types : p.armyTypes;
      p.neutralDefenders.forEach((d) => {
        d.type = theOneMadeSure(drawPool[Math.floor(kcRng() * drawPool.length)]);
        d.race = pick;
        d.unitName = theOneMadeSure(armyUnitName(d.type));
      });
    }
  }

  const FLEET_BY_RACE = THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // Corsair Fleet retired (was Human alt); coastal Humans now build Galleon Fleet only
  const fleetsByRace: Readonly<Partial<Record<string, readonly string[]>>> = FLEET_BY_RACE; // by any race's name
  const fleetTypes: ReadonlySet<string> = HUMANOID_FLEET_TYPES; // looked up by any unit's type
  provinces.forEach((p) => {
    if (p.terrain === 'sea') return; // sea handled separately below
    // Naval units are a HUMANOID shipbuilding tradition.
    if (!humanoidRaces.has(p.race)) return;
    // Check if any neighbour is sea
    const offsets = p.row % 2 === 0 ? offEven : offOdd;
    const adjSea = offsets.some(([dr, dc]) => {
      const nr = p.row + dr;
      if (nr < 0 || nr >= rows) return false;
      const nc = (((p.col + dc) % cols) + cols) % cols;
      const nb = provinces[nr * cols + nc];
      return nb?.terrain === 'sea';
    });
    if (adjSea && kcRng() < COASTAL_NAVAL_CHANCE) {
      // share of coastal humanoid provinces with a fleet option
      const fleets = fleetsByRace[(p.race ?? '') || 'Human'] ?? ['Galleon Fleet'];
      const fleet = theOneMadeSure(fleets[Math.floor(kcRng() * fleets.length)]);
      if (!p.armyTypes.includes(fleet)) p.armyTypes.push(fleet);
    }
  });
  // Sea provinces: only non-humanoid sea armies — no Fleet/Corsair/Galleys/Longships Sea provinces
  // get non-humanoid sea armies only (no player fleets). Their army pool and tax are decided purely
  // by type: 20% Primal (Prosperous, tax 4-6), 20% poor waters (tax 2-3; dealt half whale waters and
  // half shark waters, turn about, so every world gets an even share — 2026-10-13, Toby: the Shark
  // Shoals are the Monsters' weak sea-beast as the Whale Cohort is the Creatures'), 60% open water
  // (no armies, tax 1).
  const POOR_SEAS = KC_THE_POOR_SEAS_BEASTS_DEALT_TURN_ABOUT_WITH_THEIR_RACE_TAGS;
  const PRIMAL_SEA_TYPES = KC_UNIT_CLASS.primalSea.filter((t) => !POOR_SEAS.some((sea) => sea.type === t)); // the prosperous seas' beasts; the Shark Shoals are the poor seas' (below)
  let _poorSeasDealt = 0;
  provinces
    .filter((p) => p.terrain === 'sea')
    .forEach((p) => {
      const r = kcRng();
      if (r < THE_SEAS_BY_KIND.theDieUnderWhichASeaIsPrimal) {
        const chosen = theOneMadeSure(PRIMAL_SEA_TYPES[Math.floor(kcRng() * PRIMAL_SEA_TYPES.length)]);
        p.armyTypes = [chosen];
        p.race = 'Primal:' + chosen.replace(/s$/, '').replace('Eldritch Kraken', 'Kraken'); // 'Primal:Sea Giant' / 'Primal:Kraken'
        // Primal seas are Prosperous waters — tax 4-6, same band as prosperous land. (Capped at 6:
        // tax 7 displays as "Rich", so the old rP(4,7) was quietly minting rich sea provinces.)
        p.tax = rP(THE_SEAS_BY_KIND.thePrimalSeasTax.theLeast, THE_SEAS_BY_KIND.thePrimalSeasTax.theMost);
        // Defender count and quality (2026-10-13: both primal sea beasts are Druid 4; the Druid-5 Leviathans
        // are gone, so no sea is guarded by Veterans alone any more).
        const defCount = neutralDefCount(p.tax); // p.tax set to 4-6 above -> Prosperous 2-3
        const defQuality = kcRng() < THE_SEAS_BY_KIND.theChanceAPrimalSeasDefendersAreVeterans ? 'Veteran' : 'Average';
        // a name once drawn here and read by nothing: its die is still drawn, for a beast with names
        if (unitNamesByType[chosen] != null) kcRng();
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: chosen,
          quality: defQuality,
          race: 'Primal',
          unitName: theOneMadeSure(armyUnitName(chosen)),
        }));
        p.npcArmies = defCount;
        p.explored = 0;
      } else if (r < THE_SEAS_BY_KIND.theDieUnderWhichASeaIsPoorWaters) {
        // Poor waters: whale waters and shark waters, turn about.
        const poorSea = theOneMadeSure(POOR_SEAS[_poorSeasDealt % POOR_SEAS.length]);
        _poorSeasDealt++;
        const beast = poorSea.type;
        p.armyTypes = [beast];
        p.race = poorSea.raceTag;
        p.tax = rP(THE_SEAS_BY_KIND.thePoorWatersTax.theLeast, THE_SEAS_BY_KIND.thePoorWatersTax.theMost); // Poor waters — 2-3, matching the poor land band (2026-09-21: no 1-tax band province)
        const defCount = neutralDefCount(p.tax);
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: beast,
          quality: 'Average',
          race: 'Primal',
          unitName: theOneMadeSure(armyUnitName(beast)),
        }));
        p.npcArmies = defCount;
      } else {
        // Open water — no armies, no defenders, tax exactly 1.
        p.armyTypes = [];
        p.neutralDefenders = [];
        p.npcArmies = 0;
        p.tax = 1;
      }
    });

  // ── UNIFIED SEA FEATURES & GUARDIANS (item: every sea province gets 1-2 sea-themed features,
  // each guarded by a sea creature; wide pools keep even the largest maps varied). Applies to ALL
  // sea provinces — primal, whale AND open water — so open ocean is now worth exploring too.
  // Tougher guardians lurk in richer waters. This is the single source of sea features (the old
  // primal-only one-feature block above was removed).
  {
    const SEA_FEATURE_NAMES = THE_SEA_FEATURES_NAMES;
    const _seaMons = MONSTERS_P.filter((m) => SEA_GUARDIAN_NAMES.has(m.name)); // shared module-level set
    const _byTier = {
      Weak: _seaMons.filter((m) => m.power === 'Weak'),
      Moderate: _seaMons.filter((m) => m.power === 'Moderate'),
      Powerful: _seaMons.filter((m) => m.power === 'Powerful'),
    };
    const _pickTier = (tax: number) => {
      const rr = kcRng();
      // 2026-09-10 item 6: softened alongside land lairs (was 50/50 P/M · 25/60/15 W/M/P · 70/30
      // W/M).
      const { theRichSeas, theMiddlingSeas, theOtherSeas } = THE_SEA_FEATURES_AND_THEIR_GUARDIANS;
      if (tax >= theRichSeas.theTaxFrom)
        return rr < theRichSeas.theDieUnderWhichPowerful
          ? 'Powerful'
          : rr < theRichSeas.theDieUnderWhichModerate
            ? 'Moderate'
            : 'Weak'; // rich/primal seas: nastier
      if (tax >= theMiddlingSeas.theTaxFrom)
        return rr < theMiddlingSeas.theDieUnderWhichWeak
          ? 'Weak'
          : rr < theMiddlingSeas.theDieUnderWhichModerate
            ? 'Moderate'
            : 'Powerful';
      return rr < theOtherSeas.theDieUnderWhichWeak ? 'Weak' : 'Moderate'; // poor / open water: mostly weak
    };
    provinces
      .filter((p) => p.terrain === 'sea')
      .forEach((p) => {
        const fcount = 1 + (kcRng() < THE_SEA_FEATURES_AND_THEIR_GUARDIANS.theChanceOfASecondFeature ? 1 : 0); // 1-2 features
        const used = new Set<string>();
        p.features = []; // unified source — replace anything set earlier
        for (let fi = 0; fi < fcount; fi++) {
          let fname: string,
            tries = 0;
          do {
            fname = theOneMadeSure(SEA_FEATURE_NAMES[Math.floor(kcRng() * SEA_FEATURE_NAMES.length)]);
            tries++;
          } while (used.has(fname) && tries < THE_SEA_FEATURES_AND_THEIR_GUARDIANS.theTriesForAFeaturesNameNotYetTaken);
          used.add(fname);
          const tier = _pickTier(p.tax || 1);
          const pool = _byTier[tier].length ? _byTier[tier] : _seaMons;
          const m = { ...theOneMadeSure(pool[Math.floor(kcRng() * pool.length)]) };
          p.features.push({
            name: fname,
            tier: m.power || '',
            discovered: false,
            cleared: false,
            monster: { ...m },
            treasure: Math.max(1, rP(m.minG, m.maxG)),
          });
        }
      });
  }

  // ── Home coastal guarantee: a home that borders any sea borders at least one OPEN-WATER sea (no
  // neutral defenders), so a king's first fleet always has somewhere to sail without a fight. Sea
  // features/guardians (lairs) are untouched - they never block movement.
  homeCells.forEach((home) => {
    const seas = neighbourCells(home.r, home.c)
      .map((n) => provinces[n.id])
      .filter((p): p is AProvinceAsTheWorldIsMadeIt => p?.terrain === 'sea');
    if (!seas.length || seas.some((p) => !p.neutralDefenders.length)) return;
    const p = theOneMadeSure(seas[Math.floor(kcRng() * seas.length)]);
    p.armyTypes = [];
    p.neutralDefenders = [];
    p.npcArmies = 0;
    p.tax = 1;
    p.race = null;
  });

  // Player starts were already chosen up front (Phase 1) and their neighbourhoods tailored
  // (Phase 2). Here we simply take each king's pre-selected home province in order.
  const playerStarts: AProvinceAsTheWorldIsMadeIt[] = [];
  const allChars: AHeroAsTheWorldMakesHim[] = [];

  // 2026-09-28 (Toby item 1): realm colours are dealt from a SHUFFLED palette. They used to be
  // REALM_COLOURS[player index], and humans always take the lowest indices (bots are appended after
  // them), so a player alone against bots was Rose (pink) in every game. shuffleP is the unbiased
  // Fisher-Yates at module top level; the palette's rules (terrain clearance, luma spacing) are
  // properties of the set, not of the seat, so any order keeps them.
  const _realmColourDeal = shuffleP(REALM_COLOURS);
  // The wild pools the home passes deal from: the alignment neighbour pass below and the
  // wild-country pass after the homes (item 12), the same banks as the province pass's.
  // the two banks by any terrain's name
  const creaturesByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = THE_WILD_CREATURES_BY_TERRAIN;
  const monstersByTerrain: Readonly<Partial<Record<string, readonly string[]>>> = THE_WILD_MONSTERS_BY_TERRAIN;
  const players = setupPlayers.map((sp, pi) => {
    const best = theOneMadeSure(provinces[theOneMadeSure(homeCells[pi]).id]);
    // Home province race always matches the king's race, and army pool updates accordingly
    best.owner = pi;
    best.npcArmies = 0;
    best.neutralDefenders = [];
    best.exploredBy = { [pi]: THE_HOMES.howWellARealmKnowsItsHome };
    best.explored = THE_HOMES.howWellARealmKnowsItsHome;
    best.visitedBy = [pi];
    best.tax = THE_HOMES.theTaxOfAHome;
    best.race = sp.race;
    // The home province is the ONE humanoid province exempt from the 2-3-types cap: a king opens
    // with his race's complete land roster. Restoring it here overwrites anything the coastal pass
    // added, so a coastal capital is re-offered its racial fleet on the same terms as any other
    // coastal humanoid province.
    best.armyTypes = fullRaceLandRoster(sp.race);
    if (!best.armyTypes.length) best.armyTypes = ['Shieldwall Levies'];
    {
      const hOffs = best.row % 2 === 0 ? offEven : offOdd;
      const homeCoastal = hOffs.some(([dr, dc]) => {
        const nr = best.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nc = (((best.col + dc) % cols) + cols) % cols;
        const nb = provinces[nr * cols + nc];
        return nb?.terrain === 'sea';
      });
      // 2026-09-25 (Toby): a coastal capital ALWAYS offers its race's fleet, at every sea share (was an
      // 80% roll). backfillHomeRosters applies the same rule to games already running.
      if (homeCoastal) {
        const homeFleets: Readonly<Partial<Record<string, readonly string[]>>> =
          THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // by any race's name
        const hf = homeFleets[sp.race] ?? []; // Corsair Fleet retired
        const pickH = hf[Math.floor(kcRng() * hf.length)];
        if (pickH && !best.armyTypes.includes(pickH)) best.armyTypes.push(pickH);
      }
    }
    // 100% explored = all features discovered at start (by the home's OWNER only)
    best.features.forEach((f) => {
      discoverFeat(f, pi);
    });

    // ── Guarantee: the home is adjacent to one POOR (tax 2-3) and one PROSPEROUS (tax 4-6) land
    // province, BOTH of them HUMANOID, and at least one of the two of the king's OWN race. The
    // Phase-2 ring constraints usually place the tax bands; here we fix any shortfall (edge of map
    // / clustered starts) and enforce the race rules by re-racing the chosen neighbours in place
    // (terrain, tax and features kept; recruit pool and neutral garrison rebuilt).
    const _reRaceProvince = (conv: AProvinceAsTheWorldIsMadeIt, _race: string) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      // Coastal humanoid provinces keep their chance of a racial fleet, same rule as world gen.
      {
        const offs = conv.row % 2 === 0 ? offEven : offOdd;
        const convCoastal = offs.some(([dr, dc]) => {
          const nr = conv.row + dr;
          if (nr < 0 || nr >= rows) return false;
          const nc = (((conv.col + dc) % cols) + cols) % cols;
          const nb = provinces[nr * cols + nc];
          return nb?.terrain === 'sea';
        });
        if (convCoastal && kcRng() < COASTAL_NAVAL_CHANCE) {
          const convFleets: Readonly<Partial<Record<string, readonly string[]>>> =
            THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // by any race's name
          const cf = convFleets[_race] ?? []; // Corsair Fleet retired
          const pickF = cf[Math.floor(kcRng() * cf.length)];
          if (pickF && !conv.armyTypes.includes(pickF)) conv.armyTypes.push(pickF);
        }
      }
      // Rebuild the neutral garrison from the new pool. This runs BEFORE the neutral-guard hero
      // pass, so the hero picks up the corrected armies; province wealth still sets the count.
      const cDrawPool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const cPool = cDrawPool.length > 0 ? cDrawPool : conv.armyTypes;
      const cCount = neutralDefCount(conv.tax);
      conv.neutralDefenders = Array.from({ length: cCount }, () => {
        const dt = theOneMadeSure(cPool[Math.floor(kcRng() * cPool.length)]);
        return { type: dt, quality: 'Average', race: _race, unitName: theOneMadeSure(armyUnitName(dt)) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // re-named thematically by the naming pass below
    };
    const _rawLandNbrs = getNeighborsP(best, cols, rows, provinces).filter(
      (n) => n.terrain !== 'sea' && n.owner == null,
    );
    const _isHumanoid = (n: AProvinceAsTheWorldIsMadeIt | null) => !!n && !(n.race ?? '').startsWith('Primal');
    // when a tax band has to be FORCED, prefer a cell that is not an earlier king's guaranteed pair
    // member, so fixing this home can't silently break a neighbouring home's.
    const _earlierPair = new Set(playerStarts.flatMap((h) => h._homePairIds ?? []));
    const homeLandNbrs = [
      ..._rawLandNbrs.filter((n) => !_earlierPair.has(n.id)),
      ..._rawLandNbrs.filter((n) => _earlierPair.has(n.id)),
    ];
    // Pick the poor neighbour: an existing poor humanoid, else an existing poor primal, else force
    // one.
    const { thePoor: _thePoor, theProsperous: _theProsperous } = THE_TAX_BANDS;
    let poorNbr =
      homeLandNbrs.find((n) => n.tax >= _thePoor.theLeast && n.tax <= _thePoor.theMost && _isHumanoid(n)) ??
      homeLandNbrs.find((n) => n.tax >= _thePoor.theLeast && n.tax <= _thePoor.theMost) ??
      null;
    if (!poorNbr && homeLandNbrs.length >= 1) {
      poorNbr = theOneMadeSure(homeLandNbrs[0]);
      poorNbr.tax = rP(_thePoor.theLeast, _thePoor.theMost);
    }
    let prospNbr =
      homeLandNbrs.find(
        (n) => n !== poorNbr && n.tax >= _theProsperous.theLeast && n.tax <= _theProsperous.theMost && _isHumanoid(n),
      ) ??
      homeLandNbrs.find((n) => n !== poorNbr && n.tax >= _theProsperous.theLeast && n.tax <= _theProsperous.theMost) ??
      null;
    if (!prospNbr) {
      const cands = homeLandNbrs.filter((n) => n !== poorNbr);
      if (cands.length) {
        prospNbr = theOneMadeSure(cands[0]);
        prospNbr.tax = rP(_theProsperous.theLeast, _theProsperous.theMost);
      }
    }
    // Both must be humanoid; at least one must be the king's race.
    const _pair = [poorNbr, prospNbr].filter((n): n is AProvinceAsTheWorldIsMadeIt => Boolean(n));
    _pair.forEach((n) => {
      if (!_isHumanoid(n)) _reRaceProvince(n, sp.race);
    });
    if (_pair.length && !_pair.some((n) => n.race === sp.race))
      _reRaceProvince(theOneMadeSure(_pair[Math.floor(kcRng() * _pair.length)]), sp.race);
    // Remember them so the alignment primal-neighbour pass below leaves them alone where it can.
    best._homePairIds = _pair.map((n) => n.id);
    // Belt-and-braces: some own-race land neighbour must exist (covers a home with no free ring
    // cells).
    if (homeLandNbrs.length && !homeLandNbrs.some((n) => n.race === sp.race))
      _reRaceProvince(theOneMadeSure(homeLandNbrs[0]), sp.race);

    // ── Tasks 6 & 7: alignment starting primal neighbour ── Pagan kings open beside a PRIMAL
    // FOREST or JUNGLE province that holds a RITUAL SITE (somewhere to Perform Rites from turn
    // one). Druidic kings open beside a PRIMAL CREATURE province (Eagles, Ents, Giants, Rocs — a wild
    // host they can lead with no Druid requirement), and since 2026-10-13 (Toby, Creatures and
    // Monsters I) Evil kings beside a PRIMAL MONSTER province (Trolls, Basilisks, Manticores… — the
    // mirror). We convert a free neighbour, preferring one that is NOT the king's own-race homeland
    // guaranteed above.
    {
      // the wild country a capital of the realm's alignment opens beside, from its rows (P1-19ay1)
      const _align = sp.alignment;
      const _besideTheStones = doesACapitalOfTheAlignmentOpenBesideTheRitualStones(_align),
        _besideCreatures = doesACapitalOfTheAlignmentOpenBesideCreatures(_align),
        _besideMonsters = doesACapitalOfTheAlignmentOpenBesideMonsters(_align);
      if (_besideTheStones || _besideCreatures || _besideMonsters) {
        const _allFreeNbrs = getNeighborsP(best, cols, rows, provinces).filter(
          (n) => n.terrain !== 'sea' && n.owner == null,
        );
        // the poor/prosperous pair must be HUMANOID for EVERY home, so this pass may never convert
        // (a) this home's own pair, (b) an earlier king's pair, or (c) any cell in an earlier
        // king's ring (that would push their ring over the one-primal cap after their cap pass has
        // already run).
        const _protectedIds = new Set(best._homePairIds ?? []);
        playerStarts.forEach((h) => {
          (h._homePairIds ?? []).forEach((id) => _protectedIds.add(id));
          getNeighborsP(h, cols, rows, provinces).forEach((n) => {
            _protectedIds.add(n.id);
          });
        });
        const _freeNbrs = _allFreeNbrs.filter((n) => !_protectedIds.has(n.id)); // may be empty -> no alignment neighbour; the pair wins
        // don't clobber the just-guaranteed own-race neighbour if we can help it
        const _pick = (list: AProvinceAsTheWorldIsMadeIt[]) => {
          const notOwn = list.filter((n) => n.race !== sp.race);
          return notOwn.length ? notOwn : list;
        };
        let cand: AProvinceAsTheWorldIsMadeIt | undefined;
        if (_besideTheStones) {
          const pool = _pick(_freeNbrs);
          // prefer an existing forest/jungle neighbour; else re-terrain one to forest/jungle
          cand = pool.find((n) => n.terrain === 'forest' || n.terrain === 'jungle') ?? pool[0];
          if (cand) {
            if (cand.terrain !== 'forest' && cand.terrain !== 'jungle')
              cand.terrain = kcRng() < THE_HOMES.theChanceTheStonesNeighbourIsForest ? 'forest' : 'jungle';
          }
        } else {
          // Druidic or Evil
          cand = _pick(_freeNbrs)[0];
        }
        if (cand) {
          const creatureOnly = _besideCreatures,
            monsterOnly = _besideMonsters;
          const bank = creatureOnly
            ? (creaturesByTerrain[cand.terrain] ?? ['Stone Giants'])
            : monsterOnly
              ? (monstersByTerrain[cand.terrain] ?? ['Cave Trolls'])
              : ((kcRng() < THE_HOMES.theChanceTheCreedsNeighbourHoldsCreatures
                  ? creaturesByTerrain
                  : monstersByTerrain)[cand.terrain] ?? ['Stone Giants']);
          const primalUnit = theOneMadeSure(bank[Math.floor(kcRng() * bank.length)]);
          const candsRace = 'Primal:' + ((primalDefs[primalUnit]?.race ?? '') || primalUnit);
          cand.race = candsRace;
          cand.armyTypes = [primalUnit];
          const dc = neutralDefCount(cand.tax);
          cand.neutralDefenders = Array.from({ length: dc }, () => ({
            type: primalUnit,
            quality: kcRng() < THE_HOMES.theChanceTheCreedsNeighboursDefendersAreVeterans ? 'Veteran' : 'Average',
            race: candsRace,
            unitName: theOneMadeSure(armyUnitName(primalUnit)),
          }));
          cand.npcArmies = cand.neutralDefenders.length;
          if (_besideTheStones && !cand.features.some((f) => f.ritualSite)) {
            cand.features.push({
              name: theOneMadeSure(RITUAL_SITE_NAMES[Math.floor(kcRng() * RITUAL_SITE_NAMES.length)]),
              ritualSite: true,
              monster: null,
              discovered: false,
              cleared: false,
              treasure: 0,
            });
          }
          cand.name = null; // re-named thematically by the naming pass
          best._alignPrimalId = cand.id;
        }
      }
    }

    // ── 2026-09-09: at most ONE primal province may border a home province ── World gen scatters
    // primal (creature/monster) provinces freely, so a home could open ringed by two or three of
    // them — unconquerable ground for a new realm. Keep one (the alignment-placed one if there is
    // one, else the first found) and re-race every other primal land neighbour as a humanoid
    // province of a random race (own-race guarantee above is untouched — it never picks a primal).
    {
      const _ringPrimal = getNeighborsP(best, cols, rows, provinces).filter(
        (n) => n.terrain !== 'sea' && n.owner == null && (n.race ?? '').startsWith('Primal'),
      );
      if (_ringPrimal.length > 1) {
        const keepId =
          best._alignPrimalId != null && _ringPrimal.some((n) => n.id === best._alignPrimalId)
            ? best._alignPrimalId
            : theOneMadeSure(_ringPrimal[0]).id;
        const HUM = KC_HUMANOID_RACES.slice();
        _ringPrimal
          .filter((n) => n.id !== keepId)
          .forEach((n) => {
            _reRaceProvince(n, theOneMadeSure(HUM[Math.floor(kcRng() * HUM.length)]));
          });
      }
      delete best._alignPrimalId;
    }

    // ── Guarantee: at least one WEAK feature in every player's home province ──
    {
      const SEA_MONS = new Set(THE_SEA_BEASTS_A_HOMES_WEAK_LAIR_LEAVES_OUT);
      const weakMons = MONSTERS_P.filter((mm) => mm.power === 'Weak' && !SEA_MONS.has(mm.name));
      if (weakMons.length > 0) {
        if (best.features.length === 0) {
          const wpool = featurePools[best.terrain] ?? FEATURE_POOLS_P.plain;
          best.features.push({
            name: theOneMadeSure(wpool[Math.floor(kcRng() * wpool.length)]),
            tier: 'Weak',
            monster: { ...theOneMadeSure(weakMons[Math.floor(kcRng() * weakMons.length)]) },
            discovered: true,
            discoveredBy: [pi],
            cleared: false,
            treasure: Math.max(1, rP(1, THE_HOMES.theMostTreasureOfAHomesWeakLair)),
          });
        } else if (!best.features.some((f) => f.monster?.power === 'Weak')) {
          // 2026-09-09g: softening a starting lair swaps its guardian, so its own difficulty must
          // follow — otherwise this one lair in the world reads Powerful while a Weak beast sits in
          // it.
          const firstFeature = theOneMadeSure(best.features[0]);
          firstFeature.monster = { ...theOneMadeSure(weakMons[Math.floor(kcRng() * weakMons.length)]) };
          firstFeature.tier = 'Weak';
        }
      }
    }
    playerStarts.push(best);

    // Build king skills
    const kingSkills: Partial<Record<string, number>> = { ...A_KING_AND_HIS_HEROES.theKingsSkills };
    // his alignment's skill a level more, from its row (P1-19ay1): Divine White, Druidic Druid, Evil Druid (2026-10-13,
    // Toby: the mirror — an Evil king drives his Monsters from turn one), Pagan Explorer (the old faith walks the wild
    // places), Undead Necromancy
    const _kingsSkill = theSkillAKingOfTheAlignmentStartsWith(sp.alignment);
    if (_kingsSkill)
      kingSkills[_kingsSkill.theSkill] = (kingSkills[_kingsSkill.theSkill] ?? 0) + _kingsSkill.theLevelsMore;
    // Normalise any mixed-case skill keys from the join form to engine keys
    const SKILL_NORM: Readonly<Partial<Record<string, string>>> = {
      Melee: 'melee',
      Archery: 'archery',
      Tactical: 'tactical',
      March: 'march',
      Naval: 'naval',
      Sage: 'sage',
      Spy: 'spy',
      Thief: 'thief',
      Druid: 'druid',
      Explorer: 'explorer',
      'White Magic': 'white',
      'Psychic Magic': 'psychic',
      'Illusory Magic': 'illusory',
      'Elemental Magic': 'elemental',
      Necromancy: 'necromancy',
      White: 'white',
      Psychic: 'psychic',
      Illusory: 'illusory',
      Elemental: 'elemental',
    };
    if (sp.skills)
      Object.entries(sp.skills).forEach(([k, v]) => {
        const normKey = SKILL_NORM[k] ?? k.toLowerCase();
        kingSkills[normKey] = (Number(kingSkills[normKey]) || 0) + Number(v);
      });

    // A king who begins with any Naval skill must be able to put that skill to use: guarantee at
    // least one of their race's naval units is recruitable in their home province. The king still
    // starts with land armies only — this just adds the option to build a fleet from turn one.
    if ((kingSkills['naval'] ?? 0) >= 1) {
      const NAVAL_BY_RACE = { ...HOME_FLEET_BY_RACE };
      const navalUnit = (NAVAL_BY_RACE[sp.race] ?? '') || 'Galleon Fleet';
      if (!best.armyTypes.includes(navalUnit)) best.armyTypes.push(navalUnit);
    }

    const kingId = allChars.length;
    // King's starting armies are drawn from the province's LAND army pool only (no fleets), so a
    // Naval-skilled king still opens with land units and must recruit ships themselves.
    const homesArmies = armiesByTerrainAndRace[best.terrain] ?? {};
    const startArmyPool = (homesArmies[sp.race] ?? ['Shieldwall Levies']).filter((t) => !SEA_TYPES_GEN.has(t));
    const king: AHeroAsTheWorldMakesHim = {
      id: kingId,
      name: (sp.kingName ?? '') || sp.name,
      isKing: true,
      player: pi,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      hp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
      maxHp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
      skills: kingSkills,
      aptitude: {},
      armies: (() => {
        const nonGarrison = startArmyPool.filter((t) => !t.toLowerCase().includes('garrison'));
        let pool = nonGarrison.length > 0 ? nonGarrison : startArmyPool;
        // Never hand a king a starting unit his own Druid skill can't lead cleanly. Own-race troops
        // are commanded as if Druid 1 (the same-race rule), so keep only types whose required Druid
        // level is within reach — this filters out exotic own-race beasts (Eagle Riders, Noble
        // Griffons, Wyvern Riders, etc.) that would otherwise saddle a low-Druid king with a
        // strength penalty from turn one. Fall back to the full pool only if nothing qualifies.
        const kingDruidReach = Math.max(1, Number(kingSkills['druid']) || 0);
        const safe = pool.filter((t) => getDruidLevel(t) <= kingDruidReach);
        if (safe.length > 0) pool = safe;
        const t1 = (pool[0] ?? '') || 'Shieldwall Levies',
          t2 = (pool[Math.min(1, pool.length - 1)] ?? '') || (pool[0] ?? '') || 'Shieldwall Levies';
        const a1: Army = { type: t1, quality: 'Average', race: sp.race, unitName: theOneMadeSure(armyUnitName(t1)) };
        const a2: Army = { type: t2, quality: 'Average', race: sp.race, unitName: theOneMadeSure(armyUnitName(t2)) };
        return [a1, a2];
      })(),
      items: [],
      location: best.id,
      alive: true,
      merits: 0,
      taxBonus: 0,
      pay: 0,
      spellsUsedThisTurn: [],
      locationName: best.name,
    };
    ABILITIES_P.forEach((ab) => {
      king.aptitude[ab] = rP(A_KING_AND_HIS_HEROES.eachAptitude.theLeast, A_KING_AND_HIS_HEROES.eachAptitude.theMost);
    });
    // Undead kings get one skeletal starter army in addition to normal starting armies (its row: P1-19ay1)
    if (doesAKingOfTheAlignmentStartWithASkeletalCompany(sp.alignment)) {
      king.armies.push({
        type: 'Shieldwall Levies',
        quality: 'Average',
        race: 'Undead',
        _isSkeletal: true,
        unitName: theOneMadeSure(armyUnitName('Shieldwall Levies')) + ' (Skeletal)',
      });
    }
    allChars.push(king);
    best.characters.push(kingId);

    // Starting heroes — pay = 1 (loyal to their liege). the FIRST hero shares the king's race; the
    // SECOND is a random race that bears no animosity toward the king's race
    // (Orcs↔Humans and Elves↔Dwarves are the feuding pairs), so a king never opens with a rival-kin
    // hero at his side (who would lead his native troops at −20%).
    const _RACE_RIVAL: Readonly<Partial<Record<string, string>>> = { ...KC_RIVAL_RACE };
    const heroIds: number[] = [];
    // each is dealt an alignment within the ladder's steps of the king's (P1-19av2: one), by the rungs' order
    const _within = THE_LADDER_OF_THE_ALIGNMENTS.theNumbers.theStepsAKingsHeroesAreDealtWithin.value;
    for (let h = 0; h < A_KING_AND_HIS_HEROES.theHeroesARealmStartsWith; h++) {
      const hid = allChars.length;
      const hSkills: Partial<Record<string, number>> = {};
      for (let s = 0; s < A_KING_AND_HIS_HEROES.theSkillPointsOfAStartingHero; s++) {
        const sk = theOneMadeSure(ABILITIES_P[Math.floor(kcRng() * ABILITIES_P.length)]);
        hSkills[sk] = (hSkills[sk] ?? 0) + 1;
      }
      const heroAlign = theOneMadeSure(
        ALIGNMENTS_P[Math.max(0, Math.min(6, ALIGNMENTS_P.indexOf(sp.alignment) + rP(-_within, _within)))],
      );
      const _hRace =
        h === 0
          ? sp.race
          : (() => {
              const opts = RACES_P.filter((r) => r !== _RACE_RIVAL[sp.race]);
              return theOneMadeSure(opts[Math.floor(kcRng() * opts.length)]);
            })();
      const hero: AHeroAsTheWorldMakesHim = {
        id: hid,
        name: nextHeroName(heroAlign),
        isKing: false,
        player: pi,
        race: _hRace, // hero 0 = king's race; hero 1 = random non-feuding race
        alignment: heroAlign,
        temper: TEMPERS_P[Math.floor(kcRng() * A_KING_AND_HIS_HEROES.theTempersAHeroIsDealtFrom)],
        hp: A_KING_AND_HIS_HEROES.theHpTheyAreMadeWith,
        maxHp: 0,
        skills: hSkills,
        aptitude: {},
        armies: [],
        items: [],
        location: best.id,
        alive: true,
        merits: 0,
        taxBonus: 0,
        spellsUsedThisTurn: [],
        locationName: best.name,
        startingHero: true, // informational only — wage follows the standard skill formula
      };
      hero.maxHp = hero.hp;
      ABILITIES_P.forEach((ab) => {
        hero.aptitude[ab] = rP(A_KING_AND_HIS_HEROES.eachAptitude.theLeast, A_KING_AND_HIS_HEROES.eachAptitude.theMost);
      });
      // Same wage formula as every other hero (theWageOfAHeroInService, B-06d): 3 starting skill points → 1g.
      hero.pay = theWageOfAHeroInService(KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired, hero);
      allChars.push(hero);
      best.characters.push(hid);
      heroIds.push(hid);
    }

    // homeProvinceId is the founding capital and is written ONCE, here. It is deliberately separate
    // from provinces[0], which shifts as land is won and lost — the player map is centred on this
    // province for the whole game, so it must never move under them mid-campaign.
    return {
      id: pi,
      name: (sp.kingdomName ?? '') || sp.name,
      kingName: (sp.kingName ?? '') || sp.name,
      _isBot: !!sp.isBot,
      color: (_realmColourDeal[pi] ?? '') || REALM_COLOUR_FALLBACK,
      race: sp.race,
      alignment: sp.alignment,
      temper: sp.temper,
      gold: A_KING_AND_HIS_HEROES.theGoldARealmStartsWith,
      king: kingId,
      heroes: [...heroIds],
      provinces: [best.id],
      homeProvinceId: best.id,
      merits: 0,
      // ── Diplomacy (KC alliance system) ── players this king has ENCOUNTERED (seen a character or
      // province of). Only encountered players may be treated with. Accumulated in
      // updateProvinceMemory.
      _encountered: [],
    };
  });

  // ── WILD COUNTRY NEAR THE TWO CROWNS (2026-10-13, Toby item 12) ── A Druidic king must have at
  // least one land CREATURE province within two provinces of home, and an Evil king a land MONSTER
  // province, so each crown can reach its speciality early. The alignment pass above only tries to
  // put one beside the home, and it can find no free neighbour; later homes' cap passes can also
  // re-race a primal province that sits two steps from an earlier home. This pass runs after every
  // home is tailored and is the authority. Where nothing within two steps qualifies it converts one
  // cell, choosing in order: a cell exactly two steps away that borders no home (so no ring breaks
  // its one-primal cap), then a free cell in this home's own ring if that ring holds no primal yet.
  // It never touches a home, any king's poor/prosperous pair, or a primal cell that is another
  // crown's only qualifying province. Wrong-family primal cells are preferred over humanoid ones (the
  // wild country only changes sides), then cells not of the king's own race.
  {
    const _nb = (p: AProvinceAsTheWorldIsMadeIt) => getNeighborsP(p, cols, rows, provinces).filter(Boolean);
    const _within2 = (h: AProvinceAsTheWorldIsMadeIt) => {
      const one = _nb(h),
        seen = new Map(one.map((n): [number, number] => [n.id, 1]));
      one.forEach((n) => {
        _nb(n).forEach((m) => {
          if (m.id !== h.id && !seen.has(m.id)) seen.set(m.id, 2);
        });
      });
      return seen;
    };
    // the units of each family, looked up by a type that may be missing
    const creatureUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.creature;
    const monsterUnits: readonly (string | undefined)[] = KC_UNIT_CLASS.monster;
    const _famOf = (p: AProvinceAsTheWorldIsMadeIt) => {
      if (p.terrain === 'sea' || !(p.race ?? '').startsWith('Primal')) return null;
      const t = p.armyTypes[0];
      return creatureUnits.includes(t) ? 'creature' : monsterUnits.includes(t) ? 'monster' : null;
    };
    const _homeIds = new Set(players.map((pl) => pl.homeProvinceId));
    const _pairIds = new Set(playerStarts.flatMap((h) => h._homePairIds ?? []));
    const _ringIds = new Set<number>();
    playerStarts.forEach((h) => {
      _nb(h).forEach((n) => _ringIds.add(n.id));
    });
    /** A crown that wants wild country near home: its realm, the family it wants, its home. */
    interface ACrownWantingWildCountry {
      readonly pl: (typeof players)[number];
      readonly want: 'creature' | 'monster';
      readonly home: AProvinceAsTheWorldIsMadeIt;
    }
    const _crowns = players
      .map((pl) => ({
        pl,
        want: doesACapitalOfTheAlignmentOpenBesideCreatures(pl.alignment)
          ? 'creature'
          : doesACapitalOfTheAlignmentOpenBesideMonsters(pl.alignment)
            ? 'monster'
            : null,
        home: provinces[pl.homeProvinceId],
      }))
      .filter((x): x is ACrownWantingWildCountry => Boolean(x.want && x.home));
    const _matches = (cr: ACrownWantingWildCountry) =>
      [..._within2(cr.home).keys()].filter((id) => {
        const q = provinces[id];
        return q && q.owner == null && _famOf(q) === cr.want;
      });
    _crowns.forEach((cr) => {
      if (_matches(cr).length) return;
      const near = _within2(cr.home);
      const soleFor = (id: number) =>
        _crowns.some((o) => o !== cr && _matches(o).length === 1 && _matches(o)[0] === id);
      const ok = (q: AProvinceAsTheWorldIsMadeIt | undefined): q is AProvinceAsTheWorldIsMadeIt =>
        Boolean(
          q && q.terrain !== 'sea' && q.owner == null && !_homeIds.has(q.id) && !_pairIds.has(q.id) && !soleFor(q.id),
        );
      const ringHasPrimal = _nb(cr.home).some((n) => n.terrain !== 'sea' && (n.race ?? '').startsWith('Primal'));
      const rank = (list: AProvinceAsTheWorldIsMadeIt[]) =>
        list.sort(
          (x, y) =>
            (_famOf(y) ? 1 : 0) - (_famOf(x) ? 1 : 0) ||
            (x.race === cr.pl.race ? 1 : 0) - (y.race === cr.pl.race ? 1 : 0),
        );
      const far = rank(
        shuffleP(
          [...near.entries()]
            .filter(([, d]) => d === 2)
            .map(([id]) => provinces[id])
            .filter((q): q is AProvinceAsTheWorldIsMadeIt => ok(q) && !_ringIds.has(q.id)),
        ),
      );
      const ring = ringHasPrimal ? [] : rank(shuffleP(_nb(cr.home).filter(ok)));
      const cand = far[0] ?? ring[0] ?? null;
      if (!cand) return;
      const bank = (cr.want === 'creature' ? creaturesByTerrain : monstersByTerrain)[cand.terrain] ?? [
        cr.want === 'creature' ? 'Stone Giants' : 'Cave Trolls',
      ];
      const unit = theOneMadeSure(bank[Math.floor(kcRng() * bank.length)]);
      const candsRace = 'Primal:' + ((primalDefs[unit]?.race ?? '') || unit);
      cand.race = candsRace;
      cand.armyTypes = [unit];
      cand.neutralDefenders = Array.from({ length: neutralDefCount(cand.tax) }, () => ({
        type: unit,
        quality:
          kcRng() < THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS.theChanceItsDefendersAreVeterans ? 'Veteran' : 'Average',
        race: candsRace,
        unitName: theOneMadeSure(armyUnitName(unit)),
      }));
      cand.npcArmies = cand.neutralDefenders.length;
      cand.name = null; // renamed by the thematic naming pass below
    });
  }

  // ── NEUTRAL RACE REBALANCE (2026-09-21) ── The allocation pass above deals the four humanoid
  // races EXACTLY evenly (to within one province) — but the home-tailoring passes that follow then
  // re-race provinces one at a time (own-race neighbour, primal-cap re-race to a RANDOM race,
  // alignment primal conversion), and an audit measured the final spread drifting up to 8 provinces
  // apart on a 5-realm map. This pass restores the promise for the NEUTRAL world. Home provinces are
  // left out of the count (their race is the king's choice), and nothing inside ANY home ring is
  // touched, so every home-neighbourhood guarantee stands exactly as tailored. A province is moved
  // from the most- to the least-held race, preferring one on the receiving race's heartland terrain
  // so the heartland clustering survives.
  {
    const _homeRing = new Set<number>();
    playerStarts.forEach((h) => {
      _homeRing.add(h.id);
      getNeighborsP(h, cols, rows, provinces).forEach((n) => {
        _homeRing.add(n.id);
      });
    });
    const _neutralHum = () =>
      provinces.filter((p) => p.terrain !== 'sea' && p.owner === null && humanoidRaces.has(p.race));
    const _reRace = (conv: AProvinceAsTheWorldIsMadeIt, _race: string) => {
      conv.race = _race;
      const cHp = buildHumanoidPool(conv.terrain, _race, provincePoolSize(kcRng), kcRng);
      conv.armyTypes = [...cHp.types, ...cHp.garrison];
      const offs = conv.row % 2 === 0 ? offEven : offOdd;
      const coastal = offs.some(([dr, dc]) => {
        const nr = conv.row + dr;
        if (nr < 0 || nr >= rows) return false;
        const nb = provinces[nr * cols + ((((conv.col + dc) % cols) + cols) % cols)];
        return nb?.terrain === 'sea';
      });
      if (coastal && kcRng() < COASTAL_NAVAL_CHANCE) {
        const f = HOME_FLEET_BY_RACE[_race];
        if (f && !conv.armyTypes.includes(f)) conv.armyTypes.push(f);
      }
      const pool = conv.armyTypes.filter((t) => !t.toLowerCase().includes('garrison') && !SEA_TYPES_GEN.has(t));
      const draw = pool.length ? pool : conv.armyTypes;
      conv.neutralDefenders = Array.from({ length: neutralDefCount(conv.tax) }, () => {
        const dt = theOneMadeSure(draw[Math.floor(kcRng() * draw.length)]);
        return { type: dt, quality: 'Average', race: _race, unitName: theOneMadeSure(armyUnitName(dt)) };
      });
      conv.npcArmies = conv.neutralDefenders.length;
      conv.name = null; // renamed by the thematic naming pass below
    };
    for (let guard = 0; guard < 500; guard++) {
      const cnt: Partial<Record<string, number>> = {};
      RACES_P.forEach((r) => (cnt[r] = 0));
      _neutralHum().forEach((p) => {
        cnt[String(p.race)] = Number(cnt[String(p.race)]) + 1;
      });
      const order = shuffleP(RACES_P).sort((a, b) => Number(cnt[b]) - Number(cnt[a]));
      const hi = theOneMadeSure(order[0]),
        lo = theOneMadeSure(order[order.length - 1]);
      if (Number(cnt[hi]) - Number(cnt[lo]) <= 1) break;
      const movable = shuffleP(_neutralHum().filter((p) => p.race === hi && !_homeRing.has(p.id)));
      if (!movable.length) break;
      const pick = theOneMadeSure(
        movable.find((p) => SIGNATURE_TERRAIN_P[lo] === p.terrain) ??
          movable.find((p) => SIGNATURE_TERRAIN_P[hi] !== p.terrain) ??
          movable[0],
      );
      _reRace(pick, lo);
    }
  }

  // ── MINIMUM TAX FLOOR (2026-09-21) ── No LAND province may be worth 1 tax. The Poor band is
  // 2-3 everywhere it is rolled above, but terrain rolls, re-racing and future tailoring passes all
  // touch tax independently, so this single sweep is the authority: every land province is lifted to
  // at least 2 before garrisons are sized off its FINAL tax. Sea is deliberately exempt — open water
  // is pinned at tax 1 as the "worthless ocean" marker the home-coastal guarantee relies on.
  provinces.forEach((p) => {
    if (p.terrain !== 'sea' && (p.tax || 0) < THE_TAX_FLOOR.theLeastTaxOfALandProvince)
      p.tax = THE_TAX_FLOOR.theLeastTaxOfALandProvince;
  });

  // ── COASTAL SHIPYARDS (2026-09-21, Toby) ── EVERY humanoid land province that touches the sea offers
  // its race's fleet. The earlier passes gave one to COASTAL_NAVAL_CHANCE (80%) of coasts, and the
  // race-rebalance / re-race passes rebuild pools afterwards, so this final sweep is the authority.
  provinces.forEach((p) => {
    if (p.terrain === 'sea' || !humanoidRaces.has(p.race)) return;
    const coastal = neighbourCells(p.row, p.col).some((n) => {
      const q = provinces[n.id];
      return q?.terrain === 'sea';
    });
    if (!coastal) return;
    if (p.armyTypes.some((t) => fleetTypes.has(t))) return;
    const fleet = theOneMadeSure((fleetsByRace[String(p.race)] ?? ['Galleon Fleet'])[0]);
    p.armyTypes.push(fleet);
  });

  // ── NEUTRAL DEFENDER BAND AUDIT ────
  // Every defender pass rolls its count from the province's tax AT THE TIME, but three passes above
  // change a province's tax AFTERWARDS and do not rebuild the garrison:
  // • the home poor-neighbour force (`poorNbr.tax=rP(2,3)`) — a Rich/Prosperous province keeps
  // its 3-4 or 2-3 defenders while displaying as Poor;
  // • the home prosperous-neighbour force (`prospNbr.tax=rP(4,6)`) — a POOR province is promoted to
  // Prosperous and keeps its 1-2 defenders. This is the reported bug: a province the player is
  // shown as "Prosperous" defended by a single army.
  // • `_reRaceProvince` rebuilds correctly, but only fires when a pair member is non-humanoid or
  // has to be re-raced to the king's race, so it cannot be relied on to clean up after the above.
  // Rather than patch each mutation site (and have the next one reintroduce it), this single sweep
  // is the authority: after ALL world-gen tailoring and BEFORE the neutral-guard heroes take
  // command of these arrays, every neutral land province is brought inside the band its FINAL tax
  // demands. Rich (tax>=7) 3-4 · Prosperous (tax 4-6) 2-3 · Poor (tax 2-3) 1-2 — the same
  // thresholds as the player-facing wealth label. Provinces already in band are left exactly as
  // generated.
  provinces.forEach((p) => {
    if (p.owner === null && p.terrain !== 'sea') resyncNeutralDefenders(p);
  });

  // ── THE STRONGEST NEUTRAL MIX (2026-10-13, Toby item 13) ── With the count final, every neutral
  // land province fields the most effective mix of its own units (bestNeutralMix), the same number
  // of units, each slot keeping the quality it was dealt. A unit keeps its company name when its type
  // is unchanged. Primal provinces offer one beast and are left as they are.
  provinces.forEach((p) => {
    if (p.owner !== null || p.terrain === 'sea' || (p.race ?? '').startsWith('Primal')) return;
    const defs = p.neutralDefenders;
    if (!defs.length) return;
    const quals = defs
      .map((d) => d.quality || 'Average')
      .sort(
        (a, b) =>
          ((UNIT_Q_MULT[b] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone) -
          ((UNIT_Q_MULT[a] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone),
      );
    const mix = bestNeutralMix(p.armyTypes, quals, p.terrain, p.race);
    if (!mix) return;
    const left = defs.slice();
    p.neutralDefenders = mix.map((t, i) => {
      const k = left.findIndex((d) => d.type === t && (d.quality || 'Average') === quals[i]);
      if (k >= 0) return theOneMadeSure(left.splice(k, 1)[0]);
      return {
        type: t,
        quality: theOneMadeSure(quals[i]),
        race: theOneMadeSure(defs[0]).race || (p.race ?? '') || 'Human',
        unitName: theOneMadeSure(armyUnitName(t)),
      };
    });
    p.npcArmies = p.neutralDefenders.length;
  });

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
