// S3 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): PHASE 3, every province made. The
// Creature / Monster parity and the race deck, the terrain pre-pass (the tailored cells' terrain, the clustered fill,
// the sea share made exact), then each cell's province: its tax, whether it is wild, its people, its army pool, its
// features and lairs, a ritual site where a Pagan realm plays, and its neutral defenders, pushed onto the provinces'
// list in place.
import { MONSTERS_P, THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS } from '../../../content/kingdoms-call-data.ts';
import {
  THE_WILD_CREATURES_BY_TERRAIN,
  THE_WILD_MONSTERS_BY_TERRAIN,
} from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import {
  EACH_PROVINCE,
  THE_TAX_BANDS,
} from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import {
  isTheRaceOneOfTheWildsSubRaces,
  theWildsSubRaceOf,
} from '../../rules-on-plain-values/whether-a-race-is-the-wilds-or-one-of-its-sub-races.ts';
import { PRIMAL_LAND_CHANCE, RACES_P, buildHumanoidPool, provincePoolSize } from '../tables.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { SEA_GUARDIAN_NAMES } from '../../names.ts';
import { FEATURE_POOLS_P, RITUAL_SITE_CHANCE_HUMANOID, RITUAL_SITE_NAMES } from '../../items/tiers-and-hoards.ts';
import { neutralDefCount, rP } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { LAIR_TIER_ROLL } from '../../chances-and-lair-grades.ts';
import type { Army, ProvinceFeature } from '../../../schemas/saved-game-state.ts';
import {
  type ACellOfTheGrid,
  type ACellsTailoring,
  type AProvinceAsTheWorldIsMadeIt,
  type ATerrainOfTheMaking,
  theCardDealt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What every province's making reads: the set-up's (S0's) map size, provinces' list, sea share (as the GM gave it and
 *  as a fraction), Pagan flag, content tables, neighbours of a cell and pickLand, and each home's ring (S2): the
 *  tailored cells and the seas' fill rates. */
export interface WhatEveryProvincesMakingReads {
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly seaPct: number;
  readonly seaTarget: number;
  readonly hasPaganPlayer: boolean;
  readonly humanoidRaces: ReadonlySet<string | null | undefined>;
  readonly primalDefs: Readonly<Partial<Record<string, { readonly race?: string | undefined }>>>;
  readonly armiesByTerrainAndRace: Readonly<
    Partial<Record<string, Readonly<Partial<Record<string, readonly string[]>>>>>
  >;
  readonly featurePools: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly neighbourCells: (r: number, c: number) => ACellOfTheGrid[];
  readonly pickLand: () => ATerrainOfTheMaking;
  readonly constraint: Readonly<Partial<Record<number, ACellsTailoring>>>;
  readonly SEA_BASE_RATE: number;
  readonly SEA_CLUSTER_RATE: number;
}

/** S3, every province made: each cell of the map gets its province, pushed onto `provinces` in place, in the order of
 *  its id. It returns nothing: what the later stages read of it is the provinces' list. */
export function everyProvinceMadeItsTerrainTaxArmiesAndLairs({
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
}: WhatEveryProvincesMakingReads) {
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
        race = theWildsSubRaceOf((primalDefs[primalUnit]?.race ?? '') || primalUnit);
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
        const isPrimalProv = isTheRaceOneOfTheWildsSubRaces(race);
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
            race: (race ?? '') || THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS,
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
}
